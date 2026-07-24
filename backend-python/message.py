"""站内消息与微信订阅消息（mock 可上线前替换真实模板）。"""

import json
from datetime import datetime
from typing import List, Optional

from app_time import china_now
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from message_enrich import enrich_message
from message_filters import apply_message_category, apply_message_search, apply_admin_ops_inbox_scope
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


class SubscribePreferenceRequest(BaseModel):
    accepted: bool = False
    results: Optional[dict] = None
    event_keys: Optional[List[str]] = None


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
    category: Optional[str] = Query(None, description="消息分类，如 appointment_new / exemption / UNREAD"),
    q: Optional[str] = Query(None, description="关键词搜索（标题、摘要、人名、类型等）"),
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    query = db.query(AppMessage).filter(AppMessage.AccountId == current_account.Id)
    active_role = getattr(current_account, "ActiveRole", None)
    query = apply_admin_ops_inbox_scope(
        query, active_role, db=db, account_id=current_account.Id
    )
    if unread_only or category == "UNREAD":
        query = query.filter(AppMessage.IsRead == False)
    if category and category not in ("ALL", "UNREAD"):
        query = apply_message_category(
            query, category, active_role, db=db, account_id=current_account.Id
        )
    query = apply_message_search(query, q)
    rows = query.order_by(AppMessage.CreatedAt.desc()).limit(100).all()
    return [enrich_message(m, db) for m in rows]


