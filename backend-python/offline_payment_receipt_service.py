"""线下支付单：来访确认预约后，管理工作台确认收款并取消置顶。"""
from datetime import datetime

from sqlalchemy.orm import Session

from models import AppAccount, AppMessage, AppOrder

OFFLINE_PAYMENT_DUE = "OFFLINE_PAYMENT_DUE"
STAFF_RECEIPT_ROLES = ("Admin", "Assistant", "Ops")


class OfflineReceiptError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def receipt_is_pending(order: AppOrder | None) -> bool:
    if order is None or not order.ProxyIsOfflinePayment:
        return False
    return order.ProxyOfflineReceiptConfirmedAt is None


def confirm_offline_payment_receipt(
    db: Session,
    account: AppAccount,
    message: AppMessage,
    operator_name: str,
) -> AppMessage:
    role = (getattr(account, "ActiveRole", None) or "").strip()
    if role not in STAFF_RECEIPT_ROLES:
        raise OfflineReceiptError(403, "仅管理员、咨询助理、咨询主任可以确认线下收款")
    if message.RelatedType != OFFLINE_PAYMENT_DUE:
        raise OfflineReceiptError(400, "该消息不是线下待付款消息")
    name = (operator_name or "").strip()
    if not name:
        raise OfflineReceiptError(400, "请填写确认收款操作人")
    if len(name) > 100:
        raise OfflineReceiptError(400, "确认收款操作人不超过100字")
    order = (
        db.query(AppOrder).filter(AppOrder.Id == message.RelatedId).first()
        if message.RelatedId
        else None
    )
    if order is None or not order.ProxyIsOfflinePayment:
        raise OfflineReceiptError(400, "未找到对应的线下支付订单")
    if order.ProxyOfflineReceiptConfirmedAt is not None:
        return message
    order.ProxyOfflineReceiptOperator = name
    order.ProxyOfflineReceiptByAccountId = account.Id
    order.ProxyOfflineReceiptByRole = role
    order.ProxyOfflineReceiptConfirmedAt = datetime.utcnow()
    db.commit()
    db.refresh(message)
    return message
