"""订单支付前：来访与咨询师未签约时需签署心理咨询协议。"""
from typing import Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppOrder, AppSchedule


def order_schedule_counselor_id(db: Session, order: AppOrder) -> Optional[int]:
    if not order.SlotId:
        return None
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    if not schedule or not schedule.CounselorId:
        return None
    return int(schedule.CounselorId)


def is_signed_with_counselor(
    db: Session,
    account: AppAccount,
    counselor_id: int,
) -> bool:
    """来访与指定咨询师是否已签约（绑定时已按该咨询师历史支付记录同步状态）。"""
    bound_id = getattr(account, "BoundCounselorId", None)
    if not bound_id or int(bound_id) != int(counselor_id):
        return False
    return bool(getattr(account, "IsContractSigned", False))


def order_has_contract_agreement(order: AppOrder) -> bool:
    url = (getattr(order, "IntakeSignatureUrl", None) or "").strip()
    return bool(url) and getattr(order, "IntakeIsAdult", None) is not None


def needs_contract_agreement_for_order(
    db: Session,
    account: AppAccount,
    order: AppOrder,
) -> bool:
    counselor_id = order_schedule_counselor_id(db, order)
    if not counselor_id:
        return False
    return not is_signed_with_counselor(db, account, counselor_id)


def attach_contract_agreement_to_order(
    db: Session,
    account: AppAccount,
    order: AppOrder,
    *,
    is_adult: Optional[bool],
    signature_url: Optional[str],
) -> None:
    if not needs_contract_agreement_for_order(db, account, order):
        return
    if order_has_contract_agreement(order):
        return
    preset = getattr(order, "ProxyAgreementIsAdult", None)
    if preset is not None:
        if is_adult is not None and bool(is_adult) != bool(preset):
            raise ValueError("协议类型与助理推送的订单不一致，请刷新订单后重试")
        effective_adult = bool(preset)
    else:
        effective_adult = is_adult
    url = (signature_url or "").strip()
    if effective_adult is None or not url:
        raise ValueError("请先签署心理咨询协议")
    order.IntakeIsAdult = effective_adult
    order.IntakeSignatureUrl = url
    db.flush()


def assert_order_contract_agreement_ready(
    db: Session,
    account: AppAccount,
    order: AppOrder,
) -> None:
    if needs_contract_agreement_for_order(db, account, order) and not order_has_contract_agreement(order):
        raise ValueError("请先签署心理咨询协议后再支付")
