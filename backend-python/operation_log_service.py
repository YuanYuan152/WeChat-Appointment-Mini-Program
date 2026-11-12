"""上线后的写操作留痕。调用方在同一事务里 commit，失败回滚时这条记录也不会留下。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from models import AppOperationLog

ASSESSMENT_ACTION_LABELS = {
    "DEFINITION_CREATE": "新建量表",
    "DEFINITION_UPDATE": "保存量表草稿",
    "DEFINITION_PUBLISH": "发布量表",
    "DEFINITION_ARCHIVE": "归档量表",
    "DEFINITION_DELETE": "删除量表",
    "DEFINITION_RESTORE": "恢复量表版本",
    "REPORT_VIEW": "查看量表结果",
    "REPORT_VIEW_RAW": "查看量表原始答卷",
    "REPORT_DELETE": "删除量表结果",
    "SHARE_STATS_VIEW": "查看量表分享统计",
}


def record_operation(
    db: Session,
    *,
    action_type: str,
    action_label: str,
    summary: str,
    actor: Any = None,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[Any] = None,
    target_name: Optional[str] = None,
    status: Optional[str] = None,
    amount: Optional[int] = None,
    patient_id: Optional[int] = None,
    counselor_id: Optional[int] = None,
    order_id: Optional[int] = None,
    consultation_id: Optional[int] = None,
    schedule_id: Optional[int] = None,
    center_name: Optional[str] = None,
    room_name: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> None:
    if actor is not None:
        actor_id = getattr(actor, "Id", actor_id)
        actor_role = actor_role or getattr(actor, "ActiveRole", None)
    text = (summary or "").strip()
    if len(text) > 1000:
        text = text[:1000]
    name = (target_name or "").strip() or None
    if name and len(name) > 200:
        name = name[:200]
    db.add(
        AppOperationLog(
            OccurredAt=datetime.utcnow(),
            ActorAccountId=int(actor_id) if actor_id else None,
            ActorRole=(actor_role or None),
            ActionType=action_type[:64],
            ActionLabel=action_label[:100],
            TargetType=(target_type or None),
            TargetId=None if target_id is None else str(target_id)[:80],
            TargetName=name,
            Summary=text or None,
            Status=(status or None),
            Amount=amount,
            PatientId=patient_id,
            CounselorId=counselor_id,
            OrderId=order_id,
            ConsultationId=consultation_id,
            ScheduleId=schedule_id,
            CenterName=(center_name or None),
            RoomName=(room_name or None),
            StartTime=start_time,
            EndTime=end_time,
        )
    )


def record_patient_settlement(db: Session, order: Any, schedule: Any = None) -> None:
    """来访确认免费/线下单，或支付成功使订单变为已支付。已支付的重复入账不会再次进入这里。"""
    offline = bool(getattr(order, "ProxyIsOfflinePayment", False))
    free = int(getattr(order, "TotalFee", 0) or 0) <= 0
    if offline or free:
        action_type = "PATIENT_CONFIRM_ORDER"
        action_label = "来访确认订单"
        kind = "线下支付单" if offline else "免费体验单"
    else:
        action_type = "PATIENT_PAY_ORDER"
        action_label = "来访预约支付"
        kind = "支付订单"
    record_operation(
        db,
        action_type=action_type,
        action_label=action_label,
        summary=f"{kind} {getattr(order, 'OutTradeNo', '') or ''}".strip(),
        actor_id=getattr(order, "AccountId", None),
        actor_role="Patient",
        target_type="Order",
        target_id=getattr(order, "Id", None),
        amount=getattr(order, "TotalFee", None),
        patient_id=getattr(order, "AccountId", None),
        counselor_id=getattr(schedule, "CounselorId", None) if schedule is not None else None,
        order_id=getattr(order, "Id", None),
        schedule_id=getattr(schedule, "Id", None) if schedule is not None else getattr(order, "SlotId", None),
        start_time=getattr(schedule, "StartTime", None) if schedule is not None else None,
        end_time=getattr(schedule, "EndTime", None) if schedule is not None else None,
        status="PAID",
    )
