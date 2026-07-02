"""退款豁免申请：提交校验、管理员审核、消息通知。"""
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from consultation_cancel import (
    can_visitor_cancel,
    cancel_consultation_for_visitor,
    is_refund_eligible,
)
from message import create_message
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppRefundExemption,
    AppRoleBinding,
)


def latest_exemptions_by_consultation(
    db: Session,
    consultation_ids: List[int],
    *,
    account_id: Optional[int] = None,
) -> Dict[int, AppRefundExemption]:
    if not consultation_ids:
        return {}
    q = db.query(AppRefundExemption).filter(
        AppRefundExemption.ConsultationId.in_(consultation_ids),
    )
    if account_id is not None:
        q = q.filter(AppRefundExemption.AccountId == account_id)
    rows = q.order_by(AppRefundExemption.CreatedAt.desc()).all()
    result: Dict[int, AppRefundExemption] = {}
    for row in rows:
        if row.ConsultationId not in result:
            result[row.ConsultationId] = row
    return result


def validate_exemption_submission(
    consultation: AppConsultation,
    *,
    patient_id: int,
    amount: int,
    reason: str,
    pending: Optional[AppRefundExemption],
) -> None:
    if consultation.PatientId != patient_id:
        raise ValueError("无权为该预约申请豁免")
    if not can_visitor_cancel(consultation.Status):
        raise ValueError("当前状态不可申请豁免")
    if is_refund_eligible(consultation.StartTime):
        raise ValueError("距咨询开始超过24小时，请直接取消预约即可退款，无需申请豁免")
    if not (reason or "").strip():
        raise ValueError("请填写申请原因")
    if amount <= 0:
        raise ValueError("申请金额须大于 0")
    if pending:
        raise ValueError("该预约已有待审核的豁免申请")


def _admin_account_ids(db: Session) -> List[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType.in_(["Admin", "Ops"]))
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _patient_display_name(db: Session, account_id: int) -> str:
    acc = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not acc:
        return "未留姓名用户"
    return acc.RealName or acc.Nickname or acc.Mobile or "未留姓名用户"


def _counselor_display_name(db: Session, counselor_id: int) -> str:
    prof = db.query(AppCounselorProfile).filter(AppCounselorProfile.AccountId == counselor_id).first()
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if acc:
        return acc.Nickname or acc.RealName or acc.Mobile or "未留姓名咨询师"
    return "未留姓名咨询师"


def notify_admins_new_exemption(
    db: Session,
    exemption: AppRefundExemption,
    consultation: AppConsultation,
) -> None:
    patient_name = _patient_display_name(db, exemption.AccountId)
    counselor_name = _counselor_display_name(db, consultation.CounselorId)
    amount_yuan = f"{exemption.Amount / 100:.2f}"
    title = "新的退款豁免申请待审核"
    summary = f"{patient_name} · {counselor_name} · ¥{amount_yuan}"
    detail = {
        "patientName": patient_name,
        "counselorName": counselor_name,
        "amountYuan": amount_yuan,
        "reason": exemption.Reason,
        "exemptionId": exemption.Id,
        "consultationId": exemption.ConsultationId,
        "status": "PENDING",
    }
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    for admin_id in _admin_account_ids(db):
        create_message(
            db,
            admin_id,
            "SYSTEM",
            title,
            content,
            related_type="REFUND_EXEMPTION_PENDING",
            related_id=exemption.Id,
        )


def notify_patient_exemption_result(
    db: Session,
    exemption: AppRefundExemption,
    *,
    approved: bool,
    reject_reason: Optional[str] = None,
) -> None:
    from patient_message_service import notify_patient_refund_exemption_result

    notify_patient_refund_exemption_result(
        db,
        exemption,
        approved=approved,
        reject_reason=reject_reason,
    )


def approve_refund_exemption(
    db: Session,
    exemption: AppRefundExemption,
    admin_id: int,
) -> Tuple[bool, str]:
    if exemption.Status != "PENDING":
        raise ValueError("该申请已处理，无法重复审核")

    consultation = (
        db.query(AppConsultation)
        .filter(AppConsultation.Id == exemption.ConsultationId)
        .first()
    )
    if not consultation:
        raise ValueError("关联咨询记录不存在")
    if not can_visitor_cancel(consultation.Status):
        raise ValueError("咨询状态已变更，无法通过豁免取消")

    refunded, cancel_msg = cancel_consultation_for_visitor(
        db,
        consultation,
        patient_id=exemption.AccountId,
        force_refund=True,
    )
    now = datetime.utcnow()
    exemption.Status = "APPROVED"
    exemption.ReviewedBy = admin_id
    exemption.ReviewedAt = now
    exemption.UpdatedAt = now
    exemption.RejectReason = None

    from staff_message_service import notify_staff_appointment_cancelled
    from counselor_message_service import notify_counselor_appointment_cancelled
    from patient_message_service import (
        cancel_patient_consultation_reminders,
        notify_patient_appointment_cancelled,
    )

    notify_patient_appointment_cancelled(
        db, consultation, refunded=refunded, cancelled_by="exemption",
    )
    notify_staff_appointment_cancelled(db, consultation, refunded=refunded)
    notify_counselor_appointment_cancelled(db, consultation, refunded=refunded)
    cancel_patient_consultation_reminders(db, consultation.Id)

    notify_patient_exemption_result(db, exemption, approved=True)
    return refunded, cancel_msg


def reject_refund_exemption(
    db: Session,
    exemption: AppRefundExemption,
    admin_id: int,
    reject_reason: str,
) -> None:
    if exemption.Status != "PENDING":
        raise ValueError("该申请已处理，无法重复审核")
    reason = (reject_reason or "").strip()
    if not reason:
        raise ValueError("请填写拒绝理由")

    now = datetime.utcnow()
    exemption.Status = "REJECTED"
    exemption.RejectReason = reason
    exemption.ReviewedBy = admin_id
    exemption.ReviewedAt = now
    exemption.UpdatedAt = now

    notify_patient_exemption_result(
        db,
        exemption,
        approved=False,
        reject_reason=reason,
    )
