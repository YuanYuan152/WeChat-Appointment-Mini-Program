"""
3.1 咨询师工作台接口
GET  /api/mini/counselor/schedules          今日及近期排期
POST /api/mini/counselor/schedules          新增排期
PUT  /api/mini/counselor/schedules/{id}     修改排期（取消/备注）
GET  /api/mini/counselor/consultations      咨询单列表（按状态筛选）
PUT  /api/mini/counselor/consultations/{id} 更新咨询单状态（确认/完成/取消）
GET  /api/mini/counselor/consultations/completed 已完成咨询（含个案记录摘要）
GET  /api/mini/counselor/case-records/{id}        个案记录详情
GET  /api/mini/counselor/case-records/{id}/revisions  个案记录历史版本
"""

from datetime import datetime, timedelta, date as date_type, time
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, OperationalError

from case_record_service import (
    apply_case_record_fields,
    case_record_has_content,
    case_record_header_info,
    case_record_photo_urls,
    case_record_risk_assessment,
    decode_photo_urls,
    decode_risk_assessment,
    decode_header_info,
    build_default_header_info,
    save_case_record_revision,
    validate_case_record_required_fields,
    reject_if_case_record_locked,
    get_crisis_level_choice,
    notify_admins_crisis_report_if_needed,
)
from model_compat import optional_model_value
from consultation_status_service import mark_consultation_done
from case_record_amendment_service import (
    latest_amendment_for_record,
    submit_amendment_request,
)
from auth import get_current_account, AppAccount
from database import get_db
from models import (
    AppSchedule,
    AppConsultation,
    AppCaseRecord,
    AppCaseRecordRevision,
    AppCaseRecordAmendmentRequest,
    AppRoleBinding,
    AppCounselorProfile,
    AppLeaveRequest,
    AppOrder,
    AppScheduleCancelLog,
)
from app_time import china_now
from consultation_cancel import has_appointment_started, is_refund_eligible, refund_order_for_counselor_leave
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
from schedule_display import resolve_schedule_display, DISPLAY_LABELS, is_consultation_recordable
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
from pricing_service import resolve_revenue_share_cents
from patient_contract_service import batch_patient_contract_extras
from leave_request_service import acquire_leave_schedule_lock

router = APIRouter(prefix="/api/mini/counselor", tags=["Counselor"])


# ---------------------------------------------------------------------------
# 权限检查：当前账号必须绑定了 Counselor 角色
# ---------------------------------------------------------------------------

