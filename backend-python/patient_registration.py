"""新用户默认来访注册：单账号仅一个角色。"""
from typing import Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppRoleBinding
from role_active import get_account_role, set_account_role

DEFAULT_PATIENT_SOURCE = "MINI_PROGRAM"

PATIENT_SOURCES = {
    "MINI_PROGRAM": "小程序注册",
    "CHARITY_VISITOR": "公益来访",
    "CHARITY_PROJECT_1": "公益项目1",
    "CHARITY_PROJECT_2": "公益项目2",
    "HOSPITAL": "医院",
}


def patient_source_label(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    return PATIENT_SOURCES.get(code, code)


def ensure_patient_role_binding(db: Session, account_id: int) -> bool:
    """仅当账号尚无角色绑定时，设为来访。"""
    exists = (
        db.query(AppRoleBinding)
        .filter(AppRoleBinding.AccountId == account_id)
        .first()
    )
    if exists:
        return False
    set_account_role(db, account_id, "Patient")
    return True


def ensure_default_patient_registration(db: Session, account: AppAccount) -> bool:
    """
    小程序自主注册：无角色时设为来访，并标记默认来源。
    已有角色的账号（如管理员添加的咨询师）不会被覆盖为来访。
    """
    if not getattr(account, "IsActive", True):
        return False

    changed = False
    binding = (
        db.query(AppRoleBinding)
        .filter(AppRoleBinding.AccountId == account.Id)
        .first()
    )
    if not binding:
        set_account_role(db, account.Id, "Patient")
        changed = True
    elif getattr(account, "ActiveRole", None) != get_account_role(db, account.Id):
        account.ActiveRole = get_account_role(db, account.Id)
        changed = True

    if get_account_role(db, account.Id) == "Patient" and not getattr(account, "PatientSource", None):
        account.PatientSource = DEFAULT_PATIENT_SOURCE
        changed = True

    return changed
