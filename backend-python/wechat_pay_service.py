"""
微信支付业务编排：下单签名、查单同步入账、关单、申请退款、后台对账。

资金方向的原则（避免"用户没操作却被退款"）：
- 只有显式的取消/退款操作才会发起微信退款：来访取消预约、退款豁免审核通过、
  咨询师请假审核通过，见 consultation_cancel.py。
- 支付回调、主动查单、过期关单、员工取消待支付单、后台对账都只做"与微信对齐"：
  微信已收款 → 入账并尽量履约；履约条件已不满足 → 记为"已收款待人工处理"并通知助理；
  微信侧已退款 → 同步为已退款。这些路径永远不会发起退款。

未配置真实凭证时：
- 支付参数走 mock
- 退款仅更新本地订单状态（开发模拟）
"""

from __future__ import annotations

import hashlib
import logging
import random
import string
import threading
import time
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Callable, Iterator, Optional

from sqlalchemy import exists, text
from sqlalchemy.orm import Session

from booking_errors import BookingBusyError
from models import AppConsultation, AppOrder
from wechat_pay_credentials import pay_credentials
from wechat_pay_metrics import inc as inc_pay_metric
from wechat_pay_v3 import WeChatPayV3Error, get_wechat_pay_client

logger = logging.getLogger(__name__)

_UNPAID_TRADE_STATES = {"NOTPAY", "CLOSED", "REVOKED", "PAYERROR"}
# 本地确认、模拟支付、数据导入写入的交易号，不对应任何微信订单
_INTERNAL_TX_PREFIXES = ("SIM_", "DEV_", "MOCK_", "FREE_", "OFFLINE_", "IMPORT-")
_BOOKED_CONSULTATION_STATUSES = ("PENDING", "CONFIRMED", "ONGOING", "DONE")

RECONCILE_INTERVAL_SECONDS = 10 * 60
RECONCILE_INITIAL_DELAY_SECONDS = 60
# 未入账订单（待支付/已取消）回看窗口
RECONCILE_LOOKBACK = timedelta(days=7)
# "已收款待人工处理"订单回看窗口：等待工作人员在商户平台退款后同步状态
PAID_REVIEW_LOOKBACK = timedelta(days=30)
_RECONCILE_RUN_LOCK = "wechat-pay:reconcile"
_reconcile_started = False


def is_real_wechat_pay_configured() -> bool:
    """是否走官方真实支付。

    凭证齐全且未开启模拟开关时返回 True。
    本地/服务器任选其一即可强制模拟：WECHAT_PAY_FORCE_SIMULATE=true
    或部署文件里的 ALLOW_SIMULATED_PAYMENT=true。
    """
    from config import settings

    if settings.WECHAT_PAY_FORCE_SIMULATE or settings.ALLOW_SIMULATED_PAYMENT:
        return False
    return pay_credentials.is_real_configured()


def _random_nonce(length: int = 16) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def format_wechat_time_expire(dt: datetime) -> str:
    """微信 time_expire：rfc3339，东八区。"""
    return dt.strftime("%Y-%m-%dT%H:%M:%S+08:00")


def mock_pay_params(out_trade_no: str, total_fee: int) -> dict:
    nonce_str = _random_nonce()
    timestamp = str(int(time.time()))
    return {
        "appId": pay_credentials.appid or "wx_dev_placeholder",
        "timeStamp": timestamp,
        "nonceStr": nonce_str,
        "package": f"prepay_id=mock_{out_trade_no}",
        "signType": "RSA",
        "paySign": "MOCK_SIGN_"
        + hashlib.md5(f"{out_trade_no}{nonce_str}{total_fee}".encode()).hexdigest()[:16].upper(),
        "out_trade_no": out_trade_no,
    }


def build_jsapi_pay_params(
    *,
    out_trade_no: str,
    total_fee: int,
    description: str,
    openid: str,
    time_expire: Optional[str] = None,
) -> dict:
    """
    真实模式：调用 POST /v3/pay/transactions/jsapi 并签名调起参数。
    模拟模式：返回 mock pay_params。
    """
    if not openid and is_real_wechat_pay_configured():
        raise ValueError("缺少用户 openid，无法发起微信支付")
    if not is_real_wechat_pay_configured():
        return mock_pay_params(out_trade_no, total_fee)
    client = get_wechat_pay_client()
    return client.create_and_sign_jsapi_pay(
        out_trade_no=out_trade_no,
        description=description,
        total_fee=total_fee,
        openid=openid,
        time_expire=time_expire,
    )


