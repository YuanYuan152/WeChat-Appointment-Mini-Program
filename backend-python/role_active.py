"""根据已绑定角色解析/校正 ActiveRole。"""
from typing import Iterable, List, Optional, Sequence

# 角色等级由低到高；展示与权限取已绑定角色中的最高等级
ROLE_PRIORITY: Sequence[str] = ("Patient", "Counselor", "Assistant", "Ops", "Admin")


def resolve_highest_role(roles: Iterable[str]) -> str:
    role_set = set(roles or [])
    for role in reversed(ROLE_PRIORITY):
        if role in role_set:
            return role
    return "Patient"


def resolve_active_role(
    roles: Iterable[str],
    preferred: Optional[str] = None,
) -> str:
    """preferred 保留兼容；实际始终返回最高等级角色。"""
    return resolve_highest_role(roles)


def list_account_roles(db, account_id: int) -> List[str]:
    from models import AppRoleBinding

    return [
        b.RoleType
        for b in db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == account_id).all()
    ]


def invalidate_user_sessions(db, account_id: int) -> None:
    from models import AppLoginSession

    db.query(AppLoginSession).filter(
        AppLoginSession.AccountId == account_id
    ).delete(synchronize_session=False)
