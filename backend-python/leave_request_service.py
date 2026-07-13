"""咨询师请假：管理员列表、详情与审核。"""
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from consultation_cancel import refund_order_for_counselor_leave
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppLeaveRequest,
    AppOrder,
    AppSchedule,
    AppScheduleCancelLog,
)
from schedule_meta import (
    center_display_name,
    display_room_id,
    is_video_center,
    parse_center_id,
    release_assigned_room,
    room_display_name,
)


def _account_name(db: Session, account_id: int) -> str:
    acc = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not acc:
        return "未留姓名用户"
    return acc.RealName or acc.Nickname or acc.Mobile or "未留姓名用户"


def _counselor_name(db: Session, counselor_id: int) -> str:
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    return _account_name(db, counselor_id)


def _location(db: Session, note: Optional[str], *, status: str = "BOOKED") -> Optional[str]:
    if not note:
        return None
    center_id = parse_center_id(note)
    center_name = center_display_name(center_id) or "未知地点"
    if is_video_center(center_id):
        return center_name
    room_id = display_room_id(note, status)
    room_name = room_display_name(center_id, room_id, db) if room_id else None
    if room_name:
        return f"{center_name} · {room_name}"
    return center_name


def _affected_patients(
    db: Session,
    schedule: Optional[AppSchedule],
    consultation: Optional[AppConsultation],
) -> List[dict]:
    if not consultation:
        return []
    patient = db.query(AppAccount).filter(AppAccount.Id == consultation.PatientId).first()
    note = consultation.Note or (schedule.Note if schedule else None)
    loc = _location(db, note, status=schedule.Status if schedule else "BOOKED")
    refunded = False
    if consultation.OrderId:
        order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
        refunded = bool(order and order.Status == "REFUNDED")
    return [{
        "consultationId": consultation.Id,
        "patientName": _account_name(db, consultation.PatientId),
        "patientPhone": patient.Mobile if patient else None,
        "emergencyContact": patient.EmergencyContact if patient else None,
        "emergencyPhone": patient.EmergencyPhone if patient else None,
        "startTime": consultation.StartTime or (schedule.StartTime if schedule else None),
        "endTime": consultation.EndTime or (schedule.EndTime if schedule else None),
        "location": loc,
        "refundText": "款项将原路退回" if refunded else "按规定不予退款",
    }]


def build_leave_request_out(db: Session, leave: AppLeaveRequest) -> dict:
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == leave.ScheduleId).first()
    consultation = (
        db.query(AppConsultation)
        .filter(AppConsultation.ScheduleId == leave.ScheduleId)
        .order_by(AppConsultation.CreatedAt.desc())
        .first()
    )
    cancel_log = (
        db.query(AppScheduleCancelLog)
        .filter(
            AppScheduleCancelLog.ScheduleId == leave.ScheduleId,
            AppScheduleCancelLog.CounselorId == leave.CounselorId,
        )
        .order_by(AppScheduleCancelLog.CreatedAt.desc())
        .first()
    )
    note = schedule.Note if schedule else None
    return {
        "id": leave.Id,
        "scheduleId": leave.ScheduleId,
        "counselorId": leave.CounselorId,
        "counselorName": _counselor_name(db, leave.CounselorId),
        "reason": leave.Reason,
        "status": leave.Status,
        "startTime": schedule.StartTime if schedule else None,
        "endTime": schedule.EndTime if schedule else None,
        "location": _location(db, note, status=schedule.Status if schedule else "BOOKED"),
        "screenshotUrl": cancel_log.ScreenshotUrl if cancel_log else None,
        "affectedPatients": _affected_patients(db, schedule, consultation),
        "createdAt": leave.CreatedAt,
        "reviewedAt": leave.UpdatedAt if leave.Status in ("APPROVED", "REJECTED") else None,
    }


def approve_leave_request(
    db: Session,
    leave: AppLeaveRequest,
    admin_id: int,
) -> Tuple[str, str]:
    if leave.Status != "PENDING":
        raise ValueError("该请假申请已处理，无法重复审核")

    schedule = db.query(AppSchedule).filter(AppSchedule.Id == leave.ScheduleId).first()
    if not schedule:
        raise ValueError("关联排期不存在")

    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == leave.ScheduleId,
            AppConsultation.CounselorId == leave.CounselorId,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if consultation:
        consultation.Status = "CANCELLED"
        consultation.UpdatedAt = datetime.utcnow()
        refunded = refund_order_for_counselor_leave(db, consultation)
        from counselor_message_service import (
            cancel_counselor_consultation_done_notices,
            cancel_counselor_consultation_reminders,
        )
        from patient_message_service import (
            cancel_patient_consultation_reminders,
            notify_patient_counselor_leave_approved,
        )
        from consultation_status_service import cancel_consultation_auto_done_tasks

        cancel_counselor_consultation_reminders(db, consultation.Id)
        cancel_counselor_consultation_done_notices(db, consultation.Id)
        cancel_consultation_auto_done_tasks(db, consultation.Id)
        cancel_patient_consultation_reminders(db, consultation.Id)
        notify_patient_counselor_leave_approved(
            db,
            consultation,
            leave_reason=leave.Reason,
            refunded=refunded,
        )

    schedule.Status = "CANCELLED"
    schedule.Note = release_assigned_room(schedule.Note)
    schedule.UpdatedAt = datetime.utcnow()

    now = datetime.utcnow()
    leave.Status = "APPROVED"
    leave.UpdatedAt = now

    from counselor_message_service import notify_counselor_leave_success

    notify_counselor_leave_success(
        db,
        counselor_id=leave.CounselorId,
        schedule=schedule,
        leave_reason=leave.Reason,
        leave_request_id=leave.Id,
        consultation=consultation,
    )
    return "APPROVED", "请假已通过，相关预约已取消"


def reject_leave_request(db: Session, leave: AppLeaveRequest, admin_id: int) -> None:
    if leave.Status != "PENDING":
        raise ValueError("该请假申请已处理，无法重复审核")
    now = datetime.utcnow()
    leave.Status = "REJECTED"
    leave.UpdatedAt = now
