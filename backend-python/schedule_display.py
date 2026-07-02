"""排期展示状态：与来访者预约系统联动。"""
from typing import Optional

from consultation_cancel import has_appointment_started
from models import AppConsultation, AppSchedule

# OPEN=已排期可约 BOOKED=已预约 ON_LEAVE=已请假 DONE=已完成 EXPIRED=已过期 CANCELLED=已取消
DISPLAY_OPEN = "OPEN"
DISPLAY_BOOKED = "BOOKED"
DISPLAY_ON_LEAVE = "ON_LEAVE"
DISPLAY_DONE = "DONE"
DISPLAY_EXPIRED = "EXPIRED"
DISPLAY_CANCELLED = "CANCELLED"

DISPLAY_LABELS = {
    DISPLAY_OPEN: "已排期",
    DISPLAY_BOOKED: "已预约",
    DISPLAY_ON_LEAVE: "已请假",
    DISPLAY_DONE: "已完成",
    DISPLAY_EXPIRED: "已过期",
    DISPLAY_CANCELLED: "已取消",
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


def resolve_schedule_display(
    schedule: AppSchedule,
    consultation: Optional[AppConsultation],
) -> str:
    if schedule.Status == "CANCELLED":
        return DISPLAY_CANCELLED
    if consultation and consultation.Status == "DONE":
        return DISPLAY_DONE
    if _is_booked_slot(schedule, consultation) and has_appointment_started(schedule.StartTime):
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
    start_time = consultation.StartTime
    if schedule and schedule.StartTime:
        start_time = start_time or schedule.StartTime
    if not has_appointment_started(start_time):
        return False
    if schedule is not None:
        return _is_booked_slot(schedule, consultation)
    return True
