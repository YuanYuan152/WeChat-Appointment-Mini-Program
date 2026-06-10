"""预约中心与排班 Note 字段解析（与前端 appointmentCenters 对齐）。"""
from typing import Optional

CENTER_NAMES = {
    "yangpu": "杨浦预约中心",
    "pudong": "浦东预约中心",
}


def parse_center_id(note: Optional[str]) -> Optional[str]:
    if not note:
        return None
    text = str(note).strip()
    if text.lower().startswith("center:"):
        return text.split(":", 1)[1].strip()
    return None


def center_display_name(center_id: Optional[str]) -> Optional[str]:
    if not center_id:
        return None
    return CENTER_NAMES.get(center_id, center_id)


def center_note(center_id: str) -> str:
    return f"center:{center_id}"
