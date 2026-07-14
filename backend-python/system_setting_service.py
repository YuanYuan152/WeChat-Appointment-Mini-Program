"""系统配置读写（键值存储）。"""

from typing import Optional

from sqlalchemy.orm import Session

from models import AppSystemSetting

PROXY_ORDER_TTL_MINUTES_KEY = "proxy_order_ttl_minutes"
PROXY_ORDER_TTL_HOURS_KEY = "proxy_order_ttl_hours"  # 旧版键，读取时自动迁移
DEFAULT_PROXY_ORDER_TTL_MINUTES = 120
MIN_PROXY_ORDER_TTL_MINUTES = 5
MAX_PROXY_ORDER_TTL_MINUTES = 24 * 60
PROXY_ORDER_TTL_STEP_MINUTES = 5


def _normalize_proxy_order_ttl_minutes(minutes: int) -> int:
    value = int(minutes)
    value = max(MIN_PROXY_ORDER_TTL_MINUTES, min(MAX_PROXY_ORDER_TTL_MINUTES, value))
    remainder = value % PROXY_ORDER_TTL_STEP_MINUTES
    if remainder:
        value -= remainder
    if value < MIN_PROXY_ORDER_TTL_MINUTES:
        value = MIN_PROXY_ORDER_TTL_MINUTES
    return value


def format_proxy_order_ttl_duration(minutes: Optional[int] = None) -> str:
    ttl = _normalize_proxy_order_ttl_minutes(
        minutes if minutes is not None else DEFAULT_PROXY_ORDER_TTL_MINUTES
    )
    hours, mins = divmod(ttl, 60)
    if hours and mins:
        return f"{hours} 小时 {mins} 分钟"
    if hours:
        return f"{hours} 小时"
    return f"{mins} 分钟"


def _get_setting_row(db: Session, key: str) -> Optional[AppSystemSetting]:
    return db.query(AppSystemSetting).filter(AppSystemSetting.SettingKey == key).first()


def _read_legacy_proxy_order_ttl_minutes(db: Session) -> Optional[int]:
    row = _get_setting_row(db, PROXY_ORDER_TTL_HOURS_KEY)
    if not row or not (row.SettingValue or "").strip():
        return None
    try:
        hours = int(row.SettingValue)
        if 1 <= hours <= MAX_PROXY_ORDER_TTL_MINUTES // 60:
            return hours * 60
    except (TypeError, ValueError):
        return None
    return None


def get_proxy_order_ttl_minutes(db: Session) -> int:
    row = _get_setting_row(db, PROXY_ORDER_TTL_MINUTES_KEY)
    if row and (row.SettingValue or "").strip():
        try:
            return _normalize_proxy_order_ttl_minutes(int(row.SettingValue))
        except (TypeError, ValueError):
            pass
    legacy = _read_legacy_proxy_order_ttl_minutes(db)
    if legacy is not None:
        return _normalize_proxy_order_ttl_minutes(legacy)
    return DEFAULT_PROXY_ORDER_TTL_MINUTES


def set_proxy_order_ttl_minutes(
    db: Session,
    minutes: int,
    *,
    updated_by_account_id: Optional[int] = None,
) -> int:
    normalized = _normalize_proxy_order_ttl_minutes(minutes)
    row = _get_setting_row(db, PROXY_ORDER_TTL_MINUTES_KEY)
    value = str(normalized)
    if row:
        row.SettingValue = value
        row.UpdatedByAccountId = updated_by_account_id
    else:
        db.add(
            AppSystemSetting(
                SettingKey=PROXY_ORDER_TTL_MINUTES_KEY,
                SettingValue=value,
                UpdatedByAccountId=updated_by_account_id,
            )
        )
    db.flush()
    return normalized


def proxy_order_ttl_patient_tip(minutes: Optional[int] = None) -> str:
    label = format_proxy_order_ttl_duration(minutes)
    return f"请在 {label} 内完成支付，逾期订单将自动取消"


def proxy_order_ttl_staff_tip(minutes: Optional[int] = None) -> str:
    label = format_proxy_order_ttl_duration(minutes)
    return f"订单已推送给来访，待来访在 {label} 内完成支付"


def proxy_order_ttl_push_message(minutes: Optional[int] = None) -> str:
    label = format_proxy_order_ttl_duration(minutes)
    return f"订单已推送，来访需在 {label} 内完成支付"
