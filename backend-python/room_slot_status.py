"""咨询室单时段管理状态读写。"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from models import AppConsultationRoomSlot

SLOT_STATUSES = ("AVAILABLE", "DISABLED")


def normalize_manual_status(status: str) -> str:
    """兼容历史 MAINTENANCE 数据，统一为可用/停用。"""
    if status == "MAINTENANCE":
        return "DISABLED"
    if status in SLOT_STATUSES:
        return status
    return "AVAILABLE"


def normalize_slot_start(dt: datetime) -> datetime:
    """统一时间槽起始时刻（去掉秒/微秒），避免读写格式不一致。"""
    return dt.replace(second=0, microsecond=0)


def slot_start_iso(dt: datetime) -> str:
    return normalize_slot_start(dt).strftime("%Y-%m-%dT%H:%M:%S")


def resolve_slot_manual_status(
    db: Session,
    room_id: Optional[int],
    start_time: datetime,
    default: str = "AVAILABLE",
) -> str:
    if room_id is None:
        return default
    start_norm = normalize_slot_start(start_time)
    try:
        rows = (
            db.query(AppConsultationRoomSlot)
            .filter(AppConsultationRoomSlot.RoomId == room_id)
            .all()
        )
        for row in rows:
            if normalize_slot_start(row.StartTime) == start_norm:
                return normalize_manual_status(row.Status)
    except (ProgrammingError, OperationalError):
        db.rollback()
    return default


def slot_status_map_for_room(
    db: Session,
    room_id: int,
    start_times: List[datetime],
    default: str = "AVAILABLE",
) -> Dict[datetime, str]:
    if not start_times:
        return {}
    norm_times = [normalize_slot_start(st) for st in start_times]
    window_min = min(norm_times)
    window_max = max(norm_times)
    try:
        rows = (
            db.query(AppConsultationRoomSlot)
            .filter(
                AppConsultationRoomSlot.RoomId == room_id,
                AppConsultationRoomSlot.StartTime >= window_min,
                AppConsultationRoomSlot.StartTime <= window_max,
            )
            .all()
        )
        overrides = {
            normalize_slot_start(r.StartTime): normalize_manual_status(r.Status) for r in rows
        }
    except (ProgrammingError, OperationalError):
        db.rollback()
        overrides = {}
    return {
        st: overrides.get(normalize_slot_start(st), default) for st in start_times
    }

def is_slot_operational(status: str) -> bool:
    return status == "AVAILABLE"


def is_booking_window_operational(
    db: Session,
    room_id: Optional[int],
    start_time: datetime,
    default: str = "AVAILABLE",
) -> bool:
    """50 分钟咨询 + 10 分钟打扫占用两个连续半小时时段。"""
    return all(
        is_slot_operational(
            resolve_slot_manual_status(db, room_id, point, default)
        )
        for point in (start_time, start_time + timedelta(minutes=30))
    )


def upsert_slot_statuses(
    db: Session,
    room_id: int,
    items: List[dict],
) -> None:
    """items: [{start_time, status}]；AVAILABLE 时删除覆盖记录。"""
    for item in items:
        start_time = normalize_slot_start(item["start_time"])
        status = item["status"]
        if status not in SLOT_STATUSES:
            raise ValueError(f"无效状态：{status}")

        rows = (
            db.query(AppConsultationRoomSlot)
            .filter(AppConsultationRoomSlot.RoomId == room_id)
            .all()
        )
        row = next(
            (r for r in rows if normalize_slot_start(r.StartTime) == start_time),
            None,
        )
        if status == "AVAILABLE":
            if row:
                db.delete(row)
            continue
        if row:
            row.Status = status
            row.StartTime = start_time
            row.UpdatedAt = datetime.utcnow()
        else:
            db.add(
                AppConsultationRoomSlot(
                    RoomId=room_id,
                    StartTime=start_time,
                    Status=status,
                )
            )