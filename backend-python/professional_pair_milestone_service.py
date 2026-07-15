"""来访者-专业咨询师配对：第 30 次正价咨询预约里程碑通知。"""
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from charity_milestone_service import _counselor_contact, _patient_display_name
from models import AppAccount, AppConsultation, AppCounselorProfile, AppMessage
from pricing_service import get_counselor_profile
from staff_message_service import _message_payload, notify_staff_workbench_inbox
from staff_remark_service import get_staff_remark

PROFESSIONAL_PAIR_MILESTONE_COUNT = 30
RELATED_TYPE_30TH_BOOKING = "PROFESSIONAL_PAIR_CONSULTATION_30_BOOKING"
PAIR_RELATED_ID_MULTIPLIER = 1_000_000


def pair_milestone_related_id(patient_id: int, counselor_id: int) -> int:
    return patient_id * PAIR_RELATED_ID_MULTIPLIER + counselor_id


def is_professional_consultation(db: Session, consultation: AppConsultation) -> bool:
    """正价咨询：专业咨询师（非公益咨询师）与来访的配对预约。"""
    profile = get_counselor_profile(db, consultation.CounselorId)
    return bool(profile and (profile.CounselorType or "PROFESSIONAL") == "PROFESSIONAL")


def _professional_pair_consultation_query(
    db: Session,
    patient_id: int,
    counselor_id: int,
):
    return (
        db.query(AppConsultation)
        .join(AppCounselorProfile, AppCounselorProfile.AccountId == AppConsultation.CounselorId)
        .filter(
            AppConsultation.PatientId == patient_id,
            AppConsultation.CounselorId == counselor_id,
            AppConsultation.Status != "CANCELLED",
            AppCounselorProfile.CounselorType == "PROFESSIONAL",
        )
    )


def count_professional_pair_bookings(
    db: Session,
    patient_id: int,
    counselor_id: int,
) -> int:
    return _professional_pair_consultation_query(db, patient_id, counselor_id).count()


def _pair_milestone_already_sent(
    db: Session,
    related_type: str,
    patient_id: int,
    counselor_id: int,
) -> bool:
    related_id = pair_milestone_related_id(patient_id, counselor_id)
    return (
        db.query(AppMessage)
        .filter(
            AppMessage.RelatedType == related_type,
            AppMessage.RelatedId == related_id,
        )
        .first()
        is not None
    )


def maybe_notify_professional_pair_30th_booking(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """来访与专业咨询师配对支付第 30 次正价咨询预约后，通知管理工作台全员。"""
    if not is_professional_consultation(db, consultation):
        return

    patient_id = consultation.PatientId
    counselor_id = consultation.CounselorId
    if (
        count_professional_pair_bookings(db, patient_id, counselor_id)
        != PROFESSIONAL_PAIR_MILESTONE_COUNT
    ):
        return

    if _pair_milestone_already_sent(
        db, RELATED_TYPE_30TH_BOOKING, patient_id, counselor_id
    ):
        from staff_message_service import sync_staff_workbench_inbox_messages

        sync_staff_workbench_inbox_messages(db)
        return

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    patient_name = _patient_display_name(patient)
    from patient_contract_service import patient_contract_extras

    patient_tag = patient_contract_extras(db, patient).get("contractTag")
    patient_label = f"{patient_name} {patient_tag}" if patient_tag else patient_name
    counselor_contact = _counselor_contact(db, counselor_id)
    counselor_name = counselor_contact.get("name") or "咨询师"
    counselor_staff_remark = get_staff_remark(db, counselor_id)

    title = "正价咨询第30次预约"
    summary = (
        f"{counselor_name}咨询师和{patient_label}来访即将开始第三十次预约，"
        f"请提示咨询师是否要调整抽成比例"
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
        "milestoneCount": PROFESSIONAL_PAIR_MILESTONE_COUNT,
        "pairBookingCount": PROFESSIONAL_PAIR_MILESTONE_COUNT,
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
        related_id=pair_milestone_related_id(patient_id, counselor_id),
    )
