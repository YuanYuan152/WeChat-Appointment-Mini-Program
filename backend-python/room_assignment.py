"""付款成功后分配咨询室：优先偏好，否则随机选空闲室。视频咨询不分配咨询室。"""
import random
from typing import Optional

from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app_time import china_now
from models import AppOrder, AppSchedule
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


def _acquire_center_slot_lock(
    db: Session,
    center_id: str,
    schedule: AppSchedule,
) -> None:
    """串行化同一中心同一时段的选室，避免并发付款重复分配。"""
    bind = db.get_bind()
    if not bind or bind.dialect.name != "mssql":
        return
    resource = f"booking:center:{center_id}:{schedule.StartTime.strftime('%Y%m%d%H%M%S')}"
    result = db.execute(
        text(
            "SET NOCOUNT ON; DECLARE @result int; "
            "EXEC @result = sys.sp_getapplock "
            "@Resource=:resource, @LockMode='Exclusive', "
            "@LockOwner='Transaction', @LockTimeout=10000; "
            "SELECT @result"
        ),
        {"resource": resource},
    ).scalar()
    if result is None or int(result) < 0:
        raise ValueError("该时段正在处理其他预约，请稍后重试")


def _pending_proxy_reserved_rooms(
    db: Session,
    center_id: str,
    schedule: AppSchedule,
) -> set[str]:
    """待支付代理订单已经选择的咨询室，在订单有效期内也视为被占用。"""
    rows = (
        db.query(AppSchedule)
        .join(AppOrder, AppOrder.SlotId == AppSchedule.Id)
        .filter(
            AppSchedule.StartTime == schedule.StartTime,
            AppSchedule.Status == "AVAILABLE",
            AppSchedule.Id != schedule.Id,
            AppOrder.Status == "PENDING",
            AppOrder.Description.like("proxy:%"),
            or_(AppOrder.ExpiresAt.is_(None), AppOrder.ExpiresAt > china_now()),
        )
        .all()
    )
    return {
        room_id
        for row in rows
        if parse_center_id(row.Note) == center_id
        if (room_id := parse_room_id(row.Note))
    }


def _legacy_pref_room_id(schedule: AppSchedule) -> Optional[str]:
    """兼容旧数据：AVAILABLE 状态下 note 中的 room: 视为偏好。"""
    if schedule.Status != "AVAILABLE":
        return None
    return parse_room_id(schedule.Note)


def assign_room_for_payment(
    db: Session,
    schedule: AppSchedule,
    center_id: str,
    *,
    required_room_id: Optional[str] = None,
) -> str:
    """
    为已付款排期分配咨询室。
    偏好室空闲则分配偏好室，否则从未被付款占用的咨询室中随机选择。
    """
    _acquire_center_slot_lock(db, center_id, schedule)
    rooms = get_consultation_rooms(db, center_id)
    available_ids = []
    for r in rooms:
        slot_status = resolve_slot_manual_status(
            db,
            r.get("dbId"),
            schedule.StartTime,
            r.get("status", "AVAILABLE"),
        )
        if is_slot_operational(slot_status):
            available_ids.append(r["id"])
    if not available_ids:
        raise ValueError("该中心暂无可用咨询室")

    occupied = paid_occupied_rooms_at_center(
        db, center_id, schedule.StartTime, exclude_id=schedule.Id,
    )
    occupied |= _pending_proxy_reserved_rooms(db, center_id, schedule)
    free = [rid for rid in available_ids if rid not in occupied]

    if required_room_id:
        if required_room_id not in available_ids:
            raise ValueError("代理预约指定的咨询室在该时段不可用，请联系助理重新预约")
        if required_room_id not in free:
            raise ValueError("代理预约指定的咨询室已被占用，请联系助理重新预约")
        return required_room_id

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
    *,
    required_room_id: Optional[str] = None,
) -> Optional[str]:
    """分配咨询室并写回排期 Note，返回实际咨询室 id；视频咨询返回 None。"""
    resolved_center = center_id or parse_center_id(schedule.Note)
    if not resolved_center:
        raise ValueError("排期未指定预约中心，无法分配咨询室")
    if is_video_center(resolved_center):
        return None

    assigned = assign_room_for_payment(
        db,
        schedule,
        resolved_center,
        required_room_id=required_room_id,
    )
    schedule.Note = assign_room_to_note(schedule.Note, assigned)
    return assigned