# ---------------------------------------------------------------------------
# 订单判定
# ---------------------------------------------------------------------------

def order_center_id(order: AppOrder) -> Optional[str]:
    description = order.Description or ""
    if "center:" not in description:
        return None
    for part in description.split("|"):
        if part.strip().lower().startswith("center:"):
            return part.split(":", 1)[1].strip() or None
    return None


def is_wechat_settled_order(order: AppOrder) -> bool:
    """是否为需要与微信对账的在线支付单（排除免费单、线下支付单、本地模拟/导入单）。"""
    if int(order.TotalFee or 0) <= 0:
        return False
    if bool(getattr(order, "ProxyIsOfflinePayment", False)):
        return False
    tx = (order.TransactionId or "").strip()
    return not tx.startswith(_INTERNAL_TX_PREFIXES)


def order_has_booking(db: Session, order: AppOrder) -> bool:
    """订单是否已落成咨询单（含复用同排期已有咨询单的情况）。"""
    linked = (
        db.query(AppConsultation.Id)
        .filter(AppConsultation.OrderId == order.Id)
        .first()
    )
    if linked is not None:
        return True
    if not order.SlotId:
        return False
    return (
        db.query(AppConsultation.Id)
        .filter(
            AppConsultation.ScheduleId == order.SlotId,
            AppConsultation.PatientId == order.AccountId,
            AppConsultation.Status.in_(_BOOKED_CONSULTATION_STATUSES),
        )
        .first()
        is not None
    )


def order_payment_needs_review(db: Session, order: AppOrder) -> bool:
    """微信已收款但预约未生效，等待工作人员改约或退款。"""
    return (
        order.Status == "PAID"
        and is_wechat_settled_order(order)
        and not order_has_booking(db, order)
    )


def _is_expired(order: AppOrder) -> bool:
    from app_time import china_now

    return bool(order.ExpiresAt and order.ExpiresAt < china_now())


def _trade_amount_matches(order: AppOrder, trade: dict) -> bool:
    amount = (trade.get("amount") or {}).get("total")
    if amount is None:
        amount = trade.get("total_fee")
    if amount is None:
        return True
    try:
        return int(amount) == int(order.TotalFee)
    except (TypeError, ValueError):
        return False


def _trade_paid_at_utc(trade: dict) -> datetime:
    """微信 success_time（rfc3339）转为 UTC naive；缺失时取当前时间。"""
    raw = str(trade.get("success_time") or "").strip()
    if raw:
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            parsed = None
        if parsed is not None and parsed.tzinfo is not None:
            return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return datetime.utcnow()


def trade_state_of(trade: Optional[dict]) -> str:
    return str((trade or {}).get("trade_state") or "").upper()


# ---------------------------------------------------------------------------
# 微信接口封装（查单/关单失败不抛错，交给调用方按"状态未知"处理）
# ---------------------------------------------------------------------------

def wechat_error_already_paid(exc: WeChatPayV3Error) -> bool:
    blob = f"{exc}\n{exc.body}"
    upper = blob.upper()
    return "ORDERPAID" in upper or "ORDER_PAID" in upper or "已支付" in blob


def wechat_error_order_missing(exc: WeChatPayV3Error) -> bool:
    upper = f"{exc}\n{exc.body}".upper()
    return (
        "ORDERNOTEXIST" in upper
        or "ORDER_NOT_EXIST" in upper
        or exc.status_code == 404
    )


def close_wechat_order_quietly(out_trade_no: str) -> str:
    """
    超时/取消待支付时关闭微信侧订单。
    返回 closed / already_paid / skipped / error。
    already_paid 必须重新查单并按已收款入账，不能当成关单成功。
    """
    if not out_trade_no or not is_real_wechat_pay_configured():
        return "skipped"
    try:
        get_wechat_pay_client().close_order(out_trade_no)
        return "closed"
    except WeChatPayV3Error as exc:
        if wechat_error_already_paid(exc):
            inc_pay_metric("close_already_paid")
            logger.error(
                "close_already_paid out_trade_no=%s status=%s",
                out_trade_no,
                exc.status_code,
            )
            return "already_paid"
        logger.info("微信关单跳过 out_trade_no=%s: %s", out_trade_no, exc)
        return "error"
    except Exception as exc:  # 网络异常等
        logger.warning(
            "wechat close failed out_trade_no=%s err=%s",
            out_trade_no,
            type(exc).__name__,
        )
        return "error"


