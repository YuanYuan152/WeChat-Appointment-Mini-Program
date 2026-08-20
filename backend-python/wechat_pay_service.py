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
import time
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import AppOrder
from wechat_pay_credentials import pay_credentials
from wechat_pay_v3 import WeChatPayV3Error, get_wechat_pay_client

logger = logging.getLogger(__name__)


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


def close_wechat_order_quietly(out_trade_no: str) -> None:
    """
    超时/取消待支付时关闭微信侧订单。
    已支付、已关闭等错误忽略，避免打断本地关单。
    """
    if not out_trade_no or not is_real_wechat_pay_configured():
        return
    try:
        get_wechat_pay_client().close_order(out_trade_no)
    except WeChatPayV3Error as exc:
        logger.info("微信关单跳过 out_trade_no=%s: %s", out_trade_no, exc)


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
        or tx.startswith("FREE_")
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
