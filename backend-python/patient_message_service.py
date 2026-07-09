"""来访者站内消息：活动、预约成功、开始前提醒、咨询师请假、豁免结果。"""
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app_time import china_now
from message import create_message
from models import (
    AppAccount,
    AppActivity,
    AppConsultation,
    AppCounselorProfile,
    AppMessage,
    AppOrder,
    AppRefundExemption,
    AppRemindTask,
    AppRoleBinding,
    AppSchedule,
)

PATIENT_REMIND_EVENT = "PATIENT_APPOINTMENT_REMIND"
PATIENT_REMIND_MINUTES = 30


def _format_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "时间待定"
    return dt.strftime("%Y-%m-%d %H:%M")


def _message_payload(summary: str, detail: Dict[str, Any]) -> str:
    return json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)


def _patient_account_ids(db: Session) -> List[int]:
    rows = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Patient")
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _counselor_display_name(db: Session, counselor_id: int) -> str:
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if acc:
        return acc.RealName or acc.Nickname or f"咨询师#{counselor_id}"
    return f"咨询师#{counselor_id}"


def _appointment_center_name(note: Optional[str]) -> str:
    from schedule_meta import center_display_name, parse_center_id

    center_id = parse_center_id(note)
    return center_display_name(center_id) or "未知地点"


def _appointment_location(
    db: Session,
    note: Optional[str],
    *,
    status: str = "BOOKED",
) -> str:
    from schedule_meta import (
        center_display_name,
        display_room_id,
        is_video_center,
        parse_center_id,
        room_display_name,
    )

    center_id = parse_center_id(note)
    center_name = center_display_name(center_id) or "未知地点"
    if is_video_center(center_id):
        return center_name
    room_id = display_room_id(note, status)
    room_name = room_display_name(center_id, room_id, db) if room_id else None
    if room_name:
        return f"{center_name} · {room_name}"
    return center_name


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
        "counselorName": _counselor_display_name(db, consultation.CounselorId),
        "startTime": start_time,
        "endTime": end_time,
        "location": location,
    }


def _notify_patient(
    db: Session,
    patient_id: int,
    *,
    type_: str,
    title: str,
    content: str,
    related_type: str,
    related_id: Optional[int],
) -> None:
    create_message(
        db,
        patient_id,
        type_,
        title,
        content,
        related_type=related_type,
        related_id=related_id,
    )


def cancel_patient_consultation_reminders(db: Session, consultation_id: int) -> None:
    rows = (
        db.query(AppRemindTask)
        .filter(
            AppRemindTask.RelatedId == consultation_id,
            AppRemindTask.RelatedType == "PATIENT_APPOINTMENT_REMIND",
            AppRemindTask.EventKey == PATIENT_REMIND_EVENT,
            AppRemindTask.Status == "PENDING",
        )
        .all()
    )
    now = datetime.utcnow()
    for row in rows:
        row.Status = "CANCELLED"
        row.ProcessedAt = now


def notify_patients_new_activity(db: Session, activity: AppActivity) -> None:
    """新活动发布时通知所有来访者。"""
    if not activity.IsActive:
        return
    if (activity.Type or "").upper() not in ("ACTIVITY", "NOTICE"):
        return

    title = activity.Title or "新活动"
    summary = title
    if activity.StartAt:
        summary = f"{title} · {_format_datetime(activity.StartAt)}"
    detail = {
        "activityId": activity.Id,
        "activityTitle": title,
        "activityType": activity.Type,
        "startAt": _format_datetime(activity.StartAt) if activity.StartAt else None,
        "jumpPath": f"/pages/activity/list?highlight={activity.Id}",
    }
    content = _message_payload(summary, detail)
    for account_id in _patient_account_ids(db):
        _notify_patient(
            db,
            account_id,
            type_="SYSTEM",
            title="有新活动",
            content=content,
            related_type="PATIENT_NEW_ACTIVITY",
            related_id=activity.Id,
        )


def notify_patient_appointment_success(
    db: Session,
    consultation: AppConsultation,
) -> None:
    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == consultation.PatientId,
            AppMessage.RelatedType == "PATIENT_APPOINTMENT_SUCCESS",
            AppMessage.RelatedId == consultation.Id,
        )
        .first()
    )
    if existing:
        return

    ctx = _consultation_context(db, consultation)
    schedule = (
        db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if consultation.ScheduleId
        else None
    )
    note = consultation.Note or (schedule.Note if schedule else None)
    center_name = _appointment_center_name(note)
    time_text = _format_datetime(ctx["startTime"])
    summary = f"{ctx['counselorName']} · {time_text} · {center_name}"
    detail = {
        "counselorName": ctx["counselorName"],
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": center_name,
        "centerName": center_name,
        "consultationId": consultation.Id,
        "tip": "预约成功，请准时赴约",
    }
    _notify_patient(
        db,
        consultation.PatientId,
        type_="ORDER",
        title="预约成功",
        content=_message_payload(summary, detail),
        related_type="PATIENT_APPOINTMENT_SUCCESS",
        related_id=consultation.Id,
    )


