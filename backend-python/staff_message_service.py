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
    AppMessage,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
    AppSchedule,
)
from message_filters import ADMIN_OPS_INBOX_RELATED_TYPES
from schedule_meta import (
    center_display_name,
    display_room_id,
    is_video_center,
    parse_center_id,
    room_display_name,
)
from staff_roles import staff_workbench_account_ids
from refund_exemption_service import latest_exemptions_by_consultation


def push_staff_approval_subscribe(
    db: Session,
    *,
    account_ids: Optional[List[int]] = None,
    applicant: str,
    biz_type: str,
    apply_time: Optional[datetime] = None,
) -> None:
    """向管理工作台账号推送微信「待审核提醒」（需曾授权 STAFF_APPROVAL_PENDING）。"""
    from app_time import china_now
    from wechat_subscribe_service import try_send

    ids = account_ids if account_ids is not None else staff_workbench_account_ids(db)
    time_text = (apply_time or china_now()).strftime("%Y-%m-%d %H:%M")
    payload = {
        "applyTime": time_text,
        "applicant": (applicant or "申请人")[:20],
        "bizType": (biz_type or "待审核")[:20],
    }
    for account_id in ids:
        try_send(db, account_id, "STAFF_APPROVAL_PENDING", payload)


def _assistant_account_ids(db: Session) -> List[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Assistant")
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _admin_ops_account_ids(db: Session) -> List[int]:
    return staff_workbench_account_ids(db)


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
        return "未留姓名用户"
    return acc.RealName or acc.Nickname or acc.Mobile or "未留姓名用户"


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
    from patient_contract_service import patient_contract_extras

    acc = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    contract = patient_contract_extras(db, acc)
    return {
        "name": _account_display_name(db, patient_id),
        "phone": (acc.Mobile or "") if acc else "",
        "emergencyContact": (acc.EmergencyContact or "") if acc else "",
        "emergencyPhone": (acc.EmergencyPhone or "") if acc else "",
        "contractTag": contract.get("contractTag") or "",
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
    patient_label = (
        f"{patient['name']} {patient['contractTag']}"
        if patient.get("contractTag")
        else patient["name"]
    )
    summary = f"{patient_label} · {ctx['counselorName']} · {time_text}"
    amount_yuan = None
    if order and order.TotalFee:
        amount_yuan = f"{order.TotalFee / 100:.2f}"
    detail = {
        "patientName": patient["name"],
        "patientContractTag": patient.get("contractTag") or None,
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
        account_ids=staff_workbench_account_ids(db),
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
    patient_label = (
        f"{patient['name']} {patient['contractTag']}"
        if patient.get("contractTag")
        else patient["name"]
    )
    summary = f"{patient_label} · {ctx['counselorName']} · {time_text}"

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
        "patientContractTag": patient.get("contractTag") or None,
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
        account_ids=staff_workbench_account_ids(db),
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
            "patientContractTag": patient.get("contractTag") or None,
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
        account_ids=staff_workbench_account_ids(db),
    )
    push_staff_approval_subscribe(
        db,
        applicant=counselor_name,
        biz_type="咨询师请假",
        apply_time=leave_row.CreatedAt if leave_row else None,
    )


def notify_staff_proxy_order_pushed(
    db: Session,
    *,
    staff_account_id: int,
    order: AppOrder,
    schedule: AppSchedule,
    patient: AppAccount,
    counselor_id: int,
) -> None:
    """代理预约推送后，向操作人（助理/主任/管理员/咨询师）发送推送成功确认消息。"""
    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == staff_account_id,
            AppMessage.RelatedType == "STAFF_PROXY_ORDER_PUSHED",
            AppMessage.RelatedId == order.Id,
        )
        .first()
    )
    if existing:
        return

    patient_contact = _patient_contact(db, patient.Id)
    counselor_name = _counselor_display_name(db, counselor_id)
    location = _appointment_location(db, schedule.Note, status=schedule.Status)
    time_text = _format_datetime(schedule.StartTime)
    patient_name = patient_contact["name"]
    contract_tag = patient_contact.get("contractTag") or None
    patient_label = f"{patient_name} {contract_tag}" if contract_tag else patient_name
    summary = f"{patient_label} · {counselor_name} · {time_text} · {location}"
    amount_yuan = None
    if order.TotalFee:
        amount_yuan = f"{order.TotalFee / 100:.2f}"
    from system_setting_service import get_proxy_order_ttl_minutes, proxy_order_ttl_staff_tip

    ttl_minutes = get_proxy_order_ttl_minutes(db)
    detail = {
        "patientName": patient_name,
        "patientContractTag": contract_tag,
        "counselorName": counselor_name,
        "boundCounselorName": counselor_name,
        "startTime": time_text,
        "endTime": _format_datetime(schedule.EndTime),
        "location": location,
        "orderId": order.Id,
        "amountYuan": amount_yuan,
        "proxyOrderTtlMinutes": ttl_minutes,
        "tip": proxy_order_ttl_staff_tip(ttl_minutes),
    }
    create_message(
        db,
        staff_account_id,
        "ORDER",
        "代理预约已推送",
        _message_payload(summary, detail),
        related_type="STAFF_PROXY_ORDER_PUSHED",
        related_id=order.Id,
    )


def notify_staff_workbench_inbox(
    db: Session,
    *,
    type_: str,
    title: str,
    content: str,
    related_type: str,
    related_id: Optional[int],
) -> None:
    """向管理工作台全员（助理/主任/管理员）投递同一条收件箱消息。"""
    _notify_staff(
        db,
        type_=type_,
        title=title,
        content=content,
        related_type=related_type,
        related_id=related_id,
        account_ids=staff_workbench_account_ids(db),
    )


def sync_staff_workbench_inbox_messages(db: Session) -> int:
    """将管理工作台收件箱消息对齐到全员账号（合并现有消息后复制缺失项）。"""
    staff_ids = staff_workbench_account_ids(db)
    if not staff_ids:
        return 0

    templates: dict[tuple, AppMessage] = {}
    for acc_id in staff_ids:
        rows = (
            db.query(AppMessage)
            .filter(
                AppMessage.AccountId == acc_id,
                AppMessage.RelatedType.in_(ADMIN_OPS_INBOX_RELATED_TYPES),
            )
            .all()
        )
        for msg in rows:
            key = (msg.RelatedType, msg.RelatedId, msg.Title, msg.Type)
            prev = templates.get(key)
            if prev is None or (msg.CreatedAt or datetime.min) > (prev.CreatedAt or datetime.min):
                templates[key] = msg

    created = 0
    for acc_id in staff_ids:
        existing = {
            (m.RelatedType, m.RelatedId, m.Title, m.Type)
            for m in db.query(AppMessage)
            .filter(
                AppMessage.AccountId == acc_id,
                AppMessage.RelatedType.in_(ADMIN_OPS_INBOX_RELATED_TYPES),
            )
            .all()
        }
        for key, tmpl in templates.items():
            if key in existing:
                continue
            db.add(
                AppMessage(
                    AccountId=acc_id,
                    Type=tmpl.Type,
                    Title=tmpl.Title,
                    Content=tmpl.Content,
                    RelatedType=tmpl.RelatedType,
                    RelatedId=tmpl.RelatedId,
                    IsRead=tmpl.IsRead,
                    ReadAt=tmpl.ReadAt,
                    CreatedAt=tmpl.CreatedAt,
                )
            )
            created += 1
    return created
