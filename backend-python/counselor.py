"""
3.1 咨询师工作台接口
GET  /api/mini/counselor/schedules          今日及近期排班
POST /api/mini/counselor/schedules          新增排班
PUT  /api/mini/counselor/schedules/{id}     修改排班（取消/备注）
GET  /api/mini/counselor/consultations      咨询单列表（按状态筛选）
PUT  /api/mini/counselor/consultations/{id} 更新咨询单状态（确认/完成/取消）
GET  /api/mini/counselor/case-records       个案记录列表
POST /api/mini/counselor/case-records       新建个案记录
PUT  /api/mini/counselor/case-records/{id}  更新个案记录
"""

from datetime import datetime, timedelta, date as date_type, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, OperationalError

from auth import get_current_account, AppAccount
from database import get_db
from models import (
    AppSchedule,
    AppConsultation,
    AppCaseRecord,
    AppRoleBinding,
    AppCounselorProfile,
    AppLeaveRequest,
    AppOrder,
    AppScheduleCancelLog,
)
from app_time import china_now
from consultation_cancel import has_appointment_started, is_refund_eligible
from schedule_meta import (
    CENTER_NAMES,
    CONSULTATION_ROOMS,
    center_display_name,
    display_room_id,
    get_consultation_rooms,
    is_video_center,
    parse_center_id,
    parse_room_id,
    room_display_name,
    release_assigned_room,
    schedule_pref_note,
)
from room_slot_status import resolve_slot_manual_status, is_slot_operational
from schedule_display import resolve_schedule_display, DISPLAY_LABELS
from schedule_slots import (
    ROLLING_WINDOW_DAYS,
    active_schedules_at,
    all_slot_bounds_for_date,
    counselor_has_slot,
    has_available_room_at_center,
    is_aligned_standard_slot,
    paid_occupied_rooms_at_center,
    rolling_window_end,
    rolling_window_datetime_bounds,
    validate_slot_in_rolling_window,
)

router = APIRouter(prefix="/api/mini/counselor", tags=["Counselor"])


# ---------------------------------------------------------------------------
# 权限检查：当前账号必须绑定了 Counselor 角色
# ---------------------------------------------------------------------------

