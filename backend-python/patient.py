"""
2.4 患者端接口
GET /api/mini/patient/orders        → 当前登录用户的订单列表
GET /api/mini/patient/me            → 患者资料
PUT /api/mini/patient/me            → 更新患者资料
GET /api/mini/patient/registration  → 获取完整版登记表
PUT /api/mini/patient/registration  → 保存完整版登记表
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

from auth import get_current_account, AppAccount
from consultation_cancel import (
    can_visitor_cancel,
    cancel_consultation_for_visitor,
    is_refund_eligible,
    refund_ineligible_reason,
)
from database import get_db
from model_compat import optional_model_value
from models import (
    AppOrder,
    AppRegistrationForm,
    AppConsultation,
    AppCounselorProfile,
    AppSchedule,
    AppRefundExemption,
    AppCounselorFavorite,
    AppConsultationFeedback,
    AppPsychScaleResult,
    AppAccount,
)
from psych_scale import (
    encode_answers,
    decode_answers,
    result_dict,
    validate_answers,
)
from consultation_feedback import (
    ALLOWED_IMPROVEMENTS,
    encode_feedback,
    feedback_detail,
    feedback_summary,
)
from refund_exemption_service import (
    latest_exemptions_by_consultation,
    notify_admins_new_exemption,
    validate_exemption_submission,
)
from schedule_meta import center_display_name, parse_center_id
from intake_agreement import needs_intake_agreement

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
    needsIntakeAgreement: bool = True


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


def _profile_out(account: AppAccount, db: Session) -> PatientProfileOut:
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
        needsIntakeAgreement=needs_intake_agreement(db, account),
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
    hasFeedback: bool = False
    feedbackContent: Optional[str] = None
    feedbackAt: Optional[datetime] = None
    feedbackGoalScore: Optional[int] = None
    feedbackRhythmScore: Optional[int] = None
    feedbackImprovements: Optional[List[str]] = None


class ConsultationFeedbackCreate(BaseModel):
    goalScore: Optional[int] = Field(default=None, ge=1, le=5, description="目标达成 1-5 星")
    rhythmScore: Optional[int] = Field(default=None, ge=1, le=5, description="议题节奏 1-5 星")
    improvements: List[str] = Field(default_factory=list, description="需改进方面（多选，可空）")


class ConsultationFeedbackOut(BaseModel):
    consultationId: int
    goalScore: Optional[int] = None
    rhythmScore: Optional[int] = None
    improvements: List[str] = []
    summary: str
    createdAt: datetime


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

    feedback_map: dict[int, AppConsultationFeedback] = {}
    if consultation_ids:
        try:
            for fb in db.query(AppConsultationFeedback).filter(
                AppConsultationFeedback.ConsultationId.in_(consultation_ids),
                AppConsultationFeedback.AccountId == current_account.Id,
            ).all():
                feedback_map[fb.ConsultationId] = fb
        except SQLAlchemyError:
            db.rollback()

    result: List[ConsultationOut] = []
    for r in rows:
        prof = counselor_map.get(r.CounselorId)
        acc = accounts.get(r.CounselorId)
        name = (
            (prof.Name if prof and prof.Name else None)
            or (acc.Nickname if acc else None)
            or (acc.RealName if acc else None)
            or (acc.Mobile if acc else None)
            or "未留姓名咨询师"
        )
        avatar = (prof.AvatarUrl if prof and prof.AvatarUrl else None) or (acc.AvatarUrl if acc else None)

        sched = schedule_map.get(r.ScheduleId) if r.ScheduleId else None
        start_time = r.StartTime or (sched.StartTime if sched else None)
        end_time = r.EndTime or (sched.EndTime if sched else None)

        center_note_text = r.Note or (sched.Note if sched else None)
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
        feedback = feedback_map.get(r.Id)
        fb_detail = feedback_detail(feedback.Content) if feedback else None

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
            exemptionRejectReason=(
                optional_model_value(exemption, "RejectReason")
                if exemption and exemption.Status == "REJECTED"
                else None
            ),
            exemptionId=exemption.Id if exemption else None,
            orderStatus=order_status,
            cancelSummary=cancel_summary,
            hasFeedback=bool(feedback),
            feedbackContent=feedback_summary(feedback.Content) if feedback else None,
            feedbackAt=feedback.CreatedAt if feedback else None,
            feedbackGoalScore=fb_detail.get("goalScore") or None if fb_detail else None,
            feedbackRhythmScore=fb_detail.get("rhythmScore") or None if fb_detail else None,
            feedbackImprovements=fb_detail.get("improvements") if fb_detail else None,
        ))
    return result


@router.post(
    "/consultations/{consultation_id}/feedback",
    response_model=ConsultationFeedbackOut,
    summary="提交已完成咨询的反馈",
)
def submit_consultation_feedback(
    consultation_id: int,
    body: ConsultationFeedbackCreate,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.Id == consultation_id,
            AppConsultation.PatientId == current_account.Id,
        )
        .first()
    )
    if not consultation:
        raise HTTPException(status_code=404, detail="咨询记录不存在")
    if consultation.Status != "DONE":
        raise HTTPException(status_code=400, detail="仅已完成的咨询可提交反馈")

    exists = (
        db.query(AppConsultationFeedback)
        .filter(AppConsultationFeedback.ConsultationId == consultation_id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="该咨询已提交过反馈")

    improvements = [x.strip() for x in (body.improvements or []) if x and x.strip()]
    invalid = [x for x in improvements if x not in ALLOWED_IMPROVEMENTS]
    if invalid:
        raise HTTPException(status_code=400, detail="包含无效的改进选项")

    goal_score = body.goalScore if body.goalScore and body.goalScore > 0 else None
    rhythm_score = body.rhythmScore if body.rhythmScore and body.rhythmScore > 0 else None
    payload = encode_feedback(goal_score, rhythm_score, improvements)
    row = AppConsultationFeedback(
        ConsultationId=consultation_id,
        AccountId=current_account.Id,
        Content=payload,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ConsultationFeedbackOut(
        consultationId=consultation_id,
        goalScore=goal_score,
        rhythmScore=rhythm_score,
        improvements=improvements,
        summary=feedback_summary(payload) or "",
        createdAt=row.CreatedAt,
    )


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

    from staff_message_service import notify_staff_appointment_cancelled
    from counselor_message_service import notify_counselor_appointment_cancelled
    from patient_message_service import notify_patient_appointment_cancelled

    notify_patient_appointment_cancelled(db, row, refunded=refunded)
    notify_staff_appointment_cancelled(db, row, refunded=refunded)
    notify_counselor_appointment_cancelled(db, row, refunded=refunded)

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
    from patient_message_service import notify_patient_refund_exemption_pending

    notify_patient_refund_exemption_pending(db, exemption, row)
    db.commit()
    db.refresh(exemption)
    return RefundExemptionOut(
        id=exemption.Id,
        consultationId=exemption.ConsultationId,
        amount=exemption.Amount,
        reason=exemption.Reason,
        screenshotUrl=exemption.ScreenshotUrl,
        status=exemption.Status,
        rejectReason=optional_model_value(exemption, "RejectReason"),
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
def get_patient_me(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    return _profile_out(current_account, db)


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
    return _profile_out(current_account, db)


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


class CounselorFavoriteOut(BaseModel):
    counselorId: int
    name: str
    title: Optional[str] = None
    avatarUrl: Optional[str] = None
    specialty: Optional[str] = None
    billing: Optional[int] = None
    workYears: Optional[int] = None
    consultHours: Optional[int] = None
    createdAt: datetime

    class Config:
        from_attributes = True


class FavoriteStatusOut(BaseModel):
    favorited: bool
    count: int = 0


def _favorite_counselor_out(db: Session, counselor_id: int, created_at: datetime) -> CounselorFavoriteOut:
    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    account = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    name = "咨询师"
    avatar = None
    if profile:
        name = profile.Name or name
        avatar = profile.AvatarUrl
    if account and not profile:
        name = account.RealName or account.Nickname or name
        avatar = account.AvatarUrl
    return CounselorFavoriteOut(
        counselorId=counselor_id,
        name=name,
        title=profile.Title if profile else None,
        avatarUrl=avatar,
        specialty=profile.Specialty if profile else None,
        billing=int(profile.Billing or 0) if profile else None,
        workYears=int(profile.WorkYears or 0) if profile else None,
        consultHours=int(profile.ConsultHours or 0) if profile else None,
        createdAt=created_at,
    )


@router.get("/favorites", response_model=List[CounselorFavoriteOut], summary="我的收藏咨询师")
def list_favorites(
    account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AppCounselorFavorite)
        .filter(AppCounselorFavorite.AccountId == account.Id)
        .order_by(AppCounselorFavorite.CreatedAt.desc())
        .all()
    )
    return [_favorite_counselor_out(db, r.CounselorId, r.CreatedAt) for r in rows]


@router.get("/favorites/count", summary="收藏数量")
def favorite_count(
    account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    count = (
        db.query(AppCounselorFavorite)
        .filter(AppCounselorFavorite.AccountId == account.Id)
        .count()
    )
    return {"count": count}


@router.get(
    "/favorites/check/{counselor_id}",
    response_model=FavoriteStatusOut,
    summary="是否已收藏某咨询师",
)
def check_favorite(
    counselor_id: int,
    account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    exists = (
        db.query(AppCounselorFavorite)
        .filter(
            AppCounselorFavorite.AccountId == account.Id,
            AppCounselorFavorite.CounselorId == counselor_id,
        )
        .first()
    )
    return FavoriteStatusOut(favorited=bool(exists))


@router.post(
    "/favorites/{counselor_id}",
    response_model=FavoriteStatusOut,
    summary="收藏咨询师",
)
def add_favorite(
    counselor_id: int,
    account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id, AppCounselorProfile.IsActive == True)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="咨询师不存在")
    existing = (
        db.query(AppCounselorFavorite)
        .filter(
            AppCounselorFavorite.AccountId == account.Id,
            AppCounselorFavorite.CounselorId == counselor_id,
        )
        .first()
    )
    if not existing:
        db.add(AppCounselorFavorite(AccountId=account.Id, CounselorId=counselor_id))
        db.commit()
    return FavoriteStatusOut(favorited=True)


@router.delete(
    "/favorites/{counselor_id}",
    response_model=FavoriteStatusOut,
    summary="取消收藏咨询师",
)
def remove_favorite(
    counselor_id: int,
    account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    row = (
        db.query(AppCounselorFavorite)
        .filter(
            AppCounselorFavorite.AccountId == account.Id,
            AppCounselorFavorite.CounselorId == counselor_id,
        )
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return FavoriteStatusOut(favorited=False)


class ScaleSubmitPayload(BaseModel):
    scaleType: str = Field(..., description="PHQ9 或 GAD7")
    answers: List[int] = Field(..., description="各题得分 0-3")


class ScaleResultOut(BaseModel):
    id: int
    scaleType: str
    scaleLabel: str
    total: int
    levelLabel: str
    answers: List[int]
    createdAt: datetime


@router.get("/scales", response_model=List[ScaleResultOut], summary="我的量表测评记录")
def list_my_scale_results(
    scale_type: Optional[str] = Query(None, description="PHQ9 / GAD7"),
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    q = (
        db.query(AppPsychScaleResult)
        .filter(AppPsychScaleResult.AccountId == current_account.Id)
        .order_by(AppPsychScaleResult.CreatedAt.desc())
    )
    if scale_type:
        try:
            from psych_scale import normalize_scale_type
            key = normalize_scale_type(scale_type)
            q = q.filter(AppPsychScaleResult.ScaleType == key)
        except ValueError:
            raise HTTPException(status_code=400, detail="不支持的量表类型")
    rows = q.limit(100).all()
    return [
        ScaleResultOut(
            **result_dict(
                r.Id,
                r.ScaleType,
                decode_answers(r.Answers),
                int(r.Total),
                r.CreatedAt,
            )
        )
        for r in rows
    ]


@router.post("/scales", response_model=ScaleResultOut, summary="提交量表测评")
def submit_scale_result(
    body: ScaleSubmitPayload,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    try:
        key, answers, total = validate_answers(body.scaleType, body.answers)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    row = AppPsychScaleResult(
        AccountId=current_account.Id,
        ScaleType=key,
        Answers=encode_answers(answers),
        Total=total,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ScaleResultOut(
        **result_dict(row.Id, row.ScaleType, answers, total, row.CreatedAt)
    )
