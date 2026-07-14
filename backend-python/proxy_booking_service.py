"""助理/管理员代理预约：创建排期 + 待支付订单（2 小时有效）。"""

from __future__ import annotations

import random
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models import (
    AppAccount,
    AppCounselorProfile,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
)
from pricing_service import get_counselor_profile, resolve_display_price_cents
from schedule_meta import (
    CENTER_NAMES,
    center_display_name,
    get_consultation_rooms,
    is_video_center,
    parse_center_id,
    parse_room_id,
    release_assigned_room,
    schedule_note,
)
from room_slot_status import is_slot_operational, resolve_slot_manual_status
from schedule_slots import (
    active_schedules_at,
    all_slot_bounds_for_date,
    counselor_has_slot,
    has_available_room_at_center,
    is_aligned_standard_slot,
    paid_occupied_rooms_at_center,
    rolling_window_end,
    validate_slot_in_rolling_window,
)
from app_time import china_now

DISPLAY_PENDING_PAYMENT = "PENDING_PAYMENT"


def _now() -> datetime:
    return china_now()


def expire_pending_proxy_orders(db: Session) -> int:
    """取消超时未支付的代理预约订单并释放排期占用。"""
    now = _now()
    rows = (
        db.query(AppOrder)
        .filter(
            AppOrder.Status == "PENDING",
            AppOrder.ExpiresAt.isnot(None),
            AppOrder.ExpiresAt < now,
        )
        .all()
    )
    expired = 0
    for order in rows:
        order.Status = "CANCELLED"
        order.UpdatedAt = now
        if order.SlotId:
            schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
            if schedule and schedule.Status == "AVAILABLE":
                if (order.Description or "").startswith("proxy:"):
                    schedule.Status = "CANCELLED"
                else:
                    schedule.Note = release_assigned_room(schedule.Note)
                schedule.UpdatedAt = now
        expired += 1
    if expired:
        db.flush()
    return expired


def pending_proxy_orders_for_schedules(
    db: Session,
    schedule_ids: List[int],
) -> Dict[int, AppOrder]:
    if not schedule_ids:
        return {}
    now = _now()
    rows = (
        db.query(AppOrder)
        .filter(
            AppOrder.SlotId.in_(schedule_ids),
            AppOrder.Status == "PENDING",
            AppOrder.ExpiresAt.isnot(None),
            AppOrder.ExpiresAt >= now,
        )
        .order_by(AppOrder.Id.desc())
        .all()
    )
    result: Dict[int, AppOrder] = {}
    for row in rows:
        if row.SlotId and row.SlotId not in result:
            result[row.SlotId] = row
    return result


def pending_proxy_order_for_schedule(db: Session, schedule_id: int) -> Optional[AppOrder]:
    return pending_proxy_orders_for_schedules(db, [schedule_id]).get(schedule_id)


