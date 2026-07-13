"""
来访者预约可约时段 — 与咨询师工作台排期同源、同规则。

数据流（持久链路，非注入）：
  咨询师 POST /counselor/schedules  → 写入 AppSchedule
  来访者 GET  /common/counselors/{id} 或 /time-slots → 读本模块 → 同一 AppSchedule

展示/可约规则与 schedule_display.resolve_schedule_display 一致：
  OPEN（已排期）→ 来访者可见且可预约
  BOOKED（已预约）→ 可见但不可约
  EXPIRED（已过期）→ 可见但不可约
  CANCELLED / DONE / ON_LEAVE → 不展示给来访者
"""
from typing import Dict, List, Set, Tuple

from sqlalchemy.orm import Session

from models import AppConsultation, AppSchedule
from schedule_display import (
    DISPLAY_BOOKED,
    DISPLAY_CANCELLED,
    DISPLAY_DONE,
    DISPLAY_EXPIRED,
    DISPLAY_ON_LEAVE,
    DISPLAY_OPEN,
    DISPLAY_PENDING_PAYMENT,
    resolve_schedule_display,
)
from proxy_booking_service import pending_proxy_orders_for_schedules
from schedule_meta import parse_center_id
from schedule_slots import rolling_window_datetime_bounds


def _consultations_by_schedule(
    db: Session,
    schedule_ids: List[int],
) -> Dict[int, AppConsultation]:
    if not schedule_ids:
        return {}
    rows = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId.in_(schedule_ids),
            AppConsultation.Status != "CANCELLED",
        )
        .all()
    )
    return {c.ScheduleId: c for c in rows if c.ScheduleId}


def query_counselor_schedules_for_booking(
    db: Session,
    counselor_id: int,
) -> List[AppSchedule]:
    """查询滚动窗口内对外展示的排期（排除已取消）。"""
    start_bound, end_bound = rolling_window_datetime_bounds()
    return (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.Status.in_(["AVAILABLE", "BOOKED"]),
            AppSchedule.StartTime >= start_bound,
            AppSchedule.StartTime < end_bound,
        )
        .order_by(AppSchedule.StartTime.asc())
        .all()
    )


def schedules_to_booking_time_slots(
    db: Session,
    schedules: List[AppSchedule],
    *,
    billing_cents: int = 0,
    needs_negotiation: bool = False,
    price_label: str | None = None,
    price_negotiation: bool = False,
) -> Tuple[List[dict], Set[str]]:
    """
    将 AppSchedule 转为预约页 timeSlots。
    必须使用与工作台相同的 resolve_schedule_display 判定状态。
    """
    negotiation = bool(needs_negotiation or price_negotiation)
    price = None if negotiation else float(billing_cents or 0) / 100
    schedule_ids = [s.Id for s in schedules]
    cons_map = _consultations_by_schedule(db, schedule_ids)
    pending_map = pending_proxy_orders_for_schedules(db, schedule_ids)
    time_slots: List[dict] = []
    center_ids: Set[str] = set()

    for s in schedules:
        center_id = parse_center_id(s.Note)
        if not center_id:
            continue

        display = resolve_schedule_display(
            s,
            cons_map.get(s.Id),
            has_pending_proxy_order=s.Id in pending_map,
        )
        if display in (DISPLAY_CANCELLED, DISPLAY_DONE, DISPLAY_ON_LEAVE):
            continue

        center_ids.add(center_id)
        if display == DISPLAY_OPEN:
            slot_status = "NEGOTIATION" if needs_negotiation else "AVAILABLE"
            is_bookable = not negotiation
        elif display == DISPLAY_PENDING_PAYMENT:
            slot_status = "PENDING_PAYMENT"
            is_bookable = False
        elif display == DISPLAY_BOOKED:
            slot_status = "BOOKED"
            is_bookable = False
        else:  # EXPIRED
            slot_status = "EXPIRED"
            is_bookable = False

        time_slots.append({
            "ID": s.Id,
            "centerId": center_id,
            "startDate": s.StartTime.strftime("%Y-%m-%d"),
            "startHH": s.StartTime.strftime("%H:%M"),
            "endHH": s.EndTime.strftime("%H:%M"),
            "week": f"周{'一二三四五六日'[s.StartTime.weekday()]}",
            "Price": price,
            "priceLabel": price_label or ("议价" if negotiation else f"￥{price:g}"),
            "needsNegotiation": needs_negotiation,
            "priceNegotiation": price_negotiation,
            "maxSign": 1,
            "numSign": 0 if is_bookable else 1,
            "status": slot_status,
            "isBookable": is_bookable,
            "displayStatus": display,
            "startTime": s.StartTime.isoformat(),
            "endTime": s.EndTime.isoformat(),
        })

    return time_slots, center_ids


def counselor_booking_time_slots(
    db: Session,
    counselor_id: int,
    *,
    billing_cents: int = 0,
    needs_negotiation: bool = False,
    price_label: str | None = None,
    price_negotiation: bool = False,
) -> Tuple[List[dict], Set[str]]:
    """咨询师可预约时段：读 AppSchedule，规则与工作台排期展示一致。"""
    schedules = query_counselor_schedules_for_booking(db, counselor_id)
    return schedules_to_booking_time_slots(
        db,
        schedules,
        billing_cents=billing_cents,
        needs_negotiation=needs_negotiation,
        price_label=price_label,
        price_negotiation=price_negotiation,
    )
