"""企业站入职测评进度：按人员账号读写，以正式答卷为准对齐 completed。"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from enterprise_data_service import (
    merge_submissions_from_result_public_ids,
    personnel_latest_submissions,
)
from models import EnterpriseOnboardingProgress, utc_naive_now


ALLOWED_STEPS = frozenset({"welcome", "basic", "select", "scale", "scaleResult"})
ALLOWED_STATUSES = frozenset({"in_progress", "completed"})


class OnboardingProgressError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


class OnboardingProgressConflict(OnboardingProgressError):
    def __init__(self, progress: dict[str, Any]):
        super().__init__("进度已被其他设备更新", status_code=409)
        self.progress = progress


def _dumps(value: Any) -> Optional[str]:
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as exc:
        raise OnboardingProgressError("进度数据无法序列化") from exc


def _loads_obj(raw: Optional[str], fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed is not None else fallback


def _normalize_step(raw: Any) -> str:
    step = str(raw or "").strip()
    if step == "consent":
        step = "basic"
    if step in {"complete", "report"}:
        step = "select"
    if step not in ALLOWED_STEPS:
        return "welcome"
    return step


def _normalize_completed_ids(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _normalize_object(raw: Any) -> dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


def _authorized_assessment_ids(enterprise: dict[str, Any]) -> list[str]:
    raw = enterprise.get("assessmentIds") or []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def parse_client_updated_at(raw: Optional[str]) -> Optional[datetime]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        normalized = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise OnboardingProgressError("clientUpdatedAt 格式无效") from exc
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def align_progress_with_submissions(
    *,
    step: str,
    active_scale_id: str,
    answers_by_scale: dict[str, Any],
    basic_info: dict[str, Any],
    completed_scale_ids: list[str],
    results_by_scale: dict[str, Any],
    submissions: dict[str, dict[str, Any]],
    authorized_ids: list[str],
) -> dict[str, Any]:
    """正式答卷为准：补齐已提交量表，剔除无报告的「已完成」标记。"""
    submitted_ids = [aid for aid in submissions.keys()]
    # 保留客户端顺序，再补上报告里有但进度漏掉的
    completed: list[str] = []
    seen: set[str] = set()
    for aid in _normalize_completed_ids(completed_scale_ids):
        if aid in submissions and aid not in seen:
            completed.append(aid)
            seen.add(aid)
    for aid in submitted_ids:
        if aid not in seen:
            completed.append(aid)
            seen.add(aid)

    results = dict(_normalize_object(results_by_scale))
    for aid, submission in submissions.items():
        current = results.get(aid)
        base = current if isinstance(current, dict) else {}
        results[aid] = {
            **base,
            "assessmentId": aid,
            "publicId": submission.get("publicId") or base.get("publicId") or "",
            "assessmentTitle": submission.get("assessmentTitle")
            or base.get("assessmentTitle")
            or "",
            "scoringType": submission.get("scoringType") or base.get("scoringType"),
            "resultSummary": submission.get("resultSummary")
            if submission.get("resultSummary") is not None
            else base.get("resultSummary") or "",
            "result": submission.get("result")
            if submission.get("result") is not None
            else base.get("result"),
            "submittedAt": submission.get("submittedAt") or base.get("submittedAt"),
            "completedAt": submission.get("completedAt") or base.get("completedAt"),
        }

    if authorized_ids and all(aid in seen for aid in authorized_ids):
        status = "completed"
    elif completed:
        status = "in_progress"
    else:
        status = "in_progress"

    persist_step = _normalize_step(step)
    if persist_step in {"scale", "scaleResult"}:
        persist_step = "select"
    # 已有正式提交时，不要停在 welcome
    if completed and persist_step == "welcome":
        persist_step = "select"

    return {
        "step": persist_step,
        "activeScaleId": str(active_scale_id or "").strip()[:80],
        "answersByScale": _normalize_object(answers_by_scale),
        "basicInfo": _normalize_object(basic_info),
        "completedScaleIds": completed,
        "resultsByScale": results,
        "status": status,
        "submittedReports": list(submissions.values()),
    }


def serialize_progress(
    row: EnterpriseOnboardingProgress,
    *,
    submissions: Optional[dict[str, dict[str, Any]]] = None,
    authorized_ids: Optional[list[str]] = None,
) -> dict[str, Any]:
    aligned = align_progress_with_submissions(
        step=row.Step,
        active_scale_id=str(row.ActiveScaleId or ""),
        answers_by_scale=_normalize_object(_loads_obj(row.AnswersJson, {})),
        basic_info=_normalize_object(_loads_obj(row.BasicInfoJson, {})),
        completed_scale_ids=_normalize_completed_ids(_loads_obj(row.CompletedScaleIdsJson, [])),
        results_by_scale=_normalize_object(_loads_obj(row.ResultsJson, {})),
        submissions=submissions or {},
        authorized_ids=authorized_ids or [],
    )
    return {
        "exists": True,
        "step": aligned["step"],
        "activeScaleId": aligned["activeScaleId"],
        "answersByScale": aligned["answersByScale"],
        "basicInfo": aligned["basicInfo"],
        "completedScaleIds": aligned["completedScaleIds"],
        "resultsByScale": aligned["resultsByScale"],
        "status": aligned["status"],
        "updatedAt": row.UpdatedAt.isoformat() + "Z" if row.UpdatedAt else None,
        "personnelId": int(row.PersonnelId),
        "submittedReports": aligned["submittedReports"],
        "reconciled": True,
    }


def empty_progress(
    personnel_id: int,
    *,
    submissions: Optional[dict[str, dict[str, Any]]] = None,
    authorized_ids: Optional[list[str]] = None,
) -> dict[str, Any]:
    aligned = align_progress_with_submissions(
        step="welcome",
        active_scale_id="",
        answers_by_scale={},
        basic_info={},
        completed_scale_ids=[],
        results_by_scale={},
        submissions=submissions or {},
        authorized_ids=authorized_ids or [],
    )
    return {
        "exists": bool(submissions),
        "step": aligned["step"],
        "activeScaleId": aligned["activeScaleId"],
        "answersByScale": aligned["answersByScale"],
        "basicInfo": aligned["basicInfo"],
        "completedScaleIds": aligned["completedScaleIds"],
        "resultsByScale": aligned["resultsByScale"],
        "status": aligned["status"],
        "updatedAt": None,
        "personnelId": int(personnel_id),
        "submittedReports": aligned["submittedReports"],
        "reconciled": True,
    }


def _row_needs_persist(row: EnterpriseOnboardingProgress, aligned: dict[str, Any]) -> bool:
    current_completed = _normalize_completed_ids(_loads_obj(row.CompletedScaleIdsJson, []))
    current_results = _normalize_object(_loads_obj(row.ResultsJson, {}))
    if current_completed != aligned["completedScaleIds"]:
        return True
    if _normalize_step(row.Step) != aligned["step"]:
        return True
    if str(row.Status or "") != aligned["status"]:
        return True
    for aid in aligned["completedScaleIds"]:
        want = aligned["resultsByScale"].get(aid) or {}
        have = current_results.get(aid) if isinstance(current_results.get(aid), dict) else {}
        if str(want.get("publicId") or "") != str(have.get("publicId") or ""):
            return True
        if str(want.get("submittedAt") or "") != str(have.get("submittedAt") or ""):
            return True
    return False


def get_progress(
    db: Session,
    *,
    enterprise: dict[str, Any],
    personnel_id: int,
) -> dict[str, Any]:
    enterprise_id = str(enterprise.get("id") or "").strip()
    authorized = _authorized_assessment_ids(enterprise)
    submissions = personnel_latest_submissions(db, enterprise, personnel_id)

    row = (
        db.query(EnterpriseOnboardingProgress)
        .filter(
            EnterpriseOnboardingProgress.EnterpriseId == enterprise_id,
            EnterpriseOnboardingProgress.PersonnelId == int(personnel_id),
        )
        .first()
    )
    if not row:
        empty = empty_progress(
            personnel_id,
            submissions=submissions,
            authorized_ids=authorized,
        )
        # 仅有正式答卷、尚无进度行：落一行，避免换设备只看见欢迎页
        if submissions and enterprise_id:
            now = utc_naive_now()
            row = EnterpriseOnboardingProgress(
                EnterpriseId=enterprise_id,
                EnterpriseSlug=str(enterprise.get("slug") or ""),
                PersonnelId=int(personnel_id),
                Step=empty["step"],
                ActiveScaleId=None,
                AnswersJson=_dumps({}),
                BasicInfoJson=_dumps({}),
                CompletedScaleIdsJson=_dumps(empty["completedScaleIds"]),
                ResultsJson=_dumps(empty["resultsByScale"]),
                Status=empty["status"],
                CreatedAt=now,
                UpdatedAt=now,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return serialize_progress(row, submissions=submissions, authorized_ids=authorized)
        return empty

    aligned = align_progress_with_submissions(
        step=row.Step,
        active_scale_id=str(row.ActiveScaleId or ""),
        answers_by_scale=_normalize_object(_loads_obj(row.AnswersJson, {})),
        basic_info=_normalize_object(_loads_obj(row.BasicInfoJson, {})),
        completed_scale_ids=_normalize_completed_ids(_loads_obj(row.CompletedScaleIdsJson, [])),
        results_by_scale=_normalize_object(_loads_obj(row.ResultsJson, {})),
        submissions=submissions,
        authorized_ids=authorized,
    )
    if _row_needs_persist(row, aligned):
        row.Step = aligned["step"]
        row.CompletedScaleIdsJson = _dumps(aligned["completedScaleIds"])
        row.ResultsJson = _dumps(aligned["resultsByScale"])
        row.Status = aligned["status"]
        row.UpdatedAt = utc_naive_now()
        db.commit()
        db.refresh(row)

    return serialize_progress(row, submissions=submissions, authorized_ids=authorized)


def upsert_progress(
    db: Session,
    *,
    enterprise: dict[str, Any],
    personnel_id: int,
    payload: dict[str, Any],
    client_updated_at: Optional[datetime] = None,
) -> dict[str, Any]:
    enterprise_id = str(enterprise.get("id") or "").strip()
    enterprise_slug = str(enterprise.get("slug") or "").strip()
    if not enterprise_id or not enterprise_slug:
        raise OnboardingProgressError("企业配置无效")

    authorized = _authorized_assessment_ids(enterprise)
    results_by_scale = _normalize_object(payload.get("resultsByScale"))
    submissions = merge_submissions_from_result_public_ids(
        db,
        enterprise,
        personnel_id,
        results_by_scale,
        personnel_latest_submissions(db, enterprise, personnel_id),
    )

    aligned = align_progress_with_submissions(
        step=payload.get("step"),
        active_scale_id=str(payload.get("activeScaleId") or ""),
        answers_by_scale=_normalize_object(payload.get("answersByScale")),
        basic_info=_normalize_object(payload.get("basicInfo")),
        completed_scale_ids=_normalize_completed_ids(payload.get("completedScaleIds")),
        results_by_scale=results_by_scale,
        submissions=submissions,
        authorized_ids=authorized,
    )

    row = (
        db.query(EnterpriseOnboardingProgress)
        .filter(
            EnterpriseOnboardingProgress.EnterpriseId == enterprise_id,
            EnterpriseOnboardingProgress.PersonnelId == int(personnel_id),
        )
        .first()
    )

    if row and client_updated_at and row.UpdatedAt and row.UpdatedAt > client_updated_at:
        raise OnboardingProgressConflict(
            serialize_progress(row, submissions=submissions, authorized_ids=authorized)
        )

    now = utc_naive_now()
    if not row:
        row = EnterpriseOnboardingProgress(
            EnterpriseId=enterprise_id,
            EnterpriseSlug=enterprise_slug,
            PersonnelId=int(personnel_id),
            CreatedAt=now,
        )
        db.add(row)

    row.EnterpriseSlug = enterprise_slug
    row.Step = aligned["step"]
    row.ActiveScaleId = aligned["activeScaleId"] or None
    row.AnswersJson = _dumps(aligned["answersByScale"])
    row.BasicInfoJson = _dumps(aligned["basicInfo"])
    row.CompletedScaleIdsJson = _dumps(aligned["completedScaleIds"])
    row.ResultsJson = _dumps(aligned["resultsByScale"])
    row.Status = aligned["status"]
    row.UpdatedAt = now
    db.commit()
    db.refresh(row)
    return serialize_progress(row, submissions=submissions, authorized_ids=authorized)
