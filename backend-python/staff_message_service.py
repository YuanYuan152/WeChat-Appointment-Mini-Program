"""助理/管理员站内消息：预约、取消、咨询师请假。"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from message import create_message
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppLeaveRequest,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
    AppSchedule,
)
from refund_exemption_service import latest_exemptions_by_consultation
from schedule_meta import (
    center_display_name,
    display_room_id,
    is_video_center,
    parse_center_id,
    room_display_name,
)


def _assistant_account_ids(db: Session) -> List[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Assistant")
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _admin_ops_account_ids(db: Session) -> List[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType.in_(["Admin", "Ops"]))
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _staff_account_ids(db: Session) -> List[int]:
    """助理 + 管理员/Ops（请假等需多方知晓的场景）。"""
    seen: set[int] = set()
    ids: List[int] = []
    for account_id in _assistant_account_ids(db) + _admin_ops_account_ids(db):
        if account_id in seen:
            continue
        seen.add(account_id)
        ids.append(account_id)
    return ids


def _account_display_name(db: Session, account_id: int) -> str:
    acc = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not acc:
        return f"用户#{account_id}"
    return acc.RealName or acc.Nickname or acc.Mobile or f"用户#{account_id}"


def _counselor_display_name(db: Session, counselor_id: int) -> str:
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    return _account_display_name(db, counselor_id)


def _format_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "时间待定"
    return dt.strftime("%Y-%m-%d %H:%M")


def _appointment_location(
    db: Session,
    note: Optional[str],
    *,
    status: str = "BOOKED",
) -> str:
    center_id = parse_center_id(note)
    center_name = center_display_name(center_id) or "未知地点"
    if is_video_center(center_id):
        return center_name
    room_id = display_room_id(note, status)
    room_name = room_display_name(center_id, room_id, db) if room_id else None
    if room_name:
        return f"{center_name} · {room_name}"
    return center_name


def _patient_contact(db: Session, patient_id: int) -> Dict[str, str]:
    acc = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    return {
        "name": _account_display_name(db, patient_id),
        "phone": (acc.Mobile or "") if acc else "",
        "emergencyContact": (acc.EmergencyContact or "") if acc else "",
        "emergencyPhone": (acc.EmergencyPhone or "") if acc else "",
    }


def _exemption_label(status: Optional[str]) -> str:
    if not status:
        return "未申请"
    return {
        "PENDING": "已申请，待审核",
        "APPROVED": "已通过",
        "REJECTED": "未通过",
    }.get(status, status)


def _message_payload(summary: str, detail: Dict[str, Any]) -> str:
    return json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)


def _notify_staff(
    db: Session,
    *,
    type_: str,
    title: str,
    content: str,
    related_type: str,
    related_id: Optional[int],
    account_ids: List[int],
) -> None:
    for account_id in account_ids:
        create_message(
            db,
            account_id,
            type_,
            title,
            content,
            related_type=related_type,
            related_id=related_id,
        )


def _consultation_context(
    db: Session,
    consultation: AppConsultation,
) -> Dict[str, Any]:
    schedule = (
        db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if consultation.ScheduleId
        else None
    )
    note = consultation.Note or (schedule.Note if schedule else None)
    start_time = consultation.StartTime or (schedule.StartTime if schedule else None)
    end_time = consultation.EndTime or (schedule.EndTime if schedule else None)
    location = _appointment_location(db, note, status=schedule.Status if schedule else "BOOKED")
    return {
        "schedule": schedule,
        "note": note,
        "startTime": start_time,
        "endTime": end_time,
        "location": location,
        "counselorName": _counselor_display_name(db, consultation.CounselorId),
        "patientContact": _patient_contact(db, consultation.PatientId),
    }


def notify_staff_new_appointment(
    db: Session,
    consultation: AppConsultation,
    order: Optional[AppOrder] = None,
) -> None:
    ctx = _consultation_context(db, consultation)
    patient = ctx["patientContact"]
    time_text = _format_datetime(ctx["startTime"])
    summary = f"{patient['name']} · {ctx['counselorName']} · {time_text}"
    amount_yuan = None
    if order and order.TotalFee:
        amount_yuan = f"{order.TotalFee / 100:.2f}"
    detail = {
        "patientName": patient["name"],
        "patientPhone": patient["phone"],
        "emergencyContact": patient["emergencyContact"],
        "emergencyPhone": patient["emergencyPhone"],
        "counselorName": ctx["counselorName"],
        "startTime": _format_datetime(ctx["startTime"]),
        "endTime": _format_datetime(ctx["endTime"]),
        "location": ctx["location"],
        "amountYuan": amount_yuan,
        "consultationId": consultation.Id,
    }
    _notify_staff(
        db,
        type_="ORDER",
        title="新增预约",
        content=_message_payload(summary, detail),
        related_type="APPOINTMENT_NEW",
        related_id=consultation.Id,
        account_ids=_assistant_account_ids(db),
    )


def notify_staff_appointment_cancelled(
    db: Session,
    consultation: AppConsultation,
    *,
    refunded: bool,
) -> None:
    ctx = _consultation_context(db, consultation)
    patient = ctx["patientContact"]
    time_text = _format_datetime(ctx["startTime"])
    summary = f"{patient['name']} · {ctx['counselorName']} · {time_text}"

    order_status = None
    if consultation.OrderId:
        order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
        if order:
            order_status = order.Status

    exemption_map = latest_exemptions_by_consultation(db, [consultation.Id])
    exemption = exemption_map.get(consultation.Id)
    exemption_status = exemption.Status if exemption else None

    detail = {
        "patientName": patient["name"],
        "patientPhone": patient["phone"],
        "emergencyContact": patient["emergencyContact"],
        "emergencyPhone": patient["emergencyPhone"],
        "counselorName": ctx["counselorName"],
        "startTime": _format_datetime(ctx["startTime"]),
        "endTime": _format_datetime(ctx["endTime"]),
        "location": ctx["location"],
        "refunded": refunded,
        "refundText": "款项将原路退回" if refunded else "按规定不予退款",
        "orderStatus": order_status,
        "exemptionStatus": exemption_status,
        "exemptionLabel": _exemption_label(exemption_status),
        "exemptionReason": exemption.Reason if exemption else None,
        "consultationId": consultation.Id,
    }
    _notify_staff(
        db,
        type_="ORDER",
        title="预约已取消",
        content=_message_payload(summary, detail),
        related_type="APPOINTMENT_CANCEL",
        related_id=consultation.Id,
        account_ids=_assistant_account_ids(db),
    )


def notify_staff_counselor_leave(
    db: Session,
    *,
    schedule: AppSchedule,
    counselor_id: int,
    leave_reason: str,
    screenshot_url: Optional[str],
    consultation: Optional[AppConsultation] = None,
) -> None:
    counselor_name = _counselor_display_name(db, counselor_id)
    time_text = _format_datetime(schedule.StartTime)
    location = _appointment_location(db, schedule.Note, status=schedule.Status)
    summary = f"{counselor_name} · {time_text} · {location}"

    affected: List[Dict[str, Any]] = []
    if consultation:
        patient = _patient_contact(db, consultation.PatientId)
        order_status = None
        refunded = False
        if consultation.OrderId:
            order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
            if order:
                order_status = order.Status
                refunded = order.Status == "REFUNDED"
        affected.append({
            "consultationId": consultation.Id,
            "patientName": patient["name"],
            "patientPhone": patient["phone"],
            "emergencyContact": patient["emergencyContact"],
            "emergencyPhone": patient["emergencyPhone"],
            "startTime": _format_datetime(consultation.StartTime or schedule.StartTime),
            "endTime": _format_datetime(consultation.EndTime or schedule.EndTime),
            "location": location,
            "refundText": "款项将原路退回" if refunded else "按规定不予退款",
            "orderStatus": order_status,
        })

    leave_row = (
        db.query(AppLeaveRequest)
        .filter(
            AppLeaveRequest.ScheduleId == schedule.Id,
            AppLeaveRequest.CounselorId == counselor_id,
        )
        .order_by(AppLeaveRequest.CreatedAt.desc())
        .first()
    )
    leave_request_id = leave_row.Id if leave_row else None

    detail = {
        "counselorName": counselor_name,
        "leaveReason": leave_reason,
        "screenshotUrl": screenshot_url or "",
        "startTime": time_text,
        "endTime": _format_datetime(schedule.EndTime),
        "location": location,
        "scheduleId": schedule.Id,
        "leaveRequestId": leave_request_id,
        "affectedAppointments": affected,
    }
    _notify_staff(
        db,
        type_="CONSULTATION",
        title="咨询师请假",
        content=_message_payload(summary, detail),
        related_type="COUNSELOR_LEAVE",
        related_id=leave_request_id or schedule.Id,
        account_ids=_staff_account_ids(db),
    )
