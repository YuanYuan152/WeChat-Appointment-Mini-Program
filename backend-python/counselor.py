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

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_account, AppAccount
from database import get_db
from models import AppSchedule, AppConsultation, AppCaseRecord, AppRoleBinding, AppCounselorProfile

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


class ScheduleUpdate(BaseModel):
    status: Optional[str] = None   # AVAILABLE / CANCELLED
    note: Optional[str] = None


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


@router.post("/schedules", response_model=ScheduleOut, summary="新增排班")
def create_schedule(
    body: ScheduleCreate,
    counselor: AppAccount = Depends(require_counselor),
    db: Session = Depends(get_db),
):
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=400, detail="结束时间必须晚于开始时间")
    schedule = AppSchedule(
        CounselorId=counselor.Id,
        StartTime=body.start_time,
        EndTime=body.end_time,
        Note=body.note,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.put("/schedules/{schedule_id}", response_model=ScheduleOut, summary="更新排班")
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
    if body.status:
        schedule.Status = body.status
    if body.note is not None:
        schedule.Note = body.note
    schedule.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(schedule)
    return schedule


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
