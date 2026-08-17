"""退款申请：提交校验、管理员审核、消息通知。"""
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import unquote, urlsplit

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
from staff_roles import staff_workbench_account_ids


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
    screenshot_url: str,
    pending: Optional[AppRefundExemption],
) -> None:
    if consultation.PatientId != patient_id:
        raise ValueError("无权为该预约申请退款")
    if not can_visitor_cancel(consultation.Status):
        raise ValueError("当前状态不可申请退款")
    if is_refund_eligible(consultation.StartTime):
        raise ValueError("距咨询开始超过24小时，请直接取消预约即可退款，无需另行申请")
    if not (reason or "").strip():
        raise ValueError("请填写申请原因")
    if amount <= 0:
        raise ValueError("申请金额须大于 0")
    validate_uploaded_screenshot_url(screenshot_url)
    if pending:
        raise ValueError("该预约已有待审核的退款申请")


def validate_uploaded_screenshot_url(screenshot_url: str) -> str:
    """仅接受统一上传 API 生成的图片地址。"""
    value = (screenshot_url or "").strip()
    if not value:
        raise ValueError("请上传退款申请凭证")
    if len(value) > 500:
        raise ValueError("退款申请凭证地址过长")

    parsed = urlsplit(value)
    if parsed.scheme and parsed.scheme.lower() not in ("http", "https"):
        raise ValueError("退款申请凭证地址无效")
    if (parsed.scheme and not parsed.netloc) or (not parsed.scheme and parsed.netloc):
        raise ValueError("退款申请凭证地址无效")
    if parsed.query or parsed.fragment:
        raise ValueError("退款申请凭证地址无效")

    path = unquote(parsed.path)
    if (
        not path.startswith("/static/uploads/")
        or path == "/static/uploads/"
        or "\\" in path
        or "\x00" in path
        or any(part in ("", ".", "..") for part in path[len("/static/uploads/"):].split("/"))
    ):
        raise ValueError("请使用上传接口返回的退款申请凭证地址")
    return value


def _admin_account_ids(db: Session) -> List[int]:
    return staff_workbench_account_ids(db)


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
    patient = db.query(AppAccount).filter(AppAccount.Id == exemption.AccountId).first()
    from patient_contract_service import patient_contract_extras

    patient_tag = patient_contract_extras(db, patient).get("contractTag")
    patient_label = f"{patient_name} {patient_tag}" if patient_tag else patient_name
    counselor_name = _counselor_display_name(db, consultation.CounselorId)
    amount_yuan = f"{exemption.Amount / 100:.2f}"
    title = "新的退款豁免申请待审核"
    summary = f"{patient_label} · {counselor_name} · ¥{amount_yuan}"
    detail = {
        "patientName": patient_name,
        "patientContractTag": patient_tag,
        "counselorName": counselor_name,
        "amountYuan": amount_yuan,
        "reason": exemption.Reason,
        "screenshotUrl": exemption.ScreenshotUrl,
        "exemptionId": exemption.Id,
        "consultationId": exemption.ConsultationId,
        "status": "PENDING",
    }
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    from staff_message_service import notify_staff_workbench_inbox

    notify_staff_workbench_inbox(
        db,
        type_="SYSTEM",
        title=title,
        content=content,
        related_type="REFUND_EXEMPTION_PENDING",
        related_id=exemption.Id,
    )
    from staff_message_service import push_staff_approval_subscribe

    push_staff_approval_subscribe(
        db,
        applicant=patient_name,
        biz_type="退款申请",
        apply_time=getattr(exemption, "CreatedAt", None),
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
        raise ValueError("咨询状态已变更，无法通过退款取消")

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