def notify_patient_appointment_cancelled(
    db: Session,
    consultation: AppConsultation,
    *,
    refunded: bool,
    cancelled_by: str = "visitor",
) -> None:
    """来访者取消预约后通知本人（含超过/不足24小时）。"""
    cancel_patient_consultation_reminders(db, consultation.Id)
    ctx = _consultation_context(db, consultation)
    schedule = (
        db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if consultation.ScheduleId
        else None
    )
    note = consultation.Note or (schedule.Note if schedule else None)
    center_name = _appointment_center_name(note)
    time_text = _format_datetime(ctx["startTime"])
    summary = f"{ctx['counselorName']} · {time_text} · {center_name}"
    if refunded:
        tip = "您的预约已取消，款项将原路退回"
    else:
        tip = "您的预约已取消；距咨询开始不足24小时，按规定不予退款"
    detail = {
        "counselorName": ctx["counselorName"],
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": center_name,
        "centerName": center_name,
        "refunded": refunded,
        "refundText": "款项将原路退回" if refunded else "按规定不予退款",
        "cancelledBy": cancelled_by,
        "consultationId": consultation.Id,
        "tip": tip,
    }
    _notify_patient(
        db,
        consultation.PatientId,
        type_="ORDER",
        title="预约已取消",
        content=_message_payload(summary, detail),
        related_type="PATIENT_APPOINTMENT_CANCEL",
        related_id=consultation.Id,
    )


def schedule_patient_consultation_reminder(
    db: Session,
    consultation: AppConsultation,
) -> None:
    """咨询开始前 30 分钟提醒来访者（距开始不足 30 分钟则不再单独提醒）。"""
    if consultation.Status not in ("PENDING", "CONFIRMED", "ONGOING"):
        return

    cancel_patient_consultation_reminders(db, consultation.Id)
    ctx = _consultation_context(db, consultation)
    start_time = ctx["startTime"]
    if not start_time or start_time <= china_now():
        return

    time_text = _format_datetime(start_time)
    schedule = (
        db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if consultation.ScheduleId
        else None
    )
    note = consultation.Note or (schedule.Note if schedule else None)
    center_name = _appointment_center_name(note)
    summary = f"{time_text} · {center_name}"
    detail = {
        "counselorName": ctx["counselorName"],
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": center_name,
        "centerName": center_name,
        "consultationId": consultation.Id,
        "tip": "您的咨询将在30分钟后开始，请准时赴约",
    }
    content = _message_payload(summary, detail)
    remind_at = start_time - timedelta(minutes=PATIENT_REMIND_MINUTES)

    if remind_at <= china_now():
        return

    db.add(
        AppRemindTask(
            AccountId=consultation.PatientId,
            EventKey=PATIENT_REMIND_EVENT,
            Title="咨询即将开始",
            Content=content,
            RelatedType="PATIENT_APPOINTMENT_REMIND",
            RelatedId=consultation.Id,
            ScheduledAt=remind_at,
        )
    )


def notify_patient_counselor_leave_approved(
    db: Session,
    consultation: AppConsultation,
    *,
    leave_reason: Optional[str] = None,
    refunded: bool = False,
) -> None:
    """咨询师请假审批通过（或工作台直接取消）后通知来访者。"""
    cancel_patient_consultation_reminders(db, consultation.Id)
    ctx = _consultation_context(db, consultation)
    time_text = _format_datetime(ctx["startTime"])
    summary = f"{ctx['counselorName']} · {time_text} · {ctx['location']}"
    detail = {
        "counselorName": ctx["counselorName"],
        "startTime": time_text,
        "endTime": _format_datetime(ctx["endTime"]),
        "location": ctx["location"],
        "leaveReason": (leave_reason or "").strip() or None,
        "refunded": refunded,
        "refundText": "款项将原路全额退回" if refunded else "本次预约无支付记录",
        "consultationId": consultation.Id,
        "tip": (
            "咨询师已请假，您的预约已取消，款项将原路全额退回，如需改约请联系助理"
            if refunded
            else "咨询师已请假，您的预约已取消，如需改约请联系助理"
        ),
    }
    _notify_patient(
        db,
        consultation.PatientId,
        type_="CONSULTATION",
        title="咨询师请假，预约已取消",
        content=_message_payload(summary, detail),
        related_type="PATIENT_LEAVE_APPROVED",
        related_id=consultation.Id,
    )


def notify_patient_refund_exemption_pending(
    db: Session,
    exemption: AppRefundExemption,
    consultation: AppConsultation,
) -> None:
    amount_yuan = f"{exemption.Amount / 100:.2f}"
    title = "豁免申请待审核"
    summary = f"您的退款豁免申请已提交，金额 ¥{amount_yuan}，请等待审核"
    detail = {
        "status": "PENDING",
        "amountYuan": amount_yuan,
        "reason": exemption.Reason,
        "exemptionId": exemption.Id,
        "consultationId": exemption.ConsultationId,
        "counselorName": _counselor_display_name(db, consultation.CounselorId),
        "resultText": "您的退款豁免申请正在审核中，审核结果将在此通知。",
    }
    _notify_patient(
        db,
        exemption.AccountId,
        type_="SYSTEM",
        title=title,
        content=_message_payload(summary, detail),
        related_type="REFUND_EXEMPTION_PENDING",
        related_id=exemption.Id,
    )