def search_proxy_patients(db: Session, keyword: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    from patient_contract_service import batch_patient_contract_extras

    q = db.query(AppAccount).filter(AppAccount.IsActive == True)
    if keyword:
        kw = keyword.strip()
        if kw:
            q = q.filter(
                (AppAccount.Nickname.like(f"%{kw}%"))
                | (AppAccount.RealName.like(f"%{kw}%"))
                | (AppAccount.Mobile.like(f"%{kw}%"))
            )
    accounts = q.order_by(AppAccount.Id.desc()).limit(limit * 3).all()
    patient_ids = {
        b.AccountId
        for b in db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Patient").all()
    }
    contract_map = batch_patient_contract_extras(db, accounts)
    result: List[Dict[str, Any]] = []
    for acc in accounts:
        if acc.Id not in patient_ids:
            continue
        name = acc.RealName or acc.Nickname or f"来访#{acc.Id}"
        contract = contract_map.get(acc.Id, {})
        tag = contract.get("contractTag")
        label = f"{name} · {acc.Mobile or acc.Id}"
        if tag:
            label = f"{name} {tag} · {acc.Mobile or acc.Id}"
        result.append(
            {
                "id": acc.Id,
                "name": name,
                "mobile": acc.Mobile,
                "contractTag": tag,
                "isContractSigned": bool(contract.get("isContractSigned")),
                "boundCounselorId": contract.get("boundCounselorId"),
                "boundCounselorName": contract.get("boundCounselorName"),
                "label": label,
            }
        )
        if len(result) >= limit:
            break
    return result


def search_counselor_proxy_patients(
    db: Session,
    counselor_id: int,
    keyword: Optional[str] = None,
    limit: int = 30,
) -> List[Dict[str, Any]]:
    """咨询师代理预约：按关键词搜索来访，并标注是否已绑定且已签约（可推送）。"""
    from patient_contract_service import batch_patient_contract_extras
    from models import AppRoleBinding

    patient_ids = {
        b.AccountId
        for b in db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Patient").all()
    }
    q = db.query(AppAccount).filter(AppAccount.IsActive == True)
    if keyword:
        kw = keyword.strip()
        if kw:
            q = q.filter(
                (AppAccount.Nickname.like(f"%{kw}%"))
                | (AppAccount.RealName.like(f"%{kw}%"))
                | (AppAccount.Mobile.like(f"%{kw}%"))
            )
    accounts = q.order_by(AppAccount.Id.desc()).limit(limit * 3).all()
    contract_map = batch_patient_contract_extras(db, accounts)
    result: List[Dict[str, Any]] = []
    for acc in accounts:
        if acc.Id not in patient_ids:
            continue
        contract = contract_map.get(acc.Id, {})
        bound_id = contract.get("boundCounselorId")
        is_bound = bool(bound_id and int(bound_id) == int(counselor_id))
        is_signed = bool(contract.get("isContractSigned"))
        can_proxy_push = is_bound and is_signed
        name = acc.RealName or acc.Nickname or f"来访#{acc.Id}"
        tag = contract.get("contractTag")
        label = f"{name} · {acc.Mobile or acc.Id}"
        if tag:
            label = f"{name} {tag} · {acc.Mobile or acc.Id}"
        elif not can_proxy_push:
            if not is_bound:
                label = f"{name} · 未绑定您 · {acc.Mobile or acc.Id}"
            elif not is_signed:
                label = f"{name} · 未签约 · {acc.Mobile or acc.Id}"
        result.append(
            {
                "id": acc.Id,
                "name": name,
                "mobile": acc.Mobile,
                "contractTag": tag,
                "isContractSigned": is_signed,
                "boundCounselorId": bound_id,
                "isBoundToCounselor": is_bound,
                "canProxyPush": can_proxy_push,
                "label": label,
            }
        )
        if len(result) >= limit:
            break
    return result


def counselor_proxy_patient_push_error(
    db: Session,
    patient: AppAccount,
    counselor_id: int,
) -> Optional[str]:
    """不可推送时返回提示文案，可推送则返回 None。"""
    bound_id = getattr(patient, "BoundCounselorId", None)
    if not bound_id or int(bound_id) != int(counselor_id):
        return "该来访并非您签约且绑定的来访，无法推送订单"
    from order_contract_agreement import is_signed_with_counselor

    if not is_signed_with_counselor(db, patient, counselor_id):
        return "该来访并非您签约且绑定的来访，无法推送订单"
    return None


def validate_counselor_proxy_patient(
    db: Session,
    patient: AppAccount,
    counselor_id: int,
) -> None:
    err = counselor_proxy_patient_push_error(db, patient, counselor_id)
    if err:
        raise ValueError(err)


def search_proxy_counselors(db: Session, keyword: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    counselor_ids = sorted(
        {
            b.AccountId
            for b in db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Counselor").all()
        }
    )
    if not counselor_ids:
        return []
    profiles = {
        p.AccountId: p
        for p in db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId.in_(counselor_ids), AppCounselorProfile.IsActive == True)
        .all()
    }
    accounts = {
        a.Id: a for a in db.query(AppAccount).filter(AppAccount.Id.in_(counselor_ids)).all()
    }
    kw = (keyword or "").strip().lower()
    result: List[Dict[str, Any]] = []
    for cid in counselor_ids:
        prof = profiles.get(cid)
        acc = accounts.get(cid)
        name = (prof.Name if prof else None) or (acc.Nickname if acc else None) or f"咨询师#{cid}"
        if kw and kw not in name.lower() and kw not in str(cid) and kw not in (acc.Mobile or ""):
            continue
        result.append(
            {
                "id": cid,
                "name": name,
                "mobile": acc.Mobile if acc else None,
                "label": f"{name} · ID {cid}",
            }
        )
        if len(result) >= limit:
            break
    return result


def _rooms_with_proxy_pending(
    db: Session,
    center_id: str,
    start_dt: datetime,
    exclude_schedule_id: Optional[int] = None,
) -> set[str]:
    """含代理待支付已占用的咨询室。"""
    occupied = set(paid_occupied_rooms_at_center(db, center_id, start_dt))
    for row in active_schedules_at(db, start_dt, exclude_id=exclude_schedule_id):
        if row.Status != "AVAILABLE":
            continue
        if parse_center_id(row.Note) != center_id:
            continue
        pending = pending_proxy_order_for_schedule(db, row.Id)
        if not pending:
            continue
        room_id = parse_room_id(row.Note)
        if room_id:
            occupied.add(room_id)
    return occupied


def build_proxy_slot_options(
    db: Session,
    counselor_id: int,
    slot_date,
    center_id: str,
) -> List[Dict[str, Any]]:
    from datetime import date as date_type

    if isinstance(slot_date, str):
        slot_date = date_type.fromisoformat(slot_date)

    today = _now().date()
    if slot_date < today or slot_date > rolling_window_end(today):
        raise ValueError("仅可选择今天起滚动窗口内日期")

    now = _now()
    if center_id not in CENTER_NAMES:
        raise ValueError("无效的预约中心")

    rooms = [] if is_video_center(center_id) else get_consultation_rooms(db, center_id)
    options: List[Dict[str, Any]] = []

    for start_dt, end_dt in all_slot_bounds_for_date(slot_date):
        key = start_dt.strftime("%H:%M")
        label = f"{key} – {end_dt.strftime('%H:%M')}"
        past = start_dt <= now
        self_row = next(
            (r for r in active_schedules_at(db, start_dt) if r.CounselorId == counselor_id),
            None,
        )
        is_booked = self_row is not None and self_row.Status == "BOOKED"
        pending_on_self = (
            self_row is not None
            and self_row.Status == "AVAILABLE"
            and pending_proxy_order_for_schedule(db, self_row.Id) is not None
        )
        counselor_occupied = is_booked or pending_on_self

        proxy_occupied = _rooms_with_proxy_pending(
            db, center_id, start_dt, exclude_schedule_id=self_row.Id if self_row else None,
        )
        paid_occupied = paid_occupied_rooms_at_center(db, center_id, start_dt) if rooms else set()
        all_occupied = proxy_occupied | paid_occupied

        room_opts: List[Dict[str, Any]] = []
        usable_room_ids: List[str] = []
        for room in rooms:
            slot_status = resolve_slot_manual_status(db, room.get("dbId"), start_dt, "AVAILABLE")
            room_ok = is_slot_operational(slot_status)
            if room_ok:
                usable_room_ids.append(room["id"])
            taken = room["id"] in all_occupied
            room_opts.append(
                {
                    "roomId": room["id"],
                    "roomName": room["name"],
                    "available": not past and room_ok and not taken and not counselor_occupied,
                    "occupiedByOther": taken,
                }
            )

        all_rooms_full = False if is_video_center(center_id) else (
            counselor_occupied
            or (
                bool(usable_room_ids)
                and not any(r["available"] for r in room_opts)
            )
        )

        available_slot = (
            not past
            and not is_booked
            and not pending_on_self
            and (is_video_center(center_id) or any(r["available"] for r in room_opts) or self_row is not None)
        )

        options.append(
            {
                "key": key,
                "startTime": start_dt.isoformat(),
                "endTime": end_dt.isoformat(),
                "label": label,
                "past": past,
                "counselorOccupied": counselor_occupied,
                "counselorScheduleId": self_row.Id if self_row and not is_booked and not pending_on_self else None,
                "existingAvailableScheduleId": (
                    self_row.Id if self_row and self_row.Status == "AVAILABLE" and not pending_on_self else None
                ),
                "allRoomsFull": all_rooms_full,
                "selectable": available_slot and not all_rooms_full,
                "rooms": room_opts,
            }
        )
    return options


def push_proxy_order(
    db: Session,
    *,
    staff_account_id: int,
    patient_id: int,
    counselor_id: int,
    center_id: str,
    start_time: datetime,
    end_time: datetime,
    room_id: Optional[str] = None,
    existing_schedule_id: Optional[int] = None,
    agreement_is_adult: Optional[bool] = None,
) -> Dict[str, Any]:
    from system_setting_service import get_proxy_order_ttl_minutes, proxy_order_ttl_push_message

    expire_pending_proxy_orders(db)
    ttl_minutes = get_proxy_order_ttl_minutes(db)

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id, AppAccount.IsActive == True).first()
    if not patient:
        raise ValueError("来访不存在")
    bound_id = getattr(patient, "BoundCounselorId", None)
    if not bound_id:
        raise ValueError("该来访尚未绑定签约咨询师，请先在来访者详情中绑定")
    if int(counselor_id) != int(bound_id):
        raise ValueError("只能为来访已绑定的咨询师推送代理预约订单")
    if not get_counselor_profile(db, counselor_id):
        raise ValueError("咨询师不存在")

    from order_contract_agreement import is_signed_with_counselor

    needs_agreement = not is_signed_with_counselor(db, patient, counselor_id)
    if needs_agreement:
        if agreement_is_adult is None:
            raise ValueError("未签约来访需选择推送的签约协议类型")
    elif agreement_is_adult is not None:
        agreement_is_adult = None

    from charity_milestone_service import assert_charity_patient_can_book_charity
    from fastapi import HTTPException

    try:
        assert_charity_patient_can_book_charity(db, patient_id, counselor_id)
    except HTTPException as exc:
        raise ValueError(str(exc.detail)) from exc

    if not center_id or center_id not in CENTER_NAMES:
        raise ValueError("必须选择预约中心")
    if end_time <= start_time:
        raise ValueError("结束时间必须晚于开始时间")
    if not is_aligned_standard_slot(start_time, end_time):
        raise ValueError("请使用标准时间槽（50分钟/节）")
    validate_slot_in_rolling_window(start_time)

    if not is_video_center(center_id):
        if not room_id:
            raise ValueError("请选择咨询室")
        rooms = get_consultation_rooms(db, center_id)
        if room_id not in {r["id"] for r in rooms}:
            raise ValueError("无效的咨询室")
        occupied = _rooms_with_proxy_pending(db, center_id, start_time)
        occupied |= paid_occupied_rooms_at_center(db, center_id, start_time)
        if room_id in occupied:
            raise ValueError("该咨询室在该时段已被占用")

    schedule: Optional[AppSchedule] = None
    if existing_schedule_id:
        schedule = (
            db.query(AppSchedule)
            .filter(
                AppSchedule.Id == existing_schedule_id,
                AppSchedule.CounselorId == counselor_id,
            )
            .first()
        )
        if not schedule:
            raise ValueError("排期不存在")
        if schedule.Status == "BOOKED":
            raise ValueError("该时段已被预约，不可代理")
        if pending_proxy_order_for_schedule(db, schedule.Id):
            raise ValueError("该时段已有待支付代理订单")
        if schedule.StartTime != start_time:
            raise ValueError("排期时间与所选时间不一致")
    else:
        if counselor_has_slot(db, counselor_id, start_time):
            raise ValueError("该咨询师在该时间槽已有排期")
        if not is_video_center(center_id):
            usable = [room_id] if room_id else []
            if not has_available_room_at_center(db, center_id, start_time, usable):
                raise ValueError("该时段咨询室不可用")

    note = schedule_note(center_id, room_id=room_id if not is_video_center(center_id) else None)
    if schedule:
        schedule.Note = note
        schedule.UpdatedAt = _now()
    else:
        schedule = AppSchedule(
            CounselorId=counselor_id,
            StartTime=start_time,
            EndTime=end_time,
            Status="AVAILABLE",
            Note=note,
        )
        db.add(schedule)
        db.flush()

    total_fee = resolve_display_price_cents(db, patient_id, counselor_id)
    out_trade_no = f"PROXY{int(time.time())}{random.randint(1000, 9999)}"
    expires_at = _now() + timedelta(minutes=get_proxy_order_ttl_minutes(db))
    order = AppOrder(
        AccountId=patient_id,
        SlotId=schedule.Id,
        OutTradeNo=out_trade_no,
        TotalFee=total_fee,
        Status="PENDING",
        Description=f"proxy:{staff_account_id}|center:{center_id}",
        ExpiresAt=expires_at,
        ProxyCreatedByAccountId=staff_account_id,
        ProxyAgreementIsAdult=agreement_is_adult if needs_agreement else None,
    )
    db.add(order)
    db.flush()

    from proxy_booking_notify import notify_proxy_order_created

    notify_proxy_order_created(
        db,
        order=order,
        schedule=schedule,
        patient=patient,
        counselor_id=counselor_id,
        staff_account_id=staff_account_id,
    )

    return {
        "orderId": order.Id,
        "scheduleId": schedule.Id,
        "outTradeNo": out_trade_no,
        "totalFee": total_fee,
        "totalFeeYuan": total_fee // 100,
        "expiresAt": expires_at.isoformat(),
        "message": proxy_order_ttl_push_message(ttl_minutes),
        "proxyOrderTtlMinutes": ttl_minutes,
    }