def require_counselor(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    from role_active import get_account_role

    if get_account_role(db, current_account.Id) != "Counselor":
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
    communication_screenshot_url: Optional[str] = None


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
    patientContractTag: Optional[str] = None
    consultationId: Optional[int] = None
    consultationStatus: Optional[str] = None
    canCancel: bool = False
    requiresLeave: bool = False
    cancelHint: Optional[str] = None
    leaveRequestId: Optional[int] = None
    leaveReason: Optional[str] = None
    leaveSubmittedAt: Optional[datetime] = None
    leaveStatus: Optional[str] = None
    hasCaseRecord: bool = False
    caseRecordId: Optional[int] = None


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
    risk_assessment: Optional[Dict[str, Any]] = None
    header_info: Optional[Dict[str, Any]] = None
    photo_urls: Optional[List[str]] = None


class CaseRecordUpdate(BaseModel):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    risk_assessment: Optional[Dict[str, Any]] = None
    header_info: Optional[Dict[str, Any]] = None
    photo_urls: Optional[List[str]] = None


class CaseRecordOut(BaseModel):
    Id: int
    ConsultationId: int
    CounselorId: int
    Subjective: Optional[str] = None
    Objective: Optional[str] = None
    Assessment: Optional[str] = None
    Plan: Optional[str] = None
    RiskAssessment: Optional[Dict[str, Any]] = None
    HeaderInfo: Optional[Dict[str, Any]] = None
    PhotoUrls: List[str] = []
    CreatedAt: datetime
    UpdatedAt: Optional[datetime] = None
    AmendmentStatus: Optional[str] = None
    AmendmentId: Optional[int] = None
    AmendmentRejectReason: Optional[str] = None

    @classmethod
    def from_record(
        cls,
        record: AppCaseRecord,
        amendment: Optional[AppCaseRecordAmendmentRequest] = None,
    ) -> "CaseRecordOut":
        risk_assessment = case_record_risk_assessment(record)
        header_info = case_record_header_info(record)
        photo_urls = case_record_photo_urls(record)
        out = cls(
            Id=record.Id,
            ConsultationId=record.ConsultationId,
            CounselorId=record.CounselorId,
            Subjective=record.Subjective,
            Objective=record.Objective,
            Assessment=record.Assessment,
            Plan=record.Plan,
            RiskAssessment=risk_assessment,
            HeaderInfo=header_info,
            PhotoUrls=photo_urls,
            CreatedAt=record.CreatedAt,
            UpdatedAt=record.UpdatedAt,
        )
        if amendment:
            out.AmendmentStatus = amendment.Status
            out.AmendmentId = amendment.Id
            if amendment.Status == "REJECTED":
                out.AmendmentRejectReason = optional_model_value(amendment, "RejectReason")
        return out


class CaseRecordAmendmentCreate(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    risk_assessment: Dict[str, Any]
    header_info: Dict[str, Any]
    photo_urls: Optional[List[str]] = None
    reason: Optional[str] = None


class CaseRecordFormDefaultsOut(BaseModel):
    ConsultationId: int
    HeaderInfo: Dict[str, Any]


class CaseRecordRevisionOut(BaseModel):
    Id: int
    CaseRecordId: int
    ConsultationId: int
    Subjective: Optional[str] = None
    Objective: Optional[str] = None
    Assessment: Optional[str] = None
    Plan: Optional[str] = None
    RiskAssessment: Optional[Dict[str, Any]] = None
    HeaderInfo: Optional[Dict[str, Any]] = None
    PhotoUrls: List[str] = []
    RevisedAt: datetime
    RevisedBy: int

    @classmethod
    def from_revision(cls, row: AppCaseRecordRevision) -> "CaseRecordRevisionOut":
        risk_assessment = decode_risk_assessment(optional_model_value(row, "RiskAssessment"))
        header_info = decode_header_info(optional_model_value(row, "HeaderInfo"))
        photo_urls = decode_photo_urls(optional_model_value(row, "PhotoUrls"))
        return cls(
            Id=row.Id,
            CaseRecordId=row.CaseRecordId,
            ConsultationId=row.ConsultationId,
            Subjective=row.Subjective,
            Objective=row.Objective,
            Assessment=row.Assessment,
            Plan=row.Plan,
            RiskAssessment=risk_assessment,
            HeaderInfo=header_info,
            PhotoUrls=photo_urls,
            RevisedAt=row.RevisedAt,
            RevisedBy=row.RevisedBy,
        )


class CompletedConsultationOut(BaseModel):
    Id: int
    PatientId: int
    PatientName: str
    PatientContractTag: Optional[str] = None
    StartTime: Optional[datetime] = None
    EndTime: Optional[datetime] = None
    Note: Optional[str] = None
    CaseRecordId: Optional[int] = None
    HasRecord: bool = False
    RecordUpdatedAt: Optional[datetime] = None
    PhotoCount: int = 0


class CounselorProfilePayload(BaseModel):
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    title: Optional[str] = None
    specialty: Optional[str] = None
    field: Optional[str] = None
    introduce: Optional[str] = None
    career: Optional[str] = None
    qualification: Optional[str] = None
    targetGroup: Optional[str] = None
    mode: Optional[str] = None
    consultHours: Optional[int] = None
    workYears: Optional[int] = None
    isActive: Optional[bool] = True


class AuthenticityCommitmentPayload(BaseModel):
    signerName: str
    agreed: bool = True


class DashboardDetailItem(BaseModel):
    id: int
    title: str
    subtitle: Optional[str] = None
    extra: Optional[str] = None
    amount: Optional[int] = None
    personalIncome: Optional[int] = None
    patientId: Optional[int] = None
    patientMobile: Optional[str] = None
    patientContractTag: Optional[str] = None
    orderId: Optional[int] = None
    consultationId: Optional[int] = None
    caseRecordId: Optional[int] = None
    caseRecordStatus: Optional[str] = None
    status: Optional[str] = None


def _resolve_dashboard_range(
    period: Optional[str],
    start: Optional[str],
    end: Optional[str],
) -> tuple[Optional[datetime], Optional[datetime]]:
    now = china_now()
    if start and end:
        try:
            range_start = datetime.combine(date_type.fromisoformat(start), time.min)
            range_end = datetime.combine(date_type.fromisoformat(end), time.min) + timedelta(days=1)
            return range_start, range_end
        except ValueError:
            raise HTTPException(status_code=400, detail="start/end 格式应为 YYYY-MM-DD")
    p = (period or "month").lower()
    if p == "all":
        return None, None
    if p == "quarter":
        return now - timedelta(days=90), now + timedelta(days=1)
    if p == "half_year":
        return now - timedelta(days=180), now + timedelta(days=1)
    return datetime(now.year, now.month, 1), now + timedelta(days=1)


def _consultation_time(c: AppConsultation) -> Optional[datetime]:
    return c.StartTime or c.EndTime or c.CreatedAt


def _consultation_in_range(
    c: AppConsultation,
    range_start: Optional[datetime],
    range_end: Optional[datetime],
) -> bool:
    if not range_start and not range_end:
        return True
    ref = _consultation_time(c)
    if not ref:
        return False
    if range_start and ref < range_start:
        return False
    if range_end and ref >= range_end:
        return False
    return True


def _format_dt_short(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M")


def _compute_dashboard_stats(
    db: Session,
    counselor: AppAccount,
    range_start: Optional[datetime],
    range_end: Optional[datetime],
) -> dict:
    profile = db.query(AppCounselorProfile).filter(
        AppCounselorProfile.AccountId == counselor.Id
    ).first()
    billing = profile.Billing if profile else 0

    consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.CounselorId == counselor.Id)
        .all()
    )
    in_range = [c for c in consultations if _consultation_in_range(c, range_start, range_end)]

    done_in_range = [c for c in in_range if c.Status == "DONE"]
    order_ids = {c.OrderId for c in done_in_range if c.OrderId}
    orders_by_id = {}
    if order_ids:
        orders_by_id = {
            o.Id: o
            for o in db.query(AppOrder).filter(AppOrder.Id.in_(order_ids)).all()
        }

    completed_order_count = 0
    completed_order_revenue = 0
    personal_income = 0
    for c in done_in_range:
        order = orders_by_id.get(c.OrderId) if c.OrderId else None
        if order and order.Status == "PAID":
            completed_order_count += 1
            amount = order.TotalFee or 0
            completed_order_revenue += amount
            personal_income += resolve_revenue_share_cents(db, c.PatientId, counselor.Id, amount)
        elif not order:
            completed_order_count += 1
            amount = billing or 0
            completed_order_revenue += amount
            personal_income += resolve_revenue_share_cents(db, c.PatientId, counselor.Id, amount)

    case_records = (
        db.query(AppCaseRecord)
        .filter(AppCaseRecord.CounselorId == counselor.Id)
        .all()
    )
    consultation_map = {c.Id: c for c in consultations}
    case_record_count = 0
    for record in case_records:
        if not case_record_has_content(record):
            continue
        cons = consultation_map.get(record.ConsultationId)
        ref = record.UpdatedAt or record.CreatedAt
        if cons and cons.StartTime:
            ref = cons.StartTime
        if range_start and ref and ref < range_start:
            continue
        if range_end and ref and ref >= range_end:
            continue
        case_record_count += 1

    total_appointments = sum(1 for c in in_range if c.Status != "CANCELLED")

    leave_rows = (
        db.query(AppLeaveRequest)
        .filter(AppLeaveRequest.CounselorId == counselor.Id)
        .all()
    )
    leave_count = 0
    for row in leave_rows:
        ref = row.CreatedAt
        if range_start and ref < range_start:
            continue
        if range_end and ref >= range_end:
            continue
        leave_count += 1

    return {
        "completedOrderCount": completed_order_count,
        "completedOrderRevenue": completed_order_revenue,
        "personalIncome": personal_income,
        "caseRecordCount": case_record_count,
        "totalAppointments": total_appointments,
        "leaveCount": leave_count,
    }


# ---------------------------------------------------------------------------
# 排期接口
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
            return True, False, "未预约排期可随时取消或修改咨询室偏好"
        return False, False, "当前状态不可取消"

    if _active_consultation(consultation):
        if is_refund_eligible(schedule.StartTime):
            return (
                True,
                True,
                "取消前请与来访者提前沟通并上传沟通截图。提交后须等待管理工作台审核通过，审核通过后将通知来访者并协助改约。",
            )
        return (
            True,
            True,
            "取消前请与来访者提前沟通并上传沟通截图。提交后须等待管理工作台审核通过；审核通过后来访者将全额退款，请协助改约。",
        )

    # 即使历史数据缺失有效咨询单，BOOKED 也代表该时段已经对来访生效。
    # 统一走请假审核，避免通过数据异常绕过管理工作台。
    return (
        True,
        True,
        "该时段已预约。请与来访者沟通并上传截图，提交后等待管理工作台审核。",
    )


def _counselor_cancel_booked(
    db: Session,
    schedule: AppSchedule,
    counselor_id: int,
    *,
    leave_reason: Optional[str] = None,
    communication_screenshot_url: Optional[str] = None,
) -> None:
    """咨询师取消/请假已预约排期：须填写理由并上传沟通截图，取消后释放咨询室。"""
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
        refunded = refund_order_for_counselor_leave(db, consultation)
        from counselor_message_service import (
            cancel_counselor_consultation_done_notices,
            cancel_counselor_consultation_reminders,
        )
        from patient_message_service import (
            cancel_patient_consultation_reminders,
            notify_patient_counselor_leave_approved,
        )
        from consultation_status_service import cancel_consultation_auto_done_tasks

        cancel_counselor_consultation_reminders(db, consultation.Id)
        cancel_counselor_consultation_done_notices(db, consultation.Id)
        cancel_consultation_auto_done_tasks(db, consultation.Id)
        cancel_patient_consultation_reminders(db, consultation.Id)
        notify_patient_counselor_leave_approved(
            db,
            consultation,
            leave_reason=reason,
            refunded=refunded,
        )
    db.add(
        AppLeaveRequest(
            ScheduleId=schedule.Id,
            CounselorId=counselor_id,
            Reason=reason,
            Status="APPROVED",
        )
    )
    db.flush()
    leave_row = (
        db.query(AppLeaveRequest)
        .filter(
            AppLeaveRequest.ScheduleId == schedule.Id,
            AppLeaveRequest.CounselorId == counselor_id,
        )
        .order_by(AppLeaveRequest.CreatedAt.desc())
        .first()
    )
    if leave_row:
        from counselor_message_service import notify_counselor_leave_success

        notify_counselor_leave_success(
            db,
            counselor_id=counselor_id,
            schedule=schedule,
            leave_reason=reason,
            leave_request_id=leave_row.Id,
            consultation=consultation,
        )
    db.add(
        AppScheduleCancelLog(
            ScheduleId=schedule.Id,
            CounselorId=counselor_id,
            ConsultationId=consultation.Id if consultation else None,
            LeaveRequestId=leave_row.Id if leave_row else None,
            ScreenshotUrl=screenshot,
        )
    )
    schedule.Status = "CANCELLED"
    schedule.Note = release_assigned_room(schedule.Note)
    schedule.UpdatedAt = datetime.utcnow()


def _leaves_by_schedule(
    db: Session,
    schedule_ids: List[int],
    counselor_id: int,
) -> dict[int, AppLeaveRequest]:
    """每条排期最近一条有效请假（待审核或已通过）。"""
    if not schedule_ids:
        return {}
    try:
        rows = (
            db.query(AppLeaveRequest)
            .filter(
                AppLeaveRequest.ScheduleId.in_(schedule_ids),
                AppLeaveRequest.CounselorId == counselor_id,
                AppLeaveRequest.Status.in_(["PENDING", "APPROVED"]),
            )
            .order_by(AppLeaveRequest.CreatedAt.desc())
            .all()
        )
        result: dict[int, AppLeaveRequest] = {}
        for row in rows:
            if row.ScheduleId not in result:
                result[row.ScheduleId] = row
        return result
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
    all_consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.ScheduleId.in_(schedule_ids))
        .order_by(AppConsultation.Id.desc())
        .all()
    )
    active_by_schedule: dict[int, AppConsultation] = {}
    any_by_schedule: dict[int, AppConsultation] = {}
    for c in all_consultations:
        if not c.ScheduleId:
            continue
        if c.ScheduleId not in any_by_schedule:
            any_by_schedule[c.ScheduleId] = c
        if c.Status != "CANCELLED" and c.ScheduleId not in active_by_schedule:
            active_by_schedule[c.ScheduleId] = c

    leave_by_schedule = _leaves_by_schedule(db, schedule_ids, counselor_id)

    from proxy_booking_service import pending_proxy_orders_for_schedules

    pending_proxy_map = pending_proxy_orders_for_schedules(db, schedule_ids)

    consultation_ids = list({c.Id for c in all_consultations if c.Id})
    case_records_by_consultation: dict[int, AppCaseRecord] = {}
    if consultation_ids:
        case_records_by_consultation = {
            r.ConsultationId: r
            for r in db.query(AppCaseRecord)
            .filter(
                AppCaseRecord.CounselorId == counselor_id,
                AppCaseRecord.ConsultationId.in_(consultation_ids),
            )
            .all()
        }

    patient_ids = {c.PatientId for c in all_consultations}
    patient_ids.update(
        order.AccountId
        for order in pending_proxy_map.values()
        if order.AccountId
    )
    patients = {
        a.Id: a
        for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
    } if patient_ids else {}

    items: List[ScheduleCalendarItem] = []
    for s in schedules:
        c = active_by_schedule.get(s.Id)
        pending_proxy_order = pending_proxy_map.get(s.Id)
        leave_row = leave_by_schedule.get(s.Id)
        # 待支付代理预约尚未创建咨询单。此时应显示订单对应的来访，不能回退到
        # 同一排期可能残留的历史已取消咨询单。
        display_cons = c or (None if pending_proxy_order else any_by_schedule.get(s.Id))
        center_id = parse_center_id(s.Note)
        room_id, room_name = _resolve_calendar_room(s, c, center_id, db)
        display_patient_id = (
            display_cons.PatientId
            if display_cons
            else pending_proxy_order.AccountId
            if pending_proxy_order
            else None
        )
        patient = patients.get(display_patient_id) if display_patient_id else None
        patient_name = None
        patient_contract_tag = None
        if patient:
            from patient_contract_service import patient_contract_extras

            patient_name = (
                patient.RealName
                or patient.Nickname
                or patient.Mobile
                or f"来访者#{patient.Id}"
            )
            patient_contract_tag = patient_contract_extras(db, patient).get("contractTag")

        if leave_row:
            display = "ON_LEAVE"
            display_label = (
                "请假审核中"
                if leave_row.Status == "PENDING"
                else DISPLAY_LABELS.get("ON_LEAVE", "已请假")
            )
            can_cancel, requires_leave, cancel_hint = False, False, None
        elif pending_proxy_order:
            display = "PENDING_PAYMENT"
            display_label = DISPLAY_LABELS.get("PENDING_PAYMENT", "待支付")
            can_cancel, requires_leave, cancel_hint = False, False, None
        else:
            display = resolve_schedule_display(s, c)
            display_label = DISPLAY_LABELS.get(display, display)
            can_cancel, requires_leave, cancel_hint = _cancel_permissions(s, c)

        case_record = None
        has_record = False
        if display_cons:
            case_record = case_records_by_consultation.get(display_cons.Id)
            has_record = case_record_has_content(case_record)
        if display == "DONE" and has_record:
            display_label = "咨询已填写"

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
                patientContractTag=patient_contract_tag,
                consultationId=display_cons.Id if display_cons else None,
                consultationStatus=display_cons.Status if display_cons else None,
                canCancel=can_cancel,
                requiresLeave=requires_leave,
                cancelHint=cancel_hint,
                leaveRequestId=leave_row.Id if leave_row else None,
                leaveReason=leave_row.Reason if leave_row else None,
                leaveSubmittedAt=leave_row.CreatedAt if leave_row else None,
                leaveStatus=leave_row.Status if leave_row else None,
                hasCaseRecord=has_record,
                caseRecordId=case_record.Id if case_record else None,
            )
        )
    return items


