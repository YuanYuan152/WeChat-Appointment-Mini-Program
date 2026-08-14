"""订单支付前：来访与咨询师未签约时需签署心理咨询协议。"""
import re
from typing import Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppOrder, AppSchedule


def normalize_emergency_fields(
    *,
    emergency_contact: Optional[str],
    emergency_relation: Optional[str],
    emergency_phone: Optional[str],
) -> tuple[str, str, str]:
    name = (emergency_contact or "").strip()
    relation = (emergency_relation or "").strip()
    phone = re.sub(r"[\s-]+", "", (emergency_phone or "").strip())
    if not name:
        raise ValueError("请填写紧急联系人姓名")
    if not relation:
        raise ValueError("请填写与紧急联系人的关系")
    if not phone:
        raise ValueError("请填写紧急联系人电话")
    if not re.fullmatch(r"1\d{10}", phone) and not re.fullmatch(r"0\d{2,3}\d{7,8}", phone):
        raise ValueError("请填写有效的紧急联系人电话")
    return name, relation, phone


def apply_emergency_contact_to_account(
    account: AppAccount,
    *,
    emergency_contact: Optional[str],
    emergency_relation: Optional[str],
    emergency_phone: Optional[str],
) -> None:
    name, relation, phone = normalize_emergency_fields(
        emergency_contact=emergency_contact,
        emergency_relation=emergency_relation,
        emergency_phone=emergency_phone,
    )
    account.EmergencyContact = name
    account.EmergencyRelation = relation
    account.EmergencyPhone = phone


def apply_real_name_to_account(
    account: AppAccount,
    *,
    real_name: Optional[str],
) -> None:
    """首单签约时补齐真实姓名；已有姓名不要求重复填写，也不允许在此覆盖。"""
    if (account.RealName or "").strip():
        return
    name = (real_name or "").strip()
    if not name:
        raise ValueError("请填写真实姓名")
    if len(name) > 50:
        raise ValueError("真实姓名不能超过50个字符")
    account.RealName = name


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
    """来访是否已与当前绑定咨询师完成签约。"""
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
    real_name: Optional[str] = None,
    emergency_contact: Optional[str] = None,
    emergency_relation: Optional[str] = None,
    emergency_phone: Optional[str] = None,
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
    apply_real_name_to_account(account, real_name=real_name)
    apply_emergency_contact_to_account(
        account,
        emergency_contact=emergency_contact,
        emergency_relation=emergency_relation,
        emergency_phone=emergency_phone,
    )
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
