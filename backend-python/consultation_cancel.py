"""来访者取消咨询：24 小时规则与排班释放。"""
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app_time import china_now, hours_until as _hours_until
from models import AppConsultation, AppOrder, AppSchedule
from schedule_meta import release_assigned_room

CANCEL_REFUND_HOURS = 24


def hours_until_appointment(start_time: Optional[datetime]) -> Optional[float]:
    return _hours_until(start_time)


def has_appointment_started(start_time: Optional[datetime]) -> bool:
    """当前时间是否已到或超过咨询开始时间。"""
    hours = hours_until_appointment(start_time)
    if hours is None:
        return True
    return hours <= 0


def has_appointment_ended(end_time: Optional[datetime]) -> bool:
    """当前时间是否已到或超过咨询结束时间。"""
    hours = hours_until_appointment(end_time)
    if hours is None:
        return False
    return hours <= 0


def is_refund_eligible(start_time: Optional[datetime]) -> bool:
    hours = hours_until_appointment(start_time)
    if hours is None:
        return False
    return hours >= CANCEL_REFUND_HOURS


def refund_ineligible_reason(start_time: Optional[datetime]) -> Optional[str]:
    """不可全额退款时的说明文案。"""
    if is_refund_eligible(start_time):
        return None
    hours = hours_until_appointment(start_time)
    if hours is None:
        return "咨询开始时间未确定，暂无法全额退款"
    if hours < 0:
        return "咨询已开始或已结束，按规定不予全额退款"
    return f"距咨询开始不足{CANCEL_REFUND_HOURS}小时，按规定不予全额退款"


def can_visitor_cancel(status: str) -> bool:
    return status in ("PENDING", "CONFIRMED", "ONGOING")


def refund_order_for_counselor_leave(db: Session, consultation: AppConsultation) -> bool:
    """咨询师请假导致预约取消：已支付订单无条件全额退款。"""
    if not consultation.OrderId:
        return False
    order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
    if order and order.Status == "PAID":
        order.Status = "REFUNDED"
        order.UpdatedAt = datetime.utcnow()
        return True
    return bool(order and order.Status == "REFUNDED")


def cancel_consultation_for_visitor(
    db: Session,
    consultation: AppConsultation,
    *,
    patient_id: int,
    force_refund: bool = False,
) -> Tuple[bool, str]:
    """
    取消咨询单。返回 (是否退款, 提示文案)。
    仅本人、待确认/已确认/进行中可取消。
    force_refund=True 时无视 24 小时规则（管理员退款审核通过）。
    """
    if consultation.PatientId != patient_id:
        raise PermissionError("无权取消该咨询")
    if not can_visitor_cancel(consultation.Status):
        raise ValueError("当前状态不可取消")

    refund = force_refund or is_refund_eligible(consultation.StartTime)
    consultation.Status = "CANCELLED"
    consultation.UpdatedAt = datetime.utcnow()

    from consultation_status_service import cancel_consultation_auto_done_tasks

    cancel_consultation_auto_done_tasks(db, consultation.Id)

    if consultation.OrderId:
        order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
        if order and order.Status == "PAID":
            order.Status = "REFUNDED" if refund else "CANCELLED"
            order.UpdatedAt = datetime.utcnow()

    if consultation.ScheduleId:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if schedule and schedule.Status == "BOOKED":
            schedule.Note = release_assigned_room(schedule.Note)
            schedule.Status = "AVAILABLE"
            schedule.UpdatedAt = datetime.utcnow()

    if refund:
        msg = "预约已取消，款项将原路退回"
    else:
        msg = "预约已取消；距咨询不足24小时，不予退款"
    return refund, msg