@router.get("/schedules", response_model=List[ScheduleOut], summary="获取排期列表")
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
    """滚动窗口内某日各标准时段 + 各咨询室是否可挂。"""
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
                db,
                room.get("dbId"),
                start_dt,
                room.get("status", "AVAILABLE"),
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
            self_row is not None
            or not usable_room_ids
            or not has_available_room_at_center(db, center_id, start_dt, usable_room_ids)
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


def build_schedule_calendar_for_counselor(
    db: Session,
    counselor_id: int,
    *,
    start: Optional[str] = None,
    days: int = ROLLING_WINDOW_DAYS,
    past_days: int = 0,
    month: Optional[str] = None,
) -> ScheduleCalendarOut:
    """按咨询师 ID 构建排期日历（咨询师端与管理端共用）。"""
    today = china_now().date()

    if month:
        try:
            year_s, mon_s = month.split("-", 1)
            year_i, mon_i = int(year_s), int(mon_s)
            if mon_i < 1 or mon_i > 12:
                raise ValueError
            start_date = date_type(year_i, mon_i, 1)
            if mon_i == 12:
                end_date = date_type(year_i + 1, 1, 1)
            else:
                end_date = date_type(year_i, mon_i + 1, 1)
            span_days = (end_date - start_date).days
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="month 格式应为 YYYY-MM")
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.min)
        schedules = (
            db.query(AppSchedule)
            .filter(
                AppSchedule.CounselorId == counselor_id,
                AppSchedule.StartTime >= start_dt,
                AppSchedule.StartTime < end_dt,
            )
            .order_by(AppSchedule.StartTime.asc())
            .all()
        )
        return ScheduleCalendarOut(
            startDate=start_date.isoformat(),
            days=span_days,
            slots=_calendar_items_for_schedules(db, schedules, counselor_id),
        )

    earliest_date = today - timedelta(days=past_days)
    start_date = earliest_date
    if start:
        try:
            requested = date_type.fromisoformat(start)
        except ValueError:
            raise HTTPException(status_code=400, detail="start 格式应为 YYYY-MM-DD")
        if requested < earliest_date or requested > rolling_window_end(today):
            raise HTTPException(
                status_code=400,
                detail=f"仅可查看 {earliest_date.isoformat()} ~ {rolling_window_end(today).isoformat()} 内日历",
            )
        start_date = requested

    start_dt = datetime.combine(start_date, time.min)
    _, end_dt = rolling_window_datetime_bounds(today)

    schedules = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.StartTime >= start_dt,
            AppSchedule.StartTime < end_dt,
        )
        .order_by(AppSchedule.StartTime.asc())
        .all()
    )

    total_days = (rolling_window_end(today) - start_date).days + 1

    return ScheduleCalendarOut(
        startDate=start_date.isoformat(),
        days=total_days,
        slots=_calendar_items_for_schedules(db, schedules, counselor_id),
    )


