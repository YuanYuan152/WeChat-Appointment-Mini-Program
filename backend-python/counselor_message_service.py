"""咨询师站内消息：完成、开始前提醒、来访取消、请假提交（不含来访联系方式）。"""
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app_time import china_now
from message import create_message
from models import AppAccount, AppConsultation, AppMessage, AppOrder, AppRemindTask, AppSchedule
from refund_exemption_service import latest_exemptions_by_consultation
from schedule_meta import (
    center_display_name,
    display_room_id,
    is_video_center,
    parse_center_id,
    room_display_name,
)

COUNSELOR_REMIND_EVENT = "COUNSELOR_APPOINTMENT_REMIND"
COUNSELOR_DONE_EVENT = "COUNSELOR_CONSULTATION_DONE"
COUNSELOR_REMIND_MINUTES = 30
COUNSELOR_DONE_TITLE = "咨询已完成，请尽快填写咨询记录"
COUNSELOR_DONE_TIP = "咨询已结束，请尽快填写咨询记录以便归档。"


def _format_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "时间待定"
    return dt.strftime("%Y-%m-%d %H:%M")


def _patient_contract_tag(db: Session, patient_id: int) -> Optional[str]:
    from patient_contract_service import patient_contract_extras

    acc = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    return patient_contract_extras(db, acc).get("contractTag")


def _patient_name_plain(db: Session, patient_id: int) -> str:
    """不含签约标签的来访者姓名。"""
    acc = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not acc:
        return "来访者"
    if acc.RealName:
        return acc.RealName
    if acc.Nickname:
        return acc.Nickname
    return "来访者"


def _patient_label(name: Optional[str], tag: Optional[str] = None) -> str:
    if not name:
        return ""
    if tag:
        return f"{name} {tag}"
    return name


def _patient_detail_fields(ctx: Dict[str, Any]) -> Dict[str, Any]:
    name = ctx.get("patientName")
    tag = ctx.get("patientContractTag")
    if not name:
        return {}
    out: Dict[str, Any] = {"patientName": name}
    if tag:
        out["patientContractTag"] = tag
    return out


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


def _consultation_context(db: Session, consultation: AppConsultation) -> Dict[str, Any]:
    schedule = (
        db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if consultation.ScheduleId
        else None
    )
    note = consultation.Note or (schedule.Note if schedule else None)
    start_time = consultation.StartTime or (schedule.StartTime if schedule else None)
    end_time = consultation.EndTime or (schedule.EndTime if schedule else None)
    location = _appointment_location(
        db, note, status=schedule.Status if schedule else "BOOKED",
    )
    return {
        "patientName": _patient_name_plain(db, consultation.PatientId),
        "patientContractTag": _patient_contract_tag(db, consultation.PatientId),
        "startTime": start_time,
        "endTime": end_time,
        "location": location,
    }


def _notify_counselor(
    db: Session,
    counselor_id: int,
    *,
    type_: str,
    title: str,
    content: str,
    related_type: str,
    related_id: Optional[int],
) -> None:
    create_message(
        db,
        counselor_id,
        type_,
        title,
        content,
        related_type=related_type,
        related_id=related_id,
    )


def cancel_counselor_consultation_done_notices(
    db: Session,
    consultation_id: int,
) -> None:
    rows = (
        db.query(AppRemindTask)
        .filter(
            AppRemindTask.RelatedId == consultation_id,
            AppRemindTask.RelatedType == "COUNSELOR_CONSULTATION_DONE",
            AppRemindTask.EventKey == COUNSELOR_DONE_EVENT,
            AppRemindTask.Status == "PENDING",
        )
        .all()
    )
    now = datetime.utcnow()
    for row in rows:
        row.Status = "CANCELLED"
        row.ProcessedAt = now


def cancel_counselor_consultation_reminders(
    db: Session,
    consultation_id: int,
) -> None:
    rows = (
        db.query(AppRemindTask)
        .filter(
            AppRemindTask.RelatedId == consultation_id,
            AppRemindTask.RelatedType == "COUNSELOR_CONSULTATION_REMIND",
            AppRemindTask.EventKey == COUNSELOR_REMIND_EVENT,
            AppRemindTask.Status == "PENDING",
        )
        .all()
    )
    now = datetime.utcnow()
    for row in rows:
        row.Status = "CANCELLED"
        row.ProcessedAt = now


