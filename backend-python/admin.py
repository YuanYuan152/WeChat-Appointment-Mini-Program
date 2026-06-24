"""管理员轻控制台：最小角色绑定/解绑能力。"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from models import (
    AppAccount,
    AppCaseRecord,
    AppCaseRecordRevision,
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppCounselorProfile,
    AppLeaveRequest,
    AppRefundExemption,
    AppRoleBinding,
    AppSchedule,
)
from app_time import china_now
from schedule_meta import (
    center_display_name,
    display_room_id,
    is_video_center,
    parse_center_id,
    room_display_name,
)
from leave_request_service import (
    approve_leave_request,
    build_leave_request_out,
    reject_leave_request,
)
from case_record_service import decode_photo_urls, case_record_has_content
from refund_exemption_service import approve_refund_exemption, reject_refund_exemption
from case_record_amendment_service import approve_amendment, reject_amendment
from case_record_service import decode_photo_urls, snapshot_case_record

router = APIRouter(prefix="/api/mini/admin", tags=["Admin"])


def require_admin(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType == "Admin",
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无管理员权限")
    return current_account


def require_ops_or_admin(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    """豁免审核等工作台能力：运营与管理员均可处理。"""
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType.in_(["Ops", "Admin"]),
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无运营/管理员权限")
    return current_account


class BindRoleRequest(BaseModel):
    role: str
    target_id: Optional[int] = None


class RefundExemptionAdminOut(BaseModel):
    id: int
    consultationId: int
    accountId: int
    patientName: str
    patientMobile: Optional[str] = None
    counselorId: int
    counselorName: str
    amount: int
    reason: str
    screenshotUrl: Optional[str] = None
    status: str
    rejectReason: Optional[str] = None
    consultationStartTime: Optional[datetime] = None
    consultationStatus: Optional[str] = None
    createdAt: datetime
    reviewedAt: Optional[datetime] = None


class RejectRefundExemptionRequest(BaseModel):
    reject_reason: str = Field(..., min_length=1, max_length=1000)


class CaseRecordSnapshotOut(BaseModel):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    photoUrls: List[str] = []


class CaseRecordAmendmentAdminOut(BaseModel):
    id: int
    caseRecordId: int
    consultationId: int
    counselorId: int
    counselorName: str
    reason: Optional[str] = None
    status: str
    rejectReason: Optional[str] = None
    consultationStartTime: Optional[datetime] = None
    createdAt: datetime
    reviewedAt: Optional[datetime] = None
    current: CaseRecordSnapshotOut
    proposed: CaseRecordSnapshotOut


class RejectCaseRecordAmendmentRequest(BaseModel):
    reject_reason: str = Field(..., min_length=1, max_length=1000)


@router.get("/users", summary="管理员用户列表")
def list_admin_users(
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(AppAccount).order_by(AppAccount.Id.desc()).limit(100).all()
    return [
        {
            "id": u.Id,
            "mobile": u.Mobile,
            "nickname": u.Nickname,
            "activeRole": u.ActiveRole,
            "roles": [
                b.RoleType
                for b in db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == u.Id).all()
            ],
        }
        for u in users
    ]


@router.post("/users/{user_id}/roles", summary="绑定用户角色")
def bind_user_role(
    user_id: int,
    body: BindRoleRequest,
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(AppAccount).filter(AppAccount.Id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    existing = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == user_id,
        AppRoleBinding.RoleType == body.role,
    ).first()
    if existing:
        return {"message": "角色已存在"}
    binding = AppRoleBinding(AccountId=user_id, RoleType=body.role, TargetId=body.target_id)
    db.add(binding)
    db.commit()
    return {"message": "角色已绑定"}


@router.delete("/users/{user_id}/roles/{role}", summary="解绑用户角色")
def unbind_user_role(
    user_id: int,
    role: str,
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == user_id,
        AppRoleBinding.RoleType == role,
    ).first()
    if not binding:
        raise HTTPException(status_code=404, detail="角色绑定不存在")
    db.delete(binding)
    db.commit()
    return {"message": "角色已解绑"}


def _build_exemption_admin_out(
    db: Session,
    row: AppRefundExemption,
    consultation: Optional[AppConsultation],
) -> RefundExemptionAdminOut:
    patient = db.query(AppAccount).filter(AppAccount.Id == row.AccountId).first()
    counselor_id = consultation.CounselorId if consultation else 0
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
        if counselor_id
        else None
    )
    counselor_acc = (
        db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
        if counselor_id
        else None
    )
    counselor_name = (
        (prof.Name if prof and prof.Name else None)
        or (counselor_acc.Nickname if counselor_acc else None)
        or f"咨询师#{counselor_id}"
    )
    patient_name = (
        (patient.RealName if patient and patient.RealName else None)
        or (patient.Nickname if patient else None)
        or f"用户#{row.AccountId}"
    )
    return RefundExemptionAdminOut(
        id=row.Id,
        consultationId=row.ConsultationId,
        accountId=row.AccountId,
        patientName=patient_name,
        patientMobile=patient.Mobile if patient else None,
        counselorId=counselor_id,
        counselorName=counselor_name,
        amount=row.Amount,
        reason=row.Reason,
        screenshotUrl=row.ScreenshotUrl,
        status=row.Status,
        rejectReason=row.RejectReason,
        consultationStartTime=consultation.StartTime if consultation else None,
        consultationStatus=consultation.Status if consultation else None,
        createdAt=row.CreatedAt,
        reviewedAt=row.ReviewedAt,
    )


@router.get(
    "/refund-exemptions",
    response_model=List[RefundExemptionAdminOut],
    summary="退款豁免申请列表（管理员审核）",
)
def list_refund_exemptions(
    status: Optional[str] = Query(None, description="PENDING / APPROVED / REJECTED"),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AppRefundExemption).order_by(AppRefundExemption.CreatedAt.desc())
    if status and status.upper() != "ALL":
        q = q.filter(AppRefundExemption.Status == status.upper())
    rows = q.limit(100).all()
    consultation_ids = [r.ConsultationId for r in rows]
    consultations = {
        c.Id: c
        for c in db.query(AppConsultation)
        .filter(AppConsultation.Id.in_(consultation_ids))
        .all()
    } if consultation_ids else {}
    return [_build_exemption_admin_out(db, r, consultations.get(r.ConsultationId)) for r in rows]


@router.post(
    "/refund-exemptions/{exemption_id}/approve",
    summary="同意退款豁免申请",
)
def approve_refund_exemption_request(
    exemption_id: int,
    admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AppRefundExemption).filter(AppRefundExemption.Id == exemption_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="申请不存在")
    try:
        refunded, message = approve_refund_exemption(db, row, admin.Id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": message, "refunded": refunded, "status": "APPROVED"}


@router.post(
    "/refund-exemptions/{exemption_id}/reject",
    summary="拒绝退款豁免申请",
)
def reject_refund_exemption_request(
    exemption_id: int,
    body: RejectRefundExemptionRequest,
    admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AppRefundExemption).filter(AppRefundExemption.Id == exemption_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="申请不存在")
    try:
        reject_refund_exemption(db, row, admin.Id, body.reject_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": "已拒绝申请，预约与订单维持不变", "status": "REJECTED"}


def _snapshot_to_out(data: dict) -> CaseRecordSnapshotOut:
    return CaseRecordSnapshotOut(
        subjective=data.get("subjective"),
        objective=data.get("objective"),
        assessment=data.get("assessment"),
        plan=data.get("plan"),
        photoUrls=data.get("photo_urls") or [],
    )


def _build_amendment_admin_out(
    db: Session,
    row: AppCaseRecordAmendmentRequest,
    record: Optional[AppCaseRecord],
    consultation: Optional[AppConsultation],
) -> CaseRecordAmendmentAdminOut:
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == row.CounselorId)
        .first()
    )
    acc = db.query(AppAccount).filter(AppAccount.Id == row.CounselorId).first()
    counselor_name = (
        (prof.Name if prof and prof.Name else None)
        or (acc.Nickname if acc else None)
        or f"咨询师#{row.CounselorId}"
    )
    current = _snapshot_to_out(snapshot_case_record(record)) if record else CaseRecordSnapshotOut()
    proposed = CaseRecordSnapshotOut(
        subjective=row.Subjective,
        objective=row.Objective,
        assessment=row.Assessment,
        plan=row.Plan,
        photoUrls=decode_photo_urls(row.PhotoUrls),
    )
    return CaseRecordAmendmentAdminOut(
        id=row.Id,
        caseRecordId=row.CaseRecordId,
        consultationId=row.ConsultationId,
        counselorId=row.CounselorId,
        counselorName=counselor_name,
        reason=row.Reason,
        status=row.Status,
        rejectReason=row.RejectReason,
        consultationStartTime=consultation.StartTime if consultation else None,
        createdAt=row.CreatedAt,
        reviewedAt=row.ReviewedAt,
        current=current,
        proposed=proposed,
    )


@router.get(
    "/case-record-amendments",
    response_model=List[CaseRecordAmendmentAdminOut],
    summary="咨询记录修改申请列表（管理员审核）",
)
def list_case_record_amendments(
    status: Optional[str] = Query(None, description="PENDING / APPROVED / REJECTED"),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AppCaseRecordAmendmentRequest).order_by(
        AppCaseRecordAmendmentRequest.CreatedAt.desc()
    )
    if status and status.upper() != "ALL":
        q = q.filter(AppCaseRecordAmendmentRequest.Status == status.upper())
    rows = q.limit(100).all()
    record_ids = [r.CaseRecordId for r in rows]
    consultation_ids = [r.ConsultationId for r in rows]
    records = {
        r.Id: r
        for r in db.query(AppCaseRecord).filter(AppCaseRecord.Id.in_(record_ids)).all()
    } if record_ids else {}
    consultations = {
        c.Id: c
        for c in db.query(AppConsultation).filter(AppConsultation.Id.in_(consultation_ids)).all()
    } if consultation_ids else {}
    return [
        _build_amendment_admin_out(
            db,
            r,
            records.get(r.CaseRecordId),
            consultations.get(r.ConsultationId),
        )
        for r in rows
    ]


@router.post(
    "/case-record-amendments/{amendment_id}/approve",
    summary="同意咨询记录修改申请",
)
def approve_case_record_amendment(
    amendment_id: int,
    admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AppCaseRecordAmendmentRequest).filter(
        AppCaseRecordAmendmentRequest.Id == amendment_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="申请不存在")
    try:
        approve_amendment(db, row, admin.Id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": "已同意修改，咨询记录已更新", "status": "APPROVED"}


@router.post(
    "/case-record-amendments/{amendment_id}/reject",
    summary="驳回咨询记录修改申请",
)
def reject_case_record_amendment(
    amendment_id: int,
    body: RejectCaseRecordAmendmentRequest,
    admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AppCaseRecordAmendmentRequest).filter(
        AppCaseRecordAmendmentRequest.Id == amendment_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="申请不存在")
    try:
        reject_amendment(db, row, admin.Id, body.reject_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": "已驳回修改申请，原记录维持不变", "status": "REJECTED"}


def _admin_patient_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "来访者"
    return (account.RealName or account.Nickname or account.Mobile or "来访者").strip()


def _admin_counselor_name(db: Session, counselor_id: int) -> str:
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if not acc:
        return f"咨询师#{counselor_id}"
    return acc.RealName or acc.Nickname or acc.Mobile or f"咨询师#{counselor_id}"


def _admin_visitor_patient_ids(db: Session) -> set[int]:
    role_ids = {
        b.AccountId
        for b in db.query(AppRoleBinding)
        .filter(AppRoleBinding.RoleType == "Patient")
        .all()
    }
    cons_rows = db.query(AppConsultation.PatientId).distinct().all()
    cons_ids = {row[0] for row in cons_rows if row[0]}
    return role_ids | cons_ids


def _admin_consultation_location(
    db: Session,
    consultation: AppConsultation,
    schedule: Optional[AppSchedule],
) -> Optional[str]:
    note = consultation.Note or (schedule.Note if schedule else None)
    if not note:
        return None
    center_id = parse_center_id(note)
    center_name = center_display_name(center_id) or "未知地点"
    if is_video_center(center_id):
        return center_name
    sched_status = schedule.Status if schedule else "BOOKED"
    room_id = display_room_id(note, sched_status)
    room_name = room_display_name(center_id, room_id, db) if room_id else None
    if room_name:
        return f"{center_name} · {room_name}"
    return center_name


def _admin_consultation_status_label(
    status: str,
    start_time: Optional[datetime],
) -> str:
    now = china_now()
    if status == "CANCELLED":
        return "已取消"
    if status == "DONE":
        return "已完成"
    if status in ("PENDING", "CONFIRMED", "ONGOING"):
        if start_time and start_time > now:
            return "即将开始"
        if status == "ONGOING":
            return "进行中"
        if start_time and start_time <= now:
            return "进行中"
        return {"PENDING": "待确认", "CONFIRMED": "已确认"}.get(status, status)
    return status


def _admin_consultation_bucket(
    status: str,
    start_time: Optional[datetime],
) -> str:
    label = _admin_consultation_status_label(status, start_time)
    if label == "即将开始":
        return "upcoming"
    if label == "已完成":
        return "completed"
    if label == "已取消":
        return "cancelled"
    return "other"


class AdminPatientSummaryOut(BaseModel):
    patientId: int
    name: str
    mobile: Optional[str] = None
    gender: Optional[str] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None
    totalConsultations: int = 0
    upcomingCount: int = 0
    completedCount: int = 0
    cancelledCount: int = 0
    lastConsultationTime: Optional[datetime] = None


class AdminPatientConsultationOut(BaseModel):
    consultationId: int
    counselorId: int
    counselorName: str
    status: str
    statusLabel: str
    phase: str
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    location: Optional[str] = None
    createdAt: datetime


class AdminPatientDetailOut(BaseModel):
    patientId: int
    name: str
    mobile: Optional[str] = None
    gender: Optional[str] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None
    createdAt: Optional[datetime] = None
    totalConsultations: int = 0
    upcomingCount: int = 0
    completedCount: int = 0
    cancelledCount: int = 0
    consultations: List[AdminPatientConsultationOut] = []


def _build_patient_consultation_outs(
    db: Session,
    consultations: List[AppConsultation],
) -> List[AdminPatientConsultationOut]:
    if not consultations:
        return []
    schedule_ids = {c.ScheduleId for c in consultations if c.ScheduleId}
    schedules = {
        s.Id: s
        for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all()
    } if schedule_ids else {}
    items: List[AdminPatientConsultationOut] = []
    for c in consultations:
        sched = schedules.get(c.ScheduleId) if c.ScheduleId else None
        start_time = c.StartTime or (sched.StartTime if sched else None)
        end_time = c.EndTime or (sched.EndTime if sched else None)
        items.append(
            AdminPatientConsultationOut(
                consultationId=c.Id,
                counselorId=c.CounselorId,
                counselorName=_admin_counselor_name(db, c.CounselorId),
                status=c.Status,
                statusLabel=_admin_consultation_status_label(c.Status, start_time),
                phase=_admin_consultation_bucket(c.Status, start_time),
                startTime=start_time,
                endTime=end_time,
                location=_admin_consultation_location(db, c, sched),
                createdAt=c.CreatedAt,
            )
        )
    return items


def _summarize_patient_consultations(
    consultations: List[AppConsultation],
    schedules: dict[int, AppSchedule],
) -> tuple[int, int, int, int, Optional[datetime]]:
    upcoming = completed = cancelled = 0
    last_time: Optional[datetime] = None
    for c in consultations:
        sched = schedules.get(c.ScheduleId) if c.ScheduleId else None
        start_time = c.StartTime or (sched.StartTime if sched else None)
        bucket = _admin_consultation_bucket(c.Status, start_time)
        if bucket == "upcoming":
            upcoming += 1
        elif bucket == "completed":
            completed += 1
        elif bucket == "cancelled":
            cancelled += 1
        ref = start_time or c.CreatedAt
        if ref and (last_time is None or ref > last_time):
            last_time = ref
    return len(consultations), upcoming, completed, cancelled, last_time


class AdminCaseRecordViewOut(BaseModel):
    Id: int
    ConsultationId: int
    CounselorId: int
    CounselorName: str
    PatientName: str
    StartTime: Optional[datetime] = None
    EndTime: Optional[datetime] = None
    Subjective: Optional[str] = None
    Objective: Optional[str] = None
    Assessment: Optional[str] = None
    Plan: Optional[str] = None
    PhotoUrls: List[str] = []
    CreatedAt: datetime
    UpdatedAt: Optional[datetime] = None


class AdminCaseRecordRevisionOut(BaseModel):
    Id: int
    CaseRecordId: int
    ConsultationId: int
    Subjective: Optional[str] = None
    Objective: Optional[str] = None
    Assessment: Optional[str] = None
    Plan: Optional[str] = None
    PhotoUrls: List[str] = []
    RevisedAt: datetime
    RevisedBy: int


class CounselorRecordSummaryOut(BaseModel):
    counselorId: int
    counselorName: str
    completedCount: int
    recordedCount: int
    missingCount: int


class AdminConsultationRecordOut(BaseModel):
    consultationId: int
    patientId: int
    patientName: str
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    caseRecordId: Optional[int] = None
    hasRecord: bool = False
    recordUpdatedAt: Optional[datetime] = None
    photoCount: int = 0
    subjectivePreview: Optional[str] = None


@router.get(
    "/consultation-records/counselors",
    response_model=List[CounselorRecordSummaryOut],
    summary="咨询师咨询记录概览（近 N 天）",
)
def list_counselor_record_summaries(
    days: int = Query(30, ge=1, le=90, description="统计近多少天"),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    counselor_bindings = (
        db.query(AppRoleBinding)
        .filter(AppRoleBinding.RoleType == "Counselor")
        .all()
    )
    counselor_ids = sorted({b.AccountId for b in counselor_bindings})
    if not counselor_ids:
        return []

    profiles = {
        p.AccountId: p
        for p in db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId.in_(counselor_ids))
        .all()
    }
    accounts = {
        a.Id: a
        for a in db.query(AppAccount).filter(AppAccount.Id.in_(counselor_ids)).all()
    }

    consultations = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.CounselorId.in_(counselor_ids),
            AppConsultation.Status == "DONE",
            AppConsultation.EndTime >= since,
        )
        .all()
    )
    cons_by_counselor: dict[int, list] = {}
    consultation_ids: list[int] = []
    for c in consultations:
        cons_by_counselor.setdefault(c.CounselorId, []).append(c)
        consultation_ids.append(c.Id)

    records_by_consultation: dict[int, AppCaseRecord] = {}
    if consultation_ids:
        for r in db.query(AppCaseRecord).filter(
            AppCaseRecord.ConsultationId.in_(consultation_ids)
        ).all():
            records_by_consultation[r.ConsultationId] = r

    result: List[CounselorRecordSummaryOut] = []
    for cid in counselor_ids:
        cons = cons_by_counselor.get(cid, [])
        recorded = 0
        for c in cons:
            record = records_by_consultation.get(c.Id)
            if not record:
                continue
            photo_count = len(decode_photo_urls(record.PhotoUrls))
            if (
                (record.Subjective or "").strip()
                or (record.Objective or "").strip()
                or (record.Assessment or "").strip()
                or (record.Plan or "").strip()
                or photo_count > 0
            ):
                recorded += 1
        profile = profiles.get(cid)
        account = accounts.get(cid)
        name = (
            (profile.Name if profile else None)
            or (account.Nickname if account else None)
            or (account.RealName if account else None)
            or f"咨询师#{cid}"
        )
        completed = len(cons)
        result.append(
            CounselorRecordSummaryOut(
                counselorId=cid,
                counselorName=name,
                completedCount=completed,
                recordedCount=recorded,
                missingCount=max(0, completed - recorded),
            )
        )
    result.sort(key=lambda x: (-x.completedCount, x.counselorName))
    return result


@router.get(
    "/consultation-records/counselors/{counselor_id}",
    response_model=List[AdminConsultationRecordOut],
    summary="指定咨询师近 N 天咨询记录明细",
)
def list_counselor_consultation_records(
    counselor_id: int,
    days: int = Query(30, ge=1, le=90),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == counselor_id,
        AppRoleBinding.RoleType == "Counselor",
    ).first()
    if not binding:
        raise HTTPException(status_code=404, detail="咨询师不存在")

    since = datetime.utcnow() - timedelta(days=days)
    consultations = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.CounselorId == counselor_id,
            AppConsultation.Status == "DONE",
            AppConsultation.EndTime >= since,
        )
        .order_by(AppConsultation.EndTime.desc(), AppConsultation.Id.desc())
        .all()
    )
    if not consultations:
        return []

    patient_ids = {c.PatientId for c in consultations}
    patients = {
        a.Id: a
        for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
    }
    consultation_ids = [c.Id for c in consultations]
    records = {
        r.ConsultationId: r
        for r in db.query(AppCaseRecord)
        .filter(AppCaseRecord.ConsultationId.in_(consultation_ids))
        .all()
    }

    items: List[AdminConsultationRecordOut] = []
    for c in consultations:
        record = records.get(c.Id)
        photo_count = len(decode_photo_urls(record.PhotoUrls)) if record else 0
        subjective = (record.Subjective or "").strip() if record else ""
        has_record = bool(
            record
            and (
                subjective
                or (record.Objective or "").strip()
                or (record.Assessment or "").strip()
                or (record.Plan or "").strip()
                or photo_count > 0
            )
        )
        preview = subjective[:80] + ("…" if len(subjective) > 80 else "") if subjective else None
        items.append(
            AdminConsultationRecordOut(
                consultationId=c.Id,
                patientId=c.PatientId,
                patientName=_admin_patient_name(patients.get(c.PatientId)),
                startTime=c.StartTime,
                endTime=c.EndTime,
                caseRecordId=record.Id if record else None,
                hasRecord=has_record,
                recordUpdatedAt=record.UpdatedAt or record.CreatedAt if record else None,
                photoCount=photo_count,
                subjectivePreview=preview,
            )
        )
    return items


@router.get(
    "/consultation-records/records/{record_id}",
    response_model=AdminCaseRecordViewOut,
    summary="查看咨询记录详情（管理员只读）",
)
def get_admin_case_record(
    record_id: int,
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    record = db.query(AppCaseRecord).filter(AppCaseRecord.Id == record_id).first()
    if not record or not case_record_has_content(record):
        raise HTTPException(status_code=404, detail="咨询记录不存在或未填写")
    consultation = (
        db.query(AppConsultation)
        .filter(AppConsultation.Id == record.ConsultationId)
        .first()
    )
    patient = (
        db.query(AppAccount).filter(AppAccount.Id == consultation.PatientId).first()
        if consultation
        else None
    )
    return AdminCaseRecordViewOut(
        Id=record.Id,
        ConsultationId=record.ConsultationId,
        CounselorId=record.CounselorId,
        CounselorName=_admin_counselor_name(db, record.CounselorId),
        PatientName=_admin_patient_name(patient),
        StartTime=consultation.StartTime if consultation else None,
        EndTime=consultation.EndTime if consultation else None,
        Subjective=record.Subjective,
        Objective=record.Objective,
        Assessment=record.Assessment,
        Plan=record.Plan,
        PhotoUrls=decode_photo_urls(record.PhotoUrls),
        CreatedAt=record.CreatedAt,
        UpdatedAt=record.UpdatedAt,
    )


@router.get(
    "/consultation-records/records/{record_id}/revisions",
    response_model=List[AdminCaseRecordRevisionOut],
    summary="咨询记录历史版本（管理员只读）",
)
def list_admin_case_record_revisions(
    record_id: int,
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    record = db.query(AppCaseRecord).filter(AppCaseRecord.Id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="咨询记录不存在")
    rows = (
        db.query(AppCaseRecordRevision)
        .filter(AppCaseRecordRevision.CaseRecordId == record_id)
        .order_by(AppCaseRecordRevision.RevisedAt.desc())
        .all()
    )
    return [
        AdminCaseRecordRevisionOut(
            Id=r.Id,
            CaseRecordId=r.CaseRecordId,
            ConsultationId=r.ConsultationId,
            Subjective=r.Subjective,
            Objective=r.Objective,
            Assessment=r.Assessment,
            Plan=r.Plan,
            PhotoUrls=decode_photo_urls(r.PhotoUrls),
            RevisedAt=r.RevisedAt,
            RevisedBy=r.RevisedBy,
        )
        for r in rows
    ]


@router.get(
    "/patients",
    response_model=List[AdminPatientSummaryOut],
    summary="来访者列表（含预约统计与联系方式）",
)
def list_admin_patients(
    keyword: Optional[str] = Query(None, description="姓名或手机号搜索"),
    limit: int = Query(200, ge=1, le=500),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    patient_ids = _admin_visitor_patient_ids(db)
    if not patient_ids:
        return []

    q = db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids))
    if keyword:
        kw = keyword.strip()
        if kw:
            like = f"%{kw}%"
            q = q.filter(
                (AppAccount.RealName.like(like))
                | (AppAccount.Nickname.like(like))
                | (AppAccount.Mobile.like(like))
            )
    accounts = q.order_by(AppAccount.UpdatedAt.desc(), AppAccount.Id.desc()).limit(limit).all()
    if not accounts:
        return []

    account_ids = [a.Id for a in accounts]
    consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.PatientId.in_(account_ids))
        .all()
    )
    cons_by_patient: dict[int, list] = {}
    schedule_ids: set[int] = set()
    for c in consultations:
        cons_by_patient.setdefault(c.PatientId, []).append(c)
        if c.ScheduleId:
            schedule_ids.add(c.ScheduleId)
    schedules = {
        s.Id: s
        for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all()
    } if schedule_ids else {}

    result: List[AdminPatientSummaryOut] = []
    for acc in accounts:
        rows = cons_by_patient.get(acc.Id, [])
        total, upcoming, completed, cancelled, last_time = _summarize_patient_consultations(
            rows, schedules
        )
        result.append(
            AdminPatientSummaryOut(
                patientId=acc.Id,
                name=_admin_patient_name(acc),
                mobile=acc.Mobile,
                gender=acc.Gender,
                emergencyContact=acc.EmergencyContact,
                emergencyPhone=acc.EmergencyPhone,
                totalConsultations=total,
                upcomingCount=upcoming,
                completedCount=completed,
                cancelledCount=cancelled,
                lastConsultationTime=last_time,
            )
        )
    result.sort(
        key=lambda x: (
            x.lastConsultationTime is None,
            -(x.lastConsultationTime.timestamp() if x.lastConsultationTime else 0),
        )
    )
    return result


@router.get(
    "/patients/{patient_id}",
    response_model=AdminPatientDetailOut,
    summary="来访者详情（含全部咨询预约记录）",
)
def get_admin_patient_detail(
    patient_id: int,
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="来访者不存在")

    visitor_ids = _admin_visitor_patient_ids(db)
    if patient_id not in visitor_ids:
        raise HTTPException(status_code=404, detail="来访者不存在")

    consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.PatientId == patient_id)
        .order_by(AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
        .all()
    )
    schedule_ids = {c.ScheduleId for c in consultations if c.ScheduleId}
    schedules = {
        s.Id: s
        for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all()
    } if schedule_ids else {}
    total, upcoming, completed, cancelled, _ = _summarize_patient_consultations(
        consultations, schedules
    )
    cons_out = _build_patient_consultation_outs(db, consultations)
    cons_out.sort(
        key=lambda x: (
            x.startTime is None,
            -(x.startTime.timestamp() if x.startTime else x.createdAt.timestamp()),
        )
    )
    return AdminPatientDetailOut(
        patientId=patient.Id,
        name=_admin_patient_name(patient),
        mobile=patient.Mobile,
        gender=patient.Gender,
        emergencyContact=patient.EmergencyContact,
        emergencyPhone=patient.EmergencyPhone,
        createdAt=patient.CreatedAt,
        totalConsultations=total,
        upcomingCount=upcoming,
        completedCount=completed,
        cancelledCount=cancelled,
        consultations=cons_out,
    )


@router.get("/leave-requests", summary="咨询师请假列表（管理员）")
def list_leave_requests(
    status: str = Query("ALL", description="PENDING|APPROVED|REJECTED|ALL"),
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AppLeaveRequest).order_by(AppLeaveRequest.CreatedAt.desc())
    if status and status != "ALL":
        q = q.filter(AppLeaveRequest.Status == status)
    rows = q.limit(100).all()
    return [build_leave_request_out(db, row) for row in rows]


@router.get("/leave-requests/{leave_id}", summary="咨询师请假详情（管理员）")
def get_leave_request(
    leave_id: int,
    _admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AppLeaveRequest).filter(AppLeaveRequest.Id == leave_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    return build_leave_request_out(db, row)


@router.post("/leave-requests/{leave_id}/approve", summary="通过咨询师请假")
def approve_leave_request_api(
    leave_id: int,
    admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AppLeaveRequest).filter(AppLeaveRequest.Id == leave_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    try:
        status, message = approve_leave_request(db, row, admin.Id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": message, "status": status}


@router.post("/leave-requests/{leave_id}/reject", summary="拒绝咨询师请假")
def reject_leave_request_api(
    leave_id: int,
    admin: AppAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AppLeaveRequest).filter(AppLeaveRequest.Id == leave_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    try:
        reject_leave_request(db, row, admin.Id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": "已拒绝请假申请", "status": "REJECTED"}
