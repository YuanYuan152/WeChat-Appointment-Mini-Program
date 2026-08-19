"""用户个人中心默认头像（账号资料），与咨询师对外展示头像分离。"""

from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from models import AppAccount

DEFAULT_USER_AVATAR = "/static/images-opt/default-avatar.png"

STAFF_PERSONAL_CENTER_ROLES = frozenset({"Counselor", "Assistant", "Ops", "Admin", "Tester"})


def resolve_user_avatar_url(value: Optional[str]) -> str:
    trimmed = (value or "").strip()
    return trimmed or DEFAULT_USER_AVATAR


def uses_visitor_default_avatar(db: "Session", account_id: int) -> bool:
    """来访个人中心：当前活跃角色为 Patient 时统一默认兔子头像。"""
    from role_active import get_account_role

    return get_account_role(db, account_id) == "Patient"


def resolve_user_avatar_for_account(db: "Session", account: "AppAccount") -> str:
    if uses_visitor_default_avatar(db, account.Id):
        return DEFAULT_USER_AVATAR
    return resolve_user_avatar_url(account.AvatarUrl)


def clear_visitor_account_avatars(db: "Session") -> int:
    """清空所有来访账号在库中的自定义头像 URL（含旧 tc59 / uploads 等）。"""
    from models import AppAccount
    from role_active import get_account_role

    cleared = 0
    for account in db.query(AppAccount).all():
        if get_account_role(db, account.Id) != "Patient":
            continue
        if account.AvatarUrl:
            account.AvatarUrl = None
            cleared += 1
    if cleared:
        db.commit()
    return cleared
