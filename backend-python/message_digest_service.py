"""我的消息顶部今日统计。

支付成功时间、预约取消操作时间在库里是 UTC naive。
请假、来访取消申请、咨询记录修改申请的 CreatedAt 跟随 SQL Server GETDATE()，
与排期一样按东八区墙钟比较。
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app_time import CHINA_UTC_OFFSET, china_now
from models import (
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppLeaveRequest,
    AppOrder,
    AppRefundExemption,
)


def china_today_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    current = now or china_now()
    if current.tzinfo is not None:
        current = current.replace(tzinfo=None)
    start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def today_message_digest(db: Session, now: datetime | None = None) -> dict:
    china_start, china_end = china_today_window(now)
    utc_start = china_start - CHINA_UTC_OFFSET
    utc_end = china_end - CHINA_UTC_OFFSET
    cancelled_count = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.Status == "CANCELLED",
            AppConsultation.UpdatedAt.isnot(None),
            AppConsultation.UpdatedAt >= utc_start,
            AppConsultation.UpdatedAt < utc_end,
        )
        .count()
    )
    new_booking_count = (
        db.query(AppOrder)
        .filter(
            AppOrder.PaidAt.isnot(None),
            AppOrder.PaidAt >= utc_start,
            AppOrder.PaidAt < utc_end,
            AppOrder.Status.in_(("PAID", "REFUNDED", "CANCELLED")),
        )
        .count()
    )
    return {
        "cancelledCount": int(cancelled_count),
        "newBookingCount": int(new_booking_count),
        "leavePendingCount": _pending_created_in_window(db, AppLeaveRequest, china_start, china_end),
        "visitorCancelPendingCount": _pending_created_in_window(
            db, AppRefundExemption, china_start, china_end
        ),
        "recordAmendmentPendingCount": _pending_created_in_window(
            db, AppCaseRecordAmendmentRequest, china_start, china_end
        ),
    }


def _pending_created_in_window(db: Session, model, start: datetime, end: datetime) -> int:
    """只统计当天发起、且仍为待审核的申请。审核通过或驳回后即从滚动条减去。"""
    return (
        db.query(model)
        .filter(
            model.Status == "PENDING",
            model.CreatedAt >= start,
            model.CreatedAt < end,
        )
        .count()
    )
