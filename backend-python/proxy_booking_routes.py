"""管理员/助理：代理预约 API。"""

from __future__ import annotations

from datetime import date as date_type, datetime, time, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app_time import china_now
from auth import get_current_account, AppAccount
from staff_roles import account_has_staff_workbench
from counselor import _calendar_items_for_schedules
from database import get_db
from models import AppSchedule
from proxy_booking_service import (
    build_proxy_slot_options,
    expire_pending_proxy_orders,
    push_proxy_order,
    search_proxy_counselors,
    search_proxy_patients,
)
from schedule_meta import center_display_name
from schedule_slots import ROLLING_WINDOW_DAYS, rolling_window_end

router = APIRouter(prefix="/proxy-booking", tags=["ProxyBooking"])


def require_staff_workbench(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    if not account_has_staff_workbench(
        db, current_account.Id, getattr(current_account, "ActiveRole", None)
    ):
        raise HTTPException(status_code=403, detail="无管理工作台权限")
    return current_account


class ProxyPushOrderRequest(BaseModel):
    patient_id: int
    counselor_id: int
    center_id: str
    start_time: datetime
    end_time: datetime
    room_id: Optional[str] = None
    schedule_id: Optional[int] = None


class ScheduleCalendarOut(BaseModel):
    startDate: str
    days: int
    slots: list


@router.get("/patients", summary="搜索来访（代理预约）")
def proxy_search_patients(
    keyword: Optional[str] = Query(None),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    return {"items": search_proxy_patients(db, keyword)}


@router.get("/counselors", summary="搜索咨询师（代理预约）")
def proxy_search_counselors(
    keyword: Optional[str] = Query(None),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    return {"items": search_proxy_counselors(db, keyword)}


@router.get("/calendar", response_model=ScheduleCalendarOut, summary="咨询师排期日历（仅当日及以后）")
def proxy_schedule_calendar(
    counselor_id: int = Query(...),
    start: Optional[str] = Query(None),
    days: int = Query(ROLLING_WINDOW_DAYS, ge=1, le=ROLLING_WINDOW_DAYS * 2),
    month: Optional[str] = Query(None),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    expire_pending_proxy_orders(db)
    db.commit()
    today = china_now().date()
    start_dt = datetime.combine(today, time.min)

    if month:
        try:
            year_s, mon_s = month.split("-", 1)
            year_i, mon_i = int(year_s), int(mon_s)
            start_date = date_type(year_i, mon_i, 1)
            if mon_i == 12:
                end_date = date_type(year_i + 1, 1, 1)
            else:
                end_date = date_type(year_i, mon_i + 1, 1)
            start_dt = datetime.combine(max(start_date, today), time.min)
            end_dt = datetime.combine(end_date, time.min)
            span_days = (end_date - max(start_date, today)).days
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="month 格式应为 YYYY-MM")
    else:
        start_date = today
        if start:
            try:
                requested = date_type.fromisoformat(start)
                if requested >= today:
                    start_date = requested
            except ValueError:
                raise HTTPException(status_code=400, detail="start 格式应为 YYYY-MM-DD")
        start_dt = datetime.combine(start_date, time.min)
        end_bound = datetime.combine(rolling_window_end(today) + timedelta(days=1), time.min)
        end_dt = min(
            start_dt + timedelta(days=days),
            end_bound,
        )
        span_days = max(1, (end_dt.date() - start_date).days)

    schedules: List[AppSchedule] = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.StartTime >= start_dt,
            AppSchedule.StartTime < end_dt,
            AppSchedule.Status.in_(["AVAILABLE", "BOOKED"]),
        )
        .order_by(AppSchedule.StartTime.asc())
        .all()
    )
    return ScheduleCalendarOut(
        startDate=start_date.isoformat(),
        days=span_days,
        slots=_calendar_items_for_schedules(db, schedules, counselor_id),
    )


@router.get("/slot-options", summary="某日时间槽与咨询室占用（代理预约选室）")
def proxy_slot_options(
    counselor_id: int = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    center_id: str = Query(...),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    try:
        slots = build_proxy_slot_options(db, counselor_id, date, center_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "date": date,
        "centerId": center_id,
        "centerName": center_display_name(center_id) or center_id,
        "slots": slots,
    }


@router.post("/push-order", summary="推送代理预约订单（待来访支付）")
def proxy_push_order(
    body: ProxyPushOrderRequest,
    staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    try:
        result = push_proxy_order(
            db,
            staff_account_id=staff.Id,
            patient_id=body.patient_id,
            counselor_id=body.counselor_id,
            center_id=body.center_id,
            start_time=body.start_time,
            end_time=body.end_time,
            room_id=body.room_id,
            existing_schedule_id=body.schedule_id,
        )
        db.commit()
        return result
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