def lookup_wechat_trade(out_trade_no: str) -> Optional[dict]:
    """未配置真实支付时返回 None。订单不存在视为未支付。查单异常为 QUERY_FAILED。"""
    if not out_trade_no or not is_real_wechat_pay_configured():
        return None
    try:
        data = get_wechat_pay_client().query_by_out_trade_no(out_trade_no)
    except WeChatPayV3Error as exc:
        if wechat_error_order_missing(exc):
            return {"trade_state": "NOTPAY"}
        logger.error(
            "wechat query failed out_trade_no=%s status=%s",
            out_trade_no,
            exc.status_code,
        )
        return {"trade_state": "QUERY_FAILED"}
    except Exception as exc:  # 网络超时等，不能让查单失败中断调用方请求
        logger.error(
            "wechat query failed out_trade_no=%s err=%s",
            out_trade_no,
            type(exc).__name__,
        )
        return {"trade_state": "QUERY_FAILED"}
    if not isinstance(data, dict):
        return {"trade_state": "QUERY_FAILED"}
    return data


# ---------------------------------------------------------------------------
# 按微信结果对齐本地订单（从不发起退款）
# ---------------------------------------------------------------------------

def _lock_and_refresh(db: Session, order: AppOrder) -> None:
    """与支付落单、过期取消、换绑共用来访锁，串行化同一订单的状态变更后再读最新状态。"""
    from patient_contract_service import acquire_patient_contract_lock

    acquire_patient_contract_lock(db, order.AccountId)
    db.refresh(order)


def _mark_paid_from_trade(order: AppOrder, trade: dict) -> None:
    """只记录收款，不创建咨询、不占用排期。"""
    order.Status = "PAID"
    if order.PaidAt is None:
        order.PaidAt = _trade_paid_at_utc(trade)
    transaction_id = str(trade.get("transaction_id") or "").strip()
    if transaction_id:
        order.TransactionId = transaction_id
    order.UpdatedAt = datetime.utcnow()


def record_payment_for_review(
    db: Session,
    order: AppOrder,
    trade: dict,
    *,
    reason: str,
    source: str,
) -> bool:
    """微信已收款但预约无法生效：订单记为 PAID（不建咨询、不占排期），通知助理人工处理。

    不发起退款——改约还是退款由工作人员与来访沟通后决定；在微信支付商户平台退款后，
    后台对账会把订单同步为 REFUNDED。返回本次是否发生了状态变更（用于去重通知）。
    """
    _lock_and_refresh(db, order)
    if order.Status in ("PAID", "REFUNDED"):
        return False
    previous_status = order.Status
    _mark_paid_from_trade(order, trade)
    if previous_status == "PENDING":
        from proxy_booking_service import release_unfulfilled_proxy_schedule

        release_unfulfilled_proxy_schedule(db, order)
    db.flush()
    inc_pay_metric("pay_needs_review")
    logger.error(
        "pay_needs_review out_trade_no=%s order_id=%s previous=%s source=%s reason=%s",
        order.OutTradeNo,
        order.Id,
        previous_status,
        source,
        reason,
    )
    try:
        with db.begin_nested():
            from patient_message_service import notify_patient_payment_needs_review
            from staff_message_service import notify_staff_payment_needs_review

            notify_staff_payment_needs_review(db, order, reason=reason)
            notify_patient_payment_needs_review(db, order)
    except Exception:
        # 通知失败不影响收款记录；指标与日志已足够定位
        logger.exception(
            "pay_needs_review notify failed out_trade_no=%s order_id=%s",
            order.OutTradeNo,
            order.Id,
        )
    return True


