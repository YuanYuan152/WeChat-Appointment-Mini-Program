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
)
from app_time import china_now
from consultation_cancel import has_appointment_started, is_refund_eligible
from schedule_meta import (
    CONSULTATION_ROOMS,
    center_display_name,
    parse_center_id,
    parse_room_id,
    room_display_name,
    schedule_note,
)
from schedule_display import DISPLAY_LABELS, resolve_schedule_display
from schedule_slots import (
    ROLLING_WINDOW_DAYS,
    active_schedules_at,
    all_slot_bounds_for_date,
    counselor_has_slot,
    is_aligned_standard_slot,
    room_occupied_at_center,
    rolling_window_end,
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
        return schedule_note(body.center_id, body.room_id)
    return body.note


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
            return True, False, "未预约挂课可随时取消或改约咨询室"
        return False, False, "当前状态不可取消"

    if _active_consultation(consultation):
        if is_refund_eligible(schedule.StartTime):
            return (
                True,
                False,
                "取消前请与来访者提前沟通。取消后将通知来访者并协助改约。",
            )
        return (
            False,
            True,
            "距咨询开始不足24小时，须先走请假流程，请假通过后方可取消该挂课。",
        )

    # 已标 BOOKED 但无有效咨询单（数据异常），仍允许直接取消
    return True, False, "确认取消该挂课？"


def _counselor_cancel_booked(
    db: Session,
    schedule: AppSchedule,
    counselor_id: int,
) -> None:
    """距开始≥24h：咨询师取消已预约挂课。"""
    if not is_refund_eligible(schedule.StartTime):
        raise HTTPException(
            status_code=400,
            detail="距咨询开始不足24小时，不能直接取消，请提交请假申请",
        )
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
    schedule.Status = "CANCELLED"
    schedule.UpdatedAt = datetime.utcnow()


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

    leave_rows = (
        db.query(AppLeaveRequest)
        .filter(
            AppLeaveRequest.ScheduleId.in_(schedule_ids),
            AppLeaveRequest.CounselorId == counselor_id,
            AppLeaveRequest.Status == "PENDING",
        )
        .all()
    )
    leave_by_schedule = {r.ScheduleId: r for r in leave_rows}

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
        room_id = parse_room_id(s.Note)
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
                roomName=room_display_name(center_id, room_id),
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
    rooms = CONSULTATION_ROOMS.get(center_id, [])
    if not rooms:
        raise HTTPException(status_code=400, detail="无效的预约中心")

    options: List[TimeSlotOption] = []
    for start_dt, end_dt in all_slot_bounds_for_date(slot_date):
        key = start_dt.strftime("%H:%M")
        label = f"{key} – {end_dt.strftime('%H:%M')}"
        past = start_dt <= now
        self_row = next(
            (r for r in active_schedules_at(db, start_dt) if r.CounselorId == counselor.Id),
            None,
        )
        room_opts: List[RoomSlotOption] = []
        for room in rooms:
            occ = room_occupied_at_center(db, center_id, room["id"], start_dt)
            occupied_by_self = bool(occ and occ.CounselorId == counselor.Id)
            occupied_by_other = bool(occ and occ.CounselorId != counselor.Id)
            available = not past and occ is None
            room_opts.append(
                RoomSlotOption(
                    roomId=room["id"],
                    roomName=room["name"],
                    available=available,
                    occupiedBySelf=occupied_by_self,
                    occupiedByOther=occupied_by_other,
                    otherCounselorId=occ.CounselorId if occupied_by_other and occ else None,
                )
            )
        all_rooms_full = bool(room_opts) and all(not r.available for r in room_opts)
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
    end_dt = datetime.combine(rolling_window_end(today) + timedelta(days=1), time.min)

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


@router.post("/schedules", response_model=ScheduleOut, summary="新增挂课（标准时间槽+咨询室）")
def create_schedule(
    body: ScheduleCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    if not body.center_id or not body.room_id:
        raise HTTPException(status_code=400, detail="必须选择预约中心与咨询室")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=400, detail="结束时间必须晚于开始时间")
    if not is_aligned_standard_slot(body.start_time, body.end_time):
        raise HTTPException(status_code=400, detail="请使用标准时间槽挂课（50分钟/节）")
    try:
        validate_slot_in_rolling_window(body.start_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if counselor_has_slot(db, counselor.Id, body.start_time):
        raise HTTPException(status_code=400, detail="您在该时间槽已有挂课，同一时段最多一间咨询室")

    if not body.center_id:
        raise HTTPException(status_code=400, detail="请选择预约中心")
    occ = room_occupied_at_center(db, body.center_id, body.room_id, body.start_time)
    if occ:
        if occ.CounselorId == counselor.Id:
            raise HTTPException(status_code=400, detail="您已在该时段占用此咨询室")
        raise HTTPException(status_code=400, detail="该咨询室在此时段已被其他咨询师预约")

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
                if not is_refund_eligible(schedule.StartTime):
                    raise HTTPException(
                        status_code=400,
                        detail="距咨询开始不足24小时，不能直接取消，请走请假流程",
                    )
                _counselor_cancel_booked(db, schedule, counselor.Id)
            else:
                schedule.Status = "CANCELLED"
        elif schedule.Status == "AVAILABLE":
            schedule.Status = "CANCELLED"
        else:
            raise HTTPException(status_code=400, detail="当前状态不可取消")
    elif body.center_id and body.room_id and schedule.Status == "AVAILABLE":
        occ = room_occupied_at_center(
            db, body.center_id, body.room_id, schedule.StartTime, exclude_id=schedule.Id,
        )
        if occ and occ.CounselorId != counselor.Id:
            raise HTTPException(status_code=400, detail="该咨询室在此时段已被其他咨询师占用")
        schedule.Note = schedule_note(body.center_id, body.room_id)
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
