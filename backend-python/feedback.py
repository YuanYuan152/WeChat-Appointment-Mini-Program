"""意见反馈接口。"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from models import AppAccount, AppFeedback, AppRoleBinding

router = APIRouter(prefix="/api/mini/feedback", tags=["Feedback"])


class FeedbackCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    category: Optional[str] = Field(None, max_length=50)
    contact: Optional[str] = Field(None, max_length=50)


class FeedbackOut(BaseModel):
    id: int
    category: Optional[str] = None
    content: str
    contact: Optional[str] = None
    status: str
    createdAt: datetime


class FeedbackAdminOut(FeedbackOut):
    accountId: int
    userName: Optional[str] = None
    userMobile: Optional[str] = None


def require_ops_or_admin(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType.in_(["Ops", "Admin"]),
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无运营/管理员权限")
    return current_account


def _account_name(account: Optional[AppAccount]) -> Optional[str]:
    if not account:
        return None
    return account.RealName or account.Nickname or account.Mobile or "未留姓名用户"


@router.post("", response_model=FeedbackOut, summary="提交意见反馈")
def submit_feedback(
    body: FeedbackCreate,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    row = AppFeedback(
        AccountId=current_account.Id,
        Category=(body.category or "其他").strip(),
        Content=body.content.strip(),
        Contact=body.contact.strip() if body.contact else None,
        Status="OPEN",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return FeedbackOut(
        id=row.Id,
        category=row.Category,
        content=row.Content,
        contact=row.Contact,
        status=row.Status,
        createdAt=row.CreatedAt,
    )


@router.get("/admin", response_model=List[FeedbackAdminOut], summary="管理员查看意见反馈")
def list_feedback_admin(
    status: Optional[str] = Query(None, description="OPEN / CLOSED / ALL"),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AppFeedback).order_by(AppFeedback.CreatedAt.desc())
    if status and status.upper() != "ALL":
        q = q.filter(AppFeedback.Status == status.upper())
    rows = q.limit(200).all()
    account_ids = [row.AccountId for row in rows]
    accounts = {
        account.Id: account
        for account in db.query(AppAccount).filter(AppAccount.Id.in_(account_ids)).all()
    } if account_ids else {}
    return [
        FeedbackAdminOut(
            id=row.Id,
            accountId=row.AccountId,
            userName=_account_name(accounts.get(row.AccountId)),
            userMobile=accounts.get(row.AccountId).Mobile if accounts.get(row.AccountId) else None,
            category=row.Category,
            content=row.Content,
            contact=row.Contact,
            status=row.Status,
            createdAt=row.CreatedAt,
        )
        for row in rows
    ]
