"""咨询记录修改申请：提交校验、管理员审核、消息通知。"""
import json
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app_time import china_now
from case_record_header_config import normalize_header_info
from case_record_risk_config import RISK_ASSESSMENT_ITEMS, apply_calculated_crisis_level, risk_choice_label
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


from staff_roles import staff_workbench_account_ids


def _ops_admin_account_ids(db: Session) -> List[int]:
    return staff_workbench_account_ids(db)


def _counselor_display_name(db: Session, counselor_id: int) -> str:
    prof = db.query(AppCounselorProfile).filter(AppCounselorProfile.AccountId == counselor_id).first()
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if acc:
        return acc.Nickname or acc.RealName or f"咨询师#{counselor_id}"
    return f"咨询师#{counselor_id}"


def _staff_display_name(db: Session, account_id: Optional[int]) -> Optional[str]:
    if not account_id:
        return None
    acc = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not acc:
        return f"工作人员#{account_id}"
    return acc.Nickname or acc.RealName or f"工作人员#{account_id}"


def _format_message_time(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%Y-%m-%d %H:%M")


_AMENDMENT_COMPARE_FIELDS = (
    ("subjective", "来访者主诉和当前状况", "Subjective", "text"),
    ("objective", "咨询师观察", "Objective", "text"),
    ("assessment", "评估", "Assessment", "text"),
    ("plan", "计划", "Plan", "text"),
    ("headerInfo", "表头信息", "HeaderInfo", "header"),
    ("riskAssessment", "个案风险评估表", "RiskAssessment", "risk"),
    ("photoUrls", "咨询记录照片", "PhotoUrls", "photos"),
)


def _normalize_text(value: Optional[str]) -> str:
    return (value or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def _normalize_risk_for_compare(raw) -> dict:
    data = decode_risk_assessment(raw) if isinstance(raw, str) else raw
    if isinstance(data, dict) and "items" not in data and any(
        key in data for key in (item["id"] for item in RISK_ASSESSMENT_ITEMS)
    ):
        data = {"items": data}
    completed = apply_calculated_crisis_level(data) or {"items": {}}
    items = completed.get("items") if isinstance(completed, dict) else {}
    if not isinstance(items, dict):
        return {}
    normalized: dict = {}
    for item in RISK_ASSESSMENT_ITEMS:
        val = items.get(item["id"])
        if not isinstance(val, dict):
            continue
        choice = str(val.get("choice") or "").strip().upper()
        note = str(val.get("note") or "").strip()
        if not choice:
            continue
        normalized[item["id"]] = {"choice": choice, "note": note}
    return normalized


def _format_normalized_risk_text(normalized: dict) -> str:
    if not normalized:
        return "—"
    lines: List[str] = []
    for item in RISK_ASSESSMENT_ITEMS:
        val = normalized.get(item["id"])
        if not val:
            continue
        choice = val["choice"]
        note = val["note"]
        display = risk_choice_label(item["id"], choice)
        note_choices = item.get("note_choices") or set()
        if note and choice in note_choices:
            display = f"{display}（{note}）"
        lines.append(f"{item['index']}. {item['label']}：{display}")
    return "\n".join(lines) if lines else "—"


def _format_header_info_text(data) -> str:
    header = normalize_header_info(data)
    return "\n".join(
        [
            f"代码：{header['code'] or '—'}",
            f"性别：{header['gender'] or '—'}",
            f"咨询方式：{header['consult_method'] or '—'}",
            f"咨询次数：第{header['session_number'] or '—'}次",
            (
                "咨询时间："
                f"{header['start_year'] or '—'}年{header['start_month'] or '—'}月{header['start_day'] or '—'}日 "
                f"{header['start_hour'] or '—'}时{header['start_minute'] or '—'}分 — "
                f"{header['end_hour'] or '—'}时{header['end_minute'] or '—'}分"
            ),
        ]
    )


def _format_photo_urls_text(urls: Optional[List[str]]) -> str:
    normalized = [url.strip() for url in (urls or []) if url and url.strip()]
    if not normalized:
        return "（无照片）"
    return "\n".join(f"{index + 1}. {url}" for index, url in enumerate(normalized))


def _collect_amendment_field_changes(
    record: AppCaseRecord,
    amendment: AppCaseRecordAmendmentRequest,
) -> List[dict]:
    changes: List[dict] = []
    for key, label, attr, kind in _AMENDMENT_COMPARE_FIELDS:
        if kind == "text":
            before = _normalize_text(getattr(record, attr))
            after = _normalize_text(getattr(amendment, attr))
            changed = before != after
            before_text = before or "—"
            after_text = after or "—"
        elif kind == "header":
            before_data = normalize_header_info(decode_header_info(record.HeaderInfo))
            after_data = normalize_header_info(decode_header_info(amendment.HeaderInfo))
            changed = before_data != after_data
            before_text = _format_header_info_text(before_data)
            after_text = _format_header_info_text(after_data)
        elif kind == "risk":
            before_data = _normalize_risk_for_compare(record.RiskAssessment)
            after_data = _normalize_risk_for_compare(amendment.RiskAssessment)
            changed = before_data != after_data
            before_text = _format_normalized_risk_text(before_data)
            after_text = _format_normalized_risk_text(after_data)
        else:
            before_urls = sorted(u.strip() for u in decode_photo_urls(record.PhotoUrls) if u and u.strip())
            after_urls = sorted(u.strip() for u in decode_photo_urls(amendment.PhotoUrls) if u and u.strip())
            changed = before_urls != after_urls
            before_text = _format_photo_urls_text(before_urls)
            after_text = _format_photo_urls_text(after_urls)
        if not changed:
            continue
        changes.append(
            {
                "key": key,
                "label": label,
                "before": before_text,
                "after": after_text,
            }
        )
    return changes


def _format_amendment_changes_text(
    changes: List[dict],
    reason: Optional[str] = None,
) -> str:
    reason_text = (reason or "").strip()
    if not changes and not reason_text:
        return "（无修改内容）"
    parts: List[str] = []
    if changes:
        labels = "、".join(change["label"] for change in changes)
        parts.append(f"变动字段：{labels}")
        for change in changes:
            parts.append(
                f"【{change['label']}】\n"
                f"修改前：\n{change['before']}\n\n"
                f"修改后：\n{change['after']}"
            )
    if reason_text:
        parts.append(f"【修改说明】\n{reason_text}")
    return "\n\n".join(parts)


def _build_amendment_message_detail(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    record: AppCaseRecord,
    *,
    status: str,
    consultation: Optional[AppConsultation] = None,
    approved: Optional[bool] = None,
    reject_reason: Optional[str] = None,
    changes: Optional[List[dict]] = None,
) -> dict:
    counselor_name = _counselor_display_name(db, amendment.CounselorId)
    start_time = ""
    if consultation and consultation.StartTime:
        start_time = consultation.StartTime.strftime("%Y-%m-%d %H:%M")
    field_changes = changes if changes is not None else _collect_amendment_field_changes(record, amendment)
    detail = {
        "status": status,
        "caseRecordId": record.Id,
        "consultationId": record.ConsultationId,
        "amendmentId": amendment.Id,
        "counselorName": counselor_name,
        "startTime": start_time or None,
        "submittedAt": _format_message_time(amendment.CreatedAt),
        "changedFieldLabels": [change["label"] for change in field_changes],
        "changes": field_changes,
        "changesText": _format_amendment_changes_text(field_changes, amendment.Reason),
        "reason": (amendment.Reason or "").strip() or None,
    }
    if approved is not None:
        detail["approved"] = approved
    if reject_reason:
        detail["rejectReason"] = reject_reason.strip()
    if amendment.ReviewedAt:
        detail["reviewedAt"] = _format_message_time(amendment.ReviewedAt)
        detail["reviewedByName"] = _staff_display_name(db, amendment.ReviewedBy)
    return detail


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

    # 修改表单暂不支持改照片时，沿用原记录照片，避免误判为「清空照片」
    resolved_photos = (
        photo_urls
        if photo_urls
        else decode_photo_urls(record.PhotoUrls)
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
        PhotoUrls=encode_photo_urls(resolved_photos or []),
        Reason=(reason or "").strip() or None,
        Status="PENDING",
    )
    db.add(row)
    db.flush()
    notify_admins_new_amendment(db, row, record)
    notify_counselor_amendment_submitted(db, row, record)
    return row


def notify_counselor_amendment_submitted(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    record: AppCaseRecord,
) -> None:
    consultation = (
        db.query(AppConsultation)
        .filter(AppConsultation.Id == record.ConsultationId)
        .first()
    )
    detail = _build_amendment_message_detail(
        db, amendment, record, status="SUBMITTED", consultation=consultation,
    )
    title = "咨询记录修改已提交待审核"
    summary = f"记录#{record.Id} 修改已提交，等待审核"
    if detail.get("submittedAt"):
        summary += f" · 提交于 {detail['submittedAt']}"
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    create_message(
        db,
        amendment.CounselorId,
        "SYSTEM",
        title,
        content,
        related_type="CASE_RECORD_AMENDMENT_SUBMITTED",
        related_id=amendment.Id,
    )


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
    submitted_at = _format_message_time(amendment.CreatedAt)
    if submitted_at:
        summary += f" · 提交于 {submitted_at}"
    detail = _build_amendment_message_detail(
        db, amendment, record, status="PENDING", consultation=consultation,
    )
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    from staff_message_service import notify_staff_workbench_inbox

    notify_staff_workbench_inbox(
        db,
        type_="SYSTEM",
        title=title,
        content=content,
        related_type="CASE_RECORD_AMENDMENT_PENDING",
        related_id=amendment.Id,
    )


def _update_admin_pending_messages(
    db: Session,
    amendment: AppCaseRecordAmendmentRequest,
    record: AppCaseRecord,
    *,
    approved: bool,
    reject_reason: Optional[str] = None,
    changes: Optional[List[dict]] = None,
) -> None:
    counselor_name = _counselor_display_name(db, amendment.CounselorId)
    reviewed_at = _format_message_time(amendment.ReviewedAt)
    if approved:
        title = "咨询记录修改已通过"
        summary = f"{counselor_name} · 记录#{amendment.CaseRecordId} · 已同意修改"
        if reviewed_at:
            summary += f" · 处理于 {reviewed_at}"
        detail = _build_amendment_message_detail(
            db, amendment, record, status="APPROVED", approved=True, changes=changes,
        )
    else:
        reason_text = (reject_reason or "").strip() or "未说明具体原因"
        title = "咨询记录修改已驳回"
        summary = f"{counselor_name} · 记录#{amendment.CaseRecordId} · {reason_text}"
        if reviewed_at:
            summary += f" · 处理于 {reviewed_at}"
        detail = _build_amendment_message_detail(
            db,
            amendment,
            record,
            status="REJECTED",
            approved=False,
            reject_reason=reason_text,
            changes=changes,
        )
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
    admin_ids = set(staff_workbench_account_ids(db))
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
    record: AppCaseRecord,
    *,
    approved: bool,
    reject_reason: Optional[str] = None,
    changes: Optional[List[dict]] = None,
) -> None:
    if approved:
        title = "咨询记录修改已通过"
        summary = "您的修改申请已审核通过，记录内容已更新。"
        detail = _build_amendment_message_detail(
            db, amendment, record, status="APPROVED", approved=True, changes=changes,
        )
    else:
        reason_text = (reject_reason or "").strip() or "未说明具体原因"
        title = "咨询记录修改已驳回"
        summary = f"驳回理由：{reason_text}"
        detail = _build_amendment_message_detail(
            db,
            amendment,
            record,
            status="REJECTED",
            approved=False,
            reject_reason=reason_text,
            changes=changes,
        )
    submitted_at = detail.get("submittedAt")
    reviewed_at = detail.get("reviewedAt")
    if submitted_at:
        summary += f" · 提交于 {submitted_at}"
    if reviewed_at:
        summary += f" · 处理于 {reviewed_at}"
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

    # 必须在覆盖记录前计算变更，否则审核结果消息会看不到修改前后对比
    field_changes = _collect_amendment_field_changes(record, amendment)
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
    record.UpdatedAt = china_now()

    now = china_now()
    amendment.Status = "APPROVED"
    amendment.ReviewedBy = admin_id
    amendment.ReviewedAt = now

    _update_admin_pending_messages(db, amendment, record, approved=True, changes=field_changes)
    notify_counselor_amendment_result(
        db, amendment, record, approved=True, changes=field_changes,
    )
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

    now = china_now()
    amendment.Status = "REJECTED"
    amendment.RejectReason = reject_reason.strip()
    amendment.ReviewedBy = admin_id
    amendment.ReviewedAt = now

    record = db.query(AppCaseRecord).filter(AppCaseRecord.Id == amendment.CaseRecordId).first()
    if not record:
        raise ValueError("关联咨询记录不存在")

    field_changes = _collect_amendment_field_changes(record, amendment)
    _update_admin_pending_messages(
        db,
        amendment,
        record,
        approved=False,
        reject_reason=reject_reason,
        changes=field_changes,
    )
    notify_counselor_amendment_result(
        db,
        amendment,
        record,
        approved=False,
        reject_reason=reject_reason,
        changes=field_changes,
    )
