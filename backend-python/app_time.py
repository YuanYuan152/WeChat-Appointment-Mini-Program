"""业务时区：排期、预约、取消/请假均以中国时间（UTC+8）计算。"""
from datetime import datetime, timedelta
from typing import Optional

CHINA_UTC_OFFSET = timedelta(hours=8)


def china_now() -> datetime:
    """当前中国时间（naive datetime，与库中排期 StartTime/EndTime 一致）。"""
    return datetime.utcnow() + CHINA_UTC_OFFSET


def hours_until(start_time: Optional[datetime]) -> Optional[float]:
    if not start_time:
        return None
    return (start_time - china_now()).total_seconds() / 3600
