"""
微信支付业务编排：下单签名、查单同步入账、关单、申请退款。

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
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models import AppOrder
from wechat_pay_credentials import pay_credentials
from wechat_pay_metrics import inc as inc_pay_metric
from wechat_pay_v3 import WeChatPayV3Error, get_wechat_pay_client

logger = logging.getLogger(__name__)

_UNPAID_TRADE_STATES = {"NOTPAY", "CLOSED", "REVOKED", "PAYERROR"}
RECONCILE_INTERVAL_SECONDS = 10 * 60
RECONCILE_LOOKBACK = timedelta(days=7)
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


def sync_paid_order_from_wechat(db: Session, order: AppOrder) -> bool:
    """
    官方查单：GET /v3/pay/transactions/out-trade-no/{out_trade_no}
    若 trade_state=SUCCESS 则完成本地入账。返回是否已支付成功。
    """
    from payment_service import complete_paid_order

    if order.Status == "PAID":
        return True
    if not is_real_wechat_pay_configured():
        return False

    client = get_wechat_pay_client()
    data = client.query_by_out_trade_no(order.OutTradeNo)
    if data.get("trade_state") != "SUCCESS":
        return False

    amount = (data.get("amount") or {}).get("total")
    if amount is not None and int(amount) != int(order.TotalFee):
        raise ValueError("微信支付金额与本地订单不一致")

    center_id = None
    if order.Description and "center:" in order.Description:
        for part in order.Description.split("|"):
            if part.strip().lower().startswith("center:"):
                center_id = part.split(":", 1)[1].strip()
                break

    complete_paid_order(
        db,
        order,
        center_id=center_id,
        transaction_id=data.get("transaction_id"),
    )
    return True


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
    已支付必须交给入账后退款，不能当成关单成功。
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
    if not isinstance(data, dict):
        return {"trade_state": "QUERY_FAILED"}
    return data


def _mark_paid_from_trade(order: AppOrder, trade: dict) -> None:
    """只记录收款，不创建咨询、不占用排期。"""
    if order.Status != "PAID":
        order.Status = "PAID"
    if order.PaidAt is None:
        order.PaidAt = datetime.utcnow()
    transaction_id = str(trade.get("transaction_id") or "").strip()
    if transaction_id:
        order.TransactionId = transaction_id
    order.UpdatedAt = datetime.utcnow()


def _refund_recorded_payment(order: AppOrder) -> str:
    try:
        result = request_wechat_refund(
            order,
            reason="本地过期但微信已支付，自动退款",
        )
        if not refund_status_accepted(result):
            raise WeChatPayV3Error("退款未受理", body=str(result))
        apply_local_refund(order)
        logger.warning(
            "pay_desync auto refunded out_trade_no=%s order_id=%s",
            order.OutTradeNo,
            order.Id,
        )
        return "refunded"
    except Exception as exc:
        inc_pay_metric("pay_desync")
        logger.error(
            "pay_desync refund failed out_trade_no=%s order_id=%s status=%s err=%s",
            order.OutTradeNo,
            order.Id,
            order.Status,
            type(exc).__name__,
        )
        return "paid_refund_failed"


def refund_if_wechat_paid(
    db: Session,
    order: AppOrder,
    *,
    assume_paid: bool = False,
) -> str:
    """
    微信已收款：先记 PAID，再走现有退款，最终 REFUNDED。
    返回 refunded / paid_refund_failed / sync_failed / unpaid。
    入账或退款失败时保留可人工处理状态，调用方不得改成未支付取消。
    """
    _ = db
    if int(order.TotalFee or 0) <= 0 or bool(getattr(order, "ProxyIsOfflinePayment", False)):
        return "unpaid"
    tx = (order.TransactionId or "").strip()
    if tx.startswith("OFFLINE_") or tx.startswith("FREE_"):
        return "unpaid"

    trade = lookup_wechat_trade(order.OutTradeNo)
    if trade is None:
        return "unpaid"
    state = str(trade.get("trade_state") or "").upper()
    if state == "QUERY_FAILED":
        inc_pay_metric("pay_desync")
        logger.error(
            "pay_desync query failed out_trade_no=%s order_id=%s",
            order.OutTradeNo,
            order.Id,
        )
        return "sync_failed"
    if state == "REFUND":
        _mark_paid_from_trade(order, trade)
        apply_local_refund(order)
        inc_pay_metric("pay_desync")
        logger.warning(
            "pay_desync wechat REFUND local marked REFUNDED out_trade_no=%s order_id=%s",
            order.OutTradeNo,
            order.Id,
        )
        return "refunded"
    if state != "SUCCESS":
        if assume_paid or state not in _UNPAID_TRADE_STATES:
            inc_pay_metric("pay_desync")
            logger.error(
                "pay_desync refuse local cancel out_trade_no=%s order_id=%s trade_state=%s",
                order.OutTradeNo,
                order.Id,
                state or "empty",
            )
            return "sync_failed"
        return "unpaid"

    amount = (trade.get("amount") or {}).get("total")
    if amount is not None:
        try:
            amount_ok = int(amount) == int(order.TotalFee)
        except (TypeError, ValueError):
            amount_ok = False
        if not amount_ok:
            inc_pay_metric("pay_desync")
            logger.error(
                "pay_desync amount mismatch out_trade_no=%s order_id=%s",
                order.OutTradeNo,
                order.Id,
            )
            return "sync_failed"

    inc_pay_metric("pay_desync")
    logger.error(
        "pay_desync wechat SUCCESS local status=%s out_trade_no=%s order_id=%s",
        order.Status,
        order.OutTradeNo,
        order.Id,
    )
    _mark_paid_from_trade(order, trade)
    return _refund_recorded_payment(order)


def settle_expired_pending_order(db: Session, order: AppOrder) -> str:
    """关单前先查单。已支付则入账并退款；仅未支付/已关闭才交给本地取消。"""
    outcome = refund_if_wechat_paid(db, order)
    if outcome != "unpaid":
        return outcome
    close_result = close_wechat_order_quietly(order.OutTradeNo)
    if close_result == "already_paid":
        return refund_if_wechat_paid(db, order, assume_paid=True)
    return "unpaid"


def reconcile_wechat_paid_desync(db: Session) -> int:
    """
    每轮扫描近 7 天、未写 PaidAt、金额大于 0、状态为待支付或已取消的订单。
    已过期或已本地取消且微信 SUCCESS：入账后立即退款。
    仍在支付窗口内且微信 SUCCESS：走现有查单入账，避免把刚付完的订单退掉。
    """
    if not is_real_wechat_pay_configured():
        return 0
    from app_time import china_now

    cutoff = datetime.utcnow() - RECONCILE_LOOKBACK
    now_cn = china_now()
    rows = (
        db.query(AppOrder)
        .filter(
            AppOrder.Status.in_(("PENDING", "CANCELLED")),
            AppOrder.PaidAt.is_(None),
            AppOrder.TotalFee > 0,
            AppOrder.CreatedAt >= cutoff,
        )
        .order_by(AppOrder.Id.asc())
        .all()
    )
    refunded = 0
    for order in rows:
        try:
            tx = (order.TransactionId or "").strip()
            if order.ProxyIsOfflinePayment or tx.startswith("OFFLINE_") or tx.startswith("FREE_"):
                continue
            expired = bool(order.ExpiresAt and order.ExpiresAt < now_cn)
            if order.Status == "PENDING" and not expired:
                trade = lookup_wechat_trade(order.OutTradeNo)
                state = str((trade or {}).get("trade_state") or "").upper()
                if state == "SUCCESS":
                    inc_pay_metric("pay_desync")
                    logger.error(
                        "pay_desync unexpired pending wechat SUCCESS fulfill out_trade_no=%s order_id=%s",
                        order.OutTradeNo,
                        order.Id,
                    )
                    sync_paid_order_from_wechat(db, order)
                db.commit()
                continue
            outcome = refund_if_wechat_paid(db, order)
            if outcome in ("refunded", "paid_refund_failed"):
                from proxy_booking_service import release_unfulfilled_proxy_schedule

                release_unfulfilled_proxy_schedule(db, order)
            if outcome == "refunded":
                refunded += 1
            db.commit()
        except Exception:
            db.rollback()
            inc_pay_metric("pay_desync")
            logger.exception(
                "pay_desync reconcile failed out_trade_no=%s order_id=%s",
                order.OutTradeNo,
                order.Id,
            )
    return refunded


def start_wechat_pay_reconcile_loop() -> None:
    """后台每 10 分钟对账一次。"""
    global _reconcile_started
    if _reconcile_started:
        return
    _reconcile_started = True

    def _loop() -> None:
        while True:
            time.sleep(RECONCILE_INTERVAL_SECONDS)
            db = None
            try:
                from database import SessionLocal

                db = SessionLocal()
                count = reconcile_wechat_paid_desync(db)
                if count:
                    logger.warning("pay_desync reconcile refunded count=%s", count)
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
