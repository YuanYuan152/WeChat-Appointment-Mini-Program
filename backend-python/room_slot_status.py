"""咨询室单时段管理状态读写。"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from models import AppConsultationRoomSlot

SLOT_STATUSES = ("AVAILABLE", "DISABLED", "OCCUPIED")
NOTE_MAX_LENGTH = 500


def normalize_manual_status(status: str) -> str:
    """兼容历史 MAINTENANCE 数据，统一为可用/停用/占用。"""
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


def normalize_note(note: Optional[str], *, status: str) -> Optional[str]:
    if status != "OCCUPIED":
        return None
    text = (note or "").strip()
    if len(text) > NOTE_MAX_LENGTH:
        raise ValueError(f"备注不能超过 {NOTE_MAX_LENGTH} 字")
    return text or None


def resolve_slot_manual_status(
    db: Session,
    room_id: Optional[int],
    start_time: datetime,
    default: str = "AVAILABLE",
) -> str:
    status, _ = resolve_slot_manual_detail(db, room_id, start_time, default)
    return status


def resolve_slot_manual_detail(
    db: Session,
    room_id: Optional[int],
    start_time: datetime,
    default: str = "AVAILABLE",
) -> Tuple[str, Optional[str]]:
    if room_id is None:
        return default, None
    start_norm = normalize_slot_start(start_time)
    try:
        rows = (
            db.query(AppConsultationRoomSlot)
            .filter(AppConsultationRoomSlot.RoomId == room_id)
            .all()
        )
        for row in rows:
            if normalize_slot_start(row.StartTime) == start_norm:
                status = normalize_manual_status(row.Status)
                note = getattr(row, "Note", None) if status == "OCCUPIED" else None
                return status, (note.strip() if isinstance(note, str) and note.strip() else None)
    except (ProgrammingError, OperationalError):
        db.rollback()
    return default, None


def slot_status_map_for_room(
    db: Session,
    room_id: int,
    start_times: List[datetime],
    default: str = "AVAILABLE",
) -> Dict[datetime, str]:
    details = slot_detail_map_for_room(db, room_id, start_times, default)
    return {st: details[st][0] for st in start_times}


def slot_detail_map_for_room(
    db: Session,
    room_id: int,
    start_times: List[datetime],
    default: str = "AVAILABLE",
) -> Dict[datetime, Tuple[str, Optional[str]]]:
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
        overrides: Dict[datetime, Tuple[str, Optional[str]]] = {}
        for row in rows:
            status = normalize_manual_status(row.Status)
            note = getattr(row, "Note", None) if status == "OCCUPIED" else None
            if isinstance(note, str):
                note = note.strip() or None
            else:
                note = None
            overrides[normalize_slot_start(row.StartTime)] = (status, note)
    except (ProgrammingError, OperationalError):
        db.rollback()
        overrides = {}
    return {
        st: overrides.get(normalize_slot_start(st), (default, None)) for st in start_times
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
    """items: [{start_time, status, note?}]；AVAILABLE 时删除覆盖记录。"""
    for item in items:
        start_time = normalize_slot_start(item["start_time"])
        status = item["status"]
        if status not in SLOT_STATUSES:
            raise ValueError(f"无效状态：{status}")
        note = normalize_note(item.get("note"), status=status)

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
            row.Note = note
            row.UpdatedAt = datetime.utcnow()
        else:
            db.add(
                AppConsultationRoomSlot(
                    RoomId=room_id,
                    StartTime=start_time,
                    Status=status,
                    Note=note,
                )
            )
