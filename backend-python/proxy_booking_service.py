"""助理/管理员代理预约：创建排期 + 带可配置有效期的待支付订单。"""

from __future__ import annotations

import random
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
)
from pricing_service import resolve_display_price_cents
from schedule_meta import (
    CENTER_NAMES,
    center_display_name,
    get_consultation_rooms,
    is_video_center,
    parse_center_id,
    parse_pref_room_id,
    parse_room_id,
    release_assigned_room,
    schedule_note,
)
from room_slot_status import (
    is_booking_window_operational,
)
from schedule_slots import (
    active_schedules_at,
    all_slot_bounds_for_date,
    booking_lead_time_reason,
    counselor_has_slot,
    has_available_room_at_center,
    is_aligned_standard_slot,
    paid_occupied_rooms_at_center,
    rolling_window_end,
    validate_slot_in_rolling_window,
)
from app_time import china_now

DISPLAY_PENDING_PAYMENT = "PENDING_PAYMENT"
PROXY_SCHEDULE_NEW = "schedule:new"
PROXY_SCHEDULE_EXISTING = "schedule:existing"


def _now() -> datetime:
    return china_now()


def _proxy_order_created_schedule(order: AppOrder) -> bool:
    description = order.Description or ""
    # 旧订单没有排期来源标记，安全起见按复用排期处理，避免误删咨询师原排期。
    return PROXY_SCHEDULE_NEW in description


def _cancel_pending_proxy_order(db: Session, order: AppOrder) -> None:
    if order.Status != "PENDING":
        return
    from wechat_pay_service import close_wechat_order_quietly

    close_wechat_order_quietly(order.OutTradeNo)
    order.Status = "CANCELLED"
    order.UpdatedAt = _now()
    if not order.SlotId:
        return
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    if not schedule or schedule.Status != "AVAILABLE":
        return
    if _proxy_order_created_schedule(order):
        schedule.Status = "CANCELLED"
    else:
        schedule.Note = release_assigned_room(schedule.Note)
    schedule.UpdatedAt = _now()


def cancel_pending_proxy_orders_for_patient(
    db: Session,
    patient_id: int,
    *,
    keep_counselor_id: Optional[int],
) -> int:
    """换绑/解绑时取消与当前绑定咨询师不一致的待支付代理订单。"""
    rows = (
        db.query(AppOrder)
        .filter(
            AppOrder.AccountId == patient_id,
            AppOrder.Status == "PENDING",
            AppOrder.Description.like("proxy:%"),
        )
        .all()
    )
    cancelled = 0
    for order in rows:
        schedule = (
            db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
            if order.SlotId
            else None
        )
        if (
            keep_counselor_id is not None
            and schedule
            and int(schedule.CounselorId) == int(keep_counselor_id)
        ):
            continue
        _cancel_pending_proxy_order(db, order)
        cancelled += 1
    if cancelled:
        db.flush()
    return cancelled


def _acquire_proxy_booking_locks(
    db: Session,
    *,
    counselor_id: int,
    center_id: str,
    start_time: datetime,
    room_id: Optional[str],
) -> None:
    """SQL Server 事务级互斥，防止同一咨询师/咨询室并发双占。"""
    bind = db.get_bind()
    if not bind or bind.dialect.name != "mssql":
        return
    slot_keys = [
        point.strftime("%Y%m%d%H%M%S")
        for point in (start_time, start_time + timedelta(minutes=30))
    ]
    resources = []
    for slot_key in slot_keys:
        resources.extend([
            f"booking:center:{center_id}:{slot_key}",
            f"proxy:counselor:{int(counselor_id)}:{slot_key}",
        ])
        if room_id:
            resources.append(f"proxy:room:{center_id}:{room_id}:{slot_key}")
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
            raise ValueError("该时段正在被其他预约占用，请稍后重试")


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
        .order_by(AppOrder.AccountId.asc(), AppOrder.Id.asc())
        .all()
    )
    expired = 0
    from patient_contract_service import acquire_patient_contract_lock

    for order in rows:
        acquire_patient_contract_lock(db, order.AccountId)
        db.refresh(order)
        if order.Status != "PENDING" or not order.ExpiresAt or order.ExpiresAt >= now:
            continue
        _cancel_pending_proxy_order(db, order)
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
            AppOrder.Description.like("proxy:%"),
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


