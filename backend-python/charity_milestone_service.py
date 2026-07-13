"""公益咨询第 30 次里程碑：预约完成与咨询结束时的员工提示消息；来访者议价展示与通知。"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppConsultation, AppCounselorProfile, AppMessage
from pricing_service import get_counselor_profile
from staff_message_service import (
    _message_payload,
    notify_staff_workbench_inbox,
)
from staff_remark_service import get_staff_remark
from user_role_meta import CHARITY_PATIENT_SOURCES, is_charity_patient_source

CHARITY_MILESTONE_COUNT = 30
RELATED_TYPE_30TH_BOOKING = "CHARITY_CONSULTATION_30_BOOKING"
RELATED_TYPE_30TH_DONE = "CHARITY_CONSULTATION_30_DONE"
RELATED_TYPE_PATIENT_NEGOTIATION_TIP = "PATIENT_CHARITY_NEGOTIATION_TIP"
PATIENT_NEGOTIATION_TIP_TEXT = "在结束30次公益咨询后，请与咨询师进行议价，议价后方可再次预约"


def _patient_display_name(db: Session, account: Optional[AppAccount]) -> str:
    from patient_contract_service import patient_display_name

    return patient_display_name(db, account, with_contract_tag=False)


def _patient_contract_tag(db: Session, account: Optional[AppAccount]) -> Optional[str]:
    from patient_contract_service import patient_contract_extras

    return patient_contract_extras(db, account).get("contractTag") if account else None


def _counselor_display_name(db: Session, counselor_id: int) -> str:
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if acc:
        return acc.RealName or acc.Nickname or acc.Mobile or f"咨询师#{counselor_id}"
    return f"咨询师#{counselor_id}"


def _counselor_contact(db: Session, counselor_id: int) -> Dict[str, str]:
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    return {
        "counselorId": counselor_id,
        "name": _counselor_display_name(db, counselor_id),
        "phone": (acc.Mobile or "") if acc else "",
    }


def is_charity_consultation(db: Session, consultation: AppConsultation) -> bool:
    patient = db.query(AppAccount).filter(AppAccount.Id == consultation.PatientId).first()
    if not patient or not is_charity_patient_source(getattr(patient, "PatientSource", None)):
        return False
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == consultation.CounselorId)
        .first()
    )
    return bool(prof and (prof.CounselorType or "") == "CHARITY")


def _charity_consultation_query(db: Session, patient_id: int, *, done_only: bool = False):
    q = (
        db.query(AppConsultation)
        .join(AppCounselorProfile, AppCounselorProfile.AccountId == AppConsultation.CounselorId)
        .join(AppAccount, AppAccount.Id == AppConsultation.PatientId)
        .filter(
            AppConsultation.PatientId == patient_id,
            AppConsultation.Status != "CANCELLED",
            AppCounselorProfile.CounselorType == "CHARITY",
            AppAccount.PatientSource.in_(CHARITY_PATIENT_SOURCES),
        )
    )
    if done_only:
        q = q.filter(AppConsultation.Status == "DONE")
    return q


def count_charity_bookings(db: Session, patient_id: int) -> int:
    return _charity_consultation_query(db, patient_id, done_only=False).count()


def is_charity_patient(db: Session, patient_id: int) -> bool:
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    return bool(patient and is_charity_patient_source(getattr(patient, "PatientSource", None)))


def is_charity_counselor(db: Session, counselor_id: int) -> bool:
    profile = get_counselor_profile(db, counselor_id)
    return bool(profile and (profile.CounselorType or "") == "CHARITY")


def _any_charity_pair_negotiated(db: Session, patient_id: int) -> bool:
    from models import AppCounselorPatientPricing

    row = (
        db.query(AppCounselorPatientPricing.Id)
        .join(AppCounselorProfile, AppCounselorProfile.AccountId == AppCounselorPatientPricing.CounselorAccountId)
        .filter(
            AppCounselorPatientPricing.PatientAccountId == patient_id,
            AppCounselorProfile.CounselorType == "CHARITY",
        )
        .first()
    )
    return row is not None


def backfill_charity_negotiation_state(db: Session) -> int:
    """补齐历史配对定价数据：有调价记录但缺少议价时间戳的，视为已议价并进入议价阶段。"""
    from models import AppCounselorPatientPricing

    updated = 0
    rows = (
        db.query(AppCounselorPatientPricing)
        .join(AppCounselorProfile, AppCounselorProfile.AccountId == AppCounselorPatientPricing.CounselorAccountId)
        .join(AppAccount, AppAccount.Id == AppCounselorPatientPricing.PatientAccountId)
        .filter(
            AppCounselorProfile.CounselorType == "CHARITY",
            AppAccount.PatientSource.in_(CHARITY_PATIENT_SOURCES),
        )
        .all()
    )
    patient_ids: set[int] = set()
    for row in rows:
        patient_ids.add(int(row.PatientAccountId))
        if getattr(row, "CharityNegotiatedAt", None):
            continue
        row.CharityNegotiatedAt = row.UpdatedAt or row.CreatedAt or datetime.utcnow()
        updated += 1
    for patient_id in patient_ids:
        mark_charity_negotiation_phase_started(db, patient_id)
    if updated:
        db.flush()
    return updated


def mark_charity_negotiation_phase_started(db: Session, patient_id: int) -> None:
    """标记公益来访进入议价阶段（患者级，与配对议价完成无关）。"""
    if not is_charity_patient(db, patient_id):
        return
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not patient or getattr(patient, "CharityPricingNegotiatedAt", None):
        return
    patient.CharityPricingNegotiatedAt = datetime.utcnow()
    db.flush()


def charity_negotiation_phase_active(db: Session, patient_id: int) -> bool:
    """公益来访是否处于议价阶段（第30次预约/完成，或工作人员已开始配对议价）。"""
    if not is_charity_patient(db, patient_id):
        return False
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if patient and getattr(patient, "CharityPricingNegotiatedAt", None):
        return True
    if count_charity_bookings(db, patient_id) >= CHARITY_MILESTONE_COUNT:
        return True
    if count_charity_completed(db, patient_id) >= CHARITY_MILESTONE_COUNT:
        return True
    return _any_charity_pair_negotiated(db, patient_id)


def charity_milestone_reached(db: Session, patient_id: int) -> bool:
    """公益来访是否进入议价阶段（展示/预约限制用）。"""
    return charity_negotiation_phase_active(db, patient_id)


def has_charity_pair_pricing_negotiated(
    db: Session,
    patient_id: int,
    counselor_id: int,
) -> bool:
    """该来访与公益咨询师是否已完成议价（工作人员在定价管理保存过该配对）。"""
    if not is_charity_patient(db, patient_id) or not is_charity_counselor(db, counselor_id):
        return False
    from pricing_service import get_pricing_override

    row = get_pricing_override(db, counselor_id, patient_id)
    return row is not None


def charity_negotiation_price_active(db: Session, patient_id: int) -> bool:
    """公益来访是否处于第30次后的议价阶段（至少有一名公益咨询师仍未议价）。"""
    if not charity_negotiation_phase_active(db, patient_id):
        return False
    from models import AppCounselorProfile

    charity_counselor_ids = [
        int(r[0])
        for r in db.query(AppCounselorProfile.AccountId)
        .filter(AppCounselorProfile.CounselorType == "CHARITY", AppCounselorProfile.IsActive == True)
        .distinct()
        .all()
    ]
    return any(
        not has_charity_pair_pricing_negotiated(db, patient_id, cid)
        for cid in charity_counselor_ids
    )


def should_show_negotiation_price(db: Session, patient_id: int, counselor_id: int) -> bool:
    """第30次后仍展示实价（定价管理中的展示价），不再对来访者显示「议价」。"""
    _ = db, patient_id, counselor_id
    return False


def assert_charity_patient_can_book_charity(
    db: Session,
    patient_id: int,
    counselor_id: int,
) -> None:
    """第30次后来访者仍可预约公益咨询师；议价提示仅通过站内消息通知工作人员。"""
    _ = db, patient_id, counselor_id
    return


def mark_charity_pair_pricing_negotiated(
    db: Session,
    patient_id: int,
    counselor_id: int,
) -> None:
    from models import AppCounselorPatientPricing
    from pricing_service import get_pricing_override

    row = get_pricing_override(db, counselor_id, patient_id)
    if not row:
        row = AppCounselorPatientPricing(
            CounselorAccountId=counselor_id,
            PatientAccountId=patient_id,
        )
        db.add(row)
    if not getattr(row, "CharityNegotiatedAt", None):
        row.CharityNegotiatedAt = datetime.utcnow()
    db.flush()
    mark_charity_negotiation_phase_started(db, patient_id)


def mark_charity_pricing_negotiated(db: Session, patient_id: int) -> None:
    """患者级议价阶段标记（工作人员保存配对定价或第30次里程碑时写入）。"""
    mark_charity_negotiation_phase_started(db, patient_id)


def count_charity_completed(db: Session, patient_id: int) -> int:
    return _charity_consultation_query(db, patient_id, done_only=True).count()


def recent_charity_counselors(
    db: Session,
    patient_id: int,
    *,
    limit: int = 3,
    done_only: bool = False,
) -> List[Dict[str, str]]:
    rows = (
        _charity_consultation_query(db, patient_id, done_only=done_only)
        .order_by(AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
        .limit(limit)
        .all()
    )
    return [_counselor_contact(db, row.CounselorId) for row in rows]


def _format_recent_counselors_text(counselors: List[Dict[str, str]]) -> str:
    if not counselors:
        return "暂无最近公益咨询记录"
    parts = []
    for idx, item in enumerate(counselors, start=1):
        phone = item.get("phone") or "未填写"
        parts.append(f"{idx}. {item.get('name') or '咨询师'}（{phone}）")
    return "；".join(parts)


def _milestone_already_sent(db: Session, related_type: str, patient_id: int) -> bool:
    return (
        db.query(AppMessage)
        .filter(
            AppMessage.RelatedType == related_type,
            AppMessage.RelatedId == patient_id,
        )
        .first()
        is not None
    )


def maybe_notify_charity_30th_booking(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """公益来访支付第 30 次公益咨询预约费用后，通知咨询助理/主任/管理员议价。"""
    if not is_charity_consultation(db, consultation):
        return
    patient_id = consultation.PatientId
    if count_charity_bookings(db, patient_id) != CHARITY_MILESTONE_COUNT:
        return
    mark_charity_negotiation_phase_started(db, patient_id)

    if _milestone_already_sent(db, RELATED_TYPE_30TH_BOOKING, patient_id):
        from staff_message_service import sync_staff_workbench_inbox_messages

        sync_staff_workbench_inbox_messages(db)
        return

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    patient_name = _patient_display_name(db, patient)
    patient_tag = _patient_contract_tag(db, patient)
    patient_label = f"{patient_name} {patient_tag}" if patient_tag else patient_name
    counselor_id = consultation.CounselorId
    counselor_contact = _counselor_contact(db, counselor_id)
    counselor_name = counselor_contact.get("name") or "咨询师"
    counselor_staff_remark = get_staff_remark(db, counselor_id)

    title = "公益咨询第30次预约"
    summary = (
        f"{counselor_name}咨询师和{patient_label}来访即将开始第三十次公益咨询预约，"
        f"请提示咨询师议价"
    )
    detail: Dict[str, Any] = {
        "patientId": patient_id,
        "patientName": patient_name,
        "patientContractTag": patient_tag,
        "patientPhone": (patient.Mobile or "") if patient else "",
        "counselorId": counselor_id,
        "counselorName": counselor_name,
        "counselorPhone": counselor_contact.get("phone") or "",
        "counselorStaffRemark": counselor_staff_remark,
        "milestoneCount": CHARITY_MILESTONE_COUNT,
        "charityBookingCount": CHARITY_MILESTONE_COUNT,
        "consultationId": consultation.Id,
        "messageText": summary,
    }
    content = _message_payload(summary, detail)
    notify_staff_workbench_inbox(
        db,
        type_="ORDER",
        title=title,
        content=content,
        related_type=RELATED_TYPE_30TH_BOOKING,
        related_id=patient_id,
    )
    maybe_notify_patient_charity_30th_booking(db, consultation)


def maybe_notify_patient_charity_30th_booking(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """公益来访支付第 30 次公益咨询预约费用后，通知来访者议价提示。"""
    if not is_charity_consultation(db, consultation):
        return
    patient_id = consultation.PatientId
    if count_charity_bookings(db, patient_id) != CHARITY_MILESTONE_COUNT:
        return
    if _milestone_already_sent(db, RELATED_TYPE_PATIENT_NEGOTIATION_TIP, patient_id):
        return

    from patient_message_service import notify_patient_charity_negotiation_tip

    notify_patient_charity_negotiation_tip(db, patient_id, consultation.Id)


def maybe_notify_charity_30th_completion(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """公益来访完成第 30 次公益咨询后，通知咨询助理/主任/管理员。"""
    if not is_charity_consultation(db, consultation):
        return
    patient_id = consultation.PatientId
    if count_charity_completed(db, patient_id) != CHARITY_MILESTONE_COUNT:
        return
    mark_charity_negotiation_phase_started(db, patient_id)

    if _milestone_already_sent(db, RELATED_TYPE_30TH_DONE, patient_id):
        from staff_message_service import sync_staff_workbench_inbox_messages

        sync_staff_workbench_inbox_messages(db)
        return

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    patient_name = _patient_display_name(db, patient)
    patient_tag = _patient_contract_tag(db, patient)
    patient_label = f"{patient_name} {patient_tag}" if patient_tag else patient_name
    counselor_id = consultation.CounselorId
    counselor_contact = _counselor_contact(db, counselor_id)
    counselor_name = counselor_contact.get("name") or "咨询师"
    counselor_staff_remark = get_staff_remark(db, counselor_id)

    title = "公益咨询第30次完成"
    summary = (
        f"{counselor_name}咨询师和{patient_label}来访已完成第三十次公益咨询，"
        f"请询问咨询师调价情况"
    )
    detail: Dict[str, Any] = {
        "patientId": patient_id,
        "patientName": patient_name,
        "patientContractTag": patient_tag,
        "patientPhone": (patient.Mobile or "") if patient else "",
        "counselorId": counselor_id,
        "counselorName": counselor_name,
        "counselorPhone": counselor_contact.get("phone") or "",
        "counselorStaffRemark": counselor_staff_remark,
        "milestoneCount": CHARITY_MILESTONE_COUNT,
        "charityCompletedCount": CHARITY_MILESTONE_COUNT,
        "consultationId": consultation.Id,
        "messageText": summary,
    }
    content = _message_payload(summary, detail)
    notify_staff_workbench_inbox(
        db,
        type_="CONSULTATION",
        title=title,
        content=content,
        related_type=RELATED_TYPE_30TH_DONE,
        related_id=patient_id,
    )
