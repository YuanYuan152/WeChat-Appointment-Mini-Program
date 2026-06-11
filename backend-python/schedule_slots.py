"""标准咨询时间槽与滚动 7 天挂课规则。"""
from datetime import date, datetime, time, timedelta
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app_time import china_now
from models import AppSchedule
from schedule_meta import parse_center_id, parse_room_id

ROLLING_WINDOW_DAYS = 7
SLOT_DURATION_MINUTES = 50
# 每日标准时段（50 分钟/节，午休 12 点不排）
SLOT_START_HOURS = [9, 10, 11, 13, 14, 15, 16, 17, 18]


def slot_bounds_for_date(d: date, hour: int) -> Tuple[datetime, datetime]:
    start = datetime.combine(d, time(hour, 0))
    end = start + timedelta(minutes=SLOT_DURATION_MINUTES)
    return start, end


def all_slot_bounds_for_date(d: date) -> List[Tuple[datetime, datetime]]:
    return [slot_bounds_for_date(d, h) for h in SLOT_START_HOURS]


def rolling_window_end(today: date) -> date:
    return today + timedelta(days=ROLLING_WINDOW_DAYS - 1)


def validate_slot_in_rolling_window(start: datetime, now: Optional[datetime] = None) -> None:
    """滚动 7 天：今天起未来 7 天内；当天须未开始。"""
    now = now or china_now()
    today = now.date()
    end_date = rolling_window_end(today)
    slot_date = start.date()
    if slot_date < today or slot_date > end_date:
        raise ValueError(f"仅可挂未来 {ROLLING_WINDOW_DAYS} 天内（{today.isoformat()} ~ {end_date.isoformat()}）的课")
    if start <= now:
        raise ValueError("该时段已开始或已过，无法挂课")


def is_aligned_standard_slot(start: datetime, end: datetime) -> bool:
    if start.minute != 0 or start.second != 0:
        return False
    expected_end = start + timedelta(minutes=SLOT_DURATION_MINUTES)
    return end == expected_end and start.hour in SLOT_START_HOURS


def active_schedules_at(
    db: Session,
    start_time: datetime,
    *,
    exclude_id: Optional[int] = None,
) -> List[AppSchedule]:
    q = db.query(AppSchedule).filter(
        AppSchedule.StartTime == start_time,
        AppSchedule.Status != "CANCELLED",
    )
    if exclude_id:
        q = q.filter(AppSchedule.Id != exclude_id)
    return q.all()


def counselor_has_slot(db: Session, counselor_id: int, start_time: datetime, exclude_id: Optional[int] = None) -> bool:
    rows = active_schedules_at(db, start_time, exclude_id=exclude_id)
    return any(r.CounselorId == counselor_id for r in rows)


def room_occupied(
    db: Session,
    room_id: str,
    start_time: datetime,
    exclude_id: Optional[int] = None,
) -> Optional[AppSchedule]:
    for row in active_schedules_at(db, start_time, exclude_id=exclude_id):
        if parse_room_id(row.Note) == room_id:
            return row
    return None


def room_occupied_at_center(
    db: Session,
    center_id: str,
    room_id: str,
    start_time: datetime,
    exclude_id: Optional[int] = None,
) -> Optional[AppSchedule]:
    """指定预约中心 + 咨询室 + 时段是否已被占用（含其他咨询师挂课/来访者已约）。"""
    for row in active_schedules_at(db, start_time, exclude_id=exclude_id):
        if parse_center_id(row.Note) != center_id:
            continue
        if parse_room_id(row.Note) == room_id:
            return row
    return None
