"""单账号单角色：AppAccount.ActiveRole 与 AppRoleBinding 保持唯一一致。"""
from typing import Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session

# 历史多绑定时合并用；正常运行期每账号仅一个角色
# Tester：测试账号，可被管理员强制物理删除（含咨询/订单等业务数据）
ROLE_PRIORITY: Sequence[str] = (
    "Patient",
    "Tester",
    "Counselor",
    "Assistant",
    "Ops",
    "Admin",
)

VALID_ROLES = frozenset(ROLE_PRIORITY)


def resolve_highest_role(roles: Iterable[str]) -> str:
    role_set = set(roles or [])
    for role in reversed(ROLE_PRIORITY):
        if role in role_set:
            return role
    return "Patient"


def get_account_role(db: Session, account_id: int) -> str:
    from models import AppAccount, AppRoleBinding

    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    bindings = (
        db.query(AppRoleBinding)
        .filter(AppRoleBinding.AccountId == account_id)
        .order_by(AppRoleBinding.Id.asc())
        .all()
    )
    if len(bindings) == 1:
        role = bindings[0].RoleType
        if account and getattr(account, "ActiveRole", None) != role:
            account.ActiveRole = role
        return role
    if len(bindings) > 1:
        return consolidate_account_role_bindings(db, account_id) or "Patient"
    if account and getattr(account, "ActiveRole", None) in VALID_ROLES:
        return account.ActiveRole
    return "Patient"


def consolidate_account_role_bindings(db: Session, account_id: int) -> str:
    """将历史多角色绑定合并为单角色（保留 ActiveRole 或最高等级）。"""
    from models import AppAccount, AppRoleBinding

    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    bindings = (
        db.query(AppRoleBinding)
        .filter(AppRoleBinding.AccountId == account_id)
        .order_by(AppRoleBinding.Id.asc())
        .all()
    )
    if not bindings:
        role = "Patient"
        if account:
            account.ActiveRole = role
        return role
    if len(bindings) == 1:
        role = bindings[0].RoleType
        if account:
            account.ActiveRole = role
        return role

    role_names = [b.RoleType for b in bindings]
    stored = getattr(account, "ActiveRole", None) if account else None
    keep = stored if stored in role_names else resolve_highest_role(role_names)

    db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.add(
        AppRoleBinding(
            AccountId=account_id,
            RoleType=keep,
            TargetId=account_id,
        )
    )
    if account:
        account.ActiveRole = keep
    return keep


def list_account_roles(db: Session, account_id: int) -> List[str]:
    return [get_account_role(db, account_id)]


def resolve_active_role(
    roles: Iterable[str],
    preferred: Optional[str] = None,
) -> str:
    if preferred in VALID_ROLES:
        return preferred
    role_list = list(roles or [])
    if role_list:
        return role_list[0]
    return "Patient"


def set_account_role(
    db: Session,
    account_id: int,
    role: str,
    target_id: Optional[int] = None,
) -> str:
    from models import AppAccount, AppRoleBinding

    if role not in VALID_ROLES:
        raise ValueError(f"不支持的角色: {role}")

    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    tid = target_id if target_id is not None else account_id

    db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.add(AppRoleBinding(AccountId=account_id, RoleType=role, TargetId=tid))
    if account:
        account.ActiveRole = role
    return role


def invalidate_user_sessions(db: Session, account_id: int) -> None:
    from models import AppLoginSession

    db.query(AppLoginSession).filter(
        AppLoginSession.AccountId == account_id
    ).delete(synchronize_session=False)
