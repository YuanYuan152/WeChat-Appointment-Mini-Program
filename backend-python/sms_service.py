"""短信验证码服务（开发环境 Mock，生产可对接真实短信网关）。"""

import logging
import re
import secrets

from datetime import timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app_time import china_now
from config import settings
from models import AppSmsVerification

PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    phone = (phone or "").strip()
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="请输入有效的中国大陆手机号")
    return phone


def generate_code() -> str:
    length = max(4, min(8, settings.SMS_CODE_LENGTH))
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def _build_send_response(code: str, expires_at) -> dict:
    now = china_now()
    remaining = max(0, int((expires_at - now).total_seconds()))
    response = {
        "message": "验证码已发送",
        "expiresIn": remaining or settings.SMS_CODE_TTL_MINUTES * 60,
    }
    if settings.SMS_MOCK:
        response["mockCode"] = code
        logger.info(
            "sms_mock_code_returned",
            extra={"event": "sms_mock_code_returned"},
        )
    return response


def _find_reusable_code(
    db: Session,
    mobile: str,
    purpose: str,
    now,
) -> Optional[AppSmsVerification]:
    return (
        db.query(AppSmsVerification)
        .filter(
            AppSmsVerification.Mobile == mobile,
            AppSmsVerification.Purpose == purpose,
            AppSmsVerification.UsedAt.is_(None),
            AppSmsVerification.ExpiresAt >= now,
        )
        .order_by(AppSmsVerification.Id.desc())
        .first()
    )


def send_verification_code(db: Session, mobile: str, purpose: str = "login") -> dict:
    mobile = normalize_phone(mobile)
    purpose = purpose or "login"
    now = china_now()

    # A real provider adapter has not been implemented yet. Returning
    # "验证码已发送" after merely writing the code to SQL would be a dangerous
    # false success in production, so non-mock mode fails closed.
    if not settings.SMS_MOCK:
        logger.error(
            "sms_provider_unavailable",
            extra={"event": "sms_provider_unavailable"},
        )
        raise HTTPException(status_code=503, detail="短信服务暂不可用")

    reusable = _find_reusable_code(db, mobile, purpose, now)
    if reusable:
        return _build_send_response(reusable.Code, reusable.ExpiresAt)

    code = generate_code()
    expires_at = now + timedelta(minutes=settings.SMS_CODE_TTL_MINUTES)
    record = AppSmsVerification(
        Mobile=mobile,
        Code=code,
        Purpose=purpose,
        ExpiresAt=expires_at,
        CreatedAt=now,
    )
    db.add(record)
    db.commit()

    return _build_send_response(code, expires_at)


def verify_code(db: Session, mobile: str, code: str, purpose: str = "login") -> None:
    mobile = normalize_phone(mobile)
    code = (code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="请输入验证码")

    now = china_now()
    record = (
        db.query(AppSmsVerification)
        .filter(
            AppSmsVerification.Mobile == mobile,
            AppSmsVerification.Purpose == purpose,
            AppSmsVerification.UsedAt.is_(None),
            AppSmsVerification.ExpiresAt >= now,
        )
        .order_by(AppSmsVerification.Id.desc())
        .first()
    )
    if not record or not secrets.compare_digest(record.Code, code):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    record.UsedAt = now
    db.commit()