def _leave_notice_detail(
    db: Session,
    *,
    schedule: AppSchedule,
    leave_reason: str,
    leave_request_id: int,
    status: str,
    reject_reason: Optional[str] = None,
    consultation: Optional[AppConsultation] = None,
) -> tuple[str, str, Dict[str, Any]]:
    ctx = _consultation_context(db, consultation) if consultation else None
    time_text = _format_datetime(schedule.StartTime)
    location = _appointment_location(db, schedule.Note, status=schedule.Status)
    patient_name = ctx["patientName"] if ctx else None
    patient_tag = ctx.get("patientContractTag") if ctx else None
    patient_label = _patient_label(patient_name, patient_tag)
    pending = status == "PENDING"
    if pending:
        title = "请假申请已提交"
        tip = "您的请假申请已提交，请等待管理工作台审核并协助来访者改约。"
        status_label = "待审核"
    elif status == "REJECTED":
        title = "请假申请未通过"
        tip = (
            f"您的请假申请未通过：{reject_reason}。原预约与排期保持不变。"
            if reject_reason
            else "您的请假申请未通过，原预约与排期保持不变。"
        )
        status_label = "已拒绝"
    else:
        title = "请假已成功"
        tip = "您的请假已生效，相关预约已取消，来访者将收到通知。"
        status_label = "已成功"
    summary = f"{time_text} · {location}"
    if patient_label:
        summary = f"{patient_label} · {summary}"
    if status == "REJECTED" and reject_reason:
        summary = f"{summary} · 拒绝原因：{reject_reason}"
    detail: Dict[str, Any] = {
        "startTime": time_text,
        "endTime": _format_datetime(schedule.EndTime),
        "location": location,
        "leaveReason": leave_reason,
        "leaveRequestId": leave_request_id,
        "scheduleId": schedule.Id,
        "status": status,
        "statusLabel": status_label,
        "tip": tip,
    }
    if reject_reason:
        detail["rejectReason"] = reject_reason
    if patient_name and ctx:
        detail.update(_patient_detail_fields(ctx))
    if consultation:
        detail["consultationId"] = consultation.Id
    return title, _message_payload(summary, detail), detail


def notify_counselor_leave_submitted(
    db: Session,
    *,
    counselor_id: int,
    schedule: AppSchedule,
    leave_reason: str,
    leave_request_id: int,
    consultation: Optional[AppConsultation] = None,
) -> None:
    """咨询师提交待审核请假后通知本人。"""
    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == counselor_id,
            AppMessage.RelatedType == "COUNSELOR_LEAVE_SUBMITTED",
            AppMessage.RelatedId == leave_request_id,
        )
        .first()
    )
    if existing:
        return

    title, content, _ = _leave_notice_detail(
        db,
        schedule=schedule,
        leave_reason=leave_reason,
        leave_request_id=leave_request_id,
        status="PENDING",
        consultation=consultation,
    )
    _notify_counselor(
        db,
        counselor_id,
        type_="CONSULTATION",
        title=title,
        content=content,
        related_type="COUNSELOR_LEAVE_SUBMITTED",
        related_id=leave_request_id,
    )


def notify_counselor_leave_success(
    db: Session,
    *,
    counselor_id: int,
    schedule: AppSchedule,
    leave_reason: str,
    leave_request_id: int,
    consultation: Optional[AppConsultation] = None,
) -> None:
    """请假生效（直接取消或管理工作台审核通过）后通知咨询师本人。"""
    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == counselor_id,
            AppMessage.RelatedType == "COUNSELOR_LEAVE_SUCCESS",
            AppMessage.RelatedId == leave_request_id,
        )
        .first()
    )
    if existing:
        return

    title, content, _ = _leave_notice_detail(
        db,
        schedule=schedule,
        leave_reason=leave_reason,
        leave_request_id=leave_request_id,
        status="APPROVED",
        consultation=consultation,
    )
    _notify_counselor(
        db,
        counselor_id,
        type_="CONSULTATION",
        title=title,
        content=content,
        related_type="COUNSELOR_LEAVE_SUCCESS",
        related_id=leave_request_id,
    )


def notify_counselor_leave_rejected(
    db: Session,
    *,
    counselor_id: int,
    schedule: AppSchedule,
    leave_reason: str,
    leave_request_id: int,
    reject_reason: Optional[str] = None,
    consultation: Optional[AppConsultation] = None,
) -> None:
    """管理工作台拒绝请假后通知咨询师本人。"""
    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == counselor_id,
            AppMessage.RelatedType == "COUNSELOR_LEAVE_REJECTED",
            AppMessage.RelatedId == leave_request_id,
        )
        .first()
    )
    if existing:
        return

    title, content, _ = _leave_notice_detail(
        db,
        schedule=schedule,
        leave_reason=leave_reason,
        leave_request_id=leave_request_id,
        status="REJECTED",
        reject_reason=reject_reason,
        consultation=consultation,
    )
    _notify_counselor(
        db,
        counselor_id,
        type_="CONSULTATION",
        title=title,
        content=content,
        related_type="COUNSELOR_LEAVE_REJECTED",
        related_id=leave_request_id,
    )


