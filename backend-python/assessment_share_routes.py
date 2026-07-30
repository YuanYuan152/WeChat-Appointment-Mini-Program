"""EAP 量表扫码跳转和管理端分享统计接口。"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Callable, Optional
from urllib.parse import quote, urlencode
from zoneinfo import ZoneInfo

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
    add_scan_if_not_recent,
    assessment_share_stats,
    decode_share_code,
    new_visitor_token,
    normalize_assessment_public_base_url,
    normalize_visitor_token,
    visitor_hash,
)
from config import settings
from database import get_db
from models import AppAccount


router = APIRouter(
    prefix="/api/web/assessment-shares",
    tags=["Web Assessment Shares"],
)
logger = logging.getLogger("uvicorn.error")
_CHINA_TIMEZONE = ZoneInfo("Asia/Shanghai")
_DATE_ONLY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _utc_naive(value: Optional[datetime]) -> Optional[datetime]:
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _date_only_boundary(
    raw_value: Optional[str],
    *,
    is_end: bool,
) -> Optional[datetime]:
    """Convert a bare China calendar date to an exclusive UTC range boundary."""
    normalized = (raw_value or "").strip()
    if not _DATE_ONLY_PATTERN.fullmatch(normalized):
        return None
    try:
        local_date = date.fromisoformat(normalized)
    except ValueError:
        return None
    if is_end:
        local_date += timedelta(days=1)
    local_boundary = datetime.combine(local_date, time.min, tzinfo=_CHINA_TIMEZONE)
    return local_boundary.astimezone(timezone.utc).replace(tzinfo=None)


def _normalize_stats_bound(
    parsed_value: Optional[datetime],
    raw_value: Optional[str],
    *,
    is_end: bool,
) -> tuple[Optional[datetime], bool]:
    """Preserve precise datetimes while accepting a bare China natural date."""
    if parsed_value is None:
        return None, False
    date_boundary = _date_only_boundary(raw_value, is_end=is_end)
    if date_boundary is not None:
        return date_boundary, is_end
    return _utc_naive(parsed_value), False


def _raise_share_http_error(exc: Exception) -> None:
    if isinstance(exc, AssessmentShareConfigurationError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, (AssessmentShareCodeError, AssessmentDefinitionError)):
        # 对外统一 404，避免用响应差异探测量表或签名细节。
        raise HTTPException(status_code=404, detail="分享链接无效或已失效") from exc
    raise HTTPException(status_code=500, detail="量表分享服务异常") from exc


def _resolve_assessment_share_target(
    share_code: str,
) -> tuple[str, str, str]:
    """Validate a share code and build its published assessment target."""
    normalized_share_code = share_code.strip()
    try:
        assessment_id = decode_share_code(normalized_share_code)
        published = get_assessment_store().get_published(assessment_id)
    except (
        AssessmentShareCodeError,
        AssessmentShareConfigurationError,
        AssessmentDefinitionError,
    ) as exc:
        _raise_share_http_error(exc)

    try:
        frontend_base = normalize_assessment_public_base_url(
            settings.ASSESSMENT_FRONTEND_BASE_URL,
            setting_name="量表页面地址",
        )
    except AssessmentShareConfigurationError as exc:
        _raise_share_http_error(exc)

    definition = published["definition"]
    query = urlencode({"shareCode": normalized_share_code})
    target = (
        f"{frontend_base}/assessment/{quote(definition['category'], safe='')}/"
        f"{quote(assessment_id, safe='')}?{query}"
    )
    return normalized_share_code, assessment_id, target


def _share_redirect(target: str) -> RedirectResponse:
    response = RedirectResponse(url=target, status_code=302)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@router.head("/{share_code}/scan", response_class=RedirectResponse)
def inspect_assessment_share(share_code: str):
    """Validate a share URL without recording a scan or setting a visitor cookie."""
    _, _, target = _resolve_assessment_share_target(share_code)
    return _share_redirect(target)


@router.get("/{share_code}/scan", response_class=RedirectResponse)
def scan_assessment_share(
    share_code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_share_code, assessment_id, target = (
        _resolve_assessment_share_target(share_code)
    )

    visitor_token = normalize_visitor_token(
        request.cookies.get(VISITOR_COOKIE_NAME)
    ) or new_visitor_token()
    visitor_hash_value = visitor_hash(visitor_token)
    try:
        if add_scan_if_not_recent(
            db,
            share_code=normalized_share_code,
            assessment_id=assessment_id,
            visitor_hash_value=visitor_hash_value,
            scanned_at=_utc_now(),
        ):
            db.commit()
    except Exception as exc:
        # Tracking is ancillary: a transient database error must not make a
        # valid static QR code unusable. Roll back this session and still
        # return the normal redirect below.
        try:
            db.rollback()
        except Exception as rollback_exc:
            logger.error(
                "assessment share scan rollback failed",
                extra={
                    "event": "assessment_share_scan_rollback_failed",
                    "result": type(rollback_exc).__name__,
                },
            )
        logger.error(
            "assessment share scan tracking failed",
            extra={
                "event": "assessment_share_scan_tracking_failed",
                "result": type(exc).__name__,
            },
        )

    response = _share_redirect(target)
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
        normalized_start, _ = _normalize_stats_bound(
            start_at,
            request.query_params.get("start_at"),
            is_end=False,
        )
        normalized_end, end_at_exclusive = _normalize_stats_bound(
            end_at,
            request.query_params.get("end_at"),
            is_end=True,
        )
        if (
            normalized_start
            and normalized_end
            and (
                normalized_start >= normalized_end
                if end_at_exclusive
                else normalized_start > normalized_end
            )
        ):
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
            end_at_exclusive=end_at_exclusive,
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
                "endAtExclusive": end_at_exclusive,
                "scanCount": result["scanCount"],
                "uniqueScanCount": result["uniqueScanCount"],
                "completedReportCount": result["completedReportCount"],
            },
            outcome="SUCCEEDED",
        )
        db.commit()
        return result
