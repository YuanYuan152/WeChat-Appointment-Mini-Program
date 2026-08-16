"""Web 端短信验证码服务。

开发/测试可使用 mock 发送；关闭 mock 后通过腾讯云短信 API 3.0 发送。
验证码沿用现有 AppSmsVerification 表，不新增数据库字段。
"""

import hmac
import json
import logging
import re
import secrets

from datetime import timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app_time import china_now
from config import settings
from models import AppSmsVerification

PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
logger = logging.getLogger(__name__)


class SmsProviderError(RuntimeError):
    """短信供应商配置或发送失败；消息不得包含密钥、手机号或验证码。"""


def normalize_phone(phone: str) -> str:
    phone = (phone or "").strip()
    if not PHONE_PATTERN.fullmatch(phone):
        raise HTTPException(status_code=400, detail="请输入有效的中国大陆手机号")
    return phone


def _code_length() -> int:
    # 前后端和腾讯云模板统一约定为 6 位数字。
    return settings.SMS_CODE_LENGTH


def generate_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(_code_length()))


def _hash_secret() -> str:
    secret = (settings.SMS_CODE_HASH_SECRET or "").strip()
    if secret:
        return secret
    if not settings.SMS_MOCK:
        raise SmsProviderError("sms code hash secret is not configured")
    # 仅本地 mock 兼容：避免要求开发者额外准备密钥。
    return settings.JWT_SECRET


def _code_digest(mobile: str, purpose: str, code: str) -> str:
    payload = f"{mobile}|{purpose}|{code}".encode("utf-8")
    return hmac.new(_hash_secret().encode("utf-8"), payload, "sha256").hexdigest()[:10]


def _matches_code(record: AppSmsVerification, mobile: str, purpose: str, code: str) -> bool:
    stored = record.Code or ""
    # 兼容升级前尚未过期的明文记录；新记录一律保存 10 位摘要。
    expected = code if stored.isdigit() and len(stored) <= 8 else _code_digest(mobile, purpose, code)
    return hmac.compare_digest(stored, expected)


def _build_send_response(code: str, expires_at) -> dict[str, Any]:
    now = china_now()
    remaining = max(0, int((expires_at - now).total_seconds()))
    response: dict[str, Any] = {
        "message": "验证码已发送",
        "expiresIn": remaining or settings.SMS_CODE_TTL_MINUTES * 60,
        "resendAfter": max(1, settings.SMS_RESEND_INTERVAL_SECONDS),
    }
    if settings.SMS_MOCK:
        response["mockCode"] = code
        logger.info(
            "sms_mock_code_returned",
            extra={"event": "sms_mock_code_returned"},
        )
    return response


def _latest_code(db: Session, mobile: str, purpose: str) -> AppSmsVerification | None:
    return (
        db.query(AppSmsVerification)
        .filter(
            AppSmsVerification.Mobile == mobile,
            AppSmsVerification.Purpose == purpose,
        )
        .order_by(AppSmsVerification.Id.desc())
        .first()
    )


def _enforce_send_limits(db: Session, mobile: str, purpose: str, now) -> None:
    latest = _latest_code(db, mobile, purpose)
    interval = max(1, settings.SMS_RESEND_INTERVAL_SECONDS)
    if latest and latest.CreatedAt:
        elapsed = max(0, int((now - latest.CreatedAt).total_seconds()))
        if elapsed < interval:
            raise HTTPException(
                status_code=429,
                detail=f"请求过于频繁，请在 {interval - elapsed} 秒后重试",
            )

    hourly_limit = max(1, settings.SMS_MAX_SENDS_PER_HOUR)
    sent_in_hour = (
        db.query(AppSmsVerification)
        .filter(
            AppSmsVerification.Mobile == mobile,
            AppSmsVerification.Purpose == purpose,
            AppSmsVerification.CreatedAt >= now - timedelta(hours=1),
        )
        .count()
    )
    if sent_in_hour >= hourly_limit:
        raise HTTPException(status_code=429, detail="验证码发送次数过多，请稍后再试")


def _load_tencent_sdk():
    try:
        from tencentcloud.common import credential
        from tencentcloud.sms.v20210111 import models, sms_client
    except ImportError as exc:  # pragma: no cover - 仅部署缺包时触发
        raise SmsProviderError("tencent cloud sdk is not installed") from exc
    return credential, models, sms_client


def _required_tencent_settings() -> dict[str, str]:
    values = {
        "TENCENTCLOUD_SECRET_ID": settings.TENCENTCLOUD_SECRET_ID,
        "TENCENTCLOUD_SECRET_KEY": settings.TENCENTCLOUD_SECRET_KEY,
        "TENCENT_SMS_REGION": settings.TENCENT_SMS_REGION,
        "TENCENT_SMS_SDK_APP_ID": settings.TENCENT_SMS_SDK_APP_ID,
        "TENCENT_SMS_SIGN_NAME": settings.TENCENT_SMS_SIGN_NAME,
        "TENCENT_SMS_TEMPLATE_ID": settings.TENCENT_SMS_TEMPLATE_ID,
    }
    missing = [name for name, value in values.items() if not (value or "").strip()]
    if missing:
        logger.error(
            "sms_provider_configuration_missing",
            extra={"event": "sms_provider_configuration_missing", "result": ",".join(missing)},
        )
        raise SmsProviderError("tencent sms configuration is incomplete")
    return {name: value.strip() for name, value in values.items()}


