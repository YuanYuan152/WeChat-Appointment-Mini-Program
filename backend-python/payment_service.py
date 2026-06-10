"""支付成功后：订单 PAID、排班 BOOKED、创建咨询单（所有用户可见时段已约）。"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import AppOrder, AppSchedule, AppConsultation
from schedule_meta import parse_center_id, parse_room_id, schedule_note


def complete_paid_order(
    db: Session,
    order: AppOrder,
    *,
    center_id: Optional[str] = None,
    transaction_id: Optional[str] = None,
) -> None:
    if order.Status == "PAID":
        return

    order.Status = "PAID"
    order.PaidAt = datetime.utcnow()
    if transaction_id:
        order.TransactionId = transaction_id

    if not order.SlotId:
        return

    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    if not schedule:
        return

    resolved_center = center_id or parse_center_id(schedule.Note)
    resolved_room = parse_room_id(schedule.Note)
    consultation_note = (
        schedule_note(resolved_center, resolved_room) if resolved_center else None
    )
    if schedule.Status == "AVAILABLE":
        schedule.Status = "BOOKED"

    existing = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule.Id,
            AppConsultation.PatientId == order.AccountId,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if existing:
        if consultation_note and not existing.Note:
            existing.Note = consultation_note
        return

    db.add(
        AppConsultation(
            OrderId=order.Id,
            PatientId=order.AccountId,
            CounselorId=schedule.CounselorId,
            ScheduleId=schedule.Id,
            Status="CONFIRMED",
            StartTime=schedule.StartTime,
            EndTime=schedule.EndTime,
            Note=consultation_note,
        )
    )
