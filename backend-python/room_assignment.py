"""付款成功后分配咨询室：优先偏好，否则随机选空闲室。视频咨询不分配咨询室。"""
import random
from typing import Optional

from sqlalchemy.orm import Session

from models import AppSchedule
from schedule_meta import (
    assign_room_to_note,
    get_consultation_rooms,
    is_video_center,
    parse_center_id,
    parse_pref_room_id,
    parse_room_id,
)
from room_slot_status import resolve_slot_manual_status, is_slot_operational
from schedule_slots import paid_occupied_rooms_at_center


def _legacy_pref_room_id(schedule: AppSchedule) -> Optional[str]:
    """兼容旧数据：AVAILABLE 状态下 note 中的 room: 视为偏好。"""
    if schedule.Status != "AVAILABLE":
        return None
    return parse_room_id(schedule.Note)


def assign_room_for_payment(
    db: Session,
    schedule: AppSchedule,
    center_id: str,
) -> str:
    """
    为已付款排期分配咨询室。
    偏好室空闲则分配偏好室，否则从未被付款占用的咨询室中随机选择。
    """
    rooms = get_consultation_rooms(db, center_id)
    available_ids = []
    for r in rooms:
        slot_status = resolve_slot_manual_status(
            db, r.get("dbId"), schedule.StartTime, "AVAILABLE",
        )
        if is_slot_operational(slot_status):
            available_ids.append(r["id"])
    if not available_ids:
        raise ValueError("该中心暂无可用咨询室")

    occupied = paid_occupied_rooms_at_center(
        db, center_id, schedule.StartTime, exclude_id=schedule.Id,
    )
    free = [rid for rid in available_ids if rid not in occupied]
    if not free:
        raise ValueError("该时段所有咨询室均已约满")

    pref = parse_pref_room_id(schedule.Note) or _legacy_pref_room_id(schedule)
    if pref and pref in free:
        return pref
    return random.choice(free)


def apply_room_assignment(
    db: Session,
    schedule: AppSchedule,
    center_id: Optional[str] = None,
) -> Optional[str]:
    """分配咨询室并写回排期 Note，返回实际咨询室 id；视频咨询返回 None。"""
    resolved_center = center_id or parse_center_id(schedule.Note)
    if not resolved_center:
        raise ValueError("排期未指定预约中心，无法分配咨询室")
    if is_video_center(resolved_center):
        return None

    assigned = assign_room_for_payment(db, schedule, resolved_center)
    schedule.Note = assign_room_to_note(schedule.Note, assigned)
    return assigned