def require_counselor(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType == "Counselor",
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无咨询师权限")
    return current_account


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ScheduleCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    note: Optional[str] = None
    center_id: Optional[str] = None
    room_id: Optional[str] = None


class ScheduleUpdate(BaseModel):
    status: Optional[str] = None   # AVAILABLE / CANCELLED
    note: Optional[str] = None
    center_id: Optional[str] = None
    room_id: Optional[str] = None
    communication_screenshot_url: Optional[str] = None
    leave_reason: Optional[str] = None


class RoomSlotOption(BaseModel):
    roomId: str
    roomName: str
    available: bool
    occupiedBySelf: bool = False
    occupiedByOther: bool = False
    otherCounselorId: Optional[int] = None


class TimeSlotOption(BaseModel):
    key: str
    startTime: datetime
    endTime: datetime
    label: str
    past: bool
    counselorOccupied: bool
    counselorScheduleId: Optional[int] = None
    allRoomsFull: bool = False
    rooms: List[RoomSlotOption]


class SlotOptionsOut(BaseModel):
    date: str
    centerId: str
    centerName: str
    slots: List[TimeSlotOption]


class LeaveRequestCreate(BaseModel):
    reason: str


class ScheduleOut(BaseModel):
    Id: int
    CounselorId: int
    StartTime: datetime
    EndTime: datetime
    Status: str
    Note: Optional[str] = None
    CreatedAt: datetime

    class Config:
        from_attributes = True


class ScheduleCalendarItem(BaseModel):
    id: int
    startTime: datetime
    endTime: datetime
    status: str
    displayStatus: str
    displayLabel: str
    centerId: Optional[str] = None
    centerName: Optional[str] = None
    roomId: Optional[str] = None
    roomName: Optional[str] = None
    patientName: Optional[str] = None
    consultationId: Optional[int] = None
    consultationStatus: Optional[str] = None
    canCancel: bool = False
    requiresLeave: bool = False
    cancelHint: Optional[str] = None
    leaveRequestId: Optional[int] = None
    leaveReason: Optional[str] = None
    leaveSubmittedAt: Optional[datetime] = None
    leaveStatus: Optional[str] = None


class ScheduleCalendarOut(BaseModel):
    startDate: str
    days: int
    slots: List[ScheduleCalendarItem]


class ConsultationUpdate(BaseModel):
    status: str   # CONFIRMED / ONGOING / DONE / CANCELLED
    note: Optional[str] = None


class ConsultationOut(BaseModel):
    Id: int
    PatientId: int
    CounselorId: int
    ScheduleId: Optional[int] = None
    Status: str
    StartTime: Optional[datetime] = None
    EndTime: Optional[datetime] = None
    Note: Optional[str] = None
    CreatedAt: datetime

    class Config:
        from_attributes = True


class CaseRecordCreate(BaseModel):
    consultation_id: int
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None


class CaseRecordUpdate(BaseModel):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None


class CaseRecordOut(BaseModel):
    Id: int
    ConsultationId: int
    CounselorId: int
    Subjective: Optional[str] = None
    Objective: Optional[str] = None
    Assessment: Optional[str] = None
    Plan: Optional[str] = None
    CreatedAt: datetime
    UpdatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class CounselorProfilePayload(BaseModel):
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    title: Optional[str] = None
    specialty: Optional[str] = None
    field: Optional[str] = None
    introduce: Optional[str] = None
    career: Optional[str] = None
    qualification: Optional[str] = None
    billing: Optional[int] = None
    consultHours: Optional[int] = None
    workYears: Optional[int] = None
    isActive: Optional[bool] = True


# ---------------------------------------------------------------------------
# 排班接口
# ---------------------------------------------------------------------------

def _build_schedule_note(body: ScheduleCreate) -> Optional[str]:
    if body.center_id:
        if is_video_center(body.center_id):
            return schedule_pref_note(body.center_id)
        pref = (body.room_id or "").strip() or None
        return schedule_pref_note(body.center_id, pref)
    return body.note


def _resolve_calendar_room(
    schedule: AppSchedule,
    consultation: Optional[AppConsultation],
    center_id: Optional[str],
    db: Session,
) -> tuple[Optional[str], Optional[str]]:
    """返回 (roomId, roomName) 供工作台展示。"""
    if is_video_center(center_id):
        if schedule.Status == "BOOKED" or _active_consultation(consultation):
            return None, "线上视频（不占咨询室）"
        return None, None

    room_id = display_room_id(schedule.Note, schedule.Status)
    if not room_id and consultation and consultation.Note:
        room_id = parse_room_id(consultation.Note)

    is_booked = schedule.Status == "BOOKED" or _active_consultation(consultation)
    if is_booked and room_id:
        name = room_display_name(center_id, room_id, db) or room_id
        return room_id, f"咨询室 {name}"

    if schedule.Status == "AVAILABLE" and center_id:
        pref_id = display_room_id(schedule.Note, schedule.Status)
        if pref_id:
            name = room_display_name(center_id, pref_id, db) or pref_id
            return pref_id, f"{name}（偏好）"
        return None, "无偏好"

    return room_id, room_display_name(center_id, room_id, db) if room_id else None


def _active_consultation(consultation: Optional[AppConsultation]) -> bool:
    return consultation is not None and consultation.Status in ("PENDING", "CONFIRMED", "ONGOING")


def _has_active_booking(schedule: AppSchedule, consultation: Optional[AppConsultation]) -> bool:
    if schedule.Status == "BOOKED":
        return True
    return _active_consultation(consultation)


def _cancel_permissions(schedule: AppSchedule, consultation: Optional[AppConsultation]) -> tuple[bool, bool, Optional[str]]:
    """返回 (canCancel, requiresLeave, hint)。"""
    if schedule.Status == "CANCELLED":
        return False, False, "当前状态不可取消"

    if has_appointment_started(schedule.StartTime):
        return False, False, "咨询已开始或已过开始时间，不可取消"

    if not _has_active_booking(schedule, consultation):
        if schedule.Status == "AVAILABLE":
            return True, False, "未预约挂课可随时取消或修改咨询室偏好"
        return False, False, "当前状态不可取消"

    if _active_consultation(consultation):
        if is_refund_eligible(schedule.StartTime):
            return (
                True,
                False,
                "取消前请与来访者提前沟通并上传沟通截图。取消后将通知来访者并协助改约。",
            )
        return (
            True,
            True,
            "取消前请与来访者提前沟通并上传沟通截图。距咨询开始不足24小时，取消后不予退款，须协助来访者改约。",
        )

    # 已标 BOOKED 但无有效咨询单（数据异常），仍允许直接取消
    return True, False, "确认取消该挂课？"


def _counselor_cancel_booked(
    db: Session,
    schedule: AppSchedule,
    counselor_id: int,
    *,
    leave_reason: Optional[str] = None,
    communication_screenshot_url: Optional[str] = None,
) -> None:
    """咨询师取消/请假已预约挂课：须填写理由并上传沟通截图，取消后释放咨询室。"""
    reason = (leave_reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="请填写请假原因")
    screenshot = (communication_screenshot_url or "").strip()
    if not screenshot:
        raise HTTPException(status_code=400, detail="请上传与来访者的沟通截图后再取消")
    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule.Id,
            AppConsultation.CounselorId == counselor_id,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if consultation:
        consultation.Status = "CANCELLED"
        consultation.UpdatedAt = datetime.utcnow()
        if consultation.OrderId:
            order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
            if order and order.Status == "PAID":
                order.Status = "REFUNDED" if is_refund_eligible(schedule.StartTime) else "CANCELLED"
                order.UpdatedAt = datetime.utcnow()
    db.add(
        AppLeaveRequest(
            ScheduleId=schedule.Id,
            CounselorId=counselor_id,
            Reason=reason,
            Status="APPROVED",
        )
    )
    db.add(
        AppScheduleCancelLog(
            ScheduleId=schedule.Id,
            CounselorId=counselor_id,
            ConsultationId=consultation.Id if consultation else None,
            ScreenshotUrl=screenshot,
        )
    )
    schedule.Status = "CANCELLED"
    schedule.Note = release_assigned_room(schedule.Note)
    schedule.UpdatedAt = datetime.utcnow()


def _pending_leaves_by_schedule(
    db: Session,
    schedule_ids: List[int],
    counselor_id: int,
) -> dict[int, AppLeaveRequest]:
    """查询待审核请假；若 AppLeaveRequest 表尚未建表则返回空（避免日历接口 500）。"""
    if not schedule_ids:
        return {}
    try:
        rows = (
            db.query(AppLeaveRequest)
            .filter(
                AppLeaveRequest.ScheduleId.in_(schedule_ids),
                AppLeaveRequest.CounselorId == counselor_id,
                AppLeaveRequest.Status == "PENDING",
            )
            .all()
        )
        return {r.ScheduleId: r for r in rows}
    except (ProgrammingError, OperationalError):
        db.rollback()
        return {}


def _calendar_items_for_schedules(
    db: Session,
    schedules: List[AppSchedule],
    counselor_id: int,
) -> List[ScheduleCalendarItem]:
    if not schedules:
        return []
    schedule_ids = [s.Id for s in schedules]
    consultations = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId.in_(schedule_ids),
            AppConsultation.Status != "CANCELLED",
        )
        .all()
    )
    cons_by_schedule = {c.ScheduleId: c for c in consultations if c.ScheduleId}

    leave_by_schedule = _pending_leaves_by_schedule(db, schedule_ids, counselor_id)

    patient_ids = {c.PatientId for c in consultations}
    patients = {
        a.Id: a
        for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
    } if patient_ids else {}

    items: List[ScheduleCalendarItem] = []
    for s in schedules:
        c = cons_by_schedule.get(s.Id)
        leave_row = leave_by_schedule.get(s.Id)
        center_id = parse_center_id(s.Note)
        room_id, room_name = _resolve_calendar_room(s, c, center_id, db)
        patient = patients.get(c.PatientId) if c else None
        patient_name = None
        if patient:
            patient_name = patient.RealName or patient.Nickname or f"来访者#{patient.Id}"

        if leave_row:
            display = "ON_LEAVE"
            display_label = DISPLAY_LABELS.get("ON_LEAVE", "已请假")
            can_cancel, requires_leave, cancel_hint = False, False, None
        else:
            display = resolve_schedule_display(s, c)
            display_label = DISPLAY_LABELS.get(display, display)
            can_cancel, requires_leave, cancel_hint = _cancel_permissions(s, c)

        items.append(
            ScheduleCalendarItem(
                id=s.Id,
                startTime=s.StartTime,
                endTime=s.EndTime,
                status=s.Status,
                displayStatus=display,
                displayLabel=display_label,
                centerId=center_id,
                centerName=center_display_name(center_id),
                roomId=room_id,
                roomName=room_name,
                patientName=patient_name,
                consultationId=c.Id if c else None,
                consultationStatus=c.Status if c else None,
                canCancel=can_cancel,
                requiresLeave=requires_leave,
                cancelHint=cancel_hint,
                leaveRequestId=leave_row.Id if leave_row else None,
                leaveReason=leave_row.Reason if leave_row else None,
                leaveSubmittedAt=leave_row.CreatedAt if leave_row else None,
                leaveStatus=leave_row.Status if leave_row else None,
            )
        )
    return items


