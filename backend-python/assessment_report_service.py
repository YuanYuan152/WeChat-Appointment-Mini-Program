"""EAP 量表报告持久化、幂等提交、行级读取和内容删除。"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from assessment_audit_service import begin_assessment_audit
from assessment_definition_service import AssessmentDefinitionStore
from assessment_scoring_service import (
    AssessmentAnswerError,
    assessment_result_summary,
    calculate_assessment_result,
    validate_submission_answers,
)
from assessment_share_service import (
    AssessmentShareCodeError,
    AssessmentShareConfigurationError,
    decode_share_code,
)
from config import settings
from models import AppAccount, AppAssessmentReport


class AssessmentReportError(Exception):
    status_code = 500


class AssessmentReportValidationError(AssessmentReportError):
    status_code = 422


class AssessmentReportNotFound(AssessmentReportError):
    status_code = 404


class AssessmentReportConflict(AssessmentReportError):
    status_code = 409


class AssessmentReportUnavailable(AssessmentReportError):
    status_code = 503


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _load_json(raw: Optional[str], label: str) -> Any:
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise AssessmentReportError(f"报告{label}数据损坏") from exc


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


def _assert_payload_size(label: str, value: Any, maximum_bytes: int) -> None:
    if len(_canonical_json(value).encode("utf-8")) > maximum_bytes:
        raise AssessmentReportValidationError(f"{label}内容过大")


def _snapshot(
    definition: dict[str, Any],
    result: dict[str, Any],
    completed_at: datetime,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "assessment": definition,
        "result": result,
        "reportContent": {
            "title": definition.get("title", ""),
            "subtitle": definition.get("subtitle", ""),
            "cover": definition.get("cover", ""),
            "disclaimer": definition.get("disclaimer", ""),
            "reportIntro": definition.get("reportIntro", ""),
            "features": definition.get("features", ""),
        },
        "completedAt": _utc_iso(completed_at),
    }


def _load_verified_snapshot(row: AppAssessmentReport) -> dict[str, Any]:
    raw = row.ReportSnapshot
    expected = row.SnapshotSha256
    if not raw or not expected:
        raise AssessmentReportError("报告快照缺失")
    actual = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(actual, expected):
        raise AssessmentReportError("报告快照完整性校验失败")
    snapshot = _load_json(raw, "快照")
    if not isinstance(snapshot, dict):
        raise AssessmentReportError("报告快照数据损坏")
    return snapshot


def _report_list_item(
    row: AppAssessmentReport,
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    assessment = snapshot.get("assessment") or {}
    return {
        "publicId": row.PublicId,
        "assessmentId": row.AssessmentId,
        "assessmentVersion": row.AssessmentVersion,
        "category": row.Category,
        "assessmentTitle": assessment.get("title", row.AssessmentTitle),
        "assessmentSubtitle": assessment.get("subtitle", ""),
        "cover": assessment.get("cover", ""),
        "scoringType": assessment.get("scoringType", row.ScoringType),
        "completedAt": _utc_iso(row.CompletedAt),
        "resultSummary": row.ResultSummary or "",
    }


def report_list_item(row: AppAssessmentReport) -> dict[str, Any]:
    return _report_list_item(row, _load_verified_snapshot(row))


def report_detail(
    row: AppAssessmentReport,
    *,
    include_raw_answers: bool,
) -> dict[str, Any]:
    snapshot = _load_verified_snapshot(row)
    item = _report_list_item(row, snapshot)
    result = snapshot.get("result")
    if not isinstance(result, dict):
        raise AssessmentReportError("报告快照缺少计分结果")
    stored_result = _load_json(row.ResultJson, "计分结果")
    if stored_result is not None and _canonical_json(stored_result) != _canonical_json(
        result
    ):
        raise AssessmentReportError("报告计分结果与快照不一致")
    item.update(
        {
            "result": result,
            "reportSnapshot": snapshot,
        }
    )
    if include_raw_answers:
        item["demographicAnswers"] = _load_json(row.DemographicAnswers, "人口学答案") or {}
        item["answers"] = _load_json(row.Answers, "答案") or {}
    return item


def _existing_submission(
    db: Session,
    account_id: int,
    client_submission_id: str,
) -> Optional[AppAssessmentReport]:
    return (
        db.query(AppAssessmentReport)
        .filter(
            AppAssessmentReport.AccountId == account_id,
            AppAssessmentReport.ClientSubmissionId == client_submission_id,
        )
        .first()
    )


def submit_report(
    db: Session,
    *,
    account: AppAccount,
    store: AssessmentDefinitionStore,
    client_submission_id: str,
    assessment_id: str,
    assessment_version: int,
    demographic_answers: dict[str, Any],
    answers: dict[str, str],
    entry_source: str,
    share_code: Optional[str],
    consent_version: str,
) -> dict[str, Any]:
    existing = _existing_submission(db, account.Id, client_submission_id)
    if existing:
        if existing.DeletedAt is not None:
            raise AssessmentReportConflict("该提交编号对应的报告已删除，请重新开始测评")
        if (
            existing.AssessmentId != assessment_id
            or existing.AssessmentVersion != assessment_version
        ):
            raise AssessmentReportConflict("该提交编号已用于其他量表")
        return report_detail(existing, include_raw_answers=True)

    definition = store.get_published_version(assessment_id, assessment_version)
    expected_consent = settings.ASSESSMENT_CONSENT_VERSION.strip()
    if definition.get("category") == "professional" and (
        not expected_consent or consent_version != expected_consent
    ):
        raise AssessmentReportValidationError("请阅读并同意当前版本的隐私保护协议")

    # 先限制未经信任的原始载荷，再进入人口学正则等语义校验。
    _assert_payload_size("人口学答案", demographic_answers, 64 * 1024)
    _assert_payload_size("量表答案", answers, 256 * 1024)
    normalized_share_code = (share_code or "").strip() or None
    if normalized_share_code:
        try:
            decode_share_code(
                normalized_share_code,
                expected_assessment_id=assessment_id,
            )
        except AssessmentShareConfigurationError as exc:
            raise AssessmentReportUnavailable("量表分享服务暂不可用") from exc
        except AssessmentShareCodeError as exc:
            raise AssessmentReportValidationError(str(exc)) from exc
        # 来源由已验证分享码决定，不信任客户端单独声明的 entrySource。
        entry_source = "qr"
    elif entry_source == "qr":
        raise AssessmentReportValidationError("扫码来源缺少有效分享码")

    try:
        demographics, normalized_answers = validate_submission_answers(
            definition,
            demographic_answers,
            answers,
        )
        result = calculate_assessment_result(definition, normalized_answers)
        summary = assessment_result_summary(result)
    except AssessmentAnswerError as exc:
        raise AssessmentReportValidationError(str(exc)) from exc

    _assert_payload_size("计分结果", result, 512 * 1024)

    completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    snapshot = _snapshot(definition, result, completed_at)
    snapshot_json = _canonical_json(snapshot)
    if len(snapshot_json.encode("utf-8")) > 2 * 1024 * 1024:
        raise AssessmentReportValidationError("报告快照内容过大")

    row = AppAssessmentReport(
        PublicId=f"rpt_{uuid.uuid4().hex}",
        AccountId=account.Id,
        ClientSubmissionId=client_submission_id,
        AssessmentId=assessment_id,
        AssessmentVersion=assessment_version,
        Category=str(definition["category"]),
        AssessmentTitle=str(definition["title"]),
        ScoringType=str(definition["scoringType"]),
        EntrySource=entry_source,
        ShareCode=normalized_share_code,
        ConsentVersion=consent_version,
        ConsentAcceptedAt=completed_at,
        DemographicAnswers=_canonical_json(demographics),
        Answers=_canonical_json(normalized_answers),
        ResultJson=_canonical_json(result),
        ResultSummary=summary,
        ReportSnapshot=snapshot_json,
        SnapshotSha256=hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest(),
        CompletedAt=completed_at,
        CreatedAt=completed_at,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raced = _existing_submission(db, account.Id, client_submission_id)
        if raced and raced.DeletedAt is None:
            if (
                raced.AssessmentId == assessment_id
                and raced.AssessmentVersion == assessment_version
            ):
                return report_detail(raced, include_raw_answers=True)
            raise AssessmentReportConflict("该提交编号已用于其他量表") from exc
        raise AssessmentReportConflict("报告重复提交，请刷新后查看") from exc
    db.refresh(row)
    return report_detail(row, include_raw_answers=True)


def list_user_reports(
    db: Session,
    *,
    account_id: int,
    page: int,
    page_size: int,
    category: Optional[str] = None,
    assessment_id: Optional[str] = None,
) -> dict[str, Any]:
    query = db.query(AppAssessmentReport).filter(
        AppAssessmentReport.AccountId == account_id,
        AppAssessmentReport.DeletedAt.is_(None),
    )
    if category:
        query = query.filter(AppAssessmentReport.Category == category)
    if assessment_id:
        query = query.filter(AppAssessmentReport.AssessmentId == assessment_id)
    total = query.count()
    rows = (
        query.order_by(AppAssessmentReport.CompletedAt.desc(), AppAssessmentReport.Id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [report_list_item(row) for row in rows],
        "page": page,
        "pageSize": page_size,
        "total": total,
    }


def get_user_report(
    db: Session,
    *,
    account_id: int,
    public_id: str,
) -> AppAssessmentReport:
    row = (
        db.query(AppAssessmentReport)
        .filter(
            AppAssessmentReport.PublicId == public_id,
            AppAssessmentReport.AccountId == account_id,
            AppAssessmentReport.DeletedAt.is_(None),
        )
        .first()
    )
    if not row:
        raise AssessmentReportNotFound("报告不存在或已删除")
    return row


def delete_user_report(
    db: Session,
    *,
    account: AppAccount,
    public_id: str,
    request_id: Optional[str] = None,
) -> None:
    row = get_user_report(db, account_id=account.Id, public_id=public_id)
    deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    row.DemographicAnswers = None
    row.Answers = None
    row.ResultJson = None
    row.ResultSummary = None
    row.ReportSnapshot = None
    row.SnapshotSha256 = None
    row.DeletedAt = deleted_at
    begin_assessment_audit(
        db,
        actor=account,
        action="REPORT_DELETE",
        target_type="REPORT",
        request_id=request_id,
        target_public_id=row.PublicId,
        assessment_id=row.AssessmentId,
        assessment_version=row.AssessmentVersion,
        metadata={"source": "eap"},
        outcome="SUCCEEDED",
    )
    db.commit()