@router.get("/schedules/calendar", response_model=ScheduleCalendarOut, summary="滚动排期日历")
def schedule_calendar(
    start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD，默认今天"),
    days: int = Query(ROLLING_WINDOW_DAYS, ge=1, le=ROLLING_WINDOW_DAYS * 2),
    past_days: int = Query(
        0,
        ge=0,
        le=ROLLING_WINDOW_DAYS,
        description="向前追溯天数（用于普通模式查看已完成咨询/咨询记录筛选）",
    ),
    month: Optional[str] = Query(None, description="按月查看 YYYY-MM（日历模式）"),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    """滚动窗口：默认从今天起连续 ROLLING_WINDOW_DAYS 天；可指定 past_days 包含历史已完成排期；或指定 month 查看整月。"""
    return build_schedule_calendar_for_counselor(
        db,
        counselor.Id,
        start=start,
        days=days,
        past_days=past_days,
        month=month,
    )


@router.post("/schedules", response_model=ScheduleOut, summary="新增排期（标准时间槽+咨询室偏好）")
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
        raise HTTPException(status_code=400, detail="请使用标准时间槽排期（50分钟/节）")
    try:
        validate_slot_in_rolling_window(body.start_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if counselor_has_slot(db, counselor.Id, body.start_time):
        raise HTTPException(status_code=400, detail="您在该时间槽已有排期，同一时段最多一节")

    if not is_video_center(body.center_id):
        rooms = get_consultation_rooms(db, body.center_id)
        usable_room_ids = []
        for r in rooms:
            slot_status = resolve_slot_manual_status(
                db,
                r.get("dbId"),
                body.start_time,
                r.get("status", "AVAILABLE"),
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
                detail="该时段所有咨询室均已约满，无法排期",
            )

        pref = (body.room_id or "").strip() or None
        if pref and pref not in usable_room_ids:
            raise HTTPException(status_code=400, detail="咨询室偏好在该时段不可用")

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


@router.put("/schedules/{schedule_id}", response_model=ScheduleOut, summary="更新/取消排期")
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
        raise HTTPException(status_code=404, detail="排期不存在")

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
            raise HTTPException(
                status_code=400,
                detail="已预约时段请提交请假申请，待管理工作台审核通过后方可取消",
            )
        elif schedule.Status == "AVAILABLE":
            schedule.Status = "CANCELLED"
        else:
            raise HTTPException(status_code=400, detail="当前状态不可取消")
    elif body.center_id is not None and schedule.Status == "AVAILABLE":
        pref = (body.room_id or "").strip() or None
        if pref:
            rooms = get_consultation_rooms(db, body.center_id)
            selected_room = next((room for room in rooms if room["id"] == pref), None)
            if not selected_room:
                raise HTTPException(status_code=400, detail="无效的咨询室偏好")
            slot_status = resolve_slot_manual_status(
                db,
                selected_room.get("dbId"),
                schedule.StartTime,
                selected_room.get("status", "AVAILABLE"),
            )
            if not is_slot_operational(slot_status):
                raise HTTPException(status_code=400, detail="咨询室偏好在该时段不可用")
        schedule.Note = schedule_pref_note(body.center_id, pref)
    elif body.note is not None:
        schedule.Note = body.note

    schedule.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(schedule)
    return schedule


@router.post("/schedules/{schedule_id}/leave-request", summary="提交请假申请（已预约须审核）")
def submit_leave_request(
    schedule_id: int,
    body: LeaveRequestCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    try:
        acquire_leave_schedule_lock(db, schedule_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    schedule = db.query(AppSchedule).filter(
        AppSchedule.Id == schedule_id,
        AppSchedule.CounselorId == counselor.Id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="排期不存在")
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
    if schedule.Status != "BOOKED" and not _active_consultation(consultation):
        raise HTTPException(status_code=400, detail="仅已预约时段可申请请假")

    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="请填写请假原因")
    screenshot = (body.communication_screenshot_url or "").strip()
    if not screenshot:
        raise HTTPException(status_code=400, detail="请上传与来访者的沟通截图")

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
    db.flush()
    db.add(
        AppScheduleCancelLog(
            ScheduleId=schedule_id,
            CounselorId=counselor.Id,
            ConsultationId=consultation.Id if consultation else None,
            LeaveRequestId=row.Id,
            ScreenshotUrl=screenshot,
        )
    )
    from counselor_message_service import notify_counselor_leave_submitted
    from staff_message_service import notify_staff_counselor_leave

    notify_staff_counselor_leave(
        db,
        schedule=schedule,
        counselor_id=counselor.Id,
        leave_reason=reason,
        screenshot_url=screenshot,
        consultation=consultation,
    )
    notify_counselor_leave_submitted(
        db,
        counselor_id=counselor.Id,
        schedule=schedule,
        leave_reason=reason,
        leave_request_id=row.Id,
        consultation=consultation,
    )
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
    if body.status == "CANCELLED":
        raise HTTPException(
            status_code=400,
            detail="已预约咨询不可直接取消，请在对应排期提交请假申请并等待审核",
        )
    allowed = {"CONFIRMED", "ONGOING", "DONE"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"无效状态，可选值：{allowed}")

    consultation = db.query(AppConsultation).filter(
        AppConsultation.Id == consultation_id,
        AppConsultation.CounselorId == counselor.Id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="咨询单不存在")

    schedule = None
    if consultation.ScheduleId:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()

    if body.note is not None:
        consultation.Note = body.note

    if body.status == "ONGOING":
        if not consultation.StartTime:
            consultation.StartTime = datetime.utcnow()
        consultation.Status = body.status
    elif body.status == "DONE":
        from consultation_status_service import cancel_consultation_auto_done_tasks, mark_consultation_done
        from counselor_message_service import notify_counselor_consultation_done

        cancel_consultation_auto_done_tasks(db, consultation.Id)
        mark_consultation_done(db, consultation, schedule)
        notify_counselor_consultation_done(db, consultation)
    else:
        consultation.Status = body.status

    consultation.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(consultation)
    return consultation


def _patient_display_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "来访者"
    return (account.RealName or account.Nickname or account.Mobile or "来访者").strip()


def _load_consultation_schedule(
    db: Session, consultation: AppConsultation
) -> Optional[AppSchedule]:
    if not consultation.ScheduleId:
        return None
    return db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()


def _get_recordable_consultation(
    db: Session,
    counselor_id: int,
    consultation_id: int,
) -> tuple[AppConsultation, Optional[AppSchedule]]:
    consultation = db.query(AppConsultation).filter(
        AppConsultation.Id == consultation_id,
        AppConsultation.CounselorId == counselor_id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="咨询单不存在")
    schedule = _load_consultation_schedule(db, consultation)
    if not is_consultation_recordable(consultation, schedule):
        raise HTTPException(status_code=400, detail="咨询尚未结束，暂不可填写记录")
    return consultation, schedule


def _list_recordable_consultations(db: Session, counselor_id: int) -> List[AppConsultation]:
    rows = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.CounselorId == counselor_id,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING", "DONE"]),
        )
        .order_by(AppConsultation.EndTime.desc(), AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
        .all()
    )
    if not rows:
        return []
    schedule_ids = {c.ScheduleId for c in rows if c.ScheduleId}
    schedules = {
        s.Id: s
        for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all()
    } if schedule_ids else {}
    return [
        c for c in rows
        if is_consultation_recordable(c, schedules.get(c.ScheduleId) if c.ScheduleId else None)
    ]


@router.get(
    "/consultations/completed",
    response_model=List[CompletedConsultationOut],
    summary="已完成咨询列表（含个案记录摘要）",
)
def list_completed_consultations(
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    consultations = _list_recordable_consultations(db, counselor.Id)
    if not consultations:
        return []

    consultation_ids = [c.Id for c in consultations]
    patient_ids = {c.PatientId for c in consultations}
    patients = {
        a.Id: a
        for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
    }
    patient_contracts = batch_patient_contract_extras(db, list(patients.values()))
    records = {
        r.ConsultationId: r
        for r in db.query(AppCaseRecord)
        .filter(
            AppCaseRecord.CounselorId == counselor.Id,
            AppCaseRecord.ConsultationId.in_(consultation_ids),
        )
        .all()
    }

    result: List[CompletedConsultationOut] = []
    for c in consultations:
        record = records.get(c.Id)
        photo_count = len(case_record_photo_urls(record)) if record else 0
        has_content = case_record_has_content(record)
        result.append(
            CompletedConsultationOut(
                Id=c.Id,
                PatientId=c.PatientId,
                PatientName=_patient_display_name(patients.get(c.PatientId)),
                PatientContractTag=patient_contracts.get(c.PatientId, {}).get("contractTag"),
                StartTime=c.StartTime,
                EndTime=c.EndTime,
                Note=c.Note,
                CaseRecordId=record.Id if record else None,
                HasRecord=has_content,
                RecordUpdatedAt=record.UpdatedAt or record.CreatedAt if record else None,
                PhotoCount=photo_count,
            )
        )
    return result


# ---------------------------------------------------------------------------
# 个案记录接口
# ---------------------------------------------------------------------------

@router.get(
    "/case-records/form-defaults",
    response_model=CaseRecordFormDefaultsOut,
    summary="咨询记录表头默认值（新建时预填）",
)
def get_case_record_form_defaults(
    consultation_id: int = Query(..., description="咨询单 ID"),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    consultation, schedule = _get_recordable_consultation(db, counselor.Id, consultation_id)
    return CaseRecordFormDefaultsOut(
        ConsultationId=consultation.Id,
        HeaderInfo=build_default_header_info(db, consultation, schedule, counselor.Id),
    )


@router.get("/case-records", response_model=List[CaseRecordOut], summary="获取个案记录列表")
def list_case_records(
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AppCaseRecord)
        .filter(AppCaseRecord.CounselorId == counselor.Id)
        .order_by(AppCaseRecord.CreatedAt.desc())
        .all()
    )
    return [CaseRecordOut.from_record(r, latest_amendment_for_record(db, r.Id)) for r in rows]


@router.get("/case-records/{record_id}", response_model=CaseRecordOut, summary="获取个案记录详情")
def get_case_record(
    record_id: int,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    record = db.query(AppCaseRecord).filter(
        AppCaseRecord.Id == record_id,
        AppCaseRecord.CounselorId == counselor.Id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="个案记录不存在")
    amendment = latest_amendment_for_record(db, record.Id)
    return CaseRecordOut.from_record(record, amendment)


@router.get(
    "/case-records/{record_id}/revisions",
    response_model=List[CaseRecordRevisionOut],
    summary="个案记录历史版本",
)
def list_case_record_revisions(
    record_id: int,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    record = db.query(AppCaseRecord).filter(
        AppCaseRecord.Id == record_id,
        AppCaseRecord.CounselorId == counselor.Id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="个案记录不存在")
    rows = (
        db.query(AppCaseRecordRevision)
        .filter(AppCaseRecordRevision.CaseRecordId == record_id)
        .order_by(AppCaseRecordRevision.RevisedAt.desc())
        .all()
    )
    return [CaseRecordRevisionOut.from_revision(r) for r in rows]


@router.post("/case-records", response_model=CaseRecordOut, summary="新建个案记录")
def create_case_record(
    body: CaseRecordCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    consultation, schedule = _get_recordable_consultation(
        db, counselor.Id, body.consultation_id
    )
    mark_consultation_done(db, consultation, schedule)

    validate_case_record_required_fields(
        subjective=body.subjective,
        objective=body.objective,
        assessment=body.assessment,
        plan=body.plan,
        risk_assessment=body.risk_assessment,
        header_info=body.header_info,
    )

    existing = db.query(AppCaseRecord).filter(
        AppCaseRecord.ConsultationId == body.consultation_id,
        AppCaseRecord.CounselorId == counselor.Id,
    ).first()
    if existing:
        reject_if_case_record_locked(existing)
        old_crisis_choice = get_crisis_level_choice(case_record_risk_assessment(existing))
        apply_case_record_fields(
            existing,
            subjective=body.subjective,
            objective=body.objective,
            assessment=body.assessment,
            plan=body.plan,
            risk_assessment=body.risk_assessment,
            risk_assessment_set=True,
            header_info=body.header_info,
            header_info_set=True,
            photo_urls=[],
            photo_urls_set=True,
        )
        existing.UpdatedAt = datetime.utcnow()
        notify_admins_crisis_report_if_needed(
            db, existing, counselor_id=counselor.Id, old_crisis_choice=old_crisis_choice
        )
        db.commit()
        db.refresh(existing)
        return CaseRecordOut.from_record(existing)

    record = AppCaseRecord(
        ConsultationId=body.consultation_id,
        CounselorId=counselor.Id,
    )
    apply_case_record_fields(
        record,
        subjective=body.subjective,
        objective=body.objective,
        assessment=body.assessment,
        plan=body.plan,
        risk_assessment=body.risk_assessment,
        risk_assessment_set=True,
        header_info=body.header_info,
        header_info_set=True,
        photo_urls=[],
        photo_urls_set=True,
    )
    db.add(record)
    db.flush()
    notify_admins_crisis_report_if_needed(
        db, record, counselor_id=counselor.Id, old_crisis_choice=""
    )
    db.commit()
    db.refresh(record)
    return CaseRecordOut.from_record(record)


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

    reject_if_case_record_locked(record)
    raise HTTPException(status_code=403, detail="咨询记录提交后不可修改")


@router.post(
    "/case-records/{record_id}/amendment-requests",
    response_model=CaseRecordOut,
    summary="提交咨询记录修改申请（需管理员审核）",
)
def create_case_record_amendment(
    record_id: int,
    body: CaseRecordAmendmentCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    record = db.query(AppCaseRecord).filter(
        AppCaseRecord.Id == record_id,
        AppCaseRecord.CounselorId == counselor.Id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="个案记录不存在")

    amendment = submit_amendment_request(
        db,
        record,
        counselor.Id,
        subjective=body.subjective,
        objective=body.objective,
        assessment=body.assessment,
        plan=body.plan,
        risk_assessment=body.risk_assessment,
        header_info=body.header_info,
        photo_urls=body.photo_urls,
        reason=body.reason,
    )
    db.commit()
    db.refresh(record)
    return CaseRecordOut.from_record(record, amendment)


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
        "targetGroup": profile.TargetGroup,
        "mode": profile.Mode,
        "billing": profile.Billing,
        "consultHours": profile.ConsultHours,
        "workYears": profile.WorkYears,
        "isActive": profile.IsActive,
        "infoAuthenticityCommitted": bool(profile.InfoAuthenticityCommittedAt),
        "infoAuthenticityCommittedAt": profile.InfoAuthenticityCommittedAt,
        "infoAuthenticitySignerName": profile.InfoAuthenticitySignerName,
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


@router.post("/profile/authenticity-commitment", summary="签署信息真实可信承诺书")
def sign_authenticity_commitment(
    body: AuthenticityCommitmentPayload,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    raise HTTPException(status_code=403, detail="咨询师资料由平台统一维护，请联系运营更新")


@router.put("/profile", summary="更新咨询师个人资料")
def update_profile(
    body: CounselorProfilePayload,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    raise HTTPException(status_code=403, detail="咨询师资料由平台统一维护，请联系运营更新")


@router.get("/stats", summary="咨询师统计看板")
def counselor_stats(
    period: Optional[str] = Query("month", description="month|quarter|half_year|all"),
    start: Optional[str] = Query(None, description="自定义起始 YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="自定义结束 YYYY-MM-DD"),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    range_start, range_end = _resolve_dashboard_range(period, start, end)
    metrics = _compute_dashboard_stats(db, counselor, range_start, range_end)

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
        **metrics,
    }


@router.get(
    "/stats/details",
    response_model=List[DashboardDetailItem],
    summary="个人看板明细",
)
def counselor_stats_details(
    category: str = Query(
        ...,
        description="orders|case-records|appointments|leaves",
    ),
    period: Optional[str] = Query("month"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    range_start, range_end = _resolve_dashboard_range(period, start, end)
    cat = category.strip().lower()

    if cat == "orders":
        consultations = (
            db.query(AppConsultation)
            .filter(
                AppConsultation.CounselorId == counselor.Id,
                AppConsultation.Status == "DONE",
            )
            .order_by(AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
            .all()
        )
        consultations = [c for c in consultations if _consultation_in_range(c, range_start, range_end)]
        patient_ids = {c.PatientId for c in consultations}
        patients = {
            a.Id: a
            for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
        } if patient_ids else {}
        patient_contracts = batch_patient_contract_extras(db, list(patients.values()))
        order_ids = {c.OrderId for c in consultations if c.OrderId}
        orders_by_id = {
            o.Id: o
            for o in db.query(AppOrder).filter(AppOrder.Id.in_(order_ids)).all()
        } if order_ids else {}
        case_records = (
            db.query(AppCaseRecord)
            .filter(AppCaseRecord.ConsultationId.in_([c.Id for c in consultations]))
            .all()
        ) if consultations else []
        case_records_by_consultation = {row.ConsultationId: row for row in case_records}
        profile = db.query(AppCounselorProfile).filter(
            AppCounselorProfile.AccountId == counselor.Id
        ).first()
        billing = profile.Billing if profile else 0

        items: List[DashboardDetailItem] = []
        for c in consultations:
            order = orders_by_id.get(c.OrderId) if c.OrderId else None
            if order and order.Status != "PAID":
                continue
            amount = (order.TotalFee if order else billing) or 0
            patient = patients.get(c.PatientId)
            case_record = case_records_by_consultation.get(c.Id)
            has_record = bool(case_record and case_record_has_content(case_record))
            if order or not c.OrderId:
                items.append(
                    DashboardDetailItem(
                        id=c.Id,
                        title=_patient_display_name(patient),
                        subtitle=_format_dt_short(_consultation_time(c)),
                        extra=f"咨询单 #{c.Id}",
                        amount=amount,
                        personalIncome=resolve_revenue_share_cents(db, c.PatientId, counselor.Id, amount),
                        patientId=c.PatientId,
                        patientMobile=patient.Mobile if patient else None,
                        patientContractTag=patient_contracts.get(c.PatientId, {}).get("contractTag"),
                        orderId=order.Id if order else None,
                        consultationId=c.Id,
                        caseRecordId=case_record.Id if case_record else None,
                        caseRecordStatus="FILLED" if has_record else "PENDING",
                        status=c.Status,
                    )
                )
        return items

    if cat == "case-records":
        records = (
            db.query(AppCaseRecord)
            .filter(AppCaseRecord.CounselorId == counselor.Id)
            .order_by(AppCaseRecord.UpdatedAt.desc(), AppCaseRecord.Id.desc())
            .all()
        )
        consultation_ids = [r.ConsultationId for r in records]
        consultations = {
            c.Id: c
            for c in db.query(AppConsultation)
            .filter(AppConsultation.Id.in_(consultation_ids))
            .all()
        } if consultation_ids else {}
        patient_ids = {c.PatientId for c in consultations.values()}
        patients = {
            a.Id: a
            for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
        } if patient_ids else {}
        patient_contracts = batch_patient_contract_extras(db, list(patients.values()))

        items = []
        for record in records:
            if not case_record_has_content(record):
                continue
            cons = consultations.get(record.ConsultationId)
            ref = cons.StartTime if cons and cons.StartTime else (record.UpdatedAt or record.CreatedAt)
            if range_start and ref and ref < range_start:
                continue
            if range_end and ref and ref >= range_end:
                continue
            patient_name = _patient_display_name(patients.get(cons.PatientId)) if cons else "来访者"
            items.append(
                DashboardDetailItem(
                    id=record.Id,
                    title=patient_name,
                    subtitle=_format_dt_short(ref),
                    extra=f"照片 {len(case_record_photo_urls(record))} 张",
                    patientId=cons.PatientId if cons else None,
                    patientMobile=(patients.get(cons.PatientId).Mobile if cons and patients.get(cons.PatientId) else None),
                    patientContractTag=(
                        patient_contracts.get(cons.PatientId, {}).get("contractTag")
                        if cons else None
                    ),
                    consultationId=record.ConsultationId,
                    caseRecordId=record.Id,
                    status="FILLED",
                )
            )
        return items

    if cat == "appointments":
        consultations = (
            db.query(AppConsultation)
            .filter(
                AppConsultation.CounselorId == counselor.Id,
                AppConsultation.Status != "CANCELLED",
            )
            .order_by(AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
            .all()
        )
        consultations = [c for c in consultations if _consultation_in_range(c, range_start, range_end)]
        patient_ids = {c.PatientId for c in consultations}
        patients = {
            a.Id: a
            for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
        } if patient_ids else {}
        patient_contracts = batch_patient_contract_extras(db, list(patients.values()))
        status_labels = {
            "PENDING": "待确认",
            "CONFIRMED": "已确认",
            "ONGOING": "进行中",
            "DONE": "已完成",
        }
        return [
            DashboardDetailItem(
                id=c.Id,
                title=_patient_display_name(patients.get(c.PatientId)),
                subtitle=_format_dt_short(_consultation_time(c)),
                extra=status_labels.get(c.Status, c.Status),
                patientId=c.PatientId,
                patientMobile=(patients.get(c.PatientId).Mobile if patients.get(c.PatientId) else None),
                patientContractTag=patient_contracts.get(c.PatientId, {}).get("contractTag"),
                consultationId=c.Id,
                status=c.Status,
            )
            for c in consultations
        ]

    if cat == "leaves":
        rows = (
            db.query(AppLeaveRequest)
            .filter(AppLeaveRequest.CounselorId == counselor.Id)
            .order_by(AppLeaveRequest.CreatedAt.desc(), AppLeaveRequest.Id.desc())
            .all()
        )
        schedule_ids = [r.ScheduleId for r in rows]
        schedules = {
            s.Id: s
            for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all()
        } if schedule_ids else {}
        status_labels = {
            "PENDING": "待审核",
            "APPROVED": "已通过",
            "REJECTED": "已驳回",
        }
        items = []
        for row in rows:
            ref = row.CreatedAt
            if range_start and ref < range_start:
                continue
            if range_end and ref >= range_end:
                continue
            schedule = schedules.get(row.ScheduleId)
            slot_text = ""
            if schedule:
                slot_text = f"{_format_dt_short(schedule.StartTime)} – {_format_dt_short(schedule.EndTime)}"
            items.append(
                DashboardDetailItem(
                    id=row.Id,
                    title=slot_text or "排期记录",
                    subtitle=_format_dt_short(row.CreatedAt),
                    extra=status_labels.get(row.Status, row.Status),
                    status=row.Status,
                )
            )
        return items

    raise HTTPException(status_code=400, detail="category 应为 orders|case-records|appointments|leaves")


# ---------------------------------------------------------------------------
# 咨询师代理预约
# ---------------------------------------------------------------------------

class CounselorProxyPushOrderRequest(BaseModel):
    patient_id: int
    center_id: str
    start_time: datetime
    end_time: datetime
    room_id: Optional[str] = None
    schedule_id: Optional[int] = None


@router.get("/proxy-booking/patients", summary="搜索可代理预约的来访（标注绑定与签约状态）")
def counselor_proxy_search_patients(
    keyword: Optional[str] = Query(None),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    from proxy_booking_service import search_counselor_proxy_patients

    return {"items": search_counselor_proxy_patients(db, counselor.Id, keyword)}


@router.get("/proxy-booking/slot-options", summary="代理预约时间槽与咨询室占用")
def counselor_proxy_slot_options(
    date: str = Query(..., description="YYYY-MM-DD"),
    center_id: str = Query(...),
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    from proxy_booking_service import build_proxy_slot_options
    from schedule_meta import center_display_name

    try:
        slots = build_proxy_slot_options(db, counselor.Id, date, center_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "date": date,
        "centerId": center_id,
        "centerName": center_display_name(center_id) or center_id,
        "slots": slots,
    }


@router.post("/proxy-booking/push-order", summary="推送代理预约订单（待来访支付）")
def counselor_proxy_push_order(
    body: CounselorProxyPushOrderRequest,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    from models import AppAccount as PatientAccount
    from proxy_booking_service import push_proxy_order, validate_counselor_proxy_patient

    patient = (
        db.query(PatientAccount)
        .filter(PatientAccount.Id == body.patient_id, PatientAccount.IsActive == True)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=400, detail="来访不存在")
    try:
        validate_counselor_proxy_patient(db, patient, counselor.Id)
        result = push_proxy_order(
            db,
            staff_account_id=counselor.Id,
            patient_id=body.patient_id,
            counselor_id=counselor.Id,
            center_id=body.center_id,
            start_time=body.start_time,
            end_time=body.end_time,
            room_id=body.room_id,
            existing_schedule_id=body.schedule_id,
            agreement_is_adult=None,
            notify_target_counselor=False,
        )
        db.commit()
        return result
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
