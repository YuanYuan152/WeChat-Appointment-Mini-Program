"""站内消息与微信订阅消息（mock 可上线前替换真实模板）。"""

import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from models import (
    AppAccount,
    AppMessage,
    AppMessageLog,
    AppRemindTask,
    AppSubscribeTemplate,
)

router = APIRouter(prefix="/api/mini/message", tags=["Message"])


class MessageOut(BaseModel):
    Id: int
    AccountId: int
    Type: str
    Title: str
    Content: Optional[str] = None
    RelatedType: Optional[str] = None
    RelatedId: Optional[int] = None
    IsRead: bool
    CreatedAt: datetime
    ReadAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscribeRequest(BaseModel):
    event_key: str
    template_id: Optional[str] = None
    payload: Optional[dict] = None


class CreateMessageRequest(BaseModel):
    account_id: int
    type: str = "SYSTEM"
    title: str
    content: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[int] = None


class CreateRemindTaskRequest(BaseModel):
    account_id: int
    event_key: str
    title: str
    content: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[int] = None
    scheduled_at: datetime


def create_message(
    db: Session,
    account_id: int,
    type_: str,
    title: str,
    content: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
) -> AppMessage:
    msg = AppMessage(
        AccountId=account_id,
        Type=type_,
        Title=title,
        Content=content,
        RelatedType=related_type,
        RelatedId=related_id,
    )
    db.add(msg)
    return msg


def log_subscribe_event(
    db: Session,
    account_id: int,
    event_key: str,
    payload: Optional[dict] = None,
    template_id: Optional[str] = None,
) -> AppMessageLog:
    tpl_id = template_id
    if not tpl_id:
        tpl = (
            db.query(AppSubscribeTemplate)
            .filter(AppSubscribeTemplate.EventKey == event_key, AppSubscribeTemplate.IsActive == True)
            .first()
        )
        tpl_id = tpl.TemplateId if tpl else f"mock_{event_key}"

    # Q2=B：先完整落日志，模板未配置时状态为 MOCK，上线前替换真实模板 ID。
    status = "MOCK" if tpl_id.startswith("mock_") else "PENDING"
    log = AppMessageLog(
        AccountId=account_id,
        EventKey=event_key,
        TemplateId=tpl_id,
        Payload=json.dumps(payload or {}, ensure_ascii=False),
        Status=status,
        SentAt=datetime.utcnow() if status == "MOCK" else None,
    )
    db.add(log)
    return log


@router.get("/list", response_model=List[MessageOut], summary="站内消息列表")
def list_messages(
    unread_only: bool = False,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    q = db.query(AppMessage).filter(AppMessage.AccountId == current_account.Id)
    if unread_only:
        q = q.filter(AppMessage.IsRead == False)
    return q.order_by(AppMessage.CreatedAt.desc()).limit(100).all()


@router.get("/unread-count", summary="未读消息数")
def unread_count(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    count = (
        db.query(AppMessage)
        .filter(AppMessage.AccountId == current_account.Id, AppMessage.IsRead == False)
        .count()
    )
    return {"count": count}


@router.put("/{message_id}/read", response_model=MessageOut, summary="标记消息已读")
def mark_read(
    message_id: int,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    msg = (
        db.query(AppMessage)
        .filter(AppMessage.Id == message_id, AppMessage.AccountId == current_account.Id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="消息不存在")
    msg.IsRead = True
    msg.ReadAt = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/templates", summary="按 event_key 列表返回需要前端请求授权的订阅消息模板 ID")
def list_subscribe_templates(
    event_keys: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    支持两种调用：
      - /templates                                → 返回所有 IsActive=True 的模板
      - /templates?event_keys=APPOINTMENT_OK,REMIND → 仅返回指定事件的模板
    返回结构 frontend 可直接喂给 wx.requestSubscribeMessage(tmplIds=...)。
    """
    q = db.query(AppSubscribeTemplate).filter(AppSubscribeTemplate.IsActive == True)
    if event_keys:
        keys = [k.strip() for k in event_keys.split(",") if k.strip()]
        if keys:
            q = q.filter(AppSubscribeTemplate.EventKey.in_(keys))
    rows = q.all()
    return {
        "tmplIds": [r.TemplateId for r in rows],
        "items": [
            {"eventKey": r.EventKey, "templateId": r.TemplateId, "description": r.Description}
            for r in rows
        ],
    }


@router.post("/subscribe", summary="记录订阅消息授权与发送日志（mock 可替换真实模板）")
def subscribe_message(
    body: SubscribeRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    log = log_subscribe_event(
        db,
        account_id=current_account.Id,
        event_key=body.event_key,
        template_id=body.template_id,
        payload=body.payload,
    )
    db.commit()
    db.refresh(log)
    return {"message": "已记录订阅消息事件", "logId": log.Id, "status": log.Status}


@router.post("/system", response_model=MessageOut, summary="创建系统消息（内部/运营调试）")
def create_system_message(
    body: CreateMessageRequest,
    db: Session = Depends(get_db),
):
    msg = create_message(
        db,
        account_id=body.account_id,
        type_=body.type,
        title=body.title,
        content=body.content,
        related_type=body.related_type,
        related_id=body.related_id,
    )
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/remind-tasks", summary="创建预约提醒任务")
def create_remind_task(body: CreateRemindTaskRequest, db: Session = Depends(get_db)):
    task = AppRemindTask(
        AccountId=body.account_id,
        EventKey=body.event_key,
        Title=body.title,
        Content=body.content,
        RelatedType=body.related_type,
        RelatedId=body.related_id,
        ScheduledAt=body.scheduled_at,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "提醒任务已创建", "taskId": task.Id}


@router.post("/remind-tasks/process", summary="处理到期提醒任务（可由定时任务调用）")
def process_due_reminders(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    tasks = (
        db.query(AppRemindTask)
        .filter(AppRemindTask.Status == "PENDING", AppRemindTask.ScheduledAt <= now)
        .order_by(AppRemindTask.ScheduledAt.asc())
        .limit(50)
        .all()
    )
    processed = 0
    for task in tasks:
        try:
            create_message(
                db,
                account_id=task.AccountId,
                type_="REMIND",
                title=task.Title,
                content=task.Content,
                related_type=task.RelatedType,
                related_id=task.RelatedId,
            )
            log_subscribe_event(
                db,
                account_id=task.AccountId,
                event_key=task.EventKey,
                payload={
                    "title": task.Title,
                    "content": task.Content,
                    "relatedType": task.RelatedType,
                    "relatedId": task.RelatedId,
                },
            )
            task.Status = "DONE"
            task.ProcessedAt = now
            processed += 1
        except Exception as exc:
            task.Status = "FAILED"
            task.ErrorMessage = str(exc)[:500]
    db.commit()
    return {"processed": processed}
