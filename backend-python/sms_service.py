"""短信验证码服务（开发环境 Mock，生产可对接真实短信网关）。"""

import random
import re
from datetime import timedelta

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app_time import china_now
from config import settings
from models import AppSmsVerification

PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")


def normalize_phone(phone: str) -> str:
    phone = (phone or "").strip()
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="请输入有效的中国大陆手机号")
    return phone


def generate_code() -> str:
    length = max(4, min(8, settings.SMS_CODE_LENGTH))
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def _build_send_response(code: str, expires_at) -> dict:
    now = china_now()
    remaining = max(0, int((expires_at - now).total_seconds()))
    response = {
        "message": "验证码已发送",
        "expiresIn": remaining or settings.SMS_CODE_TTL_MINUTES * 60,
    }
    if settings.SMS_MOCK:
        response["mockCode"] = code
        print(f"[SMS_MOCK] code={code}")
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

    reusable = _find_reusable_code(db, mobile, purpose, now)
    if reusable:
        return _build_send_response(reusable.Code, reusable.ExpiresAt)

    if not settings.SMS_MOCK:
        since = now - timedelta(seconds=settings.SMS_RESEND_INTERVAL_SECONDS)
        recent = (
            db.query(AppSmsVerification)
            .filter(
                AppSmsVerification.Mobile == mobile,
                AppSmsVerification.Purpose == purpose,
                AppSmsVerification.CreatedAt >= since,
            )
            .order_by(AppSmsVerification.Id.desc())
            .first()
        )
        if recent:
            elapsed = (now - recent.CreatedAt).total_seconds()
            wait = max(1, int(settings.SMS_RESEND_INTERVAL_SECONDS - elapsed))
            raise HTTPException(
                status_code=429,
                detail=f"发送过于频繁，请 {wait} 秒后再试",
            )

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

    if settings.SMS_MOCK:
        print(f"[SMS_MOCK] {mobile} purpose={purpose} code={code}")

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
    if not record or record.Code != code:
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    record.UsedAt = now
    db.commit()
