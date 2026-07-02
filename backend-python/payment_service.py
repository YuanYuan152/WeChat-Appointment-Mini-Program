"""支付成功后：订单 PAID、排期 BOOKED、分配咨询室并创建咨询单。"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import AppOrder, AppSchedule, AppConsultation
from room_assignment import apply_room_assignment
from schedule_meta import parse_center_id, schedule_note, is_video_center
from intake_agreement import record_intake_from_order


def complete_paid_order(
    db: Session,
    order: AppOrder,
    *,
    center_id: Optional[str] = None,
    transaction_id: Optional[str] = None,
) -> None:
    if order.Status == "PAID":
        return

    record_intake_from_order(db, order)

    order.Status = "PAID"
    order.PaidAt = datetime.utcnow()
    if transaction_id:
        order.TransactionId = transaction_id

    if not order.SlotId:
        return

    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    if not schedule:
        return

    resolved_center = center_id or parse_center_id(schedule.Note)
    if not resolved_center:
        raise ValueError("排期未指定预约中心，无法完成付款")

    if is_video_center(resolved_center):
        consultation_note = schedule_note(resolved_center)
    else:
        assigned_room = apply_room_assignment(db, schedule, resolved_center)
        consultation_note = schedule_note(resolved_center, assigned_room)

    if schedule.Status == "AVAILABLE":
        schedule.Status = "BOOKED"

    existing = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule.Id,
            AppConsultation.PatientId == order.AccountId,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if existing:
        existing.Note = consultation_note
        db.flush()
        from staff_message_service import notify_staff_new_appointment
        from counselor_message_service import (
            notify_counselor_new_appointment,
            schedule_counselor_consultation_done_notice,
            schedule_counselor_consultation_reminder,
        )
        from patient_message_service import (
            notify_patient_appointment_success,
            schedule_patient_consultation_reminder,
        )

        notify_staff_new_appointment(db, existing, order)
        notify_counselor_new_appointment(db, existing)
        schedule_counselor_consultation_reminder(db, existing)
        schedule_counselor_consultation_done_notice(db, existing)
        notify_patient_appointment_success(db, existing)
        schedule_patient_consultation_reminder(db, existing)
        return

    consultation = AppConsultation(
        OrderId=order.Id,
        PatientId=order.AccountId,
        CounselorId=schedule.CounselorId,
        ScheduleId=schedule.Id,
        Status="CONFIRMED",
        StartTime=schedule.StartTime,
        EndTime=schedule.EndTime,
        Note=consultation_note,
    )
    db.add(consultation)
    db.flush()
    from staff_message_service import notify_staff_new_appointment
    from counselor_message_service import (
        notify_counselor_new_appointment,
        schedule_counselor_consultation_done_notice,
        schedule_counselor_consultation_reminder,
    )
    from patient_message_service import (
        notify_patient_appointment_success,
        schedule_patient_consultation_reminder,
    )

    notify_staff_new_appointment(db, consultation, order)
    notify_counselor_new_appointment(db, consultation)
    schedule_counselor_consultation_reminder(db, consultation)
    schedule_counselor_consultation_done_notice(db, consultation)
    notify_patient_appointment_success(db, consultation)
    schedule_patient_consultation_reminder(db, consultation)