def apply_wechat_paid_trade(
    db: Session,
    order: AppOrder,
    trade: dict,
    *,
    source: str,
) -> str:
    """微信确认已收款（查单 SUCCESS / 支付成功回调）后的唯一入账入口，从不退款。

    返回：
    - fulfilled：本次完成履约（PAID + 咨询单）
    - already_paid：本地已是 PAID（回调重推、并发重复处理）
    - already_refunded：本地已退款，不再改动
    - needs_review：已记录收款但预约无法生效，已通知助理人工处理
    - busy：并发锁超时，保持原状等下次同步（回调应答 5xx 让微信重推）
    - amount_mismatch：金额不一致，不做任何改动并告警

    调用方负责 commit。失败的履约尝试只回滚到 SAVEPOINT，不影响调用方事务里的其他改动。
    来访在微信支付窗口内付款即视为有效：本地 ExpiresAt 已过也照常履约。
    """
    from payment_service import complete_paid_order

    _lock_and_refresh(db, order)
    if order.Status == "PAID":
        return "already_paid"
    if order.Status == "REFUNDED":
        return "already_refunded"
    if not _trade_amount_matches(order, trade):
        inc_pay_metric("pay_desync")
        logger.error(
            "pay_desync amount mismatch out_trade_no=%s order_id=%s source=%s",
            order.OutTradeNo,
            order.Id,
            source,
        )
        return "amount_mismatch"

    if order.Status != "PENDING":
        reason = "订单已在本地取消后，微信才确认收款"
    else:
        transaction_id = str(trade.get("transaction_id") or "").strip() or None
        savepoint = db.begin_nested()
        try:
            complete_paid_order(
                db,
                order,
                center_id=order_center_id(order),
                transaction_id=transaction_id,
                enforce_lead_time=False,
            )
        except BookingBusyError:
            savepoint.rollback()
            logger.warning(
                "pay_sync busy out_trade_no=%s order_id=%s source=%s",
                order.OutTradeNo,
                order.Id,
                source,
            )
            return "busy"
        except ValueError as exc:
            savepoint.rollback()
            reason = str(exc) or "预约条件已变化"
        except Exception:
            savepoint.rollback()
            raise
        else:
            savepoint.commit()
            if source != "callback":
                logger.warning(
                    "pay_sync fulfilled out_trade_no=%s order_id=%s source=%s",
                    order.OutTradeNo,
                    order.Id,
                    source,
                )
            return "fulfilled"

    if record_payment_for_review(db, order, trade, reason=reason, source=source):
        return "needs_review"
    return "already_refunded" if order.Status == "REFUNDED" else "already_paid"


def sync_wechat_refunded_trade(
    db: Session,
    order: AppOrder,
    trade: dict,
    *,
    source: str,
) -> bool:
    """微信侧已退款（trade_state=REFUND，例如商户平台人工退款）：本地同步为 REFUNDED。

    这里只同步状态，不发起任何退款请求。返回本次是否发生了状态变更。
    """
    _lock_and_refresh(db, order)
    if order.Status == "REFUNDED":
        return False
    if order.Status == "PAID" and order_has_booking(db, order):
        # 已生效预约的退款应走取消预约流程；这里只告警，避免把有效预约误标为已退款
        inc_pay_metric("pay_desync")
        logger.error(
            "pay_desync wechat REFUND but local booking active out_trade_no=%s order_id=%s",
            order.OutTradeNo,
            order.Id,
        )
        return False
    previous_status = order.Status
    if order.PaidAt is None:
        order.PaidAt = _trade_paid_at_utc(trade)
    transaction_id = str(trade.get("transaction_id") or "").strip()
    if transaction_id:
        order.TransactionId = transaction_id
    apply_local_refund(order)
    if previous_status == "PENDING":
        from proxy_booking_service import release_unfulfilled_proxy_schedule

        release_unfulfilled_proxy_schedule(db, order)
    inc_pay_metric("pay_desync")
    logger.warning(
        "pay_desync wechat REFUND synced local REFUNDED out_trade_no=%s order_id=%s previous=%s source=%s",
        order.OutTradeNo,
        order.Id,
        previous_status,
        source,
    )
    return True


def apply_wechat_trade_state(
    db: Session,
    order: AppOrder,
    trade: Optional[dict],
    *,
    source: str,
    allow_fulfill: bool = True,
) -> str:
    """按微信查单结果对齐本地订单。返回 paid / refunded / unpaid / unknown。

    - paid：微信已收款，本地已入账（履约或待人工处理）；allow_fulfill=False 时仅判定不入账
    - refunded：微信侧已退款，本地已同步
    - unpaid：微信确认未支付（NOTPAY/CLOSED/REVOKED/PAYERROR 或订单不存在）
    - unknown：支付中、查单失败、并发忙、金额异常，必须保持原状等待下次同步
    """
    state = trade_state_of(trade)
    if state == "SUCCESS":
        if not allow_fulfill:
            return "paid"
        outcome = apply_wechat_paid_trade(db, order, trade or {}, source=source)
        if outcome in ("fulfilled", "already_paid", "needs_review"):
            return "paid"
        if outcome == "already_refunded":
            return "refunded"
        return "unknown"
    if state == "REFUND":
        sync_wechat_refunded_trade(db, order, trade or {}, source=source)
        return "refunded"
    if state in _UNPAID_TRADE_STATES:
        return "unpaid"
    return "unknown"