def _proxy_patient_ids(db: Session) -> set[int]:
    """与小程序来访管理的口径一致：Patient 角色与历史咨询来访都可搜索，
    但工作人员账号不作为来访出现。
    """
    from staff_roles import staff_workbench_account_ids

    staff_ids = set(staff_workbench_account_ids(db))
    staff_ids.update(
        int(value)
        for (value,) in db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Counselor")
        .all()
    )
    role_ids = {
        int(value)
        for (value,) in db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Patient")
        .all()
    }
    consultation_ids = {
        int(value)
        for (value,) in db.query(AppConsultation.PatientId).distinct().all()
        if value
    }
    return (role_ids | consultation_ids) - staff_ids


def search_proxy_patients(db: Session, keyword: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    from patient_contract_service import batch_patient_contract_extras

    patient_ids = _proxy_patient_ids(db)
    if not patient_ids:
        return []
    q = db.query(AppAccount).filter(
        AppAccount.IsActive == True,
        AppAccount.Id.in_(patient_ids),
    )
    if keyword:
        kw = keyword.strip()
        if kw:
            q = q.filter(
                (AppAccount.Nickname.like(f"%{kw}%"))
                | (AppAccount.RealName.like(f"%{kw}%"))
                | (AppAccount.Mobile.like(f"%{kw}%"))
            )
    accounts = q.order_by(AppAccount.Id.desc()).limit(limit).all()
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
    """咨询师代理预约：仅搜索已绑定当前咨询师且已签约的来访。"""
    from patient_contract_service import batch_patient_contract_extras
    patient_ids = _proxy_patient_ids(db)
    if not patient_ids:
        return []
    q = db.query(AppAccount).filter(
        AppAccount.IsActive == True,
        AppAccount.Id.in_(patient_ids),
        AppAccount.BoundCounselorId == counselor_id,
        # SQL Server 的 BIT 列不能使用 ``IS 1``，需使用等值比较。
        AppAccount.IsContractSigned == True,
    )
    if keyword:
        kw = keyword.strip()
        if kw:
            q = q.filter(
                (AppAccount.Nickname.like(f"%{kw}%"))
                | (AppAccount.RealName.like(f"%{kw}%"))
                | (AppAccount.Mobile.like(f"%{kw}%"))
            )
    accounts = q.order_by(AppAccount.Id.desc()).limit(limit).all()
    contract_map = batch_patient_contract_extras(db, accounts)
    result: List[Dict[str, Any]] = []
    for acc in accounts:
        contract = contract_map.get(acc.Id, {})
        bound_id = contract.get("boundCounselorId")
        name = acc.RealName or acc.Nickname or f"来访#{acc.Id}"
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
                "isContractSigned": True,
                "boundCounselorId": bound_id,
                "isBoundToCounselor": True,
                "canProxyPush": True,
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
        a.Id: a
        for a in db.query(AppAccount)
        .filter(AppAccount.Id.in_(counselor_ids), AppAccount.IsActive == True)
        .all()
    }
    kw = (keyword or "").strip().lower()
    result: List[Dict[str, Any]] = []
    for cid in counselor_ids:
        prof = profiles.get(cid)
        acc = accounts.get(cid)
        if not prof or not acc:
            continue
        name = prof.Name or acc.RealName or acc.Nickname or f"咨询师#{cid}"
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
        unavailable_reason = booking_lead_time_reason(start_dt, now)
        too_soon = unavailable_reason is not None
        counselor_rows = [
            row
            for row in active_schedules_at(db, start_dt)
            if row.CounselorId == counselor_id
        ]
        self_row = next(
            (row for row in counselor_rows if row.StartTime == start_dt),
            None,
        )
        overlapping_row = next(
            (row for row in counselor_rows if row.StartTime != start_dt),
            None,
        )
        is_booked = self_row is not None and self_row.Status == "BOOKED"
        pending_on_self = (
            self_row is not None
            and self_row.Status == "AVAILABLE"
            and pending_proxy_order_for_schedule(db, self_row.Id) is not None
        )
        counselor_occupied = overlapping_row is not None or is_booked or pending_on_self

        proxy_occupied = _rooms_with_proxy_pending(
            db, center_id, start_dt, exclude_schedule_id=self_row.Id if self_row else None,
        )
        paid_occupied = paid_occupied_rooms_at_center(db, center_id, start_dt) if rooms else set()
        all_occupied = proxy_occupied | paid_occupied

        room_opts: List[Dict[str, Any]] = []
        for room in rooms:
            # 单时段状态覆盖咨询室的全局状态；未配置单时段状态时必须沿用
            # 房间本身的 AVAILABLE / DISABLED，不能把停用房间重新当成可用。
            room_ok = is_booking_window_operational(
                db,
                room.get("dbId"),
                start_dt,
                room.get("status", "AVAILABLE"),
            )
            taken = room["id"] in all_occupied
            room_opts.append(
                {
                    "roomId": room["id"],
                    "roomName": room["name"],
                    "available": not too_soon and room_ok and not taken and not counselor_occupied,
                    "occupiedByOther": taken,
                }
            )

        # 线下中心只要没有可选择的房间就应当约满。已有 AVAILABLE 排期
        # 不能绕过咨询室可用性，否则前端会出现“时段可点、房间全灰”。
        all_rooms_full = False if is_video_center(center_id) else not any(
            room["available"] for room in room_opts
        )

        available_slot = (
            not too_soon
            and not counselor_occupied
            and (is_video_center(center_id) or any(r["available"] for r in room_opts))
        )

        options.append(
            {
                "key": key,
                "startTime": start_dt.isoformat(),
                "endTime": end_dt.isoformat(),
                "label": label,
                "past": past,
                "tooSoon": too_soon,
                "unavailableReason": unavailable_reason,
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
    agreement_type: Optional[str] = None,
    notify_target_counselor: bool = True,
) -> Dict[str, Any]:
    from system_setting_service import get_proxy_order_ttl_minutes, proxy_order_ttl_push_message

    expire_pending_proxy_orders(db)
    from patient_contract_service import acquire_patient_contract_lock

    acquire_patient_contract_lock(db, patient_id)
    ttl_minutes = get_proxy_order_ttl_minutes(db)

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id, AppAccount.IsActive == True).first()
    if not patient:
        raise ValueError("来访不存在")
    bound_id = getattr(patient, "BoundCounselorId", None)
    if not bound_id:
        raise ValueError("该来访尚未绑定签约咨询师，请先在来访者详情中绑定")
    if int(counselor_id) != int(bound_id):
        raise ValueError("只能为来访已绑定的咨询师推送代理预约订单")
    counselor_account = (
        db.query(AppAccount)
        .filter(AppAccount.Id == counselor_id, AppAccount.IsActive == True)
        .first()
    )
    counselor_role = (
        db.query(AppRoleBinding.Id)
        .filter(
            AppRoleBinding.AccountId == counselor_id,
            AppRoleBinding.RoleType == "Counselor",
        )
        .first()
    )
    active_profile = (
        db.query(AppCounselorProfile.Id)
        .filter(
            AppCounselorProfile.AccountId == counselor_id,
            AppCounselorProfile.IsActive == True,
        )
        .first()
    )
    if not counselor_account or not counselor_role or not active_profile:
        raise ValueError("咨询师不存在或已停用")

    from order_contract_agreement import is_signed_with_counselor

    needs_agreement = not is_signed_with_counselor(db, patient, counselor_id)
    from consultation_agreement_types import (
        legacy_is_adult_for_agreement_type,
        resolve_push_agreement_type,
    )

    resolved_agreement_type: Optional[str] = None
    if needs_agreement:
        resolved_agreement_type = resolve_push_agreement_type(
            agreement_type=agreement_type,
            agreement_is_adult=agreement_is_adult,
        )
        if not resolved_agreement_type:
            raise ValueError("未签约来访需选择推送的签约协议类型")
    elif agreement_is_adult is not None or agreement_type:
        resolved_agreement_type = None

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

    _acquire_proxy_booking_locks(
        db,
        counselor_id=counselor_id,
        center_id=center_id,
        start_time=start_time,
        room_id=room_id,
    )

    if not is_video_center(center_id):
        if not room_id:
            raise ValueError("请选择咨询室")
        rooms = get_consultation_rooms(db, center_id)
        selected_room = next((room for room in rooms if room["id"] == room_id), None)
        if not selected_room:
            raise ValueError("无效的咨询室")
        if not is_booking_window_operational(
            db,
            selected_room.get("dbId"),
            start_time,
            selected_room.get("status", "AVAILABLE"),
        ):
            raise ValueError("该咨询室在该时段不可用")
        occupied = _rooms_with_proxy_pending(db, center_id, start_time)
        occupied |= paid_occupied_rooms_at_center(db, center_id, start_time)
        if room_id in occupied:
            raise ValueError("该咨询室在该时段已被占用")

    schedule: Optional[AppSchedule] = None
    existing_pref_room_id: Optional[str] = None
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
        if schedule.Status != "AVAILABLE":
            raise ValueError("该排期当前不可预约")
        if pending_proxy_order_for_schedule(db, schedule.Id):
            raise ValueError("该时段已有待支付代理订单")
        if schedule.StartTime != start_time or schedule.EndTime != end_time:
            raise ValueError("排期时间与所选时间不一致")
        existing_pref_room_id = parse_pref_room_id(schedule.Note) or parse_room_id(schedule.Note)
    else:
        if counselor_has_slot(db, counselor_id, start_time):
            raise ValueError("该咨询师在该时间槽已有排期")
        if not is_video_center(center_id):
            usable = [room_id] if room_id else []
            if not has_available_room_at_center(db, center_id, start_time, usable):
                raise ValueError("该时段咨询室不可用")

    note = schedule_note(
        center_id,
        room_id=room_id if not is_video_center(center_id) else None,
        pref_room_id=(
            existing_pref_room_id
            if existing_pref_room_id and not is_video_center(center_id)
            else None
        ),
    )
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
    expires_at = _now() + timedelta(minutes=ttl_minutes)
    schedule_mode = PROXY_SCHEDULE_EXISTING if existing_schedule_id else PROXY_SCHEDULE_NEW
    order = AppOrder(
        AccountId=patient_id,
        SlotId=schedule.Id,
        OutTradeNo=out_trade_no,
        TotalFee=total_fee,
        Status="PENDING",
        Description=f"proxy:{staff_account_id}|center:{center_id}|{schedule_mode}",
        ExpiresAt=expires_at,
        ProxyCreatedByAccountId=staff_account_id,
        ProxyAgreementIsAdult=(
            legacy_is_adult_for_agreement_type(resolved_agreement_type)
            if needs_agreement
            else None
        ),
        ProxyAgreementType=resolved_agreement_type if needs_agreement else None,
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
        notify_target_counselor=notify_target_counselor,
    )

    return {
        "orderId": order.Id,
        "scheduleId": schedule.Id,
        "outTradeNo": out_trade_no,
        "totalFee": total_fee,
        "totalFeeYuan": total_fee / 100,
        "isFreeOrder": int(total_fee or 0) <= 0,
        "expiresAt": expires_at.isoformat(),
        "message": (
            "已推送免费单"
            if int(total_fee or 0) <= 0
            else proxy_order_ttl_push_message(ttl_minutes)
        ),
        "proxyOrderTtlMinutes": ttl_minutes,
    }
