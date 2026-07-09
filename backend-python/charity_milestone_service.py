"""公益咨询第 30 次里程碑：预约完成与咨询结束时的员工提示消息；来访者议价展示与通知。"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import AppAccount, AppConsultation, AppCounselorProfile, AppMessage
from pricing_service import get_counselor_profile
from staff_message_service import (
    _message_payload,
    notify_staff_workbench_inbox,
)
from user_role_meta import CHARITY_PATIENT_SOURCES, is_charity_patient_source

CHARITY_MILESTONE_COUNT = 30
RELATED_TYPE_30TH_BOOKING = "CHARITY_CONSULTATION_30_BOOKING"
RELATED_TYPE_30TH_DONE = "CHARITY_CONSULTATION_30_DONE"
RELATED_TYPE_PATIENT_NEGOTIATION_TIP = "PATIENT_CHARITY_NEGOTIATION_TIP"
PATIENT_NEGOTIATION_TIP_TEXT = "在结束30次公益咨询后，请与咨询师进行议价，议价后方可再次预约"


def _patient_display_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "来访者"
    return account.RealName or account.Nickname or account.Mobile or "来访者"


def _counselor_display_name(db: Session, counselor_id: int) -> str:
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    return _patient_display_name(acc)


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


def charity_negotiation_price_active(db: Session, patient_id: int) -> bool:
    """公益来访已完成第 30 次公益咨询预约且尚未完成议价。"""
    if not is_charity_patient(db, patient_id):
        return False
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if patient and getattr(patient, "CharityPricingNegotiatedAt", None):
        return False
    return count_charity_bookings(db, patient_id) >= CHARITY_MILESTONE_COUNT


def should_show_negotiation_price(db: Session, patient_id: int, counselor_id: int) -> bool:
    if not charity_negotiation_price_active(db, patient_id):
        return False
    return is_charity_counselor(db, counselor_id)


def assert_charity_patient_can_book_charity(
    db: Session,
    patient_id: int,
    counselor_id: int,
) -> None:
    """议价完成前，禁止公益来访再次预约公益咨询师。"""
    if not is_charity_patient(db, patient_id) or not is_charity_counselor(db, counselor_id):
        return
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if patient and getattr(patient, "CharityPricingNegotiatedAt", None):
        return
    if count_charity_bookings(db, patient_id) >= CHARITY_MILESTONE_COUNT:
        raise HTTPException(
            status_code=403,
            detail="您已完成30次公益咨询，请与咨询师议价后再预约",
        )


def mark_charity_pricing_negotiated(db: Session, patient_id: int) -> None:
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not patient or getattr(patient, "CharityPricingNegotiatedAt", None):
        return
    patient.CharityPricingNegotiatedAt = datetime.utcnow()
    db.flush()


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
    if _milestone_already_sent(db, RELATED_TYPE_30TH_BOOKING, patient_id):
        from staff_message_service import sync_staff_workbench_inbox_messages

        sync_staff_workbench_inbox_messages(db)
        return

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    patient_name = _patient_display_name(patient)
    recent = recent_charity_counselors(db, patient_id, limit=3, done_only=False)
    counselors_text = _format_recent_counselors_text(recent)

    title = "公益咨询第30次预约"
    summary = f"{patient_name}已完成第三十次公益咨询的预约，请提示咨询师议价"
    detail: Dict[str, Any] = {
        "patientId": patient_id,
        "patientName": patient_name,
        "patientPhone": (patient.Mobile or "") if patient else "",
        "milestoneCount": CHARITY_MILESTONE_COUNT,
        "consultationId": consultation.Id,
        "recentCounselors": recent,
        "recentCounselorsText": counselors_text,
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
    if _milestone_already_sent(db, RELATED_TYPE_30TH_DONE, patient_id):
        from staff_message_service import sync_staff_workbench_inbox_messages

        sync_staff_workbench_inbox_messages(db)
        return

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    patient_name = _patient_display_name(patient)
    recent = recent_charity_counselors(db, patient_id, limit=3, done_only=True)
    counselors_text = _format_recent_counselors_text(recent)

    title = "公益咨询第30次完成"
    summary = f"{patient_name}来访已经完成30次公益咨询请询问咨询师调价情况"
    detail: Dict[str, Any] = {
        "patientId": patient_id,
        "patientName": patient_name,
        "patientPhone": (patient.Mobile or "") if patient else "",
        "milestoneCount": CHARITY_MILESTONE_COUNT,
        "consultationId": consultation.Id,
        "recentCounselors": recent,
        "recentCounselorsText": counselors_text,
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
