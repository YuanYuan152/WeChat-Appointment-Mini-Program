"""咨询记录修改申请：提交校验、管理员审核、消息通知。"""
import json
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from case_record_service import (
    apply_case_record_fields,
    case_record_has_content,
    decode_photo_urls,
    encode_risk_assessment,
    decode_risk_assessment,
    encode_header_info,
    decode_header_info,
    save_case_record_revision,
    validate_case_record_required_fields,
    get_crisis_level_choice,
    notify_admins_crisis_report_if_needed,
)
from message import create_message
from models import (
    AppAccount,
    AppCaseRecord,
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppCounselorProfile,
    AppMessage,
    AppRoleBinding,
)


def _ops_admin_account_ids(db: Session) -> List[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType.in_(["Admin", "Ops"]))
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _counselor_display_name(db: Session, counselor_id: int) -> str:
    prof = db.query(AppCounselorProfile).filter(AppCounselorProfile.AccountId == counselor_id).first()
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if acc:
        return acc.Nickname or acc.RealName or f"咨询师#{counselor_id}"
    return f"咨询师#{counselor_id}"


def latest_amendment_for_record(
    db: Session,
    case_record_id: int,
) -> Optional[AppCaseRecordAmendmentRequest]:
    return (
        db.query(AppCaseRecordAmendmentRequest)
        .filter(AppCaseRecordAmendmentRequest.CaseRecordId == case_record_id)
        .order_by(AppCaseRecordAmendmentRequest.CreatedAt.desc())
        .first()
    )


def pending_amendment_for_record(
    db: Session,
    case_record_id: int,
) -> Optional[AppCaseRecordAmendmentRequest]:
    return (
        db.query(AppCaseRecordAmendmentRequest)
        .filter(
            AppCaseRecordAmendmentRequest.CaseRecordId == case_record_id,
            AppCaseRecordAmendmentRequest.Status == "PENDING",
        )
        .first()
    )


def submit_amendment_request(
    db: Session,
    record: AppCaseRecord,
    counselor_id: int,
    *,
    subjective: str,
    objective: str,
    assessment: str,
    plan: str,
    risk_assessment: dict,
    header_info: dict,
    photo_urls: Optional[List[str]] = None,
    reason: Optional[str] = None,
) -> AppCaseRecordAmendmentRequest:
    if record.CounselorId != counselor_id:
        raise HTTPException(status_code=403, detail="无权修改该咨询记录")
    if not case_record_has_content(record):
        raise HTTPException(status_code=400, detail="咨询记录尚未提交，请直接编辑保存")
    if pending_amendment_for_record(db, record.Id):
        raise HTTPException(status_code=400, detail="已有待审核的修改申请，请等待审核结果")

    from case_record_risk_config import apply_calculated_crisis_level
    from case_record_service import encode_photo_urls

    completed_risk = apply_calculated_crisis_level(risk_assessment)

    validate_case_record_required_fields(
        subjective=subjective,
        objective=objective,
        assessment=assessment,
        plan=plan,
        risk_assessment=completed_risk,
        header_info=header_info,
    )

    row = AppCaseRecordAmendmentRequest(
        CaseRecordId=record.Id,
        ConsultationId=record.ConsultationId,
        CounselorId=counselor_id,
        Subjective=subjective.strip(),
        Objective=objective.strip(),
        Assessment=assessment.strip(),
        Plan=plan.strip(),
        RiskAssessment=encode_risk_assessment(completed_risk),
        HeaderInfo=encode_header_info(header_info),
        PhotoUrls=encode_photo_urls(photo_urls or []),
        Reason=(reason or "").strip() or None,
        Status="PENDING",
    )
    db.add(row)
    db.flush()
    notify_admins_new_amendment(db, row, record)
    return row


def notify_admins_new_amendment(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    record: AppCaseRecord,
) -> None:
    consultation = (
        db.query(AppConsultation)
        .filter(AppConsultation.Id == record.ConsultationId)
        .first()
    )
    counselor_name = _counselor_display_name(db, amendment.CounselorId)
    start_time = consultation.StartTime.strftime("%Y-%m-%d %H:%M") if consultation and consultation.StartTime else ""
    title = "咨询记录修改申请待审核"
    summary = f"{counselor_name} · 记录#{record.Id}"
    if start_time:
        summary += f" · {start_time}"
    detail = {
        "counselorName": counselor_name,
        "caseRecordId": record.Id,
        "consultationId": record.ConsultationId,
        "amendmentId": amendment.Id,
        "status": "PENDING",
        "startTime": start_time or None,
    }
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    for admin_id in _ops_admin_account_ids(db):
        create_message(
            db,
            admin_id,
            "SYSTEM",
            title,
            content,
            related_type="CASE_RECORD_AMENDMENT_PENDING",
            related_id=amendment.Id,
        )