@router.get("/schedules", response_model=List[ScheduleOut], summary="获取排班列表")
def list_schedules(
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AppSchedule)
        .filter(AppSchedule.CounselorId == counselor.Id)
        .order_by(AppSchedule.StartTime)
        .all()
    )
    return rows


@router.get("/schedules/slot-options", response_model=SlotOptionsOut, summary="某日标准时间槽与咨询室占用")
def schedule_slot_options(
    date: str = Query(..., description="YYYY-MM-DD"),
    center_id: str = Query(..., description="预约中心 id"),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    """滚动 7 天内某日各标准时段 + 各咨询室是否可挂。"""
    try:
        slot_date = date_type.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")

    today = china_now().date()
    if slot_date < today or slot_date > rolling_window_end(today):
        raise HTTPException(
            status_code=400,
            detail=f"仅可选择今天起 {ROLLING_WINDOW_DAYS} 天内日期",
        )

    now = china_now()
    if not is_video_center(center_id) and not get_consultation_rooms(db, center_id):
        raise HTTPException(status_code=400, detail="无效的预约中心")

    options: List[TimeSlotOption] = []
    rooms = [] if is_video_center(center_id) else get_consultation_rooms(db, center_id)
    for start_dt, end_dt in all_slot_bounds_for_date(slot_date):
        key = start_dt.strftime("%H:%M")
        label = f"{key} – {end_dt.strftime('%H:%M')}"
        past = start_dt <= now
        self_row = next(
            (r for r in active_schedules_at(db, start_dt) if r.CounselorId == counselor.Id),
            None,
        )
        room_opts: List[RoomSlotOption] = []
        usable_room_ids = []
        paid_occupied = paid_occupied_rooms_at_center(db, center_id, start_dt) if rooms else set()
        for room in rooms:
            slot_status = resolve_slot_manual_status(
                db, room.get("dbId"), start_dt, "AVAILABLE",
            )
            room_ok = is_slot_operational(slot_status)
            if room_ok:
                usable_room_ids.append(room["id"])
            paid_taken = room["id"] in paid_occupied
            available = not past and room_ok
            room_opts.append(
                RoomSlotOption(
                    roomId=room["id"],
                    roomName=room["name"],
                    available=available,
                    occupiedBySelf=False,
                    occupiedByOther=paid_taken,
                    otherCounselorId=None,
                )
            )
        all_rooms_full = False if is_video_center(center_id) else (
            self_row is not None or (
                bool(usable_room_ids)
                and not has_available_room_at_center(db, center_id, start_dt, usable_room_ids)
            )
        )
        options.append(
            TimeSlotOption(
                key=key,
                startTime=start_dt,
                endTime=end_dt,
                label=label,
                past=past,
                counselorOccupied=self_row is not None,
                counselorScheduleId=self_row.Id if self_row else None,
                allRoomsFull=all_rooms_full,
                rooms=room_opts,
            )
        )

    return SlotOptionsOut(
        date=date,
        centerId=center_id,
        centerName=center_display_name(center_id) or center_id,
        slots=options,
    )


@router.get("/schedules/calendar", response_model=ScheduleCalendarOut, summary="滚动7天排班日历")
def schedule_calendar(
    start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD，默认今天"),
    days: int = Query(7, ge=1, le=7),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    """滚动 7 天：从今天起连续 7 天。"""
    today = china_now().date()
    start_date = today
    if start:
        try:
            requested = date_type.fromisoformat(start)
        except ValueError:
            raise HTTPException(status_code=400, detail="start 格式应为 YYYY-MM-DD")
        if requested < today or requested > rolling_window_end(today):
            raise HTTPException(status_code=400, detail=f"仅可查看今天起 {ROLLING_WINDOW_DAYS} 天内日历")
        start_date = requested

    start_dt = datetime.combine(start_date, time.min)
    _, end_dt = rolling_window_datetime_bounds(today)

    schedules = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor.Id,
            AppSchedule.StartTime >= start_dt,
            AppSchedule.StartTime < end_dt,
        )
        .order_by(AppSchedule.StartTime.asc())
        .all()
    )

    return ScheduleCalendarOut(
        startDate=start_date.isoformat(),
        days=days,
        slots=_calendar_items_for_schedules(db, schedules, counselor.Id),
    )


