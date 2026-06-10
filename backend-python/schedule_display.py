"""排班展示状态：与来访者预约系统联动。"""
from typing import Optional

from models import AppConsultation, AppSchedule

# OPEN=已挂课可约 BOOKED=已预约 DONE=已完成 CANCELLED=已取消
DISPLAY_OPEN = "OPEN"
DISPLAY_BOOKED = "BOOKED"
DISPLAY_DONE = "DONE"
DISPLAY_CANCELLED = "CANCELLED"

DISPLAY_LABELS = {
    DISPLAY_OPEN: "已挂课",
    DISPLAY_BOOKED: "已预约",
    DISPLAY_DONE: "已完成",
    DISPLAY_CANCELLED: "已取消",
}


def resolve_schedule_display(
    schedule: AppSchedule,
    consultation: Optional[AppConsultation],
) -> str:
    if schedule.Status == "CANCELLED":
        return DISPLAY_CANCELLED
    if consultation and consultation.Status == "DONE":
        return DISPLAY_DONE
    if schedule.Status == "BOOKED":
        return DISPLAY_BOOKED
    if consultation and consultation.Status in ("PENDING", "CONFIRMED", "ONGOING"):
        return DISPLAY_BOOKED
    if schedule.Status == "AVAILABLE":
        return DISPLAY_OPEN
    return DISPLAY_CANCELLED
