"""预约中心、咨询室与排班 Note 字段解析（与前端 appointmentCenters / consultationRooms 对齐）。"""
from typing import List, Optional, TypedDict

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


def room_display_name(center_id: Optional[str], room_id: Optional[str]) -> Optional[str]:
    if not center_id or not room_id:
        return None
    for room in CONSULTATION_ROOMS.get(center_id, []):
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
