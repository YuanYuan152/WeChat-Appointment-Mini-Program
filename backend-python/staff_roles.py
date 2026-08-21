"""管理工作台角色与角色赋权层级。

咨询助理 < 咨询主任 < 管理员（权限依次升高）。
高级别可为低级别账号新建、删除、赋权；低级别不可操作高级别。
同级之间：助理/主任/普通管理员不可互操作。
仅密钥登录管理员（OpenId=demo-openid-admin）可新增、删除、更换其他管理员；
该密钥管理员账号本身不可被删除或更换角色。
来访、咨询师等非管理工作台角色，三者均可赋权与管理。
测试员（Tester）仅管理员可赋权；其它管理工作台角色不可将账号设为测试员。
Tester 可被强制物理删除（含业务数据），其它角色仍受咨询/订单保护。
"""

from typing import Any, Optional

from sqlalchemy.orm import Session

from role_active import get_account_role

STAFF_WORKBENCH_ROLES: tuple[str, ...] = ("Assistant", "Ops", "Admin")

# 管理工作台内部层级：数值越大权限越高
STAFF_ROLE_RANK: dict[str, int] = {
    "Assistant": 1,
    "Ops": 2,
    "Admin": 3,
}

# 仅管理员可赋权的角色
ADMIN_ONLY_ASSIGNABLE_ROLES: frozenset[str] = frozenset({"Tester"})

# 密钥登录入口绑定的演示管理员 OpenId（dev_admin）
KEY_LOGIN_ADMIN_OPENID = "demo-openid-admin"


def is_key_login_admin_account(account: Any) -> bool:
    """是否为密钥登录对应的受保护管理员账号。"""
    openid = ""
    if account is None:
        return False
    if isinstance(account, str):
        openid = account
    else:
        openid = getattr(account, "OpenId", None) or getattr(account, "openId", None) or ""
    return str(openid).strip() == KEY_LOGIN_ADMIN_OPENID


def is_staff_management_role(role: str) -> bool:
    return role in STAFF_ROLE_RANK


def staff_role_rank(role: str) -> int:
    return STAFF_ROLE_RANK.get(role, 0)


def can_actor_assign_role(
    actor_role: str,
    target_role: str,
    *,
    actor_is_key_admin: bool = False,
) -> bool:
    """操作者是否可将 target_role 赋给其他账号。"""
    if actor_role not in STAFF_WORKBENCH_ROLES:
        return False
    if target_role in ADMIN_ONLY_ASSIGNABLE_ROLES:
        return actor_role == "Admin"
    if not is_staff_management_role(target_role):
        return True
    # 仅密钥登录管理员可新建/赋权其他管理员
    if target_role == "Admin":
        return actor_role == "Admin" and actor_is_key_admin
    return staff_role_rank(actor_role) > staff_role_rank(target_role)


def can_actor_manage_user(
    actor_role: str,
    user_role: str,
    *,
    actor_is_key_admin: bool = False,
    target_is_key_admin: bool = False,
) -> bool:
    """操作者是否可删除或更换 user_role 对应账号的角色。"""
    if target_is_key_admin:
        return False
    if actor_role not in STAFF_WORKBENCH_ROLES:
        return False
    if not is_staff_management_role(user_role):
        return True
    # 仅密钥登录管理员可修改/删除其他管理员
    if user_role == "Admin":
        return actor_role == "Admin" and actor_is_key_admin
    return staff_role_rank(actor_role) > staff_role_rank(user_role)


def assignable_roles_for_actor(
    actor_role: str,
    bindable_roles: frozenset[str],
    *,
    actor_is_key_admin: bool = False,
) -> list[str]:
    return [
        role
        for role in bindable_roles
        if can_actor_assign_role(actor_role, role, actor_is_key_admin=actor_is_key_admin)
    ]


STAFF_ROLE_LABELS: dict[str, str] = {
    "Assistant": "咨询助理",
    "Ops": "咨询主任",
    "Admin": "管理员",
}


def role_display_name(role: str) -> str:
    return STAFF_ROLE_LABELS.get(role, role)


def role_management_error(
    actor_role: str,
    target_role: str,
    *,
    action: str,
    actor_is_key_admin: bool = False,
    target_is_key_admin: bool = False,
) -> str:
    if target_is_key_admin:
        return "密钥登录管理员账号不可删除或更换角色"
    if target_role == "Admin" and actor_role == "Admin" and not actor_is_key_admin:
        return f"仅密钥登录管理员可对管理员账号{action}"
    if target_role in ADMIN_ONLY_ASSIGNABLE_ROLES and action == "赋权":
        return "仅管理员可将账号设为测试员"
    if is_staff_management_role(target_role):
        actor_rank = staff_role_rank(actor_role)
        target_rank = staff_role_rank(target_role)
        target_label = role_display_name(target_role)
        if actor_rank == target_rank:
            return f"同级角色之间不可互相{action}"
        if actor_rank < target_rank:
            return f"您的权限不足，无法对「{target_label}」{action}"
    return f"无权对该账号{action}"


def assert_can_assign_role(
    actor_role: str,
    target_role: str,
    *,
    actor_is_key_admin: bool = False,
) -> None:
    if not can_actor_assign_role(
        actor_role,
        target_role,
        actor_is_key_admin=actor_is_key_admin,
    ):
        raise PermissionError(
            role_management_error(
                actor_role,
                target_role,
                action="赋权",
                actor_is_key_admin=actor_is_key_admin,
            )
        )


def assert_can_manage_user(
    actor_role: str,
    user_role: str,
    *,
    actor_is_key_admin: bool = False,
    target_is_key_admin: bool = False,
) -> None:
    if not can_actor_manage_user(
        actor_role,
        user_role,
        actor_is_key_admin=actor_is_key_admin,
        target_is_key_admin=target_is_key_admin,
    ):
        raise PermissionError(
            role_management_error(
                actor_role,
                user_role,
                action="管理",
                actor_is_key_admin=actor_is_key_admin,
                target_is_key_admin=target_is_key_admin,
            )
        )


def account_has_staff_workbench(
    db: Session,
    account_id: int,
    active_role: Optional[str] = None,
) -> bool:
    role = active_role or get_account_role(db, account_id)
    return role in STAFF_WORKBENCH_ROLES


def staff_workbench_account_ids(db: Session) -> list[int]:
    from models import AppRoleBinding

    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType.in_(STAFF_WORKBENCH_ROLES))
        .distinct()
        .all()
    )
    return [r[0] for r in rows]
