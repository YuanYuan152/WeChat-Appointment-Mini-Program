"""管理工作台改期：校验时间/咨询室冲突并原子迁移已预约咨询。"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app_time import china_now
from models import (
    AppConsultation,
    AppLeaveRequest,
    AppOrder,
    AppSchedule,
    AppScheduleRescheduleLog,
)
from room_slot_status import is_booking_window_operational
from schedule_meta import (
    center_display_name,
    get_consultation_rooms,
    is_video_center,
    parse_center_id,
    parse_room_id,
    release_assigned_room,
    room_display_name,
    schedule_note,
)
from schedule_slots import (
    all_slot_bounds_for_date,
    active_schedules_at,
    booking_lead_time_reason,
    is_aligned_standard_slot,
    paid_occupied_rooms_at_center,
    rolling_window_end,
    validate_slot_in_rolling_window,
)

RESCHEDULABLE_CONSULTATION_STATUSES = ("PENDING", "CONFIRMED")


def _load_reschedulable(
    db: Session,
    schedule_id: int,
    *,
    for_update: bool = False,
) -> tuple[AppSchedule, AppConsultation]:
    query = db.query(AppSchedule).filter(AppSchedule.Id == schedule_id)
    if for_update:
        query = query.with_for_update()
    schedule = query.first()
    if not schedule:
        raise ValueError("排期不存在")
    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule.Id,
            AppConsultation.Status.in_(RESCHEDULABLE_CONSULTATION_STATUSES),
        )
        .first()
    )
    if schedule.Status != "BOOKED" or not consultation:
        raise ValueError("仅已预约且尚未完成的排期可以改时间")
    if schedule.StartTime <= china_now():
        raise ValueError("已开始或已过的排期不能改时间")
    pending_leave = (
        db.query(AppLeaveRequest.Id)
        .filter(
            AppLeaveRequest.ScheduleId == schedule.Id,
            AppLeaveRequest.Status == "PENDING",
        )
        .first()
    )
    if pending_leave:
        raise ValueError("该排期有待审核请假申请，不能改时间")
    return schedule, consultation


def _exact_available_target(
    db: Session,
    counselor_id: int,
    start_time: datetime,
    *,
    exclude_schedule_id: int,
) -> Optional[AppSchedule]:
    return (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.StartTime == start_time,
            AppSchedule.Status == "AVAILABLE",
            AppSchedule.Id != exclude_schedule_id,
        )
        .with_for_update()
        .first()
    )


def _target_conflict_reason(
    db: Session,
    schedule: AppSchedule,
    start_time: datetime,
) -> Optional[str]:
    target = _exact_available_target(
        db,
        schedule.CounselorId,
        start_time,
        exclude_schedule_id=schedule.Id,
    )
    for row in active_schedules_at(db, start_time, exclude_id=schedule.Id):
        if row.CounselorId != schedule.CounselorId:
            continue
        if target and row.Id == target.Id:
            continue
        return "咨询师在该时段已有其他排期"
    if target:
        pending_order = (
            db.query(AppOrder.Id)
            .filter(AppOrder.SlotId == target.Id, AppOrder.Status == "PENDING")
            .first()
        )
        if pending_order:
            return "该时段已有待支付订单"
    return None


def build_reschedule_options(
    db: Session,
    *,
    schedule_id: int,
    target_date: date,
) -> Dict[str, Any]:
    schedule, consultation = _load_reschedulable(db, schedule_id)
    today = china_now().date()
    if target_date < today or target_date > rolling_window_end(today):
        raise ValueError("仅可选择未来30天内的日期")
    center_id = parse_center_id(schedule.Note)
    if not center_id:
        raise ValueError("排期未指定预约中心")
    rooms = get_consultation_rooms(db, center_id)
    result = []
    for start_time, end_time in all_slot_bounds_for_date(target_date):
        lead_reason = booking_lead_time_reason(start_time)
        conflict_reason = _target_conflict_reason(db, schedule, start_time)
        occupied = paid_occupied_rooms_at_center(
            db,
            center_id,
            start_time,
            exclude_id=schedule.Id,
        )
        room_options = []
        for room in rooms:
            operational = is_booking_window_operational(
                db,
                room.get("dbId"),
                start_time,
                room.get("status", "AVAILABLE"),
            )
            available = operational and room["id"] not in occupied
            room_options.append(
                {
                    "roomId": room["id"],
                    "roomName": room["name"],
                    "available": available,
                    "unavailableReason": (
                        None if available else ("已占用" if room["id"] in occupied else "不可用")
                    ),
                }
            )
        selectable = (
            not lead_reason
            and not conflict_reason
            and (is_video_center(center_id) or any(item["available"] for item in room_options))
        )
        result.append(
            {
                "key": start_time.strftime("%H:%M"),
                "startTime": start_time,
                "endTime": end_time,
                "selectable": selectable,
                "unavailableReason": lead_reason or conflict_reason or (
                    None if selectable else "无可用咨询室"
                ),
                "rooms": room_options,
            }
        )
    return {
        "scheduleId": schedule.Id,
        "consultationId": consultation.Id,
        "date": target_date.isoformat(),
        "centerId": center_id,
        "centerName": center_display_name(center_id),
        "currentStartTime": schedule.StartTime,
        "currentEndTime": schedule.EndTime,
        "currentRoomId": parse_room_id(schedule.Note),
        "slots": result,
    }


def _source_was_proxy_created_without_open_slot(
    db: Session,
    consultation: AppConsultation,
    schedule_id: int,
) -> bool:
    order = (
        db.query(AppOrder)
        .filter(AppOrder.Id == consultation.OrderId)
        .first()
        if consultation.OrderId
        else db.query(AppOrder).filter(AppOrder.SlotId == schedule_id).first()
    )
    description = str(getattr(order, "Description", "") or "")
    return description.startswith("proxy:") and description.endswith("|new")


def _refresh_consultation_tasks_and_messages(
    db: Session,
    consultation: AppConsultation,
    schedule: AppSchedule,
    *,
    old_start_time: datetime,
    reason: str,
) -> None:
    from consultation_status_service import (
        cancel_consultation_auto_done_tasks,
        schedule_consultation_auto_done,
    )
    from counselor_message_service import (
        cancel_counselor_consultation_done_notices,
        cancel_counselor_consultation_reminders,
        notify_counselor_appointment_rescheduled,
        schedule_counselor_consultation_done_notice,
        schedule_counselor_consultation_reminder,
    )
    from patient_message_service import (
        cancel_patient_consultation_reminders,
        notify_patient_appointment_rescheduled,
        schedule_patient_consultation_reminder,
    )

    cancel_patient_consultation_reminders(db, consultation.Id)
    cancel_counselor_consultation_reminders(db, consultation.Id)
    cancel_counselor_consultation_done_notices(db, consultation.Id)
    cancel_consultation_auto_done_tasks(db, consultation.Id)
    schedule_patient_consultation_reminder(db, consultation)
    schedule_counselor_consultation_reminder(db, consultation)
    schedule_counselor_consultation_done_notice(db, consultation)
    schedule_consultation_auto_done(db, consultation, schedule)
    notify_patient_appointment_rescheduled(
        db,
        consultation,
        old_start_time=old_start_time,
        reason=reason,
    )
    notify_counselor_appointment_rescheduled(
        db,
        consultation,
        old_start_time=old_start_time,
        reason=reason,
    )


def reschedule_booked_consultation(
    db: Session,
    *,
    schedule_id: int,
    operator_account_id: int,
    new_start_time: datetime,
    new_end_time: datetime,
    room_id: Optional[str],
    reason: str,
) -> Dict[str, Any]:
    normalized_reason = (reason or "").strip()
    if not normalized_reason:
        raise ValueError("修改原因不能为空")
    schedule, consultation = _load_reschedulable(db, schedule_id, for_update=True)
    if not is_aligned_standard_slot(new_start_time, new_end_time):
        raise ValueError("请选择标准时间槽")
    validate_slot_in_rolling_window(new_start_time)

    center_id = parse_center_id(schedule.Note)
    if not center_id:
        raise ValueError("排期未指定预约中心")
    conflict_reason = _target_conflict_reason(db, schedule, new_start_time)
    if conflict_reason:
        raise ValueError(conflict_reason)

    normalized_room_id = (room_id or "").strip() or None
    if is_video_center(center_id):
        normalized_room_id = None
    else:
        if not normalized_room_id:
            raise ValueError("请选择咨询室")
        room = next(
            (item for item in get_consultation_rooms(db, center_id) if item["id"] == normalized_room_id),
            None,
        )
        if not room or not is_booking_window_operational(
            db,
            room.get("dbId"),
            new_start_time,
            room.get("status", "AVAILABLE"),
        ):
            raise ValueError("该咨询室在所选时段不可用")
        if normalized_room_id in paid_occupied_rooms_at_center(
            db,
            center_id,
            new_start_time,
            exclude_id=schedule.Id,
        ):
            raise ValueError("该咨询室在所选时段已被占用")
    if (
        new_start_time == schedule.StartTime
        and normalized_room_id == parse_room_id(schedule.Note)
    ):
        raise ValueError("新时间和咨询室与当前排期相同")

    old_start_time = schedule.StartTime
    old_end_time = schedule.EndTime
    old_center_id = parse_center_id(schedule.Note)
    old_room_id = parse_room_id(schedule.Note)
    moving_to_new_slot = new_start_time != old_start_time
    source_was_proxy_new = _source_was_proxy_created_without_open_slot(
        db, consultation, schedule.Id,
    )
    target_schedule = schedule
    if moving_to_new_slot:
        target_schedule = _exact_available_target(
            db,
            schedule.CounselorId,
            new_start_time,
            exclude_schedule_id=schedule.Id,
        )
        if not target_schedule:
            target_schedule = AppSchedule(
                CounselorId=schedule.CounselorId,
                StartTime=new_start_time,
                EndTime=new_end_time,
                Status="BOOKED",
            )
            db.add(target_schedule)
            db.flush()

    target_schedule.StartTime = new_start_time
    target_schedule.EndTime = new_end_time
    target_schedule.Status = "BOOKED"
    target_schedule.Note = schedule_note(center_id, normalized_room_id)
    target_schedule.UpdatedAt = datetime.utcnow()

    consultation.ScheduleId = target_schedule.Id
    consultation.StartTime = new_start_time
    consultation.EndTime = new_end_time
    consultation.Note = target_schedule.Note
    consultation.UpdatedAt = datetime.utcnow()
    related_orders = (
        db.query(AppOrder)
        .filter(
            (AppOrder.Id == consultation.OrderId)
            if consultation.OrderId
            else (AppOrder.SlotId == schedule.Id)
        )
        .all()
    )
    for order in related_orders:
        order.SlotId = target_schedule.Id
        order.UpdatedAt = datetime.utcnow()

    if moving_to_new_slot:
        if source_was_proxy_new:
            schedule.Status = "CANCELLED"
        else:
            schedule.Status = "AVAILABLE"
        schedule.Note = release_assigned_room(schedule.Note)
        schedule.UpdatedAt = datetime.utcnow()

    db.add(
        AppScheduleRescheduleLog(
            OriginalScheduleId=schedule.Id,
            TargetScheduleId=target_schedule.Id,
            ConsultationId=consultation.Id,
            OperatorAccountId=operator_account_id,
            Reason=normalized_reason,
            OldStartTime=old_start_time,
            OldEndTime=old_end_time,
            OldCenterId=old_center_id,
            OldRoomId=old_room_id,
            NewStartTime=new_start_time,
            NewEndTime=new_end_time,
            NewCenterId=center_id,
            NewRoomId=normalized_room_id,
        )
    )
    db.flush()
    # 消息与后续提醒和排期迁移共用一个事务。任一消息创建失败时由接口层
    # 整体回滚，避免返回“已通知”但咨询师或来访实际收不到改期消息。
    _refresh_consultation_tasks_and_messages(
        db,
        consultation,
        target_schedule,
        old_start_time=old_start_time,
        reason=normalized_reason,
    )

    return {
        "scheduleId": target_schedule.Id,
        "originalScheduleId": schedule.Id,
        "consultationId": consultation.Id,
        "startTime": new_start_time,
        "endTime": new_end_time,
        "centerId": center_id,
        "centerName": center_display_name(center_id),
        "roomId": normalized_room_id,
        "roomName": room_display_name(center_id, normalized_room_id, db),
        "reason": normalized_reason,
        "message": "咨询时间已修改，并已通知咨询师和来访",
    }
