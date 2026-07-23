"""EAP 静态分享码、匿名扫码标识和聚合统计。"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime
from typing import Any, Optional
from urllib.parse import quote

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from config import settings
from models import AppAssessmentReport, AppAssessmentShareScan


SHARE_CODE_VERSION = "as1"
SHARE_CODE_MAX_LENGTH = 120
VISITOR_COOKIE_NAME = "eap_assessment_visitor"
VISITOR_COOKIE_MAX_AGE = 180 * 24 * 60 * 60
_ASSESSMENT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_VISITOR_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{24,128}$")
_BASE64URL_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


class AssessmentShareError(Exception):
    status_code = 500


class AssessmentShareConfigurationError(AssessmentShareError):
    status_code = 503


class AssessmentShareCodeError(AssessmentShareError):
    status_code = 404


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    try:
        return base64.b64decode(
            f"{value}{padding}",
            altchars=b"-_",
            validate=True,
        )
    except (ValueError, UnicodeEncodeError) as exc:
        raise AssessmentShareCodeError("分享码无效") from exc


def _secret_bytes(secret: Optional[str] = None) -> bytes:
    value = settings.ASSESSMENT_SHARE_SECRET if secret is None else secret
    normalized = value.strip()
    if len(normalized) < 32:
        raise AssessmentShareConfigurationError("量表分享服务尚未配置")
    return normalized.encode("utf-8")


def build_share_code(assessment_id: str, *, secret: Optional[str] = None) -> str:
    """为一份量表生成稳定且不可伪造的静态分享码。"""
    if not _ASSESSMENT_ID_PATTERN.fullmatch(assessment_id):
        raise AssessmentShareCodeError("量表标识无效")
    encoded_id = _base64url_encode(assessment_id.encode("utf-8"))
    signed_part = f"{SHARE_CODE_VERSION}.{encoded_id}"
    signature = _base64url_encode(
        hmac.new(
            _secret_bytes(secret),
            signed_part.encode("ascii"),
            hashlib.sha256,
        ).digest()
    )
    share_code = f"{signed_part}.{signature}"
    if len(share_code) > SHARE_CODE_MAX_LENGTH:
        raise AssessmentShareCodeError("量表标识过长，无法生成分享码")
    return share_code


def decode_share_code(
    share_code: str,
    *,
    expected_assessment_id: Optional[str] = None,
    secret: Optional[str] = None,
) -> str:
    """校验静态码签名并返回量表 ID。"""
    normalized = (share_code or "").strip()
    if not normalized or len(normalized) > SHARE_CODE_MAX_LENGTH:
        raise AssessmentShareCodeError("分享码无效")
    parts = normalized.split(".")
    if len(parts) != 3 or parts[0] != SHARE_CODE_VERSION:
        raise AssessmentShareCodeError("分享码无效")
    version, encoded_id, supplied_signature = parts
    if not _BASE64URL_PATTERN.fullmatch(encoded_id) or not _BASE64URL_PATTERN.fullmatch(
        supplied_signature
    ):
        raise AssessmentShareCodeError("分享码无效")
    expected_signature = _base64url_encode(
        hmac.new(
            _secret_bytes(secret),
            f"{version}.{encoded_id}".encode("ascii"),
            hashlib.sha256,
        ).digest()
    )
    if not hmac.compare_digest(supplied_signature, expected_signature):
        raise AssessmentShareCodeError("分享码无效")
    try:
        assessment_id = _base64url_decode(encoded_id).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise AssessmentShareCodeError("分享码无效") from exc
    if not _ASSESSMENT_ID_PATTERN.fullmatch(assessment_id):
        raise AssessmentShareCodeError("分享码无效")
    if expected_assessment_id and assessment_id != expected_assessment_id:
        raise AssessmentShareCodeError("分享码与量表不匹配")
    return assessment_id


def public_share_info(assessment_id: str) -> dict[str, str]:
    share_code = build_share_code(assessment_id)
    base_url = settings.BASE_URL.strip().rstrip("/")
    if not base_url:
        raise AssessmentShareConfigurationError("量表分享服务地址尚未配置")
    return {
        "shareCode": share_code,
        "shareUrl": (
            f"{base_url}/api/web/assessment-shares/"
            f"{quote(share_code, safe='')}/scan"
        ),
    }


def new_visitor_token() -> str:
    return secrets.token_urlsafe(32)


def normalize_visitor_token(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip()
    return normalized if _VISITOR_TOKEN_PATTERN.fullmatch(normalized) else None


def visitor_hash(visitor_token: str, *, secret: Optional[str] = None) -> str:
    return hmac.new(
        _secret_bytes(secret),
        f"assessment-visitor:{visitor_token}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def assessment_share_stats(
    db: Session,
    *,
    assessment_id: Optional[str],
    start_at: Optional[datetime],
    end_at: Optional[datetime],
    assessment_titles: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """按同一时间窗口统计扫码、近似独立扫码和完成报告数。"""
    scan_query = db.query(AppAssessmentShareScan)
    report_query = db.query(AppAssessmentReport).filter(
        AppAssessmentReport.DeletedAt.is_(None),
        AppAssessmentReport.ShareCode.isnot(None),
        AppAssessmentReport.ShareCode != "",
    )
    if assessment_id:
        scan_query = scan_query.filter(
            AppAssessmentShareScan.AssessmentId == assessment_id
        )
        report_query = report_query.filter(
            AppAssessmentReport.AssessmentId == assessment_id
        )
    if start_at:
        scan_query = scan_query.filter(AppAssessmentShareScan.ScannedAt >= start_at)
        report_query = report_query.filter(AppAssessmentReport.CompletedAt >= start_at)
    if end_at:
        scan_query = scan_query.filter(AppAssessmentShareScan.ScannedAt <= end_at)
        report_query = report_query.filter(AppAssessmentReport.CompletedAt <= end_at)

    scan_count = int(scan_query.count())
    unique_scan_count = int(
        scan_query.with_entities(
            func.count(distinct(AppAssessmentShareScan.VisitorHash))
        ).scalar()
        or 0
    )
    completed_report_count = int(report_query.count())

    scan_groups = {
        row.assessment_id: (int(row.scan_count), int(row.unique_scan_count))
        for row in scan_query.with_entities(
            AppAssessmentShareScan.AssessmentId.label("assessment_id"),
            func.count(AppAssessmentShareScan.Id).label("scan_count"),
            func.count(distinct(AppAssessmentShareScan.VisitorHash)).label(
                "unique_scan_count"
            ),
        )
        .group_by(AppAssessmentShareScan.AssessmentId)
        .all()
    }
    report_groups = {
        row.assessment_id: int(row.completed_report_count)
        for row in report_query.with_entities(
            AppAssessmentReport.AssessmentId.label("assessment_id"),
            func.count(AppAssessmentReport.Id).label("completed_report_count"),
        )
        .group_by(AppAssessmentReport.AssessmentId)
        .all()
    }
    assessment_ids = set(scan_groups) | set(report_groups)
    if assessment_id:
        assessment_ids.add(assessment_id)
    titles = assessment_titles or {}
    items = []
    for item_assessment_id in assessment_ids:
        item_scan_count, item_unique_count = scan_groups.get(
            item_assessment_id, (0, 0)
        )
        item_completed_count = report_groups.get(item_assessment_id, 0)
        items.append(
            {
                "assessmentId": item_assessment_id,
                "assessmentTitle": titles.get(
                    item_assessment_id, item_assessment_id
                ),
                "scanCount": item_scan_count,
                "uniqueScanCount": item_unique_count,
                "completedReportCount": item_completed_count,
                "conversionRate": round(
                    item_completed_count / item_scan_count, 4
                )
                if item_scan_count
                else 0.0,
            }
        )
    items.sort(key=lambda item: (-item["scanCount"], item["assessmentId"]))
    return {
        "scanCount": scan_count,
        "uniqueScanCount": unique_scan_count,
        "completedReportCount": completed_report_count,
        "conversionRate": round(completed_report_count / scan_count, 4)
        if scan_count
        else 0.0,
        "items": items,
    }
