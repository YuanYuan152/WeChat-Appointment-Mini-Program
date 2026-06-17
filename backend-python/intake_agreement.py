"""首次来访：年龄确认 + 心理咨询协议签署。"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppOrder


def needs_intake_agreement(db: Session, account: AppAccount) -> bool:
    """是否仍需完成首次协议签署（含年龄确认）。"""
    if getattr(account, "IntakeAgreementSignedAt", None):
        return False
    paid = (
        db.query(AppOrder)
        .filter(AppOrder.AccountId == account.Id, AppOrder.Status == "PAID")
        .first()
    )
    return paid is None


def attach_intake_to_order(
    db: Session,
    account: AppAccount,
    order: AppOrder,
    *,
    is_adult: Optional[bool],
    signature_url: Optional[str],
) -> None:
    """首次预约下单时校验并写入订单上的协议快照。"""
    if not needs_intake_agreement(db, account):
        return
    url = (signature_url or "").strip()
    if is_adult is None or not url:
        raise ValueError("首次预约需确认是否成年并签署心理咨询协议")
    order.IntakeIsAdult = is_adult
    order.IntakeSignatureUrl = url


def record_intake_from_order(db: Session, order: AppOrder) -> None:
    """支付成功后，将订单上的协议签署信息落库到账号。"""
    account = db.query(AppAccount).filter(AppAccount.Id == order.AccountId).first()
    if not account or getattr(account, "IntakeAgreementSignedAt", None):
        return
    url = (getattr(order, "IntakeSignatureUrl", None) or "").strip()
    if not url:
        return
    account.IntakeIsAdult = getattr(order, "IntakeIsAdult", None)
    account.IntakeSignatureUrl = url
    account.IntakeAgreementSignedAt = datetime.utcnow()
    account.UpdatedAt = datetime.utcnow()
