"""新用户默认来访注册：角色绑定与来源标记。"""
from typing import Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppRoleBinding
from role_active import list_account_roles, resolve_active_role
from user_role_meta import PATIENT_SOURCES

# 小程序自主注册默认来源（管理端仍可改为公益/医院等）
DEFAULT_PATIENT_SOURCE = "MINI_PROGRAM"


def patient_source_label(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    return PATIENT_SOURCES.get(code, code)


def ensure_patient_role_binding(db: Session, account_id: int) -> bool:
    exists = (
        db.query(AppRoleBinding)
        .filter(
            AppRoleBinding.AccountId == account_id,
            AppRoleBinding.RoleType == "Patient",
        )
        .first()
    )
    if exists:
        return False
    db.add(
        AppRoleBinding(
            AccountId=account_id,
            RoleType="Patient",
            TargetId=account_id,
        )
    )
    return True


def ensure_default_patient_registration(db: Session, account: AppAccount) -> bool:
    """
    确保账号具备来访基础身份：
    - 写入 Patient 角色绑定（若尚未绑定）
    - 无来源时标记为小程序注册
    - 同步 ActiveRole 为当前最高已绑定角色
    """
    if not getattr(account, "IsActive", True):
        return False

    changed = ensure_patient_role_binding(db, account.Id)
    if not getattr(account, "PatientSource", None):
        account.PatientSource = DEFAULT_PATIENT_SOURCE
        changed = True

    roles = list_account_roles(db, account.Id)
    resolved = resolve_active_role(roles, getattr(account, "ActiveRole", None))
    if getattr(account, "ActiveRole", None) != resolved:
        account.ActiveRole = resolved
        changed = True

    return changed
