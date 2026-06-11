"""预约中心、咨询室与排班 Note 字段解析（与前端 appointmentCenters / consultationRooms 对齐）。"""
from typing import List, Optional, TypedDict

from sqlalchemy.orm import Session

CENTER_NAMES = {
    "yangpu": "杨浦预约中心",
    "pudong": "浦东预约中心",
}

# 每个中心 3 间咨询室（仅咨询师挂课使用，来访者预约不展示）
CONSULTATION_ROOMS: dict[str, List[dict[str, str]]] = {
    "yangpu": [
        {"id": "yangpu-r1", "name": "咨询室 A"},
        {"id": "yangpu-r2", "name": "咨询室 B"},
        {"id": "yangpu-r3", "name": "咨询室 C"},
    ],
    "pudong": [
        {"id": "pudong-r1", "name": "咨询室 A"},
        {"id": "pudong-r2", "name": "咨询室 B"},
        {"id": "pudong-r3", "name": "咨询室 C"},
    ],
}


def get_consultation_rooms(db: Optional[Session], center_id: str) -> List[dict[str, str]]:
    """优先读数据库，无记录时回退静态配置。"""
    if db is not None:
        try:
            from models import AppConsultationRoom

            rows = (
                db.query(AppConsultationRoom)
                .filter(AppConsultationRoom.CenterId == center_id)
                .order_by(AppConsultationRoom.SortOrder.asc(), AppConsultationRoom.Id.asc())
                .all()
            )
            if rows:
                return [
                    {"id": r.RoomCode, "name": r.Name, "status": r.Status, "dbId": r.Id}
                    for r in rows
                ]
        except Exception:
            pass
    return [{**room, "status": "AVAILABLE"} for room in CONSULTATION_ROOMS.get(center_id, [])]


def get_all_consultation_rooms(db: Optional[Session]) -> List[dict]:
    """全部中心的咨询室列表。"""
    centers = list(CENTER_NAMES.keys())
    result: List[dict] = []
    for center_id in centers:
        for room in get_consultation_rooms(db, center_id):
            result.append({"centerId": center_id, **room})
    return result


def _note_parts(note: Optional[str]) -> List[str]:
    if not note:
        return []
    return [p.strip() for p in str(note).split(";") if p.strip()]


def parse_center_id(note: Optional[str]) -> Optional[str]:
    for part in _note_parts(note):
        if part.lower().startswith("center:"):
            return part.split(":", 1)[1].strip()
    return None


def parse_room_id(note: Optional[str]) -> Optional[str]:
    for part in _note_parts(note):
        if part.lower().startswith("room:"):
            return part.split(":", 1)[1].strip()
    return None


def center_display_name(center_id: Optional[str]) -> Optional[str]:
    if not center_id:
        return None
    return CENTER_NAMES.get(center_id, center_id)


def room_display_name(center_id: Optional[str], room_id: Optional[str], db: Optional[Session] = None) -> Optional[str]:
    if not center_id or not room_id:
        return None
    for room in get_consultation_rooms(db, center_id):
        if room["id"] == room_id:
            return room["name"]
    return room_id


def center_note(center_id: str) -> str:
    return schedule_note(center_id)


def schedule_note(center_id: str, room_id: Optional[str] = None) -> str:
    base = f"center:{center_id}"
    if room_id:
        return f"{base};room:{room_id}"
    return base
