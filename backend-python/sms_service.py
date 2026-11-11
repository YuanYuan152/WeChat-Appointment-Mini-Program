"""短信验证码服务（开发 Mock / 生产腾讯云 SMS）。"""

import logging
import re
import secrets

from datetime import timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app_time import china_now
from config import settings
from models import AppSmsVerification

PHONE_PATTERN = re.compile(r"^1\d{10}$")
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


TOO_MANY_ATTEMPTS_DETAIL = "验证码错误次数过多，请重新获取验证码"


def _max_attempts() -> int:
    return max(1, settings.SMS_CODE_MAX_ATTEMPTS)


def _attempts_exhausted(record: AppSmsVerification) -> bool:
    return (record.FailedAttempts or 0) >= _max_attempts()


def _latest_pending_code(
    db: Session,
    mobile: str,
    purpose: str,
    now,
    *,
    lock: bool = False,
) -> Optional[AppSmsVerification]:
    """(手机号, 用途) 下最新一条未核销、未过期的验证码。

    同一时刻只认这一条：校验只比对它，重发也只复用它；它因输错过多作废后，
    重发会生成新码，而不是退回去复用更早的码。
    """
    query = (
        db.query(AppSmsVerification)
        .filter(
            AppSmsVerification.Mobile == mobile,
            AppSmsVerification.Purpose == purpose,
            AppSmsVerification.UsedAt.is_(None),
            AppSmsVerification.ExpiresAt >= now,
        )
        .order_by(AppSmsVerification.Id.desc())
    )
    if lock:
        # SQLAlchemy 的 SQL Server 方言会忽略 with_for_update()，这里显式加表提示；
        # 其他数据库（单测用的 SQLite）自动忽略该提示。
        query = query.with_hint(AppSmsVerification, "WITH (UPDLOCK, ROWLOCK)", "mssql")
    return query.first()


def _find_reusable_code(
    db: Session,
    mobile: str,
    purpose: str,
    now,
) -> Optional[AppSmsVerification]:
    record = _latest_pending_code(db, mobile, purpose, now)
    if record is None or _attempts_exhausted(record):
        return None
    return record


def _assert_resend_allowed(db: Session, mobile: str, purpose: str, now) -> None:
    """按该号码、该用途最后一次下发的时间限制重发频率。

    有效期内重发复用旧验证码时 CreatedAt 不变、只刷新 LastSentAt，所以按
    LastSentAt 计算；补列前的旧记录 LastSentAt 为空，退回 CreatedAt。
    """
    interval = max(1, settings.SMS_RESEND_INTERVAL_SECONDS)
    sent_at = func.coalesce(AppSmsVerification.LastSentAt, AppSmsVerification.CreatedAt)
    last_sent_at = (
        db.query(func.max(sent_at))
        .filter(
            AppSmsVerification.Mobile == mobile,
            AppSmsVerification.Purpose == purpose,
            sent_at >= now - timedelta(seconds=interval),
        )
        .scalar()
    )
    if last_sent_at is None:
        return
    elapsed = (now - last_sent_at).total_seconds()
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

    _assert_resend_allowed(db, mobile, purpose, now)

    # 有效期内重发复用同一验证码，输错次数跟着这个码走、重发不清零；没有可复用的
    # （从未发过、已核销、已过期或已因输错过多作废）才生成新码。
    record = _find_reusable_code(db, mobile, purpose, now)
    if record is None:
        record = AppSmsVerification(
            Mobile=mobile,
            Code=generate_code(),
            Purpose=purpose,
            ExpiresAt=now + timedelta(minutes=settings.SMS_CODE_TTL_MINUTES),
            CreatedAt=now,
        )
        db.add(record)
    # 复用旧码时也要刷新，重发间隔才会从这次下发重新计算。先写入（未提交）再下发：
    # 下发失败整体回滚，失败的这次不占用重发间隔。
    record.LastSentAt = now
    code, expires_at = record.Code, record.ExpiresAt
    db.flush()

    try:
        _dispatch_sms(mobile, code, purpose)
    except Exception:
        db.rollback()
        raise

    db.commit()
    return _build_send_response(code, expires_at)


def verify_code(
    db: Session,
    mobile: str,
    code: str,
    purpose: str = "login",
    *,
    commit: bool = True,
) -> None:
    """校验并核销验证码。

    commit=False 时只在当前事务内标记已使用，由调用方与后续写入（如创建账号）
    一起提交；后续步骤失败回滚时验证码不会被白白消耗。查询加行锁，并发重复
    提交同一验证码时只有一个请求能核销成功。

    同一验证码累计输错 SMS_CODE_MAX_ATTEMPTS 次即作废，之后输入正确也不再通过，
    只能重新获取。输错时不论 commit 取何值，都会在抛出 400 之前提交错误计数
    （请求出错结束时会话会回滚，不提交计数就丢了）；自增和提交都在持有行锁时
    完成，并发猜码也逐个计数。所以调用方必须在写入自己的业务数据之前调用本函数，
    否则输错时那些写入会被一并提交。
    """
    mobile = normalize_phone(mobile)
    code = _validate_code_format(code)
    purpose = purpose or "login"

    now = china_now()
    record = _latest_pending_code(db, mobile, purpose, now, lock=True)
    if not record:
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    if _attempts_exhausted(record):
        raise HTTPException(status_code=400, detail=TOO_MANY_ATTEMPTS_DETAIL)

    if secrets.compare_digest(record.Code, code):
        record.UsedAt = now
        if commit:
            db.commit()
        else:
            db.flush()
        return

    failed_attempts = (record.FailedAttempts or 0) + 1
    # 在库里用表达式自增：即使行锁没生效，并发请求也不会互相覆盖而少计。
    record.FailedAttempts = AppSmsVerification.FailedAttempts + 1
    db.commit()

    remaining = _max_attempts() - failed_attempts
    if remaining <= 0:
        logger.warning(
            "sms_code_attempts_exhausted",
            extra={"event": "sms_code_attempts_exhausted", "purpose": purpose},
        )
        raise HTTPException(status_code=400, detail=TOO_MANY_ATTEMPTS_DETAIL)
    raise HTTPException(status_code=400, detail=f"验证码错误，还可尝试 {remaining} 次")
