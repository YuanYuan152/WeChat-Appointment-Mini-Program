"""咨询记录（个案记录）序列化与版本留存。"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import AppCaseRecord, AppCaseRecordRevision, AppConsultation, AppSchedule


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


def snapshot_case_record(record: AppCaseRecord) -> Dict[str, Any]:
    return {
        "subjective": record.Subjective,
        "objective": record.Objective,
        "assessment": record.Assessment,
        "plan": record.Plan,
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
) -> None:
    """四项文字内容为必填，照片可选。"""
    labels = {
        "subjective": "患者情况记录（主观陈述）",
        "objective": "客观观察",
        "assessment": "评估分析",
        "plan": "计划方向",
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
        or photo_count > 0
    )


def apply_case_record_fields(
    record: AppCaseRecord,
    *,
    subjective: Optional[str] = None,
    objective: Optional[str] = None,
    assessment: Optional[str] = None,
    plan: Optional[str] = None,
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