def notify_counselor_new_appointment(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """来访者预约成功后立即通知咨询师（仅含来访者姓名、时间、地点）。"""
    if consultation.Status not in ("PENDING", "CONFIRMED", "ONGOING"):
        return

    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == consultation.CounselorId,
            AppMessage.RelatedType == "COUNSELOR_APPOINTMENT_NEW",
            AppMessage.RelatedId == consultation.Id,
        )
        .first()
    )
    if existing:
        return

    ctx = _consultation_context(db, consultation)
    time_text = _format_datetime(ctx["startTime"])
    patient_label = _patient_label(ctx["patientName"], ctx.get("patientContractTag"))
    location = ctx["location"]
    summary = f"{patient_label} · {time_text} · {location}"
    detail = {
        **_patient_detail_fields(ctx),
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": location,
        "consultationId": consultation.Id,
        "tip": "来访者已成功预约，请准时赴约",
    }
    _notify_counselor(
        db,
        consultation.CounselorId,
        type_="ORDER",
        title="新预约",
        content=_message_payload(summary, detail),
        related_type="COUNSELOR_APPOINTMENT_NEW",
        related_id=consultation.Id,
    )
    # 首期仅启用 APPOINTMENT_REMIND（咨询提醒）真实模板；咨询师排期/完善资料授权的也是该事件。
    # COUNSELOR_APPOINTMENT_NEW 未配置真实模板且未授权，会导致服务通知 SKIPPED_NO_AUTH。
    from wechat_subscribe_service import try_send

    counselor_acc = db.query(AppAccount).filter(AppAccount.Id == consultation.CounselorId).first()
    counselor_name = (
        (counselor_acc.RealName if counselor_acc else None)
        or (counselor_acc.Nickname if counselor_acc else None)
        or "您"
    )
    try_send(
        db,
        consultation.CounselorId,
        "APPOINTMENT_REMIND",
        {
            "time": time_text,
            "patient": patient_label,
            "counselor": counselor_name,
        },
    )


def schedule_counselor_consultation_reminder(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """咨询开始前 30 分钟提醒咨询师（距开始不足 30 分钟则不再单独提醒）。"""
    if consultation.Status not in ("PENDING", "CONFIRMED", "ONGOING"):
        return

    cancel_counselor_consultation_reminders(db, consultation.Id)

    ctx = _consultation_context(db, consultation)
    start_time = ctx["startTime"]
    if not start_time or start_time <= china_now():
        return

    time_text = _format_datetime(start_time)
    patient_label = _patient_label(ctx["patientName"], ctx.get("patientContractTag"))
    location = ctx["location"]
    summary = f"{patient_label} · {time_text} · {location}"
    detail = {
        **_patient_detail_fields(ctx),
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": location,
        "consultationId": consultation.Id,
        "tip": "咨询将在30分钟后开始，请准时赴约",
    }
    content = _message_payload(summary, detail)
    remind_at = start_time - timedelta(minutes=COUNSELOR_REMIND_MINUTES)

    if remind_at <= china_now():
        return

    db.add(
        AppRemindTask(
            AccountId=consultation.CounselorId,
            EventKey=COUNSELOR_REMIND_EVENT,
            Title="咨询即将开始",
            Content=content,
            RelatedType="COUNSELOR_CONSULTATION_REMIND",
            RelatedId=consultation.Id,
            ScheduledAt=remind_at,
        )
    )


def schedule_counselor_consultation_done_notice(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """预约结束时间到达后提醒咨询师填写咨询记录。"""
    if consultation.Status not in ("PENDING", "CONFIRMED", "ONGOING"):
        return

    cancel_counselor_consultation_done_notices(db, consultation.Id)

    ctx = _consultation_context(db, consultation)
    end_time = ctx["endTime"]
    if not end_time:
        return

    if end_time <= china_now():
        notify_counselor_consultation_done(db, consultation)
        return

    db.add(
        AppRemindTask(
            AccountId=consultation.CounselorId,
            EventKey=COUNSELOR_DONE_EVENT,
            Title=COUNSELOR_DONE_TITLE,
            Content="",
            RelatedType="COUNSELOR_CONSULTATION_DONE",
            RelatedId=consultation.Id,
            ScheduledAt=end_time,
        )
    )


def notify_counselor_consultation_done(
    db: Session,
    consultation: AppConsultation,
) -> None:
    cancel_counselor_consultation_reminders(db, consultation.Id)
    cancel_counselor_consultation_done_notices(db, consultation.Id)

    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == consultation.CounselorId,
            AppMessage.RelatedType == "COUNSELOR_CONSULTATION_DONE",
            AppMessage.RelatedId == consultation.Id,
        )
        .first()
    )
    if existing:
        return

    ctx = _consultation_context(db, consultation)
    time_text = _format_datetime(ctx["startTime"])
    patient_label = _patient_label(ctx["patientName"], ctx.get("patientContractTag"))
    summary = (
        f"{patient_label} · {time_text} · {ctx['location']} · 请尽快填写咨询记录"
    )
    detail = {
        **_patient_detail_fields(ctx),
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": ctx["location"],
        "consultationId": consultation.Id,
        "tip": COUNSELOR_DONE_TIP,
    }
    _notify_counselor(
        db,
        consultation.CounselorId,
        type_="CONSULTATION",
        title=COUNSELOR_DONE_TITLE,
        content=_message_payload(summary, detail),
        related_type="COUNSELOR_CONSULTATION_DONE",
        related_id=consultation.Id,
    )