def sync_paid_order_from_wechat(db: Session, order: AppOrder) -> str:
    """
    来访付款后主动查单：GET /v3/pay/transactions/out-trade-no/{out_trade_no}
    按微信结果入账或同步，返回 paid / refunded / unpaid / unknown。
    查单失败抛 WeChatPayV3Error；从不发起退款。调用方负责 commit。
    """
    if order.Status == "PAID":
        return "paid"
    if not is_real_wechat_pay_configured():
        return "unpaid"
    trade = get_wechat_pay_client().query_by_out_trade_no(order.OutTradeNo)
    return apply_wechat_trade_state(db, order, trade, source="sync")


def settle_pending_order_before_cancel(
    db: Session,
    order: AppOrder,
    *,
    allow_fulfill: bool,
    source: str,
) -> str:
    """取消待支付订单前先与微信对齐，返回 unpaid / paid / refunded / unknown。

    只有 unpaid（微信确认未支付且已关单，或根本没有微信订单）才允许本地取消。
    """
    if not is_wechat_settled_order(order):
        return "unpaid"
    trade = lookup_wechat_trade(order.OutTradeNo)
    if trade is None:  # 未接真实支付
        return "unpaid"
    outcome = apply_wechat_trade_state(
        db, order, trade, source=source, allow_fulfill=allow_fulfill,
    )
    if outcome != "unpaid":
        return outcome
    if close_wechat_order_quietly(order.OutTradeNo) != "already_paid":
        return "unpaid"
    # 查单与关单之间来访刚好付完款：以微信为准重新对齐
    trade = lookup_wechat_trade(order.OutTradeNo)
    outcome = apply_wechat_trade_state(
        db, order, trade, source=source, allow_fulfill=allow_fulfill,
    )
    return "unknown" if outcome == "unpaid" else outcome


# ---------------------------------------------------------------------------
# 后台对账
# ---------------------------------------------------------------------------

@contextmanager
def _reconcile_run_guard(db: Session) -> Iterator[bool]:
    """多 worker 部署时同一轮只让一个进程对账（SQL Server 会话级应用锁，拿不到就跳过本轮）。"""
    bind = db.get_bind()
    engine = getattr(bind, "engine", bind)
    if engine is None or engine.dialect.name != "mssql":
        yield True
        return
    conn = engine.connect()
    acquired = False
    try:
        result = conn.execute(
            text(
                "SET NOCOUNT ON; DECLARE @result int; "
                "EXEC @result = sys.sp_getapplock "
                "@Resource=:resource, @LockMode='Exclusive', "
                "@LockOwner='Session', @LockTimeout=0; "
                "SELECT @result"
            ),
            {"resource": _RECONCILE_RUN_LOCK},
        ).scalar()
        acquired = result is not None and int(result) >= 0
        yield acquired
    finally:
        if acquired:
            try:
                conn.execute(
                    text(
                        "EXEC sys.sp_releaseapplock "
                        "@Resource=:resource, @LockOwner='Session'"
                    ),
                    {"resource": _RECONCILE_RUN_LOCK},
                )
            except Exception:
                # 释放失败时断开物理连接，会话级锁随连接一起释放
                conn.invalidate()
        conn.close()


def _reconcile_unpaid_order(db: Session, order_id: int) -> str:
    order = db.get(AppOrder, order_id)
    if order is None:
        return "missing"
    _lock_and_refresh(db, order)
    if (
        order.PaidAt is not None
        or order.Status not in ("PENDING", "CANCELLED")
        or not is_wechat_settled_order(order)
    ):
        return "skipped"
    if order.Status == "PENDING" and _is_expired(order):
        # 与请求触发的过期处理同一套逻辑：已付则入账，确认未付才关单取消
        from proxy_booking_service import cancel_pending_order

        outcome = cancel_pending_order(db, order, system=True)
    else:
        trade = lookup_wechat_trade(order.OutTradeNo)
        state = trade_state_of(trade)
        if state not in ("SUCCESS", "REFUND"):
            # 未过期待支付单可能仍在支付窗口内；已取消单未付款都无需处理
            return "query_failed" if state == "QUERY_FAILED" else "unchanged"
        outcome = apply_wechat_trade_state(db, order, trade, source="reconcile")
    if outcome == "paid" and order.Status == "PAID":
        return "needs_review" if order_payment_needs_review(db, order) else "fulfilled"
    return outcome