def _send_via_tencent(mobile: str, code: str) -> None:
    values = _required_tencent_settings()
    credential, models, sms_client = _load_tencent_sdk()

    try:
        cred = credential.Credential(
            values["TENCENTCLOUD_SECRET_ID"],
            values["TENCENTCLOUD_SECRET_KEY"],
        )
        client = sms_client.SmsClient(cred, values["TENCENT_SMS_REGION"])
        request = models.SendSmsRequest()
        request.from_json_string(
            json.dumps(
                {
                    "PhoneNumberSet": [f"+86{mobile}"],
                    "SmsSdkAppId": values["TENCENT_SMS_SDK_APP_ID"],
                    "SignName": values["TENCENT_SMS_SIGN_NAME"],
                    # 约定模板：您的验证码为 {1}，{2} 分钟内有效。
                    "TemplateId": values["TENCENT_SMS_TEMPLATE_ID"],
                    "TemplateParamSet": [code, str(settings.SMS_CODE_TTL_MINUTES)],
                },
                ensure_ascii=False,
            )
        )
        response = client.SendSms(request)
        statuses = list(response.SendStatusSet or [])
        if not statuses or any(getattr(status, "Code", "") != "Ok" for status in statuses):
            provider_code = getattr(statuses[0], "Code", "empty_status") if statuses else "empty_status"
            logger.warning(
                "sms_provider_rejected",
                extra={"event": "sms_provider_rejected", "result": provider_code},
            )
            raise SmsProviderError("tencent sms rejected the request")
    except SmsProviderError:
        raise
    except Exception as exc:
        logger.error(
            "sms_provider_request_failed",
            extra={"event": "sms_provider_request_failed", "result": type(exc).__name__},
        )
        raise SmsProviderError("tencent sms request failed") from exc


def _deliver_code(mobile: str, code: str) -> None:
    if settings.SMS_MOCK:
        return
    if settings.SMS_PROVIDER == "tencent":
        _send_via_tencent(mobile, code)
        return
    raise SmsProviderError("unsupported sms provider")


def _validate_delivery_configuration() -> None:
    if settings.SMS_MOCK:
        return
    _hash_secret()
    if settings.SMS_PROVIDER == "tencent":
        _required_tencent_settings()
        return
    raise SmsProviderError("unsupported sms provider")


def send_verification_code(db: Session, mobile: str, purpose: str = "login") -> dict[str, Any]:
    mobile = normalize_phone(mobile)
    purpose = (purpose or "login").strip()
    now = china_now()
    try:
        _validate_delivery_configuration()
    except SmsProviderError as exc:
        raise HTTPException(status_code=503, detail="短信服务暂不可用，请稍后重试") from exc
    _enforce_send_limits(db, mobile, purpose, now)

    code = generate_code()
    expires_at = now + timedelta(minutes=max(1, settings.SMS_CODE_TTL_MINUTES))
    record = AppSmsVerification(
        Mobile=mobile,
        Code=_code_digest(mobile, purpose, code),
        Purpose=purpose,
        ExpiresAt=expires_at,
        CreatedAt=now,
    )
    try:
        db.add(record)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(
            "sms_code_persist_failed",
            extra={"event": "sms_code_persist_failed", "result": type(exc).__name__},
        )
        raise HTTPException(status_code=503, detail="短信服务暂不可用，请稍后重试")

    try:
        _deliver_code(mobile, code)
    except SmsProviderError as exc:
        # 已持久化但未确认发送的验证码立即作废，避免供应商恢复后被误用。
        record.UsedAt = china_now()
        try:
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=503, detail="短信服务暂不可用，请稍后重试") from exc

    return _build_send_response(code, expires_at)


def _attempt_purpose(record_id: int) -> str:
    return f"vf:{record_id}"


def _verification_attempt_count(db: Session, record: AppSmsVerification) -> int:
    return (
        db.query(AppSmsVerification)
        .filter(
            AppSmsVerification.Mobile == record.Mobile,
            AppSmsVerification.Purpose == _attempt_purpose(record.Id),
        )
        .count()
    )


def _record_failed_attempt(db: Session, record: AppSmsVerification, now) -> None:
    attempts = _verification_attempt_count(db, record) + 1
    db.add(
        AppSmsVerification(
            Mobile=record.Mobile,
            Code="invalid",
            Purpose=_attempt_purpose(record.Id),
            ExpiresAt=record.ExpiresAt,
            CreatedAt=now,
        )
    )
    if attempts >= max(1, settings.SMS_MAX_VERIFY_ATTEMPTS):
        record.UsedAt = now
    db.commit()


def verify_code(db: Session, mobile: str, code: str, purpose: str = "login") -> None:
    mobile = normalize_phone(mobile)
    code = (code or "").strip()
    if not re.fullmatch(rf"\d{{{_code_length()}}}", code):
        raise HTTPException(status_code=400, detail=f"请输入 {_code_length()} 位数字验证码")

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
    if not record:
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    if _verification_attempt_count(db, record) >= max(1, settings.SMS_MAX_VERIFY_ATTEMPTS):
        record.UsedAt = now
        db.commit()
        raise HTTPException(status_code=429, detail="验证码尝试次数过多，请重新获取")

    if not _matches_code(record, mobile, purpose, code):
        _record_failed_attempt(db, record, now)
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    record.UsedAt = now
    db.commit()
