"""企业站入职测评进度：按人员账号读写，以正式答卷为准并对空写入做合并保护。"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from enterprise_data_service import (
    merge_submissions_from_result_public_ids,
    personnel_latest_employee_info,
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


def _has_nonempty_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, (dict, list)):
        return len(value) > 0
    return str(value).strip() != ""


def _merge_basic_info(*parts: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for part in parts:
        for key, value in _normalize_object(part).items():
            if _has_nonempty_value(value):
                merged[str(key)] = value
    return merged


def _merge_answers(*parts: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for part in parts:
        for scale_id, answers in _normalize_object(part).items():
            aid = str(scale_id or "").strip()
            if not aid or not isinstance(answers, dict) or not answers:
                continue
            current = merged.get(aid) if isinstance(merged.get(aid), dict) else {}
            merged[aid] = {**current, **answers}
    return merged


def _merge_results(*parts: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for part in parts:
        for scale_id, payload in _normalize_object(part).items():
            aid = str(scale_id or "").strip()
            if not aid or not isinstance(payload, dict):
                continue
            current = merged.get(aid) if isinstance(merged.get(aid), dict) else {}
            # 带 publicId / submittedAt 的优先保留权威字段
            next_payload = {**current, **payload}
            if current.get("publicId") and not payload.get("publicId"):
                next_payload["publicId"] = current.get("publicId")
            if current.get("submittedAt") and not payload.get("submittedAt"):
                next_payload["submittedAt"] = current.get("submittedAt")
            if current.get("result") and payload.get("result") in (None, {}):
                next_payload["result"] = current.get("result")
            merged[aid] = next_payload
    return merged


def _completed_ids_from_results(results: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for aid, payload in _normalize_object(results).items():
        if not isinstance(payload, dict):
            continue
        if payload.get("publicId") or payload.get("submittedAt") or payload.get("completedAt"):
            value = str(aid or "").strip()
            if value:
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
    """正式答卷为准补齐完成态；进度里已带 publicId 的完成标记也保留，避免误清空。"""
    results = _merge_results(results_by_scale)
    trusted_from_results = set(_completed_ids_from_results(results))

    completed: list[str] = []
    seen: set[str] = set()
    for aid in _normalize_completed_ids(completed_scale_ids):
        if (aid in submissions or aid in trusted_from_results) and aid not in seen:
            completed.append(aid)
            seen.add(aid)
    for aid in submissions.keys():
        if aid not in seen:
            completed.append(aid)
            seen.add(aid)
    for aid in trusted_from_results:
        if aid not in seen:
            completed.append(aid)
            seen.add(aid)

    for aid, submission in submissions.items():
        current = results.get(aid) if isinstance(results.get(aid), dict) else {}
        results[aid] = {
            **current,
            "assessmentId": aid,
            "publicId": submission.get("publicId") or current.get("publicId") or "",
            "assessmentTitle": submission.get("assessmentTitle")
            or current.get("assessmentTitle")
            or "",
            "scoringType": submission.get("scoringType") or current.get("scoringType"),
            "resultSummary": submission.get("resultSummary")
            if submission.get("resultSummary") is not None
            else current.get("resultSummary") or "",
            "result": submission.get("result")
            if submission.get("result") is not None
            else current.get("result"),
            "submittedAt": submission.get("submittedAt") or current.get("submittedAt"),
            "completedAt": submission.get("completedAt") or current.get("completedAt"),
        }

    if authorized_ids and all(aid in seen for aid in authorized_ids):
        status = "completed"
    else:
        status = "in_progress"

    persist_step = _normalize_step(step)
    if persist_step in {"scale", "scaleResult"}:
        persist_step = "select"
    # 已有基本信息或完成量表时，换设备不要停在 welcome/basic
    if persist_step in {"welcome", "basic"} and (
        completed or _has_nonempty_value(basic_info)
    ):
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
    basic_info_override: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    basic = basic_info_override
    if basic is None:
        basic = _normalize_object(_loads_obj(row.BasicInfoJson, {}))
    aligned = align_progress_with_submissions(
        step=row.Step,
        active_scale_id=str(row.ActiveScaleId or ""),
        answers_by_scale=_normalize_object(_loads_obj(row.AnswersJson, {})),
        basic_info=basic,
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
    basic_info: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    aligned = align_progress_with_submissions(
        step="welcome",
        active_scale_id="",
        answers_by_scale={},
        basic_info=_normalize_object(basic_info),
        completed_scale_ids=[],
        results_by_scale={},
        submissions=submissions or {},
        authorized_ids=authorized_ids or [],
    )
    return {
        "exists": bool(submissions) or bool(aligned["basicInfo"]),
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
    current_basic = _normalize_object(_loads_obj(row.BasicInfoJson, {}))
    if current_completed != aligned["completedScaleIds"]:
        return True
    if _normalize_step(row.Step) != aligned["step"]:
        return True
    if str(row.Status or "") != aligned["status"]:
        return True
    if current_basic != aligned["basicInfo"] and aligned["basicInfo"]:
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
    fallback_basic = personnel_latest_employee_info(db, enterprise, personnel_id)

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
            basic_info=fallback_basic,
        )
        if (submissions or fallback_basic) and enterprise_id:
            now = utc_naive_now()
            row = EnterpriseOnboardingProgress(
                EnterpriseId=enterprise_id,
                EnterpriseSlug=str(enterprise.get("slug") or ""),
                PersonnelId=int(personnel_id),
                Step=empty["step"],
                ActiveScaleId=None,
                AnswersJson=_dumps({}),
                BasicInfoJson=_dumps(empty["basicInfo"]),
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

    stored_basic = _normalize_object(_loads_obj(row.BasicInfoJson, {}))
    basic = _merge_basic_info(fallback_basic, stored_basic)
    aligned = align_progress_with_submissions(
        step=row.Step,
        active_scale_id=str(row.ActiveScaleId or ""),
        answers_by_scale=_normalize_object(_loads_obj(row.AnswersJson, {})),
        basic_info=basic,
        completed_scale_ids=_normalize_completed_ids(_loads_obj(row.CompletedScaleIdsJson, [])),
        results_by_scale=_normalize_object(_loads_obj(row.ResultsJson, {})),
        submissions=submissions,
        authorized_ids=authorized,
    )
    if _row_needs_persist(row, aligned):
        row.Step = aligned["step"]
        row.CompletedScaleIdsJson = _dumps(aligned["completedScaleIds"])
        row.ResultsJson = _dumps(aligned["resultsByScale"])
        row.BasicInfoJson = _dumps(aligned["basicInfo"])
        row.Status = aligned["status"]
        row.UpdatedAt = utc_naive_now()
        db.commit()
        db.refresh(row)

    return serialize_progress(
        row,
        submissions=submissions,
        authorized_ids=authorized,
        basic_info_override=aligned["basicInfo"],
    )


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
    row = (
        db.query(EnterpriseOnboardingProgress)
        .filter(
            EnterpriseOnboardingProgress.EnterpriseId == enterprise_id,
            EnterpriseOnboardingProgress.PersonnelId == int(personnel_id),
        )
        .first()
    )

    existing_answers = _normalize_object(_loads_obj(row.AnswersJson, {})) if row else {}
    existing_basic = _normalize_object(_loads_obj(row.BasicInfoJson, {})) if row else {}
    existing_completed = (
        _normalize_completed_ids(_loads_obj(row.CompletedScaleIdsJson, [])) if row else []
    )
    existing_results = _normalize_object(_loads_obj(row.ResultsJson, {})) if row else {}
    fallback_basic = personnel_latest_employee_info(db, enterprise, personnel_id)

    incoming_results = _normalize_object(payload.get("resultsByScale"))
    merged_results = _merge_results(existing_results, incoming_results)
    submissions = merge_submissions_from_result_public_ids(
        db,
        enterprise,
        personnel_id,
        merged_results,
        personnel_latest_submissions(db, enterprise, personnel_id),
    )

    merged_basic = _merge_basic_info(
        fallback_basic,
        existing_basic,
        _normalize_object(payload.get("basicInfo")),
    )
    merged_answers = _merge_answers(
        existing_answers,
        _normalize_object(payload.get("answersByScale")),
    )
    merged_completed = _normalize_completed_ids(
        [
            *existing_completed,
            *_normalize_completed_ids(payload.get("completedScaleIds")),
            *_completed_ids_from_results(merged_results),
            *list(submissions.keys()),
        ]
    )

    # 防止新设备空状态覆盖：无 clientUpdatedAt 且服务端已有更新时，按冲突处理
    if row and row.UpdatedAt and not client_updated_at:
        incoming_empty = (
            not _has_nonempty_value(payload.get("answersByScale"))
            and not _has_nonempty_value(payload.get("basicInfo"))
            and not _normalize_completed_ids(payload.get("completedScaleIds"))
            and not _has_nonempty_value(payload.get("resultsByScale"))
        )
        if incoming_empty:
            raise OnboardingProgressConflict(
                serialize_progress(row, submissions=submissions, authorized_ids=authorized)
            )

    aligned = align_progress_with_submissions(
        step=payload.get("step") or (row.Step if row else "welcome"),
        active_scale_id=str(
            payload.get("activeScaleId")
            if payload.get("activeScaleId") is not None
            else (row.ActiveScaleId if row else "")
        ),
        answers_by_scale=merged_answers,
        basic_info=merged_basic,
        completed_scale_ids=merged_completed,
        results_by_scale=merged_results,
        submissions=submissions,
        authorized_ids=authorized,
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
