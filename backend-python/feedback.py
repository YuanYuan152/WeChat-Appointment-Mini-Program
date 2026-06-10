"""意见反馈接口。"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from models import AppAccount, AppFeedback

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
