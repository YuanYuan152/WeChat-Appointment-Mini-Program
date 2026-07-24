"""EAP 用户量表报告与管理后台聚合查询接口。"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, load_only

from assessment_audit_service import begin_assessment_audit
from assessment_definition_service import (
    AssessmentConflict,
    AssessmentDefinitionError,
    AssessmentNotFound,
    AssessmentValidationError,
)
from assessment_report_service import (
    AssessmentReportError,
    AssessmentReportNotFound,
    delete_user_report,
    get_user_report,
    list_user_reports,
    report_detail,
    submit_report,
)
from assessment_routes import get_assessment_store
from auth import get_current_account
from database import get_db
from models import AppAccount, AppAssessmentReport, AppPsychScaleResult
from psych_scale import decode_answers, interpret_scale, result_dict, scale_label
from role_active import get_account_role


web_report_router = APIRouter(
    prefix="/api/web/assessment-reports",
    tags=["Web Assessment Reports"],
)

AssessmentCategory = Literal["professional", "fun"]
AssessmentReportSource = Literal["eap", "mini-legacy"]


class AssessmentReportSubmitPayload(BaseModel):
    clientSubmissionId: UUID
    assessmentId: str = Field(..., min_length=1, max_length=80)
    assessmentVersion: int = Field(..., ge=1)
    demographicAnswers: dict[str, Any] = Field(default_factory=dict)
    answers: dict[str, str]
    entrySource: Literal["web", "mini-webview", "qr", "direct"] = "web"
    shareCode: Optional[str] = Field(None, max_length=120)
    consentVersion: str = Field(..., min_length=1, max_length=50)


def _request_id(request: Request) -> Optional[str]:
    return request.headers.get("x-request-id")


def _raise_report_http_error(exc: Exception) -> None:
    if isinstance(exc, AssessmentReportError):
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    if isinstance(exc, AssessmentNotFound):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, AssessmentConflict):
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if isinstance(exc, AssessmentValidationError):
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail="量表报告服务异常") from exc


def _require_patient(
    account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    if get_account_role(db, account.Id) != "Patient":
        raise HTTPException(status_code=403, detail="仅来访者账号可以使用测评报告")
    return account


def _record_report_view(
    db: Session,
    *,
    actor: AppAccount,
    request: Request,
    row: Optional[AppAssessmentReport],
    source: AssessmentReportSource,
    report_id: str,
    outcome: str,
    include_raw_answers: bool,
) -> None:
    begin_assessment_audit(
        db,
        actor=actor,
        action="REPORT_VIEW_RAW" if include_raw_answers else "REPORT_VIEW",
        target_type="REPORT",
        request_id=_request_id(request),
        target_public_id=(row.PublicId if row else report_id) if source == "eap" else None,
        assessment_id=row.AssessmentId if row else None,
        assessment_version=row.AssessmentVersion if row else None,
        metadata={
            "source": source,
            "rawAnswers": include_raw_answers,
            **({"legacyReportId": report_id} if source == "mini-legacy" else {}),
        },
        outcome=outcome,
    )
    db.commit()


@web_report_router.post("", summary="提交 EAP 测评报告")
def submit_assessment_report(
    body: AssessmentReportSubmitPayload,
    account: AppAccount = Depends(_require_patient),
    db: Session = Depends(get_db),
):
    try:
        return submit_report(
            db,
            account=account,
            store=get_assessment_store(),
            client_submission_id=str(body.clientSubmissionId),
            assessment_id=body.assessmentId,
            assessment_version=body.assessmentVersion,
            demographic_answers=body.demographicAnswers,
            answers=body.answers,
            entry_source=body.entrySource,
            share_code=body.shareCode,
            consent_version=body.consentVersion,
        )
    except (AssessmentReportError, AssessmentDefinitionError) as exc:
        _raise_report_http_error(exc)


@web_report_router.get("", summary="获取当前用户 EAP 测评报告")
def list_assessment_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[AssessmentCategory] = Query(None),
    assessment_id: Optional[str] = Query(None, max_length=80),
    account: AppAccount = Depends(_require_patient),
    db: Session = Depends(get_db),
):
    return list_user_reports(
        db,
        account_id=account.Id,
        page=page,
        page_size=page_size,
        category=category,
        assessment_id=(assessment_id or "").strip() or None,
    )


@web_report_router.get("/{public_id}", summary="获取当前用户 EAP 测评报告详情")
def get_assessment_report(
    public_id: str,
    request: Request,
    account: AppAccount = Depends(_require_patient),
    db: Session = Depends(get_db),
):
    try:
        row = get_user_report(db, account_id=account.Id, public_id=public_id)
    except AssessmentReportNotFound as exc:
        _record_report_view(
            db,
            actor=account,
            request=request,
            row=None,
            source="eap",
            report_id=public_id,
            outcome="FAILED",
            include_raw_answers=True,
        )
        _raise_report_http_error(exc)
    result = report_detail(row, include_raw_answers=True)
    _record_report_view(
        db,
        actor=account,
        request=request,
        row=row,
        source="eap",
        report_id=public_id,
        outcome="SUCCEEDED",
        include_raw_answers=True,
    )
    return result


@web_report_router.delete("/{public_id}", summary="删除当前用户 EAP 测评报告")
def delete_assessment_report(
    public_id: str,
    request: Request,
    account: AppAccount = Depends(_require_patient),
    db: Session = Depends(get_db),
):
    try:
        delete_user_report(
            db,
            account=account,
            public_id=public_id,
            request_id=_request_id(request),
        )
        return {"deleted": True, "publicId": public_id}
    except AssessmentReportError as exc:
        _raise_report_http_error(exc)


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


def _utc_naive(value: Optional[datetime]) -> Optional[datetime]:
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _account_display_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "已注销用户"
    return account.RealName or account.Nickname or account.Mobile or f"用户 {account.Id}"


def _eap_admin_item(
    row: AppAssessmentReport,
    account: Optional[AppAccount],
) -> dict[str, Any]:
    return {
        "source": "eap",
        "reportId": row.PublicId,
        "accountId": row.AccountId,
        "patientName": _account_display_name(account),
        "patientMobile": account.Mobile if account else None,
        "assessmentId": row.AssessmentId,
        "assessmentVersion": row.AssessmentVersion,
        "category": row.Category,
        "assessmentTitle": row.AssessmentTitle,
        "resultSummary": row.ResultSummary or "",
        "completedAt": _utc_iso(row.CompletedAt),
    }


def _legacy_admin_item(
    row: AppPsychScaleResult,
    account: Optional[AppAccount],
) -> dict[str, Any]:
    scale_type = row.ScaleType.upper().replace("-", "")
    interpretation = interpret_scale(scale_type, row.Total)
    return {
        "source": "mini-legacy",
        "reportId": str(row.Id),
        "accountId": row.AccountId,
        "patientName": _account_display_name(account),
        "patientMobile": account.Mobile if account else None,
        "assessmentId": scale_type,
        "assessmentVersion": None,
        "category": "professional",
        "assessmentTitle": scale_label(scale_type),
        "resultSummary": interpretation["resultSummary"],
        "completedAt": _utc_iso(row.CreatedAt),
    }


def _filtered_patient_ids(
    db: Session,
    visitor_ids: set[int],
    keyword: Optional[str],
) -> tuple[set[int], dict[int, AppAccount]]:
    if not visitor_ids:
        return set(), {}
    accounts = db.query(AppAccount).filter(AppAccount.Id.in_(visitor_ids)).all()
    account_map = {account.Id: account for account in accounts}
    normalized = (keyword or "").strip().casefold()
    if not normalized:
        return set(visitor_ids), account_map
    matched = {
        account.Id
        for account in accounts
        if normalized
        in " ".join(
            value
            for value in (account.RealName, account.Nickname, account.Mobile)
            if value
        ).casefold()
    }
    return matched, account_map


def _admin_report_items(
    db: Session,
    *,
    visitor_ids: set[int],
    keyword: Optional[str],
    assessment_id: Optional[str],
    category: Optional[AssessmentCategory],
    source: Optional[AssessmentReportSource],
    start_at: Optional[datetime],
    end_at: Optional[datetime],
) -> list[dict[str, Any]]:
    patient_ids, account_map = _filtered_patient_ids(db, visitor_ids, keyword)
    if not patient_ids:
        return []

    result: list[dict[str, Any]] = []
    normalized_assessment = (assessment_id or "").strip()
    start_at = _utc_naive(start_at)
    end_at = _utc_naive(end_at)
    if source in (None, "eap"):
        query = (
            db.query(AppAssessmentReport)
            .options(
                load_only(
                    AppAssessmentReport.PublicId,
                    AppAssessmentReport.AccountId,
                    AppAssessmentReport.AssessmentId,
                    AppAssessmentReport.AssessmentVersion,
                    AppAssessmentReport.Category,
                    AppAssessmentReport.AssessmentTitle,
                    AppAssessmentReport.ResultSummary,
                    AppAssessmentReport.CompletedAt,
                )
            )
            .filter(
                AppAssessmentReport.AccountId.in_(patient_ids),
                AppAssessmentReport.DeletedAt.is_(None),
            )
        )
        if normalized_assessment:
            query = query.filter(AppAssessmentReport.AssessmentId == normalized_assessment)
        if category:
            query = query.filter(AppAssessmentReport.Category == category)
        if start_at:
            query = query.filter(AppAssessmentReport.CompletedAt >= start_at)
        if end_at:
            query = query.filter(AppAssessmentReport.CompletedAt <= end_at)
        result.extend(
            _eap_admin_item(row, account_map.get(row.AccountId)) for row in query.all()
        )

    if source in (None, "mini-legacy") and category in (None, "professional"):
        query = (
            db.query(AppPsychScaleResult)
            .options(
                load_only(
                    AppPsychScaleResult.Id,
                    AppPsychScaleResult.AccountId,
                    AppPsychScaleResult.ScaleType,
                    AppPsychScaleResult.Total,
                    AppPsychScaleResult.CreatedAt,
                )
            )
            .filter(AppPsychScaleResult.AccountId.in_(patient_ids))
        )
        if normalized_assessment:
            normalized_legacy = normalized_assessment.upper().replace("-", "")
            query = query.filter(AppPsychScaleResult.ScaleType == normalized_legacy)
        if start_at:
            query = query.filter(AppPsychScaleResult.CreatedAt >= start_at)
        if end_at:
            query = query.filter(AppPsychScaleResult.CreatedAt <= end_at)
        result.extend(
            _legacy_admin_item(row, account_map.get(row.AccountId)) for row in query.all()
        )

    result.sort(
        key=lambda item: (item["completedAt"], item["source"], item["reportId"]),
        reverse=True,
    )
    return result


def register_assessment_report_admin_routes(
    router: APIRouter,
    *,
    require_assessment_viewer: Callable[..., Any],
    visitor_patient_ids: Callable[[Session], set[int]],
) -> None:
    """把报告管理接口注册到现有 `/api/mini/admin` 路由。"""

    @router.get("/assessment-reports", summary="管理后台量表报告列表")
    def list_admin_assessment_reports(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        keyword: Optional[str] = Query(None, max_length=100),
        assessment_id: Optional[str] = Query(None, max_length=80),
        category: Optional[AssessmentCategory] = Query(None),
        source: Optional[AssessmentReportSource] = Query(None),
        start_at: Optional[datetime] = Query(None),
        end_at: Optional[datetime] = Query(None),
        _actor: AppAccount = Depends(require_assessment_viewer),
        db: Session = Depends(get_db),
    ):
        normalized_start = _utc_naive(start_at)
        normalized_end = _utc_naive(end_at)
        if normalized_start and normalized_end and normalized_start > normalized_end:
            raise HTTPException(status_code=422, detail="开始时间不能晚于结束时间")
        items = _admin_report_items(
            db,
            visitor_ids=visitor_patient_ids(db),
            keyword=keyword,
            assessment_id=assessment_id,
            category=category,
            source=source,
            start_at=normalized_start,
            end_at=normalized_end,
        )
        start = (page - 1) * page_size
        return {
            "items": items[start : start + page_size],
            "page": page,
            "pageSize": page_size,
            "total": len(items),
        }

    @router.get(
        "/assessment-reports/{source}/{report_id}",
        summary="管理后台量表报告详情",
    )
    def get_admin_assessment_report(
        source: AssessmentReportSource,
        report_id: str,
        request: Request,
        actor: AppAccount = Depends(require_assessment_viewer),
        db: Session = Depends(get_db),
    ):
        visitor_ids = visitor_patient_ids(db)
        role = get_account_role(db, actor.Id)
        include_raw = role in {"Ops", "Admin"}
        if source == "eap":
            row = (
                db.query(AppAssessmentReport)
                .filter(
                    AppAssessmentReport.PublicId == report_id,
                    AppAssessmentReport.AccountId.in_(visitor_ids),
                    AppAssessmentReport.DeletedAt.is_(None),
                )
                .first()
            )
            if not row:
                _record_report_view(
                    db,
                    actor=actor,
                    request=request,
                    row=None,
                    source=source,
                    report_id=report_id,
                    outcome="FAILED",
                    include_raw_answers=include_raw,
                )
                raise HTTPException(status_code=404, detail="量表报告不存在")
            account = db.query(AppAccount).filter(AppAccount.Id == row.AccountId).first()
            result = {
                **_eap_admin_item(row, account),
                **report_detail(row, include_raw_answers=include_raw),
            }
            _record_report_view(
                db,
                actor=actor,
                request=request,
                row=row,
                source=source,
                report_id=report_id,
                outcome="SUCCEEDED",
                include_raw_answers=include_raw,
            )
            return result

        try:
            legacy_id = int(report_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="量表报告不存在") from exc
        row = (
            db.query(AppPsychScaleResult)
            .filter(
                AppPsychScaleResult.Id == legacy_id,
                AppPsychScaleResult.AccountId.in_(visitor_ids),
            )
            .first()
        )
        if not row:
            _record_report_view(
                db,
                actor=actor,
                request=request,
                row=None,
                source=source,
                report_id=report_id,
                outcome="FAILED",
                include_raw_answers=include_raw,
            )
            raise HTTPException(status_code=404, detail="量表报告不存在")
        account = db.query(AppAccount).filter(AppAccount.Id == row.AccountId).first()
        detail = result_dict(
            row.Id,
            row.ScaleType,
            decode_answers(row.Answers),
            row.Total,
            row.CreatedAt,
        )
        if not include_raw:
            detail.pop("answers", None)
        result = {**_legacy_admin_item(row, account), "result": detail}
        _record_report_view(
            db,
            actor=actor,
            request=request,
            row=None,
            source=source,
            report_id=report_id,
            outcome="SUCCEEDED",
            include_raw_answers=include_raw,
        )
        return result

    @router.get(
        "/boards/patients/{account_id}/assessment-reports",
        summary="指定来访者量表报告",
    )
    def list_patient_assessment_reports(
        account_id: int,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        source: Optional[AssessmentReportSource] = Query(None),
        _actor: AppAccount = Depends(require_assessment_viewer),
        db: Session = Depends(get_db),
    ):
        if account_id not in visitor_patient_ids(db):
            raise HTTPException(status_code=404, detail="来访者不存在")
        items = _admin_report_items(
            db,
            visitor_ids={account_id},
            keyword=None,
            assessment_id=None,
            category=None,
            source=source,
            start_at=None,
            end_at=None,
        )
        start = (page - 1) * page_size
        return {
            "items": items[start : start + page_size],
            "page": page,
            "pageSize": page_size,
            "total": len(items),
        }