def _ensure_review_notified(db: Session, order: AppOrder) -> None:
    """历史遗留的"已收款未履约"订单（例如旧逻辑退款失败留下的）补发一次助理待处理消息。"""
    from models import AppMessage
    from staff_message_service import (
        PAYMENT_REVIEW_RELATED_TYPE,
        notify_staff_payment_needs_review,
    )

    notified = (
        db.query(AppMessage.Id)
        .filter(
            AppMessage.RelatedType == PAYMENT_REVIEW_RELATED_TYPE,
            AppMessage.RelatedId == order.Id,
        )
        .first()
    )
    if notified is not None:
        return
    try:
        with db.begin_nested():
            notify_staff_payment_needs_review(db, order, reason="微信已收款但预约未生效")
    except Exception:
        logger.exception(
            "pay_needs_review notify failed out_trade_no=%s order_id=%s",
            order.OutTradeNo,
            order.Id,
        )


def _reconcile_paid_review_order(db: Session, order_id: int) -> str:
    order = db.get(AppOrder, order_id)
    if order is None:
        return "missing"
    _lock_and_refresh(db, order)
    if not order_payment_needs_review(db, order):
        return "skipped"
    trade = lookup_wechat_trade(order.OutTradeNo)
    if trade_state_of(trade) == "REFUND":
        if sync_wechat_refunded_trade(db, order, trade or {}, source="reconcile"):
            return "refunded"
        return "unchanged"
    _ensure_review_notified(db, order)
    return "needs_review"


def _run_reconcile_step(
    db: Session,
    order_id: int,
    step: Callable[[Session, int], str],
) -> str:
    try:
        outcome = step(db, order_id)
        db.commit()
        return outcome
    except BookingBusyError:
        db.rollback()
        return "busy"
    except Exception:
        db.rollback()
        inc_pay_metric("pay_desync")
        logger.exception("pay_desync reconcile failed order_id=%s", order_id)
        return "error"


def reconcile_wechat_payments(db: Session) -> Counter:
    """
    后台对账：把本地订单与微信支付状态对齐，从不发起退款。

    1) 近 7 天未入账（PENDING/CANCELLED 且无 PaidAt）的在线支付单：
       - 微信 SUCCESS：待支付单照常履约（过期也一样）；履约条件不满足或本地已取消，
         记为"已收款待人工处理"并通知助理；
       - 微信 REFUND：同步为 REFUNDED；
       - 已过期且微信确认未支付：关单后本地取消（与请求触发的过期处理一致）；
       - 支付中 / 查单失败：不动，下一轮再查。
    2) 近 30 天"已收款待人工处理"的订单：微信侧已退款（商户平台人工退款）则同步为 REFUNDED。
    """
    stats: Counter = Counter()
    if not is_real_wechat_pay_configured():
        return stats
    with _reconcile_run_guard(db) as acquired:
        if not acquired:
            stats["skipped_other_worker"] += 1
            return stats
        now_utc = datetime.utcnow()
        unpaid_ids = [
            row[0]
            for row in db.query(AppOrder.Id)
            .filter(
                AppOrder.Status.in_(("PENDING", "CANCELLED")),
                AppOrder.PaidAt.is_(None),
                AppOrder.TotalFee > 0,
                AppOrder.CreatedAt >= now_utc - RECONCILE_LOOKBACK,
            )
            .order_by(AppOrder.Id.asc())
            .all()
        ]
        review_ids = [
            row[0]
            for row in db.query(AppOrder.Id)
            .filter(
                AppOrder.Status == "PAID",
                AppOrder.TotalFee > 0,
                AppOrder.PaidAt >= now_utc - PAID_REVIEW_LOOKBACK,
                ~exists().where(AppConsultation.OrderId == AppOrder.Id),
            )
            .order_by(AppOrder.Id.asc())
            .all()
        ]
        db.rollback()
        for order_id in unpaid_ids:
            stats[_run_reconcile_step(db, order_id, _reconcile_unpaid_order)] += 1
        for order_id in review_ids:
            stats[_run_reconcile_step(db, order_id, _reconcile_paid_review_order)] += 1
    return stats


