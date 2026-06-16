"""管理员轻控制台：最小角色绑定/解绑能力。"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppRefundExemption,
    AppRoleBinding,
)
from refund_exemption_service import approve_refund_exemption, reject_refund_exemption

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
