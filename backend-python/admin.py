"""管理员轻控制台：最小角色绑定/解绑能力。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from models import AppAccount, AppRoleBinding

router = APIRouter(prefix="/api/mini/admin", tags=["Admin"])


def require_admin(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType == "Admin",
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无管理员权限")
    return current_account


class BindRoleRequest(BaseModel):
    role: str
    target_id: Optional[int] = None


@router.get("/users", summary="管理员用户列表")
def list_admin_users(
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(AppAccount).order_by(AppAccount.Id.desc()).limit(100).all()
    return [
        {
            "id": u.Id,
            "mobile": u.Mobile,
            "nickname": u.Nickname,
            "activeRole": u.ActiveRole,
            "roles": [
                b.RoleType
                for b in db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == u.Id).all()
            ],
        }
        for u in users
    ]


@router.post("/users/{user_id}/roles", summary="绑定用户角色")
def bind_user_role(
    user_id: int,
    body: BindRoleRequest,
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(AppAccount).filter(AppAccount.Id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    existing = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == user_id,
        AppRoleBinding.RoleType == body.role,
    ).first()
    if existing:
        return {"message": "角色已存在"}
    binding = AppRoleBinding(AccountId=user_id, RoleType=body.role, TargetId=body.target_id)
    db.add(binding)
    db.commit()
    return {"message": "角色已绑定"}


@router.delete("/users/{user_id}/roles/{role}", summary="解绑用户角色")
def unbind_user_role(
    user_id: int,
    role: str,
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == user_id,
        AppRoleBinding.RoleType == role,
    ).first()
    if not binding:
        raise HTTPException(status_code=404, detail="角色绑定不存在")
    db.delete(binding)
    db.commit()
    return {"message": "角色已解绑"}