def _update_admin_pending_messages(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    *,
    approved: bool,
    reject_reason: Optional[str] = None,
) -> None:
    counselor_name = _counselor_display_name(db, amendment.CounselorId)
    if approved:
        title = "咨询记录修改已通过"
        summary = f"{counselor_name} · 记录#{amendment.CaseRecordId} · 已同意修改"
        detail = {"status": "APPROVED", "approved": True, "amendmentId": amendment.Id}
    else:
        reason_text = (reject_reason or "").strip() or "未说明具体原因"
        title = "咨询记录修改已驳回"
        summary = f"{counselor_name} · 记录#{amendment.CaseRecordId} · {reason_text}"
        detail = {
            "status": "REJECTED",
            "approved": False,
            "rejectReason": reason_text,
            "amendmentId": amendment.Id,
        }
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    rows = (
        db.query(AppMessage)
        .filter(
            AppMessage.RelatedId == amendment.Id,
            AppMessage.RelatedType.in_(["CASE_RECORD_AMENDMENT_PENDING", "CASE_RECORD_AMENDMENT"]),
        )
        .order_by(AppMessage.CreatedAt.asc())
        .all()
    )
    admin_ids = set(_ops_admin_account_ids(db))
    for row in rows:
        if row.AccountId not in admin_ids:
            continue
        row.Type = "SYSTEM"
        row.Title = title
        row.Content = content
        row.RelatedType = "CASE_RECORD_AMENDMENT"
        row.IsRead = False
        row.ReadAt = None


def notify_counselor_amendment_result(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    *,
    approved: bool,
    reject_reason: Optional[str] = None,
) -> None:
    if approved:
        title = "咨询记录修改已通过"
        summary = "您的修改申请已审核通过，记录内容已更新。"
        detail = {
            "status": "APPROVED",
            "approved": True,
            "caseRecordId": amendment.CaseRecordId,
            "amendmentId": amendment.Id,
        }
    else:
        reason_text = (reject_reason or "").strip() or "未说明具体原因"
        title = "咨询记录修改已驳回"
        summary = f"驳回理由：{reason_text}"
        detail = {
            "status": "REJECTED",
            "approved": False,
            "rejectReason": reason_text,
            "caseRecordId": amendment.CaseRecordId,
            "amendmentId": amendment.Id,
        }
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    create_message(
        db,
        amendment.CounselorId,
        "SYSTEM",
        title,
        content,
        related_type="CASE_RECORD_AMENDMENT",
        related_id=amendment.Id,
    )


def approve_amendment(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    admin_id: int,
) -> None:
    if amendment.Status != "PENDING":
        raise ValueError("该申请已处理，无法重复审核")

    record = db.query(AppCaseRecord).filter(AppCaseRecord.Id == amendment.CaseRecordId).first()
    if not record:
        raise ValueError("关联咨询记录不存在")

    old_crisis_choice = get_crisis_level_choice(decode_risk_assessment(record.RiskAssessment))
    save_case_record_revision(db, record, revised_by=amendment.CounselorId)
    apply_case_record_fields(
        record,
        subjective=amendment.Subjective,
        objective=amendment.Objective,
        assessment=amendment.Assessment,
        plan=amendment.Plan,
        risk_assessment=decode_risk_assessment(amendment.RiskAssessment),
        risk_assessment_set=True,
        header_info=decode_header_info(amendment.HeaderInfo),
        header_info_set=True,
        photo_urls=decode_photo_urls(amendment.PhotoUrls),
        photo_urls_set=True,
    )
    record.UpdatedAt = datetime.utcnow()

    now = datetime.utcnow()
    amendment.Status = "APPROVED"
    amendment.ReviewedBy = admin_id
    amendment.ReviewedAt = now

    _update_admin_pending_messages(db, amendment, approved=True)
    notify_counselor_amendment_result(db, amendment, approved=True)
    notify_admins_crisis_report_if_needed(
        db,
        record,
        counselor_id=amendment.CounselorId,
        old_crisis_choice=old_crisis_choice,
    )


def reject_amendment(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    admin_id: int,
    reject_reason: str,
) -> None:
    if amendment.Status != "PENDING":
        raise ValueError("该申请已处理，无法重复审核")
    if not (reject_reason or "").strip():
        raise ValueError("请填写驳回理由")

    now = datetime.utcnow()
    amendment.Status = "REJECTED"
    amendment.RejectReason = reject_reason.strip()
    amendment.ReviewedBy = admin_id
    amendment.ReviewedAt = now

    _update_admin_pending_messages(db, amendment, approved=False, reject_reason=reject_reason)
    notify_counselor_amendment_result(
        db,
        amendment,
        approved=False,
        reject_reason=reject_reason,
    )
