"""咨询单状态：结束时间到达后自动标记为已完成。"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app_time import china_now
from consultation_cancel import has_appointment_ended
from models import AppConsultation, AppRemindTask, AppSchedule

AUTO_DONE_EVENT = "CONSULTATION_AUTO_DONE"
AUTO_DONE_RELATED = "CONSULTATION_AUTO_DONE"
ACTIVE_STATUSES = ("PENDING", "CONFIRMED", "ONGOING")


def consultation_end_time(
    consultation: AppConsultation,
    schedule: Optional[AppSchedule] = None,
) -> Optional[datetime]:
    if consultation.EndTime:
        return consultation.EndTime
    if schedule and schedule.EndTime:
        return schedule.EndTime
    start = consultation.StartTime or (schedule.StartTime if schedule else None)
    if start:
        return start + timedelta(minutes=50)
    return None


def cancel_consultation_auto_done_tasks(db: Session, consultation_id: int) -> None:
    rows = (
        db.query(AppRemindTask)
        .filter(
            AppRemindTask.RelatedId == consultation_id,
            AppRemindTask.RelatedType == AUTO_DONE_RELATED,
            AppRemindTask.EventKey == AUTO_DONE_EVENT,
            AppRemindTask.Status == "PENDING",
        )
        .all()
    )
    now = datetime.utcnow()
    for row in rows:
        row.Status = "CANCELLED"
        row.ProcessedAt = now


def mark_consultation_done(
    db: Session,
    consultation: AppConsultation,
    schedule: Optional[AppSchedule] = None,
) -> bool:
    """将咨询单标记为已完成。返回是否有变更。"""
    if consultation.Status not in ACTIVE_STATUSES:
        return False
    consultation.Status = "DONE"
    if not consultation.EndTime:
        end_time = consultation_end_time(consultation, schedule)
        consultation.EndTime = end_time or china_now()
    consultation.UpdatedAt = datetime.utcnow()
    cancel_consultation_auto_done_tasks(db, consultation.Id)
    db.flush()

    from charity_milestone_service import maybe_notify_charity_30th_completion
    maybe_notify_charity_30th_completion(db, consultation)

    return True


def mark_consultation_done_if_expired(
    db: Session,
    consultation: AppConsultation,
    schedule: Optional[AppSchedule] = None,
) -> bool:
    if consultation.Status not in ACTIVE_STATUSES:
        return False
    end_time = consultation_end_time(consultation, schedule)
    if not has_appointment_ended(end_time):
        return False
    return mark_consultation_done(db, consultation, schedule)


def schedule_consultation_auto_done(
    db: Session,
    consultation: AppConsultation,
    schedule: Optional[AppSchedule] = None,
) -> None:
    """在咨询结束时间创建后台任务，到期后将 Status 更新为 DONE。"""
    if consultation.Status not in ACTIVE_STATUSES:
        return

    cancel_consultation_auto_done_tasks(db, consultation.Id)

    if schedule is None and consultation.ScheduleId:
        schedule = (
            db.query(AppSchedule)
            .filter(AppSchedule.Id == consultation.ScheduleId)
            .first()
        )

    end_time = consultation_end_time(consultation, schedule)
    if not end_time:
        return

    if has_appointment_ended(end_time):
        mark_consultation_done(db, consultation, schedule)
        return

    db.add(
        AppRemindTask(
            AccountId=consultation.PatientId,
            EventKey=AUTO_DONE_EVENT,
            Title="咨询自动完成",
            Content="",
            RelatedType=AUTO_DONE_RELATED,
            RelatedId=consultation.Id,
            ScheduledAt=end_time,
        )
    )


def expire_due_consultations(db: Session, *, limit: int = 100) -> int:
    """补偿：将已过结束时间但仍为进行中的咨询单标记为已完成。"""
    now = china_now()
    rows = (
        db.query(AppConsultation)
        .filter(AppConsultation.Status.in_(ACTIVE_STATUSES))
        .order_by(AppConsultation.Id.asc())
        .limit(limit * 5)
        .all()
    )
    if not rows:
        return 0

    schedule_ids = {r.ScheduleId for r in rows if r.ScheduleId}
    schedule_map = {
        s.Id: s
        for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all()
    } if schedule_ids else {}

    expired = 0
    for consultation in rows:
        if expired >= limit:
            break
        sched = schedule_map.get(consultation.ScheduleId) if consultation.ScheduleId else None
        end_time = consultation_end_time(consultation, sched)
        if end_time and end_time <= now:
            if mark_consultation_done(db, consultation, sched):
                expired += 1

    if expired:
        db.flush()
    return expired


def process_consultation_auto_done_task(db: Session, consultation_id: int) -> bool:
    consultation = (
        db.query(AppConsultation)
        .filter(AppConsultation.Id == consultation_id)
        .first()
    )
    if not consultation:
        return False
    schedule = None
    if consultation.ScheduleId:
        schedule = (
            db.query(AppSchedule)
            .filter(AppSchedule.Id == consultation.ScheduleId)
            .first()
        )
    return mark_consultation_done_if_expired(db, consultation, schedule)
