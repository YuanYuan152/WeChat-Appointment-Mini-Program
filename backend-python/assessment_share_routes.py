"""EAP 量表扫码跳转和管理端分享统计接口。"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Optional
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from assessment_audit_service import begin_assessment_audit
from assessment_definition_service import AssessmentDefinitionError
from assessment_routes import get_assessment_store
from assessment_share_service import (
    VISITOR_COOKIE_MAX_AGE,
    VISITOR_COOKIE_NAME,
    AssessmentShareCodeError,
    AssessmentShareConfigurationError,
    assessment_share_stats,
    decode_share_code,
    new_visitor_token,
    normalize_visitor_token,
    visitor_hash,
)
from config import settings
from database import get_db
from models import AppAccount, AppAssessmentShareScan


router = APIRouter(
    prefix="/api/web/assessment-shares",
    tags=["Web Assessment Shares"],
)


def _utc_naive(value: Optional[datetime]) -> Optional[datetime]:
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _raise_share_http_error(exc: Exception) -> None:
    if isinstance(exc, AssessmentShareConfigurationError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, (AssessmentShareCodeError, AssessmentDefinitionError)):
        # 对外统一 404，避免用响应差异探测量表或签名细节。
        raise HTTPException(status_code=404, detail="分享链接无效或已失效") from exc
    raise HTTPException(status_code=500, detail="量表分享服务异常") from exc


@router.get("/{share_code}/scan", response_class=RedirectResponse)
def scan_assessment_share(
    share_code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_share_code = share_code.strip()
    try:
        assessment_id = decode_share_code(normalized_share_code)
        published = get_assessment_store().get_published(assessment_id)
    except (AssessmentShareCodeError, AssessmentShareConfigurationError, AssessmentDefinitionError) as exc:
        _raise_share_http_error(exc)

    frontend_base = settings.ASSESSMENT_FRONTEND_BASE_URL.strip().rstrip("/")
    if not frontend_base:
        raise HTTPException(status_code=503, detail="量表页面地址尚未配置")

    visitor_token = normalize_visitor_token(
        request.cookies.get(VISITOR_COOKIE_NAME)
    ) or new_visitor_token()
    row = AppAssessmentShareScan(
        ShareCode=normalized_share_code,
        AssessmentId=assessment_id,
        VisitorHash=visitor_hash(visitor_token),
        ScannedAt=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(row)
    db.commit()

    definition = published["definition"]
    query = urlencode({"shareCode": normalized_share_code})
    target = (
        f"{frontend_base}/assessment/{quote(definition['category'], safe='')}/"
        f"{quote(assessment_id, safe='')}?{query}"
    )
    response = RedirectResponse(url=target, status_code=302)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.set_cookie(
        VISITOR_COOKIE_NAME,
        visitor_token,
        max_age=VISITOR_COOKIE_MAX_AGE,
        httponly=True,
        secure=(
            request.url.scheme == "https"
            or settings.BASE_URL.strip().lower().startswith("https://")
        ),
        samesite="lax",
        path="/",
    )
    return response


def register_assessment_share_admin_routes(
    admin_router: APIRouter,
    *,
    require_assessment_viewer: Callable[..., Any],
) -> None:
    @admin_router.get(
        "/assessment-share-stats",
        summary="EAP 量表分享扫码统计",
    )
    def get_assessment_share_stats(
        request: Request,
        assessment_id: Optional[str] = Query(None, max_length=80),
        start_at: Optional[datetime] = Query(None),
        end_at: Optional[datetime] = Query(None),
        actor: AppAccount = Depends(require_assessment_viewer),
        db: Session = Depends(get_db),
    ):
        normalized_assessment_id = (assessment_id or "").strip() or None
        normalized_start = _utc_naive(start_at)
        normalized_end = _utc_naive(end_at)
        if normalized_start and normalized_end and normalized_start > normalized_end:
            raise HTTPException(status_code=422, detail="开始时间不能晚于结束时间")

        try:
            titles = {
                item["id"]: item["title"]
                for item in get_assessment_store().list_published()
            }
        except AssessmentDefinitionError:
            titles = {}
        result = assessment_share_stats(
            db,
            assessment_id=normalized_assessment_id,
            start_at=normalized_start,
            end_at=normalized_end,
            assessment_titles=titles,
        )
        begin_assessment_audit(
            db,
            actor=actor,
            action="SHARE_STATS_VIEW",
            target_type="ASSESSMENT",
            request_id=request.headers.get("x-request-id"),
            assessment_id=normalized_assessment_id,
            metadata={
                "startAt": normalized_start.isoformat() if normalized_start else None,
                "endAt": normalized_end.isoformat() if normalized_end else None,
                "scanCount": result["scanCount"],
                "uniqueScanCount": result["uniqueScanCount"],
                "completedReportCount": result["completedReportCount"],
            },
            outcome="SUCCEEDED",
        )
        db.commit()
        return result