@router.get("/unread-count", summary="未读消息数")
def unread_count(
    category: Optional[str] = Query(None, description="消息分类，如 case_record_crisis"),
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    active_role = getattr(current_account, "ActiveRole", None)
    query = (
        db.query(AppMessage)
        .filter(AppMessage.AccountId == current_account.Id, AppMessage.IsRead == False)
    )
    query = apply_admin_ops_inbox_scope(
        query, active_role, db=db, account_id=current_account.Id
    )
    if category and category not in ("ALL", "UNREAD"):
        query = apply_message_category(
            query, category, active_role, db=db, account_id=current_account.Id
        )
    count = query.count()
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
    return enrich_message(msg, db)


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


@router.get("/subscribe-hint", summary="当前账号是否需要弹出订阅引导")
def subscribe_hint(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    from role_active import get_account_role
    from wechat_subscribe_service import (
        event_keys_for_role,
        resolve_subscribe_prompt_flags,
    )

    role = get_account_role(db, current_account.Id)
    flags = resolve_subscribe_prompt_flags(current_account, role)
    return {
        **flags,
        "role": role,
        "eventKeys": event_keys_for_role(role),
    }


@router.post("/subscribe-ack", summary="用户跳过订阅引导")
def subscribe_ack(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    from wechat_subscribe_service import clear_subscribe_prompt_trigger

    clear_subscribe_prompt_trigger(current_account)
    current_account.UpdatedAt = datetime.utcnow()
    db.commit()
    return {"message": "ok"}


EVENT_LABELS = {
    "APPOINTMENT_OK": "预约成功通知",
    "APPOINTMENT_REMIND": "咨询前提醒",
    "ORDER_STATUS": "订单状态通知",
    "PAY_SUCCESS": "支付成功通知",
    "COUNSELOR_APPOINTMENT_NEW": "新预约提醒",
    "COUNSELOR_APPOINTMENT_CANCEL": "预约取消提醒",
    "STAFF_APPROVAL_PENDING": "待审批提醒",
}


@router.get("/subscribe-status", summary="当前角色订阅授权列表")
def subscribe_status(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    from role_active import get_account_role
    from wechat_subscribe_service import (
        event_keys_for_role,
        get_template,
        user_accepted,
        _is_mock_template,
    )

    role = get_account_role(db, current_account.Id)
    keys = event_keys_for_role(role)
    items = []
    mock_count = 0
    for key in keys:
        tpl = get_template(db, key)
        tid = tpl.TemplateId if tpl else f"mock_{key}"
        is_mock = _is_mock_template(tid)
        if is_mock:
            mock_count += 1
        enabled = False
        try:
            enabled = user_accepted(db, current_account.Id, key)
        except Exception:
            enabled = False
        items.append(
            {
                "eventKey": key,
                "label": (tpl.Description if tpl and tpl.Description else None)
                or EVENT_LABELS.get(key, key),
                "enabled": enabled,
                "isMock": is_mock,
                "templateId": tid,
            }
        )
    hint = ""
    if mock_count:
        hint = "部分模板仍为 MOCK，真机无法弹出微信授权；请在公众平台申请模板并写入 AppSubscribeTemplate。"
    return {"items": items, "hint": hint, "role": role}


@router.get("/{message_id}", response_model=MessageOut, summary="站内消息详情")
def get_message(
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
    return enrich_message(msg, db)


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


class SubscribePushRequest(BaseModel):
    event_key: str = "APPOINTMENT_OK"
    order_id: Optional[int] = None


@router.post("/subscribe-push", summary="授权后补发服务通知（如支付成功后点接收提醒）")
def subscribe_push(
    body: SubscribePushRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """
    支付成功页等场景：用户刚完成 requestSubscribeMessage 后，
    对已支付订单补发「预约成功」等到微信服务通知。
    """
    from models import AppConsultation, AppOrder
    from wechat_subscribe_service import send_subscribe_message

    event_key = (body.event_key or "APPOINTMENT_OK").strip()
    payload: dict = {"name": current_account.Nickname or "来访者", "slot": "-", "location": "-"}

    if body.order_id:
        order = (
            db.query(AppOrder)
            .filter(AppOrder.Id == body.order_id, AppOrder.AccountId == current_account.Id)
            .first()
        )
        if not order:
            raise HTTPException(status_code=404, detail="订单不存在")
        consultation = (
            db.query(AppConsultation).filter(AppConsultation.OrderId == order.Id).first()
        )
        if consultation:
            from patient_message_service import (
                _appointment_center_name,
                _consultation_context,
                _format_datetime,
            )

            ctx = _consultation_context(db, consultation)
            schedule = None
            if consultation.ScheduleId:
                from models import AppSchedule

                schedule = db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
            note = consultation.Note or (schedule.Note if schedule else None)
            payload = {
                "name": current_account.Nickname or current_account.RealName or "来访者",
                "slot": _format_datetime(ctx.get("startTime")),
                "location": _appointment_center_name(note),
            }

    result = send_subscribe_message(db, current_account.Id, event_key, payload)
    return {
        "message": "已尝试推送服务通知",
        "ok": bool(result.get("ok")),
        "reason": result.get("reason"),
        "detail": result.get("detail"),
    }


@router.post("/subscribe-preference", summary="保存服务通知授权偏好")
def save_subscribe_preference(
    body: SubscribePreferenceRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """引导页 / 业务页调用：记录微信授权结果；无模板时也可落库。"""
    from role_active import get_account_role
    from wechat_subscribe_service import save_subscribe_auth_results, clear_subscribe_prompt_trigger

    role = get_account_role(db, current_account.Id)
    try:
        result = save_subscribe_auth_results(
            db,
            current_account,
            results=body.results or {},
            event_keys=body.event_keys or [],
            role=role,
        )
        if not body.accepted and not (body.results or {}):
            # 用户点「暂不」：仍标记已提示，避免反复打扰
            current_account.SubscribeOptInAt = datetime.utcnow()
            clear_subscribe_prompt_trigger(current_account)
            current_account.UpdatedAt = datetime.utcnow()
            db.commit()
        return {
            "message": "已保存服务通知偏好",
            "subscribeOptIn": True,
            "accepted": body.accepted,
            **(result or {}),
        }
    except Exception:
        # 回退：仅写日志，保证旧库也能用
        current_account.SubscribeOptInAt = datetime.utcnow()
        current_account.UpdatedAt = datetime.utcnow()
        log_subscribe_event(
            db,
            account_id=current_account.Id,
            event_key="SUBSCRIBE_AUTH",
            payload={
                "accepted": body.accepted,
                "event_keys": body.event_keys or [],
                "results": body.results or {},
            },
        )
        db.commit()
        return {
            "message": "已保存服务通知偏好",
            "subscribeOptIn": True,
            "accepted": body.accepted,
        }


class SubscribeToggleRequest(BaseModel):
    event_key: str
    enabled: bool = False


@router.post("/subscribe-toggle", summary="开关某事件本端推送")
def subscribe_toggle(
    body: SubscribeToggleRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    from models import AppUserSubscribeAuth
    from role_active import get_account_role
    from wechat_subscribe_service import get_template

    role = get_account_role(db, current_account.Id)
    now = datetime.utcnow()
    row = (
        db.query(AppUserSubscribeAuth)
        .filter(
            AppUserSubscribeAuth.AccountId == current_account.Id,
            AppUserSubscribeAuth.EventKey == body.event_key,
        )
        .first()
    )
    if not row:
        tpl = get_template(db, body.event_key)
        row = AppUserSubscribeAuth(
            AccountId=current_account.Id,
            EventKey=body.event_key,
            TemplateId=tpl.TemplateId if tpl else f"mock_{body.event_key}",
        )
        db.add(row)
    row.Status = "accept" if body.enabled else "reject"
    row.RoleAtAuth = role
    row.UpdatedAt = now
    db.commit()
    return {"message": "ok", "eventKey": body.event_key, "enabled": body.enabled}


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
    from consultation_status_service import (
        AUTO_DONE_EVENT,
        expire_due_consultations,
        process_consultation_auto_done_task,
        mark_consultation_done_if_expired,
    )

    expire_due_consultations(db)
    now = china_now()
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
            if task.EventKey == AUTO_DONE_EVENT:
                if task.RelatedId:
                    process_consultation_auto_done_task(db, task.RelatedId)
                task.Status = "DONE"
                task.ProcessedAt = datetime.utcnow()
                processed += 1
                continue

            if task.EventKey == "COUNSELOR_CONSULTATION_DONE":
                from counselor_message_service import notify_counselor_consultation_done
                from models import AppConsultation

                consultation = (
                    db.query(AppConsultation)
                    .filter(AppConsultation.Id == task.RelatedId)
                    .first()
                )
                if consultation and consultation.Status != "CANCELLED":
                    mark_consultation_done_if_expired(db, consultation)
                    notify_counselor_consultation_done(db, consultation)
                task.Status = "DONE"
                task.ProcessedAt = datetime.utcnow()
                processed += 1
                continue

            if task.EventKey == "COUNSELOR_APPOINTMENT_REMIND":
                msg_type = "CONSULTATION"
            elif task.EventKey == "PATIENT_APPOINTMENT_REMIND":
                msg_type = "REMIND"
            else:
                msg_type = "REMIND"

            if task.RelatedType and task.RelatedId:
                existing_msg = (
                    db.query(AppMessage)
                    .filter(
                        AppMessage.AccountId == task.AccountId,
                        AppMessage.RelatedType == task.RelatedType,
                        AppMessage.RelatedId == task.RelatedId,
                    )
                    .first()
                )
                if existing_msg:
                    task.Status = "DONE"
                    task.ProcessedAt = datetime.utcnow()
                    processed += 1
                    continue

            create_message(
                db,
                account_id=task.AccountId,
                type_=msg_type,
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
            # 到期提醒同步推到微信「服务通知」（需用户曾授权对应订阅模板）
            if task.EventKey in (
                "PATIENT_APPOINTMENT_REMIND",
                "COUNSELOR_APPOINTMENT_REMIND",
            ):
                from wechat_subscribe_service import try_send

                detail: dict = {}
                try:
                    raw = json.loads(task.Content or "{}")
                    if isinstance(raw, dict):
                        detail = raw.get("detail") if isinstance(raw.get("detail"), dict) else raw
                except Exception:
                    detail = {}
                try_send(
                    db,
                    task.AccountId,
                    "APPOINTMENT_REMIND",
                    {
                        "time": detail.get("startTime") or task.Title or "-",
                        "patient": detail.get("patientName")
                        or detail.get("patient")
                        or ("您" if task.EventKey.startswith("PATIENT") else "-"),
                        "counselor": detail.get("counselorName") or detail.get("counselor") or "-",
                    },
                )
            task.Status = "DONE"
            task.ProcessedAt = datetime.utcnow()
            processed += 1
        except Exception as exc:
            task.Status = "FAILED"
            task.ErrorMessage = str(exc)[:500]
    db.commit()
    return {"processed": processed}