def notify_patient_refund_exemption_result(
    db: Session,
    exemption: AppRefundExemption,
    *,
    approved: bool,
    reject_reason: Optional[str] = None,
) -> None:
    if approved:
        title = "豁免申请已通过"
        summary = f"退款 {exemption.Amount / 100:.2f} 元将原路退回"
        detail = {
            "status": "APPROVED",
            "approved": True,
            "resultText": "您的退款豁免申请已审核通过，预约已取消。",
            "amountYuan": f"{exemption.Amount / 100:.2f}",
            "exemptionId": exemption.Id,
            "consultationId": exemption.ConsultationId,
        }
    else:
        reason_text = (reject_reason or "").strip() or "未说明具体原因"
        title = "豁免申请未通过"
        summary = f"拒绝理由：{reason_text}"
        detail = {
            "status": "REJECTED",
            "approved": False,
            "resultText": "您的退款豁免申请未通过审核，预约与订单维持不变。",
            "rejectReason": reason_text,
            "exemptionId": exemption.Id,
            "consultationId": exemption.ConsultationId,
        }

    content = _message_payload(summary, detail)
    existing_rows = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == exemption.AccountId,
            AppMessage.RelatedId == exemption.Id,
            AppMessage.RelatedType.in_(["REFUND_EXEMPTION_PENDING", "REFUND_EXEMPTION"]),
        )
        .order_by(AppMessage.CreatedAt.asc())
        .all()
    )
    if existing_rows:
        primary = existing_rows[0]
        primary.Type = "SYSTEM"
        primary.Title = title
        primary.Content = content
        primary.RelatedType = "REFUND_EXEMPTION"
        primary.IsRead = False
        primary.ReadAt = None
        for duplicate in existing_rows[1:]:
            db.delete(duplicate)
        return

    _notify_patient(
        db,
        exemption.AccountId,
        type_="SYSTEM",
        title=title,
        content=content,
        related_type="REFUND_EXEMPTION",
        related_id=exemption.Id,
    )


def notify_patient_proxy_order_pending(
    db: Session,
    *,
    patient: AppAccount,
    counselor_name: str,
    schedule: AppSchedule,
    order: AppOrder,
) -> None:
    """助理代理预约后通知来访支付。"""
    from schedule_meta import center_display_name, parse_center_id

    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == patient.Id,
            AppMessage.RelatedType == "PATIENT_PROXY_ORDER_PENDING",
            AppMessage.RelatedId == order.Id,
        )
        .first()
    )
    if existing:
        return
    center_id = parse_center_id(schedule.Note)
    center_name = center_display_name(center_id) if center_id else "待定"
    time_text = _format_datetime(schedule.StartTime)
    fee_yuan = int(order.TotalFee or 0) // 100
    summary = f"{counselor_name} · {time_text} · ¥{fee_yuan}"
    detail = {
        "counselorName": counselor_name,
        "startTime": time_text,
        "endTime": _format_datetime(schedule.EndTime),
        "location": center_name,
        "orderId": order.Id,
        "totalFeeYuan": fee_yuan,
        "expiresAt": order.ExpiresAt.isoformat() if order.ExpiresAt else None,
        "tip": "请在 2 小时内完成支付，逾期订单将自动取消",
    }
    _notify_patient(
        db,
        patient.Id,
        type_="ORDER",
        title="待支付预约",
        content=_message_payload(summary, detail),
        related_type="PATIENT_PROXY_ORDER_PENDING",
        related_id=order.Id,
    )


def notify_patient_charity_negotiation_tip(
    db: Session,
    patient_id: int,
    consultation_id: int,
) -> None:
    """公益来访支付第 30 次公益咨询预约后，提示议价。"""
    from charity_milestone_service import (
        PATIENT_NEGOTIATION_TIP_TEXT,
        RELATED_TYPE_PATIENT_NEGOTIATION_TIP,
    )

    existing = (
        db.query(AppMessage)
        .filter(
            AppMessage.AccountId == patient_id,
            AppMessage.RelatedType == RELATED_TYPE_PATIENT_NEGOTIATION_TIP,
            AppMessage.RelatedId == patient_id,
        )
        .first()
    )
    if existing:
        return

    detail = {
        "patientId": patient_id,
        "consultationId": consultation_id,
        "messageText": PATIENT_NEGOTIATION_TIP_TEXT,
        "tip": PATIENT_NEGOTIATION_TIP_TEXT,
    }
    _notify_patient(
        db,
        patient_id,
        type_="SYSTEM",
        title="公益咨询议价提示",
        content=_message_payload(PATIENT_NEGOTIATION_TIP_TEXT, detail),
        related_type=RELATED_TYPE_PATIENT_NEGOTIATION_TIP,
        related_id=patient_id,
    )
