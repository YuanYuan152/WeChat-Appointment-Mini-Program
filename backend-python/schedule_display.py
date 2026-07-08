"""排班展示状态：与来访者预约系统联动。"""
from datetime import datetime, timedelta
from typing import Optional

from consultation_cancel import has_appointment_ended, has_appointment_started
from models import AppConsultation, AppSchedule

# OPEN=已排期可约 BOOKED=已预约 ON_LEAVE=已请假 DONE=已完成 EXPIRED=已过期 CANCELLED=已取消
DISPLAY_OPEN = "OPEN"
DISPLAY_BOOKED = "BOOKED"
DISPLAY_ON_LEAVE = "ON_LEAVE"
DISPLAY_DONE = "DONE"
DISPLAY_EXPIRED = "EXPIRED"
DISPLAY_CANCELLED = "CANCELLED"
DISPLAY_PENDING_PAYMENT = "PENDING_PAYMENT"

DISPLAY_LABELS = {
    DISPLAY_OPEN: "已排期",
    DISPLAY_BOOKED: "已预约",
    DISPLAY_ON_LEAVE: "已请假",
    DISPLAY_DONE: "已完成",
    DISPLAY_EXPIRED: "已过期",
    DISPLAY_CANCELLED: "已取消",
    DISPLAY_PENDING_PAYMENT: "待支付",
}


def _is_booked_slot(
    schedule: AppSchedule,
    consultation: Optional[AppConsultation],
) -> bool:
    if schedule.Status == "BOOKED":
        return True
    return consultation is not None and consultation.Status in (
        "PENDING",
        "CONFIRMED",
        "ONGOING",
    )


def _appointment_end_time(
    schedule: AppSchedule,
    consultation: Optional[AppConsultation] = None,
) -> Optional[datetime]:
    if schedule.EndTime:
        return schedule.EndTime
    if consultation and consultation.EndTime:
        return consultation.EndTime
    start = schedule.StartTime or (consultation.StartTime if consultation else None)
    if start:
        return start + timedelta(minutes=50)
    return None


def resolve_schedule_display(
    schedule: AppSchedule,
    consultation: Optional[AppConsultation],
    *,
    has_pending_proxy_order: bool = False,
) -> str:
    if has_pending_proxy_order and schedule.Status == "AVAILABLE":
        return DISPLAY_PENDING_PAYMENT
    if schedule.Status == "CANCELLED":
        return DISPLAY_CANCELLED
    if consultation and consultation.Status == "DONE":
        return DISPLAY_DONE
    if _is_booked_slot(schedule, consultation) and has_appointment_ended(
        _appointment_end_time(schedule, consultation)
    ):
        return DISPLAY_DONE
    if schedule.Status == "BOOKED":
        return DISPLAY_BOOKED
    if consultation and consultation.Status in ("PENDING", "CONFIRMED", "ONGOING"):
        return DISPLAY_BOOKED
    if schedule.Status == "AVAILABLE":
        if has_appointment_started(schedule.StartTime):
            return DISPLAY_EXPIRED
        return DISPLAY_OPEN
    return DISPLAY_CANCELLED


def is_consultation_recordable(
    consultation: AppConsultation,
    schedule: Optional[AppSchedule] = None,
) -> bool:
    """是否可填写咨询记录，与日历「已完成」展示规则一致。"""
    if consultation.Status == "CANCELLED":
        return False
    if consultation.Status == "DONE":
        return True
    if consultation.Status not in ("PENDING", "CONFIRMED", "ONGOING"):
        return False
    if schedule is not None:
        if not has_appointment_ended(_appointment_end_time(schedule, consultation)):
            return False
        return _is_booked_slot(schedule, consultation)
    end_time = consultation.EndTime
    if not end_time and consultation.StartTime:
        end_time = consultation.StartTime + timedelta(minutes=50)
    return has_appointment_ended(end_time)
