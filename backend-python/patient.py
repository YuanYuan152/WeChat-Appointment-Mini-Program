"""
2.4 患者端接口
GET /api/mini/patient/orders        → 当前登录用户的订单列表
GET /api/mini/patient/me            → 患者资料
PUT /api/mini/patient/me            → 更新患者资料
GET /api/mini/patient/registration  → 获取完整版登记表
PUT /api/mini/patient/registration  → 保存完整版登记表
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from auth import get_current_account, AppAccount
from consultation_cancel import (
    can_visitor_cancel,
    cancel_consultation_for_visitor,
    is_refund_eligible,
    refund_ineligible_reason,
)
from database import get_db
from models import (
    AppOrder,
    AppRegistrationForm,
    AppConsultation,
    AppCounselorProfile,
    AppSchedule,
    AppRefundExemption,
)
from refund_exemption_service import (
    latest_exemptions_by_consultation,
    notify_admins_new_exemption,
    validate_exemption_submission,
)
from schedule_meta import center_display_name, parse_center_id

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
    centerId: Optional[str] = None
    centerName: Optional[str] = None
    canCancel: bool = False
    refundEligible: bool = False
    orderAmount: Optional[int] = None
    refundReason: Optional[str] = None
    exemptionStatus: Optional[str] = None
    exemptionRejectReason: Optional[str] = None
    exemptionId: Optional[int] = None
    orderStatus: Optional[str] = None
    cancelSummary: Optional[str] = None


class CancelConsultationOut(BaseModel):
    refunded: bool
    message: str


class RefundExemptionCreate(BaseModel):
    amount: int
    reason: str
    screenshot_url: Optional[str] = None


class RefundExemptionOut(BaseModel):
    id: int
    consultationId: int
    amount: int
    reason: str
    screenshotUrl: Optional[str] = None
    status: str
    rejectReason: Optional[str] = None
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

    schedule_ids = [r.ScheduleId for r in rows if r.ScheduleId]
    schedule_map: dict[int, AppSchedule] = {}
    if schedule_ids:
        for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all():
            schedule_map[s.Id] = s

    order_ids = [r.OrderId for r in rows if r.OrderId]
    order_map: dict[int, AppOrder] = {}
    if order_ids:
        for o in db.query(AppOrder).filter(AppOrder.Id.in_(order_ids)).all():
            order_map[o.Id] = o

    consultation_ids = [r.Id for r in rows]
    exemption_map = latest_exemptions_by_consultation(
        db, consultation_ids, account_id=current_account.Id,
    )

    result: List[ConsultationOut] = []
    for r in rows:
        prof = counselor_map.get(r.CounselorId)
        acc = accounts.get(r.CounselorId)
        name = (prof.Name if prof and prof.Name else None) or (acc.Nickname if acc else None) or f"咨询师#{r.CounselorId}"
        avatar = (prof.AvatarUrl if prof and prof.AvatarUrl else None) or (acc.AvatarUrl if acc else None)

        sched = schedule_map.get(r.ScheduleId) if r.ScheduleId else None
        start_time = r.StartTime or (sched.StartTime if sched else None)
        end_time = r.EndTime or (sched.EndTime if sched else None)

        center_note_text = sched.Note if sched else None
        if not center_note_text and r.Note:
            center_note_text = r.Note
        center_id = parse_center_id(center_note_text)
        center_name = center_display_name(center_id)
        cancelable = can_visitor_cancel(r.Status)
        refund_ok = cancelable and is_refund_eligible(start_time)
        order = order_map.get(r.OrderId) if r.OrderId else None
        order_status = order.Status if order else None
        if order and order.Status in ("PAID", "REFUNDED", "CANCELLED"):
            order_amount = order.TotalFee
        else:
            order_amount = None
        cancel_summary = None
        if r.Status == "CANCELLED":
            if order_status == "REFUNDED":
                cancel_summary = "预约已取消，款项将原路退回"
            else:
                cancel_summary = "预约已取消，按规定不予退款"
        exemption = exemption_map.get(r.Id)

        result.append(ConsultationOut(
            id=r.Id,
            orderId=r.OrderId,
            counselorId=r.CounselorId,
            counselorName=name,
            counselorAvatar=avatar,
            scheduleId=r.ScheduleId,
            status=r.Status,
            startTime=start_time,
            endTime=end_time,
            note=r.Note,
            createdAt=r.CreatedAt,
            centerId=center_id,
            centerName=center_name,
            canCancel=cancelable,
            refundEligible=refund_ok,
            orderAmount=order_amount,
            refundReason=None if refund_ok else refund_ineligible_reason(start_time),
            exemptionStatus=exemption.Status if exemption else None,
            exemptionRejectReason=exemption.RejectReason if exemption and exemption.Status == "REJECTED" else None,
            exemptionId=exemption.Id if exemption else None,
            orderStatus=order_status,
            cancelSummary=cancel_summary,
        ))
    return result


@router.post("/consultations/{consultation_id}/cancel", response_model=CancelConsultationOut, summary="取消咨询")
def cancel_my_consultation(
    consultation_id: int,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """距开始≥24小时取消并退款；不足24小时仅取消不退款。"""
    row = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.Id == consultation_id,
            AppConsultation.PatientId == current_account.Id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="咨询记录不存在")

    try:
        refunded, message = cancel_consultation_for_visitor(db, row, patient_id=current_account.Id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    return CancelConsultationOut(refunded=refunded, message=message)


@router.post(
    "/consultations/{consultation_id}/refund-exemption",
    response_model=RefundExemptionOut,
    summary="提交退款豁免申请",
)
def submit_refund_exemption(
    consultation_id: int,
    body: RefundExemptionCreate,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    row = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.Id == consultation_id,
            AppConsultation.PatientId == current_account.Id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="咨询记录不存在")

    pending = (
        db.query(AppRefundExemption)
        .filter(
            AppRefundExemption.ConsultationId == consultation_id,
            AppRefundExemption.AccountId == current_account.Id,
            AppRefundExemption.Status == "PENDING",
        )
        .first()
    )
    try:
        validate_exemption_submission(
            row,
            patient_id=current_account.Id,
            amount=body.amount,
            reason=body.reason or "",
            pending=pending,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    exemption = AppRefundExemption(
        ConsultationId=consultation_id,
        AccountId=current_account.Id,
        Amount=body.amount,
        Reason=(body.reason or "").strip(),
        ScreenshotUrl=body.screenshot_url,
        Status="PENDING",
    )
    db.add(exemption)
    db.flush()
    notify_admins_new_exemption(db, exemption, row)
    db.commit()
    db.refresh(exemption)
    return RefundExemptionOut(
        id=exemption.Id,
        consultationId=exemption.ConsultationId,
        amount=exemption.Amount,
        reason=exemption.Reason,
        screenshotUrl=exemption.ScreenshotUrl,
        status=exemption.Status,
        rejectReason=exemption.RejectReason,
        createdAt=exemption.CreatedAt,
    )


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


@router.get("/orders/{order_id}", response_model=OrderOut, summary="获取当前用户单笔订单")
def get_my_order(
    order_id: int,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    order = (
        db.query(AppOrder)
        .filter(AppOrder.Id == order_id, AppOrder.AccountId == current_account.Id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


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
