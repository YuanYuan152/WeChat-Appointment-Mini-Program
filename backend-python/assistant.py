"""
3.2 咨询助理工作台接口
GET  /api/mini/assistant/tasks               待处理任务列表
POST /api/mini/assistant/tasks               新建任务
PUT  /api/mini/assistant/tasks/{id}          更新任务状态
GET  /api/mini/assistant/risk-alerts         风险提醒列表
POST /api/mini/assistant/risk-alerts         新建风险提醒
PUT  /api/mini/assistant/risk-alerts/{id}    处理风险提醒
GET  /api/mini/assistant/schedule-overview   排期总览（各咨询师近期排期概览）
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_account, AppAccount
from database import get_db
from models import AppTask, AppRiskAlert, AppRoleBinding, AppSchedule, AppContactRecord

router = APIRouter(prefix="/api/mini/assistant", tags=["Assistant"])


# ---------------------------------------------------------------------------
# 权限检查：Assistant 角色
# ---------------------------------------------------------------------------

def require_assistant(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType == "Assistant",
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无助理权限")
    return current_account


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    type: str
    title: str
    content: Optional[str] = None
    related_id: Optional[int] = None
    priority: Optional[str] = "NORMAL"
    due_at: Optional[datetime] = None


class TaskUpdate(BaseModel):
    status: Optional[str] = None       # OPEN / IN_PROGRESS / DONE
    priority: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


class TaskOut(BaseModel):
    Id: int
    AssistantId: int
    Type: str
    Title: str
    Content: Optional[str] = None
    RelatedId: Optional[int] = None
    Priority: str
    Status: str
    DueAt: Optional[datetime] = None
    CreatedAt: datetime

    class Config:
        from_attributes = True


class RiskAlertCreate(BaseModel):
    patient_id: int
    level: Optional[str] = "MEDIUM"
    description: Optional[str] = None


class RiskAlertHandle(BaseModel):
    handler_note: Optional[str] = None


class RiskAlertOut(BaseModel):
    Id: int
    PatientId: int
    AssistantId: int
    Level: str
    Description: Optional[str] = None
    Status: str
    HandledAt: Optional[datetime] = None
    HandlerNote: Optional[str] = None
    CreatedAt: datetime

    class Config:
        from_attributes = True


class ContactRecordCreate(BaseModel):
    patient_id: int
    contact_method: Optional[str] = "PHONE"
    content: Optional[str] = None
    next_follow_at: Optional[datetime] = None


class ContactRecordOut(BaseModel):
    Id: int
    AssistantId: int
    PatientId: int
    ContactMethod: str
    Content: Optional[str] = None
    NextFollowAt: Optional[datetime] = None
    CreatedAt: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# 任务接口
# ---------------------------------------------------------------------------

@router.get("/tasks", response_model=List[TaskOut], summary="获取任务列表")
def list_tasks(
    status: Optional[str] = None,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    q = db.query(AppTask).filter(AppTask.AssistantId == assistant.Id)
    if status:
        q = q.filter(AppTask.Status == status)
    # SQL Server 升序时 NULL 默认在前；用 CASE WHEN 让 NULL 排到最后
    from sqlalchemy import case
    nulls_last_expr = case((AppTask.DueAt.is_(None), 1), else_=0)
    return q.order_by(nulls_last_expr.asc(), AppTask.DueAt.asc(), AppTask.CreatedAt.desc()).all()


@router.post("/tasks", response_model=TaskOut, summary="新建任务")
def create_task(
    body: TaskCreate,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    task = AppTask(
        AssistantId=assistant.Id,
        Type=body.type,
        Title=body.title,
        Content=body.content,
        RelatedId=body.related_id,
        Priority=body.priority or "NORMAL",
        DueAt=body.due_at,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=TaskOut, summary="更新任务")
def update_task(
    task_id: int,
    body: TaskUpdate,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    task = db.query(AppTask).filter(
        AppTask.Id == task_id,
        AppTask.AssistantId == assistant.Id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    for field, attr in [("status", "Status"), ("priority", "Priority"),
                        ("title", "Title"), ("content", "Content")]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(task, attr, val)
    task.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


# ---------------------------------------------------------------------------
# 风险提醒接口
# ---------------------------------------------------------------------------

@router.get("/risk-alerts", response_model=List[RiskAlertOut], summary="获取风险提醒列表")
def list_risk_alerts(
    status: Optional[str] = None,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    q = db.query(AppRiskAlert).filter(AppRiskAlert.AssistantId == assistant.Id)
    if status:
        q = q.filter(AppRiskAlert.Status == status)
    return q.order_by(AppRiskAlert.CreatedAt.desc()).all()


@router.post("/risk-alerts", response_model=RiskAlertOut, summary="新建风险提醒")
def create_risk_alert(
    body: RiskAlertCreate,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    alert = AppRiskAlert(
        PatientId=body.patient_id,
        AssistantId=assistant.Id,
        Level=body.level or "MEDIUM",
        Description=body.description,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.put("/risk-alerts/{alert_id}", response_model=RiskAlertOut, summary="处理风险提醒")
def handle_risk_alert(
    alert_id: int,
    body: RiskAlertHandle,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    alert = db.query(AppRiskAlert).filter(
        AppRiskAlert.Id == alert_id,
        AppRiskAlert.AssistantId == assistant.Id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="风险提醒不存在")
    alert.Status = "HANDLED"
    alert.HandledAt = datetime.utcnow()
    alert.HandlerNote = body.handler_note
    alert.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert


# ---------------------------------------------------------------------------
# 排期总览（简单聚合所有咨询师的近期排期）
# ---------------------------------------------------------------------------

@router.get("/schedule-overview", summary="排期总览")
def schedule_overview(
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    now = datetime.utcnow()
    next_week = now + timedelta(days=7)
    schedules = (
        db.query(AppSchedule)
        .filter(AppSchedule.StartTime >= now, AppSchedule.StartTime <= next_week)
        .order_by(AppSchedule.StartTime)
        .all()
    )
    return [
        {
            "scheduleId": s.Id,
            "counselorId": s.CounselorId,
            "startTime": s.StartTime,
            "endTime": s.EndTime,
            "status": s.Status,
        }
        for s in schedules
    ]


# ---------------------------------------------------------------------------
# 患者联系/跟进记录
# ---------------------------------------------------------------------------

@router.get("/contact-records", response_model=List[ContactRecordOut], summary="获取患者联系记录")
def list_contact_records(
    patient_id: Optional[int] = None,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    q = db.query(AppContactRecord).filter(AppContactRecord.AssistantId == assistant.Id)
    if patient_id:
        q = q.filter(AppContactRecord.PatientId == patient_id)
    return q.order_by(AppContactRecord.CreatedAt.desc()).all()


@router.post("/contact-records", response_model=ContactRecordOut, summary="新增患者联系记录")
def create_contact_record(
    body: ContactRecordCreate,
    assistant: AppAccount = Depends(require_assistant),
    db: Session = Depends(get_db),
):
    record = AppContactRecord(
        AssistantId=assistant.Id,
        PatientId=body.patient_id,
        ContactMethod=body.contact_method or "PHONE",
        Content=body.content,
        NextFollowAt=body.next_follow_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
