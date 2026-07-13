"""来访者签约状态与绑定咨询师。"""
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppCounselorProfile, AppOrder, AppRoleBinding, AppSchedule


def _base_patient_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "来访者"
    return (account.RealName or account.Nickname or account.Mobile or "来访者").strip()


def _counselor_name(db: Session, counselor_id: Optional[int]) -> Optional[str]:
    if not counselor_id:
        return None
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if not acc:
        return f"咨询师#{counselor_id}"
    return acc.RealName or acc.Nickname or acc.Mobile or f"咨询师#{counselor_id}"


def patient_contract_tag(
    *,
    is_contract_signed: bool,
    bound_counselor_name: Optional[str],
) -> Optional[str]:
    if is_contract_signed and bound_counselor_name:
        return f"已签约-{bound_counselor_name}"
    return None


def effective_contract_signed(
    db: Session,
    account: Optional[AppAccount],
) -> bool:
    """是否签约：须已绑定咨询师且库内 IsContractSigned 为真（换绑后须重新签约）。"""
    if not account:
        return False
    if not getattr(account, "BoundCounselorId", None):
        return False
    return bool(getattr(account, "IsContractSigned", False))


def patient_contract_extras(db: Session, account: Optional[AppAccount]) -> Dict[str, Any]:
    if not account:
        return {
            "isContractSigned": False,
            "boundCounselorId": None,
            "boundCounselorName": None,
            "contractTag": None,
        }
    bound_id = getattr(account, "BoundCounselorId", None)
    is_signed = effective_contract_signed(db, account)
    bound_name = _counselor_name(db, bound_id)
    tag = patient_contract_tag(is_contract_signed=is_signed, bound_counselor_name=bound_name)
    return {
        "isContractSigned": is_signed,
        "boundCounselorId": bound_id,
        "boundCounselorName": bound_name,
        "contractTag": tag,
    }


def batch_patient_contract_extras(
    db: Session,
    accounts: list[AppAccount],
) -> Dict[int, Dict[str, Any]]:
    if not accounts:
        return {}
    counselor_ids = {
        int(getattr(a, "BoundCounselorId"))
        for a in accounts
        if getattr(a, "BoundCounselorId", None)
    }
    counselor_names: Dict[int, str] = {}
    if counselor_ids:
        profiles = (
            db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId.in_(counselor_ids))
            .all()
        )
        for prof in profiles:
            counselor_names[int(prof.AccountId)] = prof.Name or f"咨询师#{prof.AccountId}"
        missing = counselor_ids - set(counselor_names)
        if missing:
            for acc in db.query(AppAccount).filter(AppAccount.Id.in_(missing)).all():
                counselor_names[int(acc.Id)] = (
                    acc.RealName or acc.Nickname or acc.Mobile or f"咨询师#{acc.Id}"
                )

    patient_ids = [int(a.Id) for a in accounts]

    out: Dict[int, Dict[str, Any]] = {}
    for account in accounts:
        bound_id = getattr(account, "BoundCounselorId", None)
        is_signed = effective_contract_signed(db, account)
        bound_name = counselor_names.get(int(bound_id)) if bound_id else None
        out[int(account.Id)] = {
            "isContractSigned": is_signed,
            "boundCounselorId": bound_id,
            "boundCounselorName": bound_name,
            "contractTag": patient_contract_tag(
                is_contract_signed=is_signed,
                bound_counselor_name=bound_name,
            ),
        }
    return out


def patient_display_name(
    db: Session,
    account: Optional[AppAccount],
    *,
    with_contract_tag: bool = True,
) -> str:
    name = _base_patient_name(account)
    if not with_contract_tag or not account:
        return name
    extras = patient_contract_extras(db, account)
    tag = extras.get("contractTag")
    if tag:
        return f"{name} {tag}"
    return name


def bind_patient_counselor(
    db: Session,
    patient_id: int,
    counselor_id: Optional[int],
) -> AppAccount:
    """绑定/更换/解除签约咨询师。绑定关系变化时一律重置为未签约，须重新推送订单并签署协议。"""
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not patient:
        raise ValueError("来访者不存在")

    new_id = int(counselor_id) if counselor_id else None
    if new_id:
        binding = (
            db.query(AppRoleBinding)
            .filter(
                AppRoleBinding.AccountId == new_id,
                AppRoleBinding.RoleType == "Counselor",
            )
            .first()
        )
        if not binding:
            raise ValueError("咨询师不存在")
        profile = (
            db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == new_id, AppCounselorProfile.IsActive == True)
            .first()
        )
        if not profile:
            raise ValueError("咨询师档案不存在或已停用")

    old_id = getattr(patient, "BoundCounselorId", None)
    if old_id != new_id:
        patient.BoundCounselorId = new_id
        patient.IsContractSigned = False
    db.flush()
    return patient


def _paid_order_counselor_id(db: Session, order: AppOrder) -> Optional[int]:
    if not order.SlotId:
        return None
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    return int(schedule.CounselorId) if schedule and schedule.CounselorId else None


def sync_patient_contract_signed_from_orders(db: Session, patient_id: int) -> bool:
    """换绑后须重新签约，不再根据历史订单自动补标。"""
    return False


def maybe_mark_patient_contract_signed(db: Session, order: AppOrder) -> None:
    """支付成功后，若订单咨询师为当前绑定咨询师则标记为已签约。"""
    if order.Status == "PAID":
        return
    account = db.query(AppAccount).filter(AppAccount.Id == order.AccountId).first()
    if not account or not getattr(account, "BoundCounselorId", None):
        return

    counselor_id = _paid_order_counselor_id(db, order)
    bound_id = int(account.BoundCounselorId)
    if not counselor_id or counselor_id != bound_id:
        return

    account.IsContractSigned = True
    db.flush()


def patient_can_self_book_counselor(
    db: Session,
    account: Optional[AppAccount],
    counselor_id: int,
) -> bool:
    """来访已签约且当前咨询师为绑定咨询师时，方可自助预约。"""
    if not account:
        return False
    bound_id = getattr(account, "BoundCounselorId", None)
    if not bound_id or int(bound_id) != int(counselor_id):
        return False
    return effective_contract_signed(db, account)


def assert_patient_can_self_book(
    db: Session,
    patient_id: int,
    counselor_id: int,
) -> None:
    account = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if patient_can_self_book_counselor(db, account, counselor_id):
        return
    raise ValueError("您尚未完成签约绑定，请联系咨询助理完成首次预约")
