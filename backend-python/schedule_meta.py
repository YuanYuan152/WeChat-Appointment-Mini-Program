"""预约中心、咨询室与排期 Note 字段解析（与前端 appointmentCenters / consultationRooms 对齐）。"""
from typing import List, Optional, TypedDict

from sqlalchemy.orm import Session

CENTER_NAMES = {
    "yangpu": "杨浦预约中心",
    "pudong": "浦东预约中心",
    "video": "视频咨询",
}

VIDEO_CENTER_ID = "video"


def is_video_center(center_id: Optional[str]) -> bool:
    return (center_id or "").strip() == VIDEO_CENTER_ID


def is_physical_center(center_id: Optional[str]) -> bool:
    return bool(center_id) and not is_video_center(center_id)

# 每个中心 3 间咨询室（仅咨询师排期使用，来访者预约不展示）
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
    """合并静态默认咨询室与数据库配置；数据库记录可覆盖同编号默认房间。"""
    if is_video_center(center_id):
        return []
    defaults = [{**room, "status": "AVAILABLE"} for room in CONSULTATION_ROOMS.get(center_id, [])]
    if db is not None:
        try:
            from models import AppConsultationRoom

            rows = (
                db.query(AppConsultationRoom)
                .filter(AppConsultationRoom.CenterId == center_id)
                .order_by(AppConsultationRoom.SortOrder.asc(), AppConsultationRoom.Id.asc())
                .all()
            )
            merged: dict[str, dict] = {room["id"]: room for room in defaults}
            ordered_codes = [room["id"] for room in defaults]
            for r in rows:
                if r.RoomCode not in ordered_codes:
                    ordered_codes.append(r.RoomCode)
                merged[r.RoomCode] = {
                    "id": r.RoomCode,
                    "name": r.Name,
                    "status": r.Status,
                    "dbId": r.Id,
                }
            return [merged[code] for code in ordered_codes if code in merged]
        except Exception:
            pass
    return defaults


def get_all_consultation_rooms(db: Optional[Session]) -> List[dict]:
    """全部中心的咨询室列表（不含视频咨询）。"""
    centers = [cid for cid in CENTER_NAMES if is_physical_center(cid)]
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
    """付款后实际分配的咨询室（room:）。"""
    for part in _note_parts(note):
        if part.lower().startswith("room:"):
            return part.split(":", 1)[1].strip()
    return None


def parse_pref_room_id(note: Optional[str]) -> Optional[str]:
    """咨询师排期时的咨询室偏好（pref:）。"""
    for part in _note_parts(note):
        if part.lower().startswith("pref:"):
            val = part.split(":", 1)[1].strip()
            if val and val.lower() != "none":
                return val
    return None


def display_room_id(note: Optional[str], status: str) -> Optional[str]:
    """日历展示：已预约显示实际咨询室，未预约显示偏好（兼容旧数据 room: 作偏好）。"""
    if status == "BOOKED":
        return parse_room_id(note)
    pref = parse_pref_room_id(note)
    if pref:
        return pref
    if status == "AVAILABLE":
        return parse_room_id(note)
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


def schedule_note(
    center_id: str,
    room_id: Optional[str] = None,
    *,
    pref_room_id: Optional[str] = None,
) -> str:
    """构建排期 Note。room_id 为付款后实际咨询室；pref_room_id 为排期偏好。"""
    parts = [f"center:{center_id}"]
    if pref_room_id:
        parts.append(f"pref:{pref_room_id}")
    if room_id:
        parts.append(f"room:{room_id}")
    return ";".join(parts)


def schedule_pref_note(center_id: str, pref_room_id: Optional[str] = None) -> str:
    """排期时仅记录中心与咨询室偏好，不占用咨询室。视频咨询不记录偏好。"""
    if is_video_center(center_id):
        return schedule_note(center_id)
    return schedule_note(center_id, pref_room_id=pref_room_id)


def assign_room_to_note(note: Optional[str], room_id: str) -> str:
    parts = [p for p in _note_parts(note) if not p.lower().startswith("room:")]
    parts.append(f"room:{room_id}")
    return ";".join(parts)


def release_assigned_room(note: Optional[str]) -> Optional[str]:
    """退款/取消后释放实际占用的咨询室，保留中心与偏好。"""
    if not note:
        return note
    parts = [p for p in _note_parts(note) if not p.lower().startswith("room:")]
    return ";".join(parts) if parts else None
