"""管理工作台角色：咨询助理、运营、管理员权限一致。"""

from typing import Optional, Tuple

from sqlalchemy.orm import Session

from models import AppRoleBinding

STAFF_WORKBENCH_ROLES: Tuple[str, ...] = ("Assistant", "Ops", "Admin")


def account_has_staff_workbench(
    db: Session,
    account_id: int,
    active_role: Optional[str] = None,
) -> bool:
    if active_role in STAFF_WORKBENCH_ROLES:
        return True
    row = (
        db.query(AppRoleBinding.AccountId)
        .filter(
            AppRoleBinding.AccountId == account_id,
            AppRoleBinding.RoleType.in_(STAFF_WORKBENCH_ROLES),
        )
        .first()
    )
    return row is not None


def staff_workbench_account_ids(db: Session) -> list[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType.in_(STAFF_WORKBENCH_ROLES))
        .distinct()
        .all()
    )
    return [r[0] for r in rows]