def start_wechat_pay_reconcile_loop() -> None:
    """后台每 10 分钟对账一次（启动 1 分钟后先跑一轮）；多 worker 时同一轮只有一个进程执行。"""
    global _reconcile_started
    if _reconcile_started:
        return
    _reconcile_started = True

    def _loop() -> None:
        delay = RECONCILE_INITIAL_DELAY_SECONDS
        while True:
            time.sleep(delay)
            delay = RECONCILE_INTERVAL_SECONDS
            db = None
            try:
                from database import SessionLocal

                db = SessionLocal()
                stats = reconcile_wechat_payments(db)
                notable = {
                    key: value
                    for key, value in stats.items()
                    if key in ("fulfilled", "needs_review", "refunded", "cancelled", "paid", "error")
                }
                if notable:
                    logger.warning("pay_reconcile result %s", notable)
            except Exception:
                logger.exception("pay_desync reconcile loop failed")
                if db is not None:
                    db.rollback()
            finally:
                if db is not None:
                    db.close()

    threading.Thread(
        target=_loop,
        name="wechat-pay-reconcile",
        daemon=True,
    ).start()


# ---------------------------------------------------------------------------
# 退款（仅供显式取消/退款操作调用，见 consultation_cancel.py）
# ---------------------------------------------------------------------------

def make_out_refund_no(order: AppOrder) -> str:
    # 同一商户退款单号多次请求只退一笔；按商户订单号派生保证幂等
    return f"RF{order.OutTradeNo}"[:64]


def refund_status_accepted(result: Optional[dict]) -> bool:
    """退款申请受理成功（PROCESSING/SUCCESS）；到账终态以回调 SUCCESS 为准。"""
    if result is None:
        return True  # 模拟模式
    status = (result.get("status") or "").upper()
    return status in ("SUCCESS", "PROCESSING")


def request_wechat_refund(
    order: AppOrder,
    *,
    reason: str = "用户取消预约",
) -> Optional[dict]:
    """
    真实模式：POST /v3/refund/domestic/refunds，并 GET 查退款单确认受理状态。
    模拟模式：返回 None（由调用方仅改本地状态）。
    注意：返回 SUCCESS/PROCESSING 仅表示受理，资金到账以后续退款回调为准。
    只允许由显式的取消/退款操作调用；对账、过期、回调等同步路径不得调用。
    """
    if order.Status != "PAID":
        return None
    # 0 元免费单不走微信退款，仅本地关单
    if int(order.TotalFee or 0) <= 0:
        return None
    if not is_real_wechat_pay_configured():
        return None

    tx = (order.TransactionId or "").strip()
    if (
        tx.startswith("SIM_")
        or tx.startswith("DEV_")
        or tx.startswith("MOCK_")
        or         tx.startswith("FREE_")
        or tx.startswith("OFFLINE_")
    ):
        return None

    client = get_wechat_pay_client()
    out_refund_no = make_out_refund_no(order)
    try:
        result = client.refund(
            out_trade_no=order.OutTradeNo,
            out_refund_no=out_refund_no,
            refund_fee=int(order.TotalFee),
            total_fee=int(order.TotalFee),
            reason=reason,
            transaction_id=tx or None,
        )
    except WeChatPayV3Error as exc:
        # 重复退款等：用查退款确认是否已受理
        try:
            queried = client.query_refund(out_refund_no)
            status = (queried.get("status") or "").upper()
            if status in ("SUCCESS", "PROCESSING"):
                return queried
        except WeChatPayV3Error:
            pass
        raise

    # 官方：申请成功≠退款到账；再查一次确认受理状态
    try:
        confirmed = client.query_refund(out_refund_no)
        return confirmed
    except WeChatPayV3Error:
        return result


def apply_local_refund(order: AppOrder) -> None:
    order.Status = "REFUNDED"
    order.UpdatedAt = datetime.utcnow()


def confirm_refund_success_from_callback(order: AppOrder, *, refund_status: str) -> bool:
    """
    退款结果回调：仅 SUCCESS 视为资金退回终态并确保本地 REFUNDED。
    PROCESSING 不在此改状态（申请时已本地关单）；ABNORMAL/CLOSED 返回 False 供日志。
    """
    status = (refund_status or "").upper()
    if status == "SUCCESS":
        if order.Status in ("PAID", "REFUNDED"):
            apply_local_refund(order)
        return True
    return False
