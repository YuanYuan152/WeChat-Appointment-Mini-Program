"""短信验证码服务（开发 Mock / 生产腾讯云 SMS）。"""

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


def _validate_code_format(code: str) -> str:
    normalized = (code or "").strip()
    expected_len = settings.SMS_CODE_LENGTH
    if len(normalized) != expected_len or not normalized.isdigit():
        raise HTTPException(status_code=400, detail=f"请输入{expected_len}位数字验证码")
    return normalized


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


def _assert_resend_allowed(db: Session, mobile: str, purpose: str, now) -> None:
    interval = max(1, settings.SMS_RESEND_INTERVAL_SECONDS)
    recent = (
        db.query(AppSmsVerification)
        .filter(
            AppSmsVerification.Mobile == mobile,
            AppSmsVerification.Purpose == purpose,
            AppSmsVerification.CreatedAt >= now - timedelta(seconds=interval),
        )
        .order_by(AppSmsVerification.Id.desc())
        .first()
    )
    if not recent:
        return
    elapsed = (now - recent.CreatedAt).total_seconds()
    wait_seconds = max(1, int(interval - elapsed))
    raise HTTPException(status_code=429, detail=f"发送过于频繁，请 {wait_seconds} 秒后再试")


RESET_PASSWORD_PURPOSES = frozenset({"admin_reset_password", "reset_password"})


def _dispatch_sms(mobile: str, code: str, purpose: str = "login") -> None:
    if settings.SMS_MOCK:
        return
    if purpose in RESET_PASSWORD_PURPOSES:
        if not settings.tencent_sms_base_configured:
            logger.error(
                "sms_provider_unavailable",
                extra={"event": "sms_provider_unavailable", "purpose": purpose},
            )
            raise HTTPException(status_code=503, detail="短信服务暂不可用")
        if not (
            settings.TENCENT_SMS_RESET_PASSWORD_TEMPLATE_ID.strip()
            or settings.TENCENT_SMS_TEMPLATE_ID.strip()
        ):
            raise HTTPException(status_code=503, detail="修改密码短信模板未配置")
        from tencent_sms_client import send_reset_password_code

        send_reset_password_code(mobile, code)
        return

    if not settings.tencent_sms_configured:
        logger.error(
            "sms_provider_unavailable",
            extra={"event": "sms_provider_unavailable", "purpose": purpose},
        )
        raise HTTPException(status_code=503, detail="短信服务暂不可用")
    from tencent_sms_client import send_login_code

    send_login_code(mobile, code)


def send_verification_code(db: Session, mobile: str, purpose: str = "login") -> dict:
    mobile = normalize_phone(mobile)
    purpose = purpose or "login"
    now = china_now()

    reusable = _find_reusable_code(db, mobile, purpose, now)
    if reusable:
        _assert_resend_allowed(db, mobile, purpose, now)
        _dispatch_sms(mobile, reusable.Code, purpose)
        return _build_send_response(reusable.Code, reusable.ExpiresAt)

    _assert_resend_allowed(db, mobile, purpose, now)

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
    db.flush()

    try:
        _dispatch_sms(mobile, code, purpose)
    except Exception:
        db.rollback()
        raise

    db.commit()
    return _build_send_response(code, expires_at)


def verify_code(db: Session, mobile: str, code: str, purpose: str = "login") -> None:
    mobile = normalize_phone(mobile)
    code = _validate_code_format(code)
    purpose = purpose or "login"

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