@router.post("/schedules", response_model=ScheduleOut, summary="新增挂课（标准时间槽+咨询室偏好）")
def create_schedule(
    body: ScheduleCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    if not body.center_id:
        raise HTTPException(status_code=400, detail="必须选择预约中心")
    if body.center_id not in CENTER_NAMES:
        raise HTTPException(status_code=400, detail="无效的预约中心")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=400, detail="结束时间必须晚于开始时间")
    if not is_aligned_standard_slot(body.start_time, body.end_time):
        raise HTTPException(status_code=400, detail="请使用标准时间槽挂课（50分钟/节）")
    try:
        validate_slot_in_rolling_window(body.start_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if counselor_has_slot(db, counselor.Id, body.start_time):
        raise HTTPException(status_code=400, detail="您在该时间槽已有挂课，同一时段最多一节")

    if not is_video_center(body.center_id):
        rooms = get_consultation_rooms(db, body.center_id)
        usable_room_ids = []
        for r in rooms:
            slot_status = resolve_slot_manual_status(
                db, r.get("dbId"), body.start_time, "AVAILABLE",
            )
            if is_slot_operational(slot_status):
                usable_room_ids.append(r["id"])
        if not usable_room_ids:
            raise HTTPException(status_code=400, detail="该中心暂无可用咨询室")
        if not has_available_room_at_center(
            db, body.center_id, body.start_time, usable_room_ids,
        ):
            raise HTTPException(
                status_code=400,
                detail="该时段所有咨询室均已约满，无法挂课",
            )

        pref = (body.room_id or "").strip() or None
        if pref and pref not in {r["id"] for r in rooms}:
            raise HTTPException(status_code=400, detail="无效的咨询室偏好")

    schedule = AppSchedule(
        CounselorId=counselor.Id,
        StartTime=body.start_time,
        EndTime=body.end_time,
        Status="AVAILABLE",
        Note=_build_schedule_note(body),
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.put("/schedules/{schedule_id}", response_model=ScheduleOut, summary="更新/取消排班")
def update_schedule(
    schedule_id: int,
    body: ScheduleUpdate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    schedule = db.query(AppSchedule).filter(
        AppSchedule.Id == schedule_id,
        AppSchedule.CounselorId == counselor.Id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="排班不存在")

    if body.status == "CANCELLED":
        consultation = (
            db.query(AppConsultation)
            .filter(
                AppConsultation.ScheduleId == schedule.Id,
                AppConsultation.CounselorId == counselor.Id,
                AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
            )
            .first()
        )
        if has_appointment_started(schedule.StartTime):
            raise HTTPException(status_code=400, detail="咨询已开始或已过开始时间，不可取消")
        if _has_active_booking(schedule, consultation):
            if _active_consultation(consultation):
                _counselor_cancel_booked(
                    db,
                    schedule,
                    counselor.Id,
                    leave_reason=body.leave_reason,
                    communication_screenshot_url=body.communication_screenshot_url,
                )
            else:
                schedule.Status = "CANCELLED"
                schedule.Note = release_assigned_room(schedule.Note)
        elif schedule.Status == "AVAILABLE":
            schedule.Status = "CANCELLED"
        else:
            raise HTTPException(status_code=400, detail="当前状态不可取消")
    elif body.center_id is not None and schedule.Status == "AVAILABLE":
        pref = (body.room_id or "").strip() or None
        if pref:
            rooms = get_consultation_rooms(db, body.center_id)
            if pref not in {r["id"] for r in rooms}:
                raise HTTPException(status_code=400, detail="无效的咨询室偏好")
        schedule.Note = schedule_pref_note(body.center_id, pref)
    elif body.note is not None:
        schedule.Note = body.note

    schedule.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(schedule)
    return schedule


@router.post("/schedules/{schedule_id}/leave-request", summary="提交请假申请（不足24h已预约）")
def submit_leave_request(
    schedule_id: int,
    body: LeaveRequestCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    schedule = db.query(AppSchedule).filter(
        AppSchedule.Id == schedule_id,
        AppSchedule.CounselorId == counselor.Id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="排班不存在")
    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule_id,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if has_appointment_started(schedule.StartTime):
        raise HTTPException(status_code=400, detail="咨询已开始或已过开始时间，不可申请请假")
    if is_refund_eligible(schedule.StartTime):
        raise HTTPException(status_code=400, detail="距咨询开始超过24小时，可直接取消挂课")
    if schedule.Status != "BOOKED" and not _active_consultation(consultation):
        raise HTTPException(status_code=400, detail="仅已预约时段可申请请假")

    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="请填写请假原因")

    pending = (
        db.query(AppLeaveRequest)
        .filter(
            AppLeaveRequest.ScheduleId == schedule_id,
            AppLeaveRequest.CounselorId == counselor.Id,
            AppLeaveRequest.Status == "PENDING",
        )
        .first()
    )
    if pending:
        raise HTTPException(status_code=400, detail="该时段已有待审核的请假申请")

    row = AppLeaveRequest(
        ScheduleId=schedule_id,
        CounselorId=counselor.Id,
        Reason=reason,
        Status="PENDING",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "message": "请假申请已提交，请等待审核并协助来访者改约",
        "leaveRequestId": row.Id,
        "submittedAt": row.CreatedAt,
    }


# ---------------------------------------------------------------------------
# 咨询单接口
# ---------------------------------------------------------------------------

@router.get("/consultations", response_model=List[ConsultationOut], summary="获取咨询单列表")
def list_consultations(
    status: Optional[str] = None,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    q = db.query(AppConsultation).filter(AppConsultation.CounselorId == counselor.Id)
    if status:
        q = q.filter(AppConsultation.Status == status)
    return q.order_by(AppConsultation.CreatedAt.desc()).all()


@router.put("/consultations/{consultation_id}", response_model=ConsultationOut, summary="更新咨询单状态")
def update_consultation(
    consultation_id: int,
    body: ConsultationUpdate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    allowed = {"CONFIRMED", "ONGOING", "DONE", "CANCELLED"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"无效状态，可选值：{allowed}")

    consultation = db.query(AppConsultation).filter(
        AppConsultation.Id == consultation_id,
        AppConsultation.CounselorId == counselor.Id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="咨询单不存在")

    consultation.Status = body.status
    if body.note is not None:
        consultation.Note = body.note
    if body.status == "ONGOING" and not consultation.StartTime:
        consultation.StartTime = datetime.utcnow()
    if body.status == "DONE" and not consultation.EndTime:
        consultation.EndTime = datetime.utcnow()

    if body.status == "CANCELLED" and consultation.ScheduleId:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if schedule and schedule.Status == "BOOKED":
            schedule.Note = release_assigned_room(schedule.Note)
            schedule.Status = "AVAILABLE"
            schedule.UpdatedAt = datetime.utcnow()

    consultation.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(consultation)
    return consultation


# ---------------------------------------------------------------------------
# 个案记录接口
# ---------------------------------------------------------------------------

@router.get("/case-records", response_model=List[CaseRecordOut], summary="获取个案记录列表")
def list_case_records(
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    return (
        db.query(AppCaseRecord)
        .filter(AppCaseRecord.CounselorId == counselor.Id)
        .order_by(AppCaseRecord.CreatedAt.desc())
        .all()
    )


@router.post("/case-records", response_model=CaseRecordOut, summary="新建个案记录")
def create_case_record(
    body: CaseRecordCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    record = AppCaseRecord(
        ConsultationId=body.consultation_id,
        CounselorId=counselor.Id,
        Subjective=body.subjective,
        Objective=body.objective,
        Assessment=body.assessment,
        Plan=body.plan,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/case-records/{record_id}", response_model=CaseRecordOut, summary="更新个案记录")
def update_case_record(
    record_id: int,
    body: CaseRecordUpdate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    record = db.query(AppCaseRecord).filter(
        AppCaseRecord.Id == record_id,
        AppCaseRecord.CounselorId == counselor.Id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="个案记录不存在")

    for field in ("Subjective", "Objective", "Assessment", "Plan"):
        val = getattr(body, field.lower(), None)
        if val is not None:
            setattr(record, field, val)
    record.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# 个人资料与统计
# ---------------------------------------------------------------------------

def _profile_to_dict(profile: AppCounselorProfile):
    return {
        "id": profile.Id,
        "accountId": profile.AccountId,
        "name": profile.Name,
        "avatarUrl": profile.AvatarUrl,
        "title": profile.Title,
        "specialty": profile.Specialty,
        "field": profile.Field,
        "introduce": profile.Introduce,
        "career": profile.Career,
        "qualification": profile.Qualification,
        "billing": profile.Billing,
        "consultHours": profile.ConsultHours,
        "workYears": profile.WorkYears,
        "isActive": profile.IsActive,
    }


@router.get("/profile", summary="获取咨询师个人资料")
def get_profile(
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    profile = db.query(AppCounselorProfile).filter(
        AppCounselorProfile.AccountId == counselor.Id
    ).first()
    if not profile:
        profile = AppCounselorProfile(
            AccountId=counselor.Id,
            Name=counselor.Nickname,
            AvatarUrl=counselor.AvatarUrl,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return _profile_to_dict(profile)


@router.put("/profile", summary="更新咨询师个人资料")
def update_profile(
    body: CounselorProfilePayload,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    profile = db.query(AppCounselorProfile).filter(
        AppCounselorProfile.AccountId == counselor.Id
    ).first()
    if not profile:
        profile = AppCounselorProfile(AccountId=counselor.Id)
        db.add(profile)

    mapping = {
        "name": "Name",
        "avatarUrl": "AvatarUrl",
        "title": "Title",
        "specialty": "Specialty",
        "field": "Field",
        "introduce": "Introduce",
        "career": "Career",
        "qualification": "Qualification",
        "billing": "Billing",
        "consultHours": "ConsultHours",
        "workYears": "WorkYears",
        "isActive": "IsActive",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(profile, dst, val)
    profile.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return _profile_to_dict(profile)


@router.get("/stats", summary="咨询师统计看板")
def counselor_stats(
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    total = db.query(AppConsultation).filter(
        AppConsultation.CounselorId == counselor.Id
    ).count()
    month_total = db.query(AppConsultation).filter(
        AppConsultation.CounselorId == counselor.Id,
        AppConsultation.CreatedAt >= month_start,
    ).count()
    pending = db.query(AppConsultation).filter(
        AppConsultation.CounselorId == counselor.Id,
        AppConsultation.Status == "PENDING",
    ).count()
    done = db.query(AppConsultation).filter(
        AppConsultation.CounselorId == counselor.Id,
        AppConsultation.Status == "DONE",
    ).count()
    profile = db.query(AppCounselorProfile).filter(
        AppCounselorProfile.AccountId == counselor.Id
    ).first()
    billing = profile.Billing if profile else 0
    return {
        "totalConsultations": total,
        "monthConsultations": month_total,
        "pendingConsultations": pending,
        "doneConsultations": done,
        "estimatedRevenue": done * billing,
    }
