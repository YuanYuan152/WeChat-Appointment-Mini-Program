"""支付成功后：订单 PAID、排期 BOOKED、分配咨询室并创建咨询单。"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppOrder, AppSchedule, AppConsultation
from room_assignment import apply_room_assignment
from schedule_meta import parse_center_id, schedule_note, is_video_center
from intake_agreement import record_intake_from_order


def _prepare_proxy_order_binding(db: Session, account, order: AppOrder) -> None:
    """代理预约首单支付：若尚未绑定咨询师，则绑定为订单对应咨询师。"""
    if not (order.Description or "").startswith("proxy:"):
        return
    if not order.SlotId:
        return
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    if not schedule or not schedule.CounselorId:
        return
    if getattr(account, "BoundCounselorId", None):
        return
    from patient_contract_service import bind_patient_counselor

    bind_patient_counselor(db, account.Id, int(schedule.CounselorId))


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

    account = db.query(AppAccount).filter(AppAccount.Id == order.AccountId).first()
    if account:
        from order_contract_agreement import assert_order_contract_agreement_ready

        assert_order_contract_agreement_ready(db, account, order)
        _prepare_proxy_order_binding(db, account, order)

    from patient_contract_service import maybe_mark_patient_contract_signed

    maybe_mark_patient_contract_signed(db, order)

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
        from consultation_status_service import schedule_consultation_auto_done

        notify_staff_new_appointment(db, existing, order)
        notify_counselor_new_appointment(db, existing)
        schedule_counselor_consultation_reminder(db, existing)
        schedule_counselor_consultation_done_notice(db, existing)
        schedule_consultation_auto_done(db, existing, schedule)
        notify_patient_appointment_success(db, existing)
        schedule_patient_consultation_reminder(db, existing)
        from charity_milestone_service import maybe_notify_charity_30th_booking
        maybe_notify_charity_30th_booking(db, existing)
        from professional_pair_milestone_service import maybe_notify_professional_pair_30th_booking
        maybe_notify_professional_pair_30th_booking(db, existing)
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
    from consultation_status_service import schedule_consultation_auto_done

    notify_staff_new_appointment(db, consultation, order)
    notify_counselor_new_appointment(db, consultation)
    schedule_counselor_consultation_reminder(db, consultation)
    schedule_counselor_consultation_done_notice(db, consultation)
    schedule_consultation_auto_done(db, consultation, schedule)
    notify_patient_appointment_success(db, consultation)
    schedule_patient_consultation_reminder(db, consultation)
    from charity_milestone_service import maybe_notify_charity_30th_booking
    maybe_notify_charity_30th_booking(db, consultation)
    from professional_pair_milestone_service import maybe_notify_professional_pair_30th_booking
    maybe_notify_professional_pair_30th_booking(db, consultation)
