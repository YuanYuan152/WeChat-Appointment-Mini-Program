"""标准咨询时间槽与滚动排期窗口规则。"""
from datetime import date, datetime, time, timedelta
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app_time import china_now
from models import AppSchedule
from schedule_meta import parse_center_id, parse_room_id

ROLLING_WINDOW_DAYS = 30
SLOT_DURATION_MINUTES = 50
# 每日标准时段（50 分钟/节，午休 12 点不排）
SLOT_START_HOURS = [9, 10, 11, 13, 14, 15, 16, 17, 18]


def slot_bounds_for_date(d: date, hour: int) -> Tuple[datetime, datetime]:
    start = datetime.combine(d, time(hour, 0))
    end = start + timedelta(minutes=SLOT_DURATION_MINUTES)
    return start, end


def all_slot_bounds_for_date(d: date) -> List[Tuple[datetime, datetime]]:
    return [slot_bounds_for_date(d, h) for h in SLOT_START_HOURS]


def standard_slot_start_containing(at_time: datetime) -> Optional[datetime]:
    """返回 at_time 所在标准时段的起始时刻。"""
    for start, end in all_slot_bounds_for_date(at_time.date()):
        if start <= at_time < end:
            return start
    return None


def standard_slot_start_for_status(at_time: datetime) -> datetime:
    """查询咨询室时段状态时对齐的标准时段起点。"""
    hit = standard_slot_start_containing(at_time)
    if hit:
        return hit
    day_starts = [slot_bounds_for_date(at_time.date(), h)[0] for h in SLOT_START_HOURS]
    future = [s for s in day_starts if s > at_time]
    if future:
        return future[0]
    return day_starts[-1] if day_starts else at_time.replace(second=0, microsecond=0)


def rolling_window_end(today: date) -> date:
    return today + timedelta(days=ROLLING_WINDOW_DAYS - 1)


def rolling_window_datetime_bounds(
    today: Optional[date] = None,
) -> Tuple[datetime, datetime]:
    """滚动排期时间窗（含起止边界），咨询师日历与来访者预约共用。"""
    ref = today or china_now().date()
    start_bound = datetime.combine(ref, time.min)
    end_bound = datetime.combine(rolling_window_end(ref) + timedelta(days=1), time.min)
    return start_bound, end_bound


def validate_slot_in_rolling_window(start: datetime, now: Optional[datetime] = None) -> None:
    """滚动窗口内：今天起未来 N 天内；当天须未开始。"""
    now = now or china_now()
    today = now.date()
    end_date = rolling_window_end(today)
    slot_date = start.date()
    if slot_date < today or slot_date > end_date:
        raise ValueError(f"仅可排未来 {ROLLING_WINDOW_DAYS} 天内（{today.isoformat()} ~ {end_date.isoformat()}）的时段")
    if start <= now:
        raise ValueError("该时段已开始或已过，无法排期")


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


def _assigned_room_id(schedule: AppSchedule) -> Optional[str]:
    """仅付款占用（BOOKED + room:）才算咨询室被占用。"""
    if schedule.Status != "BOOKED":
        return None
    return parse_room_id(schedule.Note)


def room_occupied(
    db: Session,
    room_id: str,
    start_time: datetime,
    exclude_id: Optional[int] = None,
) -> Optional[AppSchedule]:
    for row in active_schedules_at(db, start_time, exclude_id=exclude_id):
        if _assigned_room_id(row) == room_id:
            return row
    return None


def room_occupied_at_center(
    db: Session,
    center_id: str,
    room_id: str,
    start_time: datetime,
    exclude_id: Optional[int] = None,
) -> Optional[AppSchedule]:
    """指定预约中心 + 咨询室 + 时段是否已被付款占用。"""
    for row in active_schedules_at(db, start_time, exclude_id=exclude_id):
        if parse_center_id(row.Note) != center_id:
            continue
        if _assigned_room_id(row) == room_id:
            return row
    return None


def paid_occupied_rooms_at_center(
    db: Session,
    center_id: str,
    start_time: datetime,
    *,
    exclude_id: Optional[int] = None,
) -> set[str]:
    """某中心某时段已被付款占用的咨询室集合。"""
    occupied: set[str] = set()
    for row in active_schedules_at(db, start_time, exclude_id=exclude_id):
        if parse_center_id(row.Note) != center_id:
            continue
        room = _assigned_room_id(row)
        if room:
            occupied.add(room)
    return occupied


def has_available_room_at_center(
    db: Session,
    center_id: str,
    start_time: datetime,
    available_room_ids: List[str],
    *,
    exclude_id: Optional[int] = None,
) -> bool:
    """该中心该时段是否仍有可分配的咨询室（用于排期时段可选判断）。"""
    occupied = paid_occupied_rooms_at_center(
        db, center_id, start_time, exclude_id=exclude_id,
    )
    return any(rid not in occupied for rid in available_room_ids)
