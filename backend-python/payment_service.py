"""支付成功后：订单 PAID、排期 BOOKED、分配咨询室并创建咨询单。"""
from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from models import AppAccount, AppOrder, AppSchedule, AppConsultation
from room_assignment import apply_room_assignment
from schedule_meta import is_video_center, parse_center_id, parse_room_id, schedule_note
from intake_agreement import record_intake_from_order


def _acquire_payment_locks(
    db: Session,
    order: AppOrder,
    schedule: Optional[AppSchedule],
    center_id: Optional[str],
) -> None:
    """Serialize payment completion for the order and its booking slot on SQL Server."""
    bind = db.get_bind()
    if not bind or bind.dialect.name != "mssql":
        return

    order_key = order.Id or order.OutTradeNo
    resources = [f"booking:order:{order_key}"]
    if schedule:
        resources.append(f"booking:schedule:{int(schedule.Id)}")
        resolved_center = parse_center_id(schedule.Note) or center_id
        if resolved_center and schedule.StartTime:
            slot_key = schedule.StartTime.strftime("%Y%m%d%H%M%S")
            resources.append(f"booking:center:{resolved_center}:{slot_key}")

    for resource in sorted(resources):
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
            raise ValueError("该订单或预约时段正在处理，请稍后重试")


def _assert_order_binding_current(db: Session, account: AppAccount, order: AppOrder) -> None:
    """付款时必须仍与来访当前绑定咨询师一致。"""
    if not order.SlotId:
        return
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    if not schedule or not schedule.CounselorId:
        raise ValueError("预约排期不存在，无法支付")
    bound_id = getattr(account, "BoundCounselorId", None)
    if not bound_id or int(bound_id) != int(schedule.CounselorId):
        raise ValueError("来访绑定咨询师已变更，该预约订单已失效，请联系助理重新预约")


def _assert_proxy_order_binding_current(db: Session, account: AppAccount, order: AppOrder) -> None:
    """代理订单付款时必须仍与来访当前绑定咨询师一致。"""
    if not (order.Description or "").startswith("proxy:"):
        return
    _assert_order_binding_current(db, account, order)


def complete_paid_order(
    db: Session,
    order: AppOrder,
    *,
    center_id: Optional[str] = None,
    transaction_id: Optional[str] = None,
) -> None:
    is_proxy_order = (order.Description or "").startswith("proxy:")
    if order.SlotId:
        from patient_contract_service import acquire_patient_contract_lock

        acquire_patient_contract_lock(db, order.AccountId)

    schedule = (
        db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
        if order.SlotId
        else None
    )
    _acquire_payment_locks(db, order, schedule, center_id)
    db.refresh(order)

    if order.Status == "PAID":
        return
    if order.Status != "PENDING":
        raise ValueError("订单状态已变化，无法完成支付")

    resolved_center: Optional[str] = None
    if order.SlotId:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
        if not schedule:
            raise ValueError("预约排期不存在，无法完成支付")
        db.refresh(schedule)
        if schedule.Status != "AVAILABLE":
            raise ValueError("预约时段已被占用，请重新预约")
        schedule_center = parse_center_id(schedule.Note)
        if center_id and schedule_center and center_id != schedule_center:
            raise ValueError("订单预约中心与排期不一致，请重新预约")
        resolved_center = schedule_center or center_id
        if not resolved_center:
            raise ValueError("排期未指定预约中心，无法完成付款")

    account = db.query(AppAccount).filter(AppAccount.Id == order.AccountId).first()
    if order.SlotId and not account:
        raise ValueError("来访账号不存在，无法完成支付")
    if account:
        _assert_order_binding_current(db, account, order)
        from order_contract_agreement import assert_order_contract_agreement_ready

        assert_order_contract_agreement_ready(db, account, order)

    record_intake_from_order(db, order)

    from patient_contract_service import maybe_mark_patient_contract_signed

    maybe_mark_patient_contract_signed(db, order)

    order.Status = "PAID"
    order.PaidAt = datetime.utcnow()
    if transaction_id:
        order.TransactionId = transaction_id

    if not order.SlotId:
        return

    if is_video_center(resolved_center):
        consultation_note = schedule_note(resolved_center)
    else:
        required_room_id = parse_room_id(schedule.Note) if is_proxy_order else None
        if is_proxy_order and not required_room_id:
            raise ValueError("代理预约订单未指定咨询室，请联系助理重新预约")
        assigned_room = apply_room_assignment(
            db,
            schedule,
            resolved_center,
            required_room_id=required_room_id,
        )
        consultation_note = schedule_note(resolved_center, assigned_room)

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