def notify_counselor_appointment_cancelled(
    db: Session,
    consultation: AppConsultation,
    *,
    refunded: bool,
) -> None:
    from consultation_status_service import cancel_consultation_auto_done_tasks

    cancel_counselor_consultation_reminders(db, consultation.Id)
    cancel_counselor_consultation_done_notices(db, consultation.Id)
    cancel_consultation_auto_done_tasks(db, consultation.Id)
    ctx = _consultation_context(db, consultation)
    time_text = _format_datetime(ctx["startTime"])
    patient_label = _patient_label(ctx["patientName"], ctx.get("patientContractTag"))
    summary = f"{patient_label} · {time_text} · {ctx['location']}"

    exemption_map = latest_exemptions_by_consultation(db, [consultation.Id])
    exemption = exemption_map.get(consultation.Id)
    exemption_status = exemption.Status if exemption else None

    detail = {
        **_patient_detail_fields(ctx),
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": ctx["location"],
        "refunded": refunded,
        "refundText": "款项将原路退回" if refunded else "按规定不予退款",
        "exemptionStatus": exemption_status,
        "exemptionLabel": _exemption_label(exemption_status),
        "consultationId": consultation.Id,
    }
    _notify_counselor(
        db,
        consultation.CounselorId,
        type_="ORDER",
        title="预约已取消",
        content=_message_payload(summary, detail),
        related_type="COUNSELOR_APPOINTMENT_CANCEL",
        related_id=consultation.Id,
    )
    from wechat_subscribe_service import try_send

    # 与新预约相同：复用已启用的「咨询提醒」模板（COUNSELOR_APPOINTMENT_CANCEL 首期未启用）
    counselor_acc = db.query(AppAccount).filter(AppAccount.Id == consultation.CounselorId).first()
    counselor_name = (
        (counselor_acc.RealName if counselor_acc else None)
        or (counselor_acc.Nickname if counselor_acc else None)
        or "您"
    )
    try_send(
        db,
        consultation.CounselorId,
        "APPOINTMENT_REMIND",
        {
            "time": time_text,
            "patient": f"{patient_label}（已取消）",
            "counselor": counselor_name,
        },
    )


def notify_counselor_proxy_order_pending(
    db: Session,
    *,
    counselor_id: int,
    schedule: AppSchedule,
    patient_id: int,
    order: AppOrder,
) -> None:
    """助理代理预约推送待支付订单后通知咨询师。"""
    pending = next(
        (
            row
            for row in db.new
            if isinstance(row, AppMessage)
            and row.AccountId == counselor_id
            and row.RelatedType == "COUNSELOR_PROXY_ORDER_PENDING"
            and row.RelatedId == order.Id
        ),
        None,
    )
    if pending:
        return
    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == counselor_id,
            AppMessage.RelatedType == "COUNSELOR_PROXY_ORDER_PENDING",
            AppMessage.RelatedId == order.Id,
        )
        .first()
    )
    if existing:
        return
    center_id = parse_center_id(schedule.Note)
    center_name = center_display_name(center_id) if center_id else "待定"
    time_text = _format_datetime(schedule.StartTime)
    patient_name = _patient_name_plain(db, patient_id)
    patient_tag = _patient_contract_tag(db, patient_id)
    patient_label = _patient_label(patient_name, patient_tag)
    summary = f"{patient_label} · {time_text} · {center_name}"
    detail = {
        "patientName": patient_name,
        "patientContractTag": patient_tag,
        "startTime": time_text,
        "endTime": _format_datetime(schedule.EndTime),
        "location": center_name,
        "orderId": order.Id,
        "scheduleId": schedule.Id,
        "tip": "助理已为来访推送预约订单，待来访支付后生效",
    }
    _notify_counselor(
        db,
        counselor_id,
        type_="ORDER",
        title="代理预约待支付",
        content=_message_payload(summary, detail),
        related_type="COUNSELOR_PROXY_ORDER_PENDING",
        related_id=order.Id,
    )
