"""系统设置 API（读取 / 管理员修改）。"""

from pydantic import BaseModel, Field, field_validator

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import AppAccount
from system_setting_service import (
    MAX_PROXY_ORDER_TTL_MINUTES,
    MIN_PROXY_ORDER_TTL_MINUTES,
    PROXY_ORDER_TTL_STEP_MINUTES,
    format_proxy_order_ttl_duration,
    get_proxy_order_ttl_minutes,
    set_proxy_order_ttl_minutes,
)


class SystemSettingsOut(BaseModel):
    proxyOrderTtlMinutes: int
    proxyOrderTtlLabel: str
    proxyOrderTtlMinMinutes: int = MIN_PROXY_ORDER_TTL_MINUTES
    proxyOrderTtlMaxMinutes: int = MAX_PROXY_ORDER_TTL_MINUTES
    proxyOrderTtlStepMinutes: int = PROXY_ORDER_TTL_STEP_MINUTES


class UpdateProxyOrderTtlRequest(BaseModel):
    minutes: int = Field(..., ge=MIN_PROXY_ORDER_TTL_MINUTES, le=MAX_PROXY_ORDER_TTL_MINUTES)

    @field_validator("minutes")
    @classmethod
    def validate_step(cls, value: int) -> int:
        if value % PROXY_ORDER_TTL_STEP_MINUTES != 0:
            raise ValueError(f"须为 {PROXY_ORDER_TTL_STEP_MINUTES} 分钟的整数倍")
        return value


def _build_settings_out(db: Session) -> SystemSettingsOut:
    minutes = get_proxy_order_ttl_minutes(db)
    return SystemSettingsOut(
        proxyOrderTtlMinutes=minutes,
        proxyOrderTtlLabel=format_proxy_order_ttl_duration(minutes),
    )


def register_system_settings_routes(
    admin_router,
    *,
    require_staff_workbench,
    require_admin,
):
    @admin_router.get("/system-settings", response_model=SystemSettingsOut, summary="读取系统设置")
    def get_system_settings(
        _: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        return _build_settings_out(db)

    @admin_router.put(
        "/system-settings/proxy-order-ttl",
        response_model=SystemSettingsOut,
        summary="调整代理预约待支付时限（管理员）",
    )
    def update_proxy_order_ttl(
        body: UpdateProxyOrderTtlRequest,
        admin: AppAccount = Depends(require_admin),
        db: Session = Depends(get_db),
    ):
        try:
            set_proxy_order_ttl_minutes(
                db,
                body.minutes,
                updated_by_account_id=admin.Id,
            )
            db.commit()
        except ValueError as exc:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return _build_settings_out(db)
