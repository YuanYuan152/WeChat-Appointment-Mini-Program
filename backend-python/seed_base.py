"""各角色演示数据脚本的公共工具：清表、建账号、绑角色。"""

from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app_time import china_now
from models import AppAccount, AppRoleBinding

# 按依赖顺序删除，避免残留关联数据
APP_TABLES_DELETE_ORDER = [
    "AppCaseRecordRevision",
    "AppCaseRecord",
    "AppConsultationFeedback",
    "AppRefundExemption",
    "AppScheduleCancelLog",
    "AppLeaveRequest",
    "AppConsultation",
    "AppContactRecord",
    "AppTask",
    "AppRiskAlert",
    "AppMessageLog",
    "AppRemindTask",
    "AppMessage",
    "AppRegistrationForm",
    "AppFeedback",
    "AppOrder",
    "AppConsultationRoomSlot",
    "AppSchedule",
    "AppConsultationRoom",
    "AppCounselorProfile",
    "AppRoleSwitchLog",
    "AppLoginSession",
    "AppRoleBinding",
    "AppBanner",
    "AppActivity",
    "AppArticle",
    "AppSubscribeTemplate",
    "AppAccount",
]


def clear_all_tables(db: Session) -> None:
    """清空所有 App 业务表数据。"""
    for table in APP_TABLES_DELETE_ORDER:
        db.execute(text(f"DELETE FROM [{table}]"))
    db.flush()
    print(f"[OK] cleared {len(APP_TABLES_DELETE_ORDER)} tables")


def create_account(
    db: Session,
    *,
    mobile: str,
    open_id: str,
    nickname: str,
    active_role: str,
    real_name: str | None = None,
    gender: str | None = None,
    avatar_url: str = "/static/images/tc59.png",
) -> AppAccount:
    account = AppAccount(
        OpenId=open_id,
        Mobile=mobile,
        Nickname=nickname,
        AvatarUrl=avatar_url,
        ActiveRole=active_role,
        RealName=real_name or nickname,
        Gender=gender,
    )
    db.add(account)
    db.flush()
    return account


def bind_role(db: Session, account_id: int, role: str, target_id: int | None = None) -> None:
    db.add(
        AppRoleBinding(
            AccountId=account_id,
            RoleType=role,
            TargetId=target_id or account_id,
        )
    )


def utc_now() -> datetime:
    return datetime.utcnow()


def days_from_now(days: int, hour: int = 10, minute: int = 0) -> datetime:
    """与业务排班一致，使用中国时区当前时间推算。"""
    return (china_now() + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
