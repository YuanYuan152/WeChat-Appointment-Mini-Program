"""咨询记录（个案记录）序列化与版本留存。"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from case_record_risk_config import (
    RISK_ITEM_IDS,
    RISK_ITEM_BY_ID,
    VALID_CHOICES,
    get_crisis_level_choice,
    crisis_level_text_only,
    risk_item_allowed_choices,
    risk_item_note_required,
    normalize_risk_choice,
    should_notify_crisis_report,
)
from message import create_message
from case_record_header_config import (
    empty_header_info,
    header_info_is_complete,
    normalize_header_info,
    validate_header_info,
)
from models import (
    AppAccount,
    AppCaseRecord,
    AppCaseRecordRevision,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
)


def encode_photo_urls(urls: Optional[List[str]]) -> Optional[str]:
    if not urls:
        return None
    cleaned = [u.strip() for u in urls if u and u.strip()]
    return json.dumps(cleaned, ensure_ascii=False) if cleaned else None


def decode_photo_urls(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(u) for u in data if u]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def encode_risk_assessment(data: Optional[Dict[str, Any]]) -> Optional[str]:
    if not data:
        return None
    return json.dumps(data, ensure_ascii=False)


def decode_risk_assessment(raw: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return None


def risk_assessment_is_complete(data: Optional[Dict[str, Any]]) -> bool:
    if not data or not isinstance(data, dict):
        return False
    items = data.get("items")
    if not isinstance(items, dict):
        return False
    for item_id in RISK_ITEM_IDS:
        val = items.get(item_id)
        if not isinstance(val, dict):
            return False
        choice = normalize_risk_choice(str(val.get("choice") or "").strip().upper(), item_id)
        if choice not in risk_item_allowed_choices(item_id):
            return False
        if risk_item_note_required(item_id, choice) and not str(val.get("note") or "").strip():
            return False
    return True


def validate_risk_assessment(data: Optional[Dict[str, Any]]) -> None:
    if not risk_assessment_is_complete(data):
        if not data or not isinstance(data, dict) or not isinstance(data.get("items"), dict):
            raise HTTPException(status_code=400, detail="请完成个案风险评估表")
        items = data["items"]
        for item_id in RISK_ITEM_IDS:
            cfg = RISK_ITEM_BY_ID[item_id]
            val = items.get(item_id) or {}
            choice = normalize_risk_choice(str(val.get("choice") or "").strip().upper(), item_id)
            if choice not in risk_item_allowed_choices(item_id):
                raise HTTPException(status_code=400, detail=f"请选择：{cfg['label']}")
            if risk_item_note_required(item_id, choice) and not str(val.get("note") or "").strip():
                raise HTTPException(status_code=400, detail=f"请填写：{cfg['label']}说明")
        raise HTTPException(status_code=400, detail="请完成个案风险评估表")


def encode_header_info(data: Optional[Dict[str, Any]]) -> Optional[str]:
    if not data:
        return None
    normalized = normalize_header_info(data)
    if not any(normalized.values()):
        return None
    return json.dumps(normalized, ensure_ascii=False)


def decode_header_info(raw: Optional[str]) -> Optional[Dict[str, str]]:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return normalize_header_info(data)
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return None


def _dt_parts(dt: Optional[datetime]) -> Dict[str, str]:
    if not dt:
        return {"year": "", "month": "", "day": "", "hour": "", "minute": ""}
    return {
        "year": str(dt.year),
        "month": str(dt.month),
        "day": str(dt.day),
        "hour": str(dt.hour).zfill(2),
        "minute": str(dt.minute).zfill(2),
    }


def _resolve_consult_center_id(
    schedule: Optional[AppSchedule],
    order: Optional[AppOrder],
) -> Optional[str]:
    from schedule_meta import parse_center_id

    if schedule and schedule.Note:
        center_id = parse_center_id(schedule.Note)
        if center_id:
            return center_id
    if order and order.Description:
        for part in str(order.Description).split("|"):
            if part.strip().lower().startswith("center:"):
                return part.split(":", 1)[1].strip()
    return None


def _session_number(
    db: Session,
    consultation: AppConsultation,
) -> str:
    rows = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.PatientId == consultation.PatientId,
            AppConsultation.CounselorId == consultation.CounselorId,
            AppConsultation.Status.in_(["CONFIRMED", "ONGOING", "DONE"]),
        )
        .order_by(AppConsultation.StartTime.asc(), AppConsultation.Id.asc())
        .all()
    )
    for idx, row in enumerate(rows, start=1):
        if row.Id == consultation.Id:
            return str(idx)
    return str(len(rows) + 1)


def build_default_header_info(
    db: Session,
    consultation: AppConsultation,
    schedule: Optional[AppSchedule],
    counselor_id: int,
) -> Dict[str, str]:
    from schedule_meta import center_display_name

    patient = db.query(AppAccount).filter(AppAccount.Id == consultation.PatientId).first()
    counselor_profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    order = (
        db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
        if consultation.OrderId
        else None
    )
    start_dt = (schedule.StartTime if schedule else None) or consultation.StartTime
    end_dt = (schedule.EndTime if schedule else None) or consultation.EndTime
    start_parts = _dt_parts(start_dt)
    end_parts = _dt_parts(end_dt)
    center_id = _resolve_consult_center_id(schedule, order)

    header = empty_header_info()
    header["code"] = str(patient.Id) if patient else ""
    header["gender"] = (patient.Gender or "").strip() if patient else ""
    header["consult_method"] = center_display_name(center_id) or ""
    header["session_number"] = _session_number(db, consultation)
    header["start_year"] = start_parts["year"]
    header["start_month"] = start_parts["month"]
    header["start_day"] = start_parts["day"]
    header["start_hour"] = start_parts["hour"]
    header["start_minute"] = start_parts["minute"]
    header["end_hour"] = end_parts["hour"]
    header["end_minute"] = end_parts["minute"]
    header["counselor_signature"] = (counselor_profile.Name or "").strip() if counselor_profile else ""
    return header


def snapshot_case_record(record: AppCaseRecord) -> Dict[str, Any]:
    return {
        "subjective": record.Subjective,
        "objective": record.Objective,
        "assessment": record.Assessment,
        "plan": record.Plan,
        "risk_assessment": decode_risk_assessment(record.RiskAssessment),
        "header_info": decode_header_info(record.HeaderInfo),
        "photo_urls": decode_photo_urls(record.PhotoUrls),
    }


def save_case_record_revision(
    db: Session,
    record: AppCaseRecord,
    *,
    revised_by: int,
) -> None:
    db.add(
        AppCaseRecordRevision(
            CaseRecordId=record.Id,
            ConsultationId=record.ConsultationId,
            CounselorId=record.CounselorId,
            Subjective=record.Subjective,
            Objective=record.Objective,
            Assessment=record.Assessment,
            Plan=record.Plan,
            RiskAssessment=record.RiskAssessment,
            HeaderInfo=record.HeaderInfo,
            PhotoUrls=record.PhotoUrls,
            RevisedAt=datetime.utcnow(),
            RevisedBy=revised_by,
        )
    )


def validate_case_record_required_fields(
    *,
    subjective: Optional[str] = None,
    objective: Optional[str] = None,
    assessment: Optional[str] = None,
    plan: Optional[str] = None,
    risk_assessment: Optional[Dict[str, Any]] = None,
    header_info: Optional[Dict[str, Any]] = None,
) -> None:
    """表头、四项文字内容与风险评估表为必填。"""
    validate_header_info(header_info)
    labels = {
        "subjective": "来访者的主观描述",
        "objective": "对来访者客观描述",
        "assessment": "咨询师对个案的风险等级评估、以及对来访者的问题和咨询过程的评估",
        "plan": "本次咨询要点及处理",
    }
    values = {
        "subjective": subjective,
        "objective": objective,
        "assessment": assessment,
        "plan": plan,
    }
    missing = [labels[key] for key, val in values.items() if not (val or "").strip()]
    if missing:
        raise HTTPException(status_code=400, detail=f"请填写：{'、'.join(missing)}")
    validate_risk_assessment(risk_assessment)


def reject_if_case_record_locked(record: Optional[AppCaseRecord]) -> None:
    """已提交的咨询记录不允许咨询师再修改。"""
    if record and case_record_has_content(record):
        raise HTTPException(status_code=403, detail="咨询记录已提交，不可修改")


def case_record_has_content(record: Optional[AppCaseRecord]) -> bool:
    if not record:
        return False
    photo_count = len(decode_photo_urls(record.PhotoUrls))
    return bool(
        (record.Subjective or "").strip()
        or (record.Objective or "").strip()
        or (record.Assessment or "").strip()
        or (record.Plan or "").strip()
        or risk_assessment_is_complete(decode_risk_assessment(record.RiskAssessment))
        or header_info_is_complete(decode_header_info(record.HeaderInfo))
        or photo_count > 0
    )


def apply_case_record_fields(
    record: AppCaseRecord,
    *,
    subjective: Optional[str] = None,
    objective: Optional[str] = None,
    assessment: Optional[str] = None,
    plan: Optional[str] = None,
    risk_assessment: Optional[Dict[str, Any]] = None,
    risk_assessment_set: bool = False,
    header_info: Optional[Dict[str, Any]] = None,
    header_info_set: bool = False,
    photo_urls: Optional[List[str]] = None,
    photo_urls_set: bool = False,
) -> None:
    if subjective is not None:
        record.Subjective = subjective
    if objective is not None:
        record.Objective = objective
    if assessment is not None:
        record.Assessment = assessment
    if plan is not None:
        record.Plan = plan
    if risk_assessment_set:
        record.RiskAssessment = encode_risk_assessment(risk_assessment)
    if header_info_set:
        record.HeaderInfo = encode_header_info(header_info)
    if photo_urls_set:
        record.PhotoUrls = encode_photo_urls(photo_urls)


def ensure_consultation_done_for_record(
    consultation: AppConsultation,
    schedule: Optional[AppSchedule] = None,
) -> None:
    """保存咨询记录时，将已到期的咨询单自动标记为已完成。"""
    if consultation.Status == "DONE":
        return
    consultation.Status = "DONE"
    if not consultation.EndTime:
        if schedule and schedule.EndTime:
            consultation.EndTime = schedule.EndTime
        else:
            consultation.EndTime = datetime.utcnow()
    consultation.UpdatedAt = datetime.utcnow()


def _ops_admin_account_ids(db: Session) -> List[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType.in_(["Admin", "Ops"]))
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


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
        return acc.Nickname or acc.RealName or f"咨询师#{counselor_id}"
    return f"咨询师#{counselor_id}"


def _patient_display_name(db: Session, patient_id: int) -> str:
    acc = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not acc:
        return f"来访者#{patient_id}"
    return acc.RealName or acc.Nickname or acc.Mobile or f"来访者#{patient_id}"


def _account_phone(db: Session, account_id: int) -> str:
    acc = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    return (acc.Mobile or "").strip() if acc else ""


def notify_admins_crisis_report_if_needed(
    db: Session,
    record: AppCaseRecord,
    *,
    counselor_id: int,
    old_crisis_choice: str = "",
) -> None:
    """个案风险评估第10题选 A/B/C 时，通知管理员/Ops 需上报。"""
    risk = decode_risk_assessment(record.RiskAssessment)
    new_choice = get_crisis_level_choice(risk)
    if not should_notify_crisis_report(old_crisis_choice, new_choice):
        return

    consultation = (
        db.query(AppConsultation)
        .filter(AppConsultation.Id == record.ConsultationId)
        .first()
    )
    counselor_name = _counselor_display_name(db, counselor_id)
    patient_name = (
        _patient_display_name(db, consultation.PatientId)
        if consultation
        else "来访者"
    )
    patient_phone = (
        _account_phone(db, consultation.PatientId) if consultation else ""
    )
    counselor_phone = _account_phone(db, counselor_id)
    start_time = (
        consultation.StartTime.strftime("%Y-%m-%d %H:%M")
        if consultation and consultation.StartTime
        else ""
    )
    level_label = crisis_level_text_only(new_choice)
    title = "个案风险需上报"
    summary = (
        f"{counselor_name} · {patient_name} · {level_label}"
        f" · 来访 {patient_phone or '未填写'}"
        f" · 咨询师 {counselor_phone or '未填写'}"
    )
    if start_time:
        summary += f" · {start_time}"
    detail = {
        "counselorName": counselor_name,
        "counselorPhone": counselor_phone or None,
        "patientName": patient_name,
        "patientPhone": patient_phone or None,
        "caseRecordId": record.Id,
        "consultationId": record.ConsultationId,
        "crisisLevel": new_choice,
        "crisisLevelLabel": level_label,
        "startTime": start_time or None,
    }
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)
    for admin_id in _ops_admin_account_ids(db):
        create_message(
            db,
            admin_id,
            "RISK",
            title,
            content,
            related_type="CASE_RECORD_CRISIS_REPORT",
            related_id=record.Id,
        )
