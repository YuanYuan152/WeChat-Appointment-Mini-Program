"""
2.4 患者端接口
GET /api/mini/patient/orders        → 当前登录用户的订单列表
GET /api/mini/patient/me            → 患者资料
PUT /api/mini/patient/me            → 更新患者资料
GET /api/mini/patient/registration  → 获取完整版登记表
PUT /api/mini/patient/registration  → 保存完整版登记表
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from auth import get_current_account, AppAccount
from database import get_db
from models import AppOrder, AppRegistrationForm, AppConsultation, AppCounselorProfile

router = APIRouter(prefix="/api/mini/patient", tags=["Patient"])


class OrderOut(BaseModel):
    Id: int
    SlotId: Optional[int] = None
    OutTradeNo: str
    TransactionId: Optional[str] = None
    TotalFee: int
    Status: str
    Description: Optional[str] = None
    CreatedAt: datetime
    PaidAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class PatientProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    avatarUrl: Optional[str] = None
    realName: Optional[str] = None
    gender: Optional[str] = None
    birthday: Optional[datetime] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None


class PatientProfileOut(BaseModel):
    id: int
    openId: Optional[str] = None
    mobile: Optional[str] = None
    nickname: Optional[str] = None
    avatarUrl: Optional[str] = None
    realName: Optional[str] = None
    gender: Optional[str] = None
    birthday: Optional[datetime] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None


class RegistrationPayload(BaseModel):
    realName: Optional[str] = None
    gender: Optional[str] = None
    birthday: Optional[datetime] = None
    occupation: Optional[str] = None
    education: Optional[str] = None
    maritalStatus: Optional[str] = None
    phone: Optional[str] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None
    chiefComplaint: Optional[str] = None

    phq1: Optional[int] = None
    phq2: Optional[int] = None
    phq3: Optional[int] = None
    phq4: Optional[int] = None
    phq5: Optional[int] = None
    phq6: Optional[int] = None
    phq7: Optional[int] = None
    phq8: Optional[int] = None
    phq9: Optional[int] = None

    gad1: Optional[int] = None
    gad2: Optional[int] = None
    gad3: Optional[int] = None
    gad4: Optional[int] = None
    gad5: Optional[int] = None
    gad6: Optional[int] = None
    gad7: Optional[int] = None

    pastDiagnosis: Optional[str] = None
    treatmentHistory: Optional[str] = None
    medicationHistory: Optional[str] = None
    familyMentalHistory: Optional[str] = None
    familyRelationship: Optional[str] = None
    sleepStatus: Optional[str] = None
    appetiteStatus: Optional[str] = None
    substanceUse: Optional[str] = None
    selfHarmRisk: Optional[str] = None
    consultationGoal: Optional[str] = None


def _profile_out(account: AppAccount) -> PatientProfileOut:
    return PatientProfileOut(
        id=account.Id,
        openId=account.OpenId,
        mobile=account.Mobile,
        nickname=account.Nickname,
        avatarUrl=account.AvatarUrl,
        realName=account.RealName,
        gender=account.Gender,
        birthday=account.Birthday,
        emergencyContact=account.EmergencyContact,
        emergencyPhone=account.EmergencyPhone,
    )


def _registration_to_dict(form: Optional[AppRegistrationForm]) -> dict:
    if not form:
        return {}
    fields = {
        "id": form.Id,
        "realName": form.RealName,
        "gender": form.Gender,
        "birthday": form.Birthday,
        "occupation": form.Occupation,
        "education": form.Education,
        "maritalStatus": form.MaritalStatus,
        "phone": form.Phone,
        "emergencyContact": form.EmergencyContact,
        "emergencyPhone": form.EmergencyPhone,
        "chiefComplaint": form.ChiefComplaint,
        "phqTotal": form.PhqTotal,
        "gadTotal": form.GadTotal,
        "pastDiagnosis": form.PastDiagnosis,
        "treatmentHistory": form.TreatmentHistory,
        "medicationHistory": form.MedicationHistory,
        "familyMentalHistory": form.FamilyMentalHistory,
        "familyRelationship": form.FamilyRelationship,
        "sleepStatus": form.SleepStatus,
        "appetiteStatus": form.AppetiteStatus,
        "substanceUse": form.SubstanceUse,
        "selfHarmRisk": form.SelfHarmRisk,
        "consultationGoal": form.ConsultationGoal,
        "createdAt": form.CreatedAt,
        "updatedAt": form.UpdatedAt,
    }
    for i in range(1, 10):
        fields[f"phq{i}"] = getattr(form, f"Phq{i}")
    for i in range(1, 8):
        fields[f"gad{i}"] = getattr(form, f"Gad{i}")
    return fields


class ConsultationOut(BaseModel):
    id: int
    orderId: Optional[int] = None
    counselorId: int
    counselorName: Optional[str] = None
    counselorAvatar: Optional[str] = None
    scheduleId: Optional[int] = None
    status: str
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    note: Optional[str] = None
    createdAt: datetime


@router.get("/consultations", response_model=List[ConsultationOut], summary="获取当前用户的咨询单列表")
def get_my_consultations(
    status: Optional[str] = None,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """方案 §8.1 我的咨询：返回登录账号作为 Patient 的所有咨询单。"""
    q = db.query(AppConsultation).filter(AppConsultation.PatientId == current_account.Id)
    if status:
        q = q.filter(AppConsultation.Status == status)
    rows = q.order_by(AppConsultation.CreatedAt.desc()).all()

    counselor_ids = list({r.CounselorId for r in rows})
    counselor_map: dict[int, AppCounselorProfile] = {}
    if counselor_ids:
        for c in db.query(AppCounselorProfile).filter(AppCounselorProfile.AccountId.in_(counselor_ids)).all():
            counselor_map[c.AccountId] = c

    accounts = {a.Id: a for a in db.query(AppAccount).filter(AppAccount.Id.in_(counselor_ids)).all()} if counselor_ids else {}

    result: List[ConsultationOut] = []
    for r in rows:
        prof = counselor_map.get(r.CounselorId)
        acc = accounts.get(r.CounselorId)
        name = (prof.Name if prof and prof.Name else None) or (acc.Nickname if acc else None) or f"咨询师#{r.CounselorId}"
        avatar = (prof.AvatarUrl if prof and prof.AvatarUrl else None) or (acc.AvatarUrl if acc else None)
        result.append(ConsultationOut(
            id=r.Id,
            orderId=r.OrderId,
            counselorId=r.CounselorId,
            counselorName=name,
            counselorAvatar=avatar,
            scheduleId=r.ScheduleId,
            status=r.Status,
            startTime=r.StartTime,
            endTime=r.EndTime,
            note=r.Note,
            createdAt=r.CreatedAt,
        ))
    return result


@router.get("/orders", response_model=List[OrderOut], summary="获取当前用户订单列表")
def get_my_orders(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(AppOrder)
        .filter(AppOrder.AccountId == current_account.Id)
        .order_by(AppOrder.CreatedAt.desc())
        .all()
    )
    return orders


@router.get("/me", response_model=PatientProfileOut, summary="获取患者资料")
def get_patient_me(current_account: AppAccount = Depends(get_current_account)):
    return _profile_out(current_account)


@router.put("/me", response_model=PatientProfileOut, summary="更新患者资料")
def update_patient_me(
    body: PatientProfileUpdate,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    mapping = {
        "nickname": "Nickname",
        "avatarUrl": "AvatarUrl",
        "realName": "RealName",
        "gender": "Gender",
        "birthday": "Birthday",
        "emergencyContact": "EmergencyContact",
        "emergencyPhone": "EmergencyPhone",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(current_account, dst, val)
    current_account.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(current_account)
    return _profile_out(current_account)


@router.get("/registration", summary="获取当前用户完整版登记表")
def get_registration(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    form = (
        db.query(AppRegistrationForm)
        .filter(AppRegistrationForm.AccountId == current_account.Id)
        .order_by(AppRegistrationForm.CreatedAt.desc())
        .first()
    )
    return _registration_to_dict(form)


@router.put("/registration", summary="保存当前用户完整版登记表")
def save_registration(
    body: RegistrationPayload,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    form = (
        db.query(AppRegistrationForm)
        .filter(AppRegistrationForm.AccountId == current_account.Id)
        .order_by(AppRegistrationForm.CreatedAt.desc())
        .first()
    )
    if not form:
        form = AppRegistrationForm(AccountId=current_account.Id)
        db.add(form)

    mapping = {
        "realName": "RealName",
        "gender": "Gender",
        "birthday": "Birthday",
        "occupation": "Occupation",
        "education": "Education",
        "maritalStatus": "MaritalStatus",
        "phone": "Phone",
        "emergencyContact": "EmergencyContact",
        "emergencyPhone": "EmergencyPhone",
        "chiefComplaint": "ChiefComplaint",
        "pastDiagnosis": "PastDiagnosis",
        "treatmentHistory": "TreatmentHistory",
        "medicationHistory": "MedicationHistory",
        "familyMentalHistory": "FamilyMentalHistory",
        "familyRelationship": "FamilyRelationship",
        "sleepStatus": "SleepStatus",
        "appetiteStatus": "AppetiteStatus",
        "substanceUse": "SubstanceUse",
        "selfHarmRisk": "SelfHarmRisk",
        "consultationGoal": "ConsultationGoal",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(form, dst, val)

    phq_total = 0
    for i in range(1, 10):
        val = getattr(body, f"phq{i}", None)
        if val is not None:
            setattr(form, f"Phq{i}", val)
            phq_total += val
    form.PhqTotal = phq_total

    gad_total = 0
    for i in range(1, 8):
        val = getattr(body, f"gad{i}", None)
        if val is not None:
            setattr(form, f"Gad{i}", val)
            gad_total += val
    form.GadTotal = gad_total

    form.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(form)
    return _registration_to_dict(form)
