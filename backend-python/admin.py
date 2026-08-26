"""管理员轻控制台：最小角色绑定/解绑能力。"""

import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import exists, not_, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from auth import get_current_account, AppAccount
from database import get_db
from staff_roles import (
    STAFF_WORKBENCH_ROLES,
    account_has_staff_workbench,
    assignable_roles_for_actor,
    assert_can_assign_role,
    assert_can_manage_user,
    is_key_login_admin_account,
    staff_workbench_account_ids,
)
from models import (
    AppAccount,
    AppCaseRecord,
    AppCaseRecordRevision,
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppConsultationFeedback,
    AppCounselorProfile,
    AppLeaveRequest,
    AppLoginSession,
    AppRefundExemption,
    AppRoleBinding,
    AppRoleSwitchLog,
    AppSchedule,
)
from consultation_feedback import feedback_detail, feedback_summary
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
from case_record_service import (
    case_record_has_content,
    case_record_header_info,
    case_record_photo_urls,
    case_record_risk_assessment,
    decode_header_info,
    decode_photo_urls,
    decode_risk_assessment,
)
from model_compat import optional_model_value
from refund_exemption_service import approve_refund_exemption, reject_refund_exemption
from case_record_amendment_service import approve_amendment, reject_amendment
from case_record_service import snapshot_case_record
from user_role_meta import (
    counselor_type_label,
    is_charity_patient_source,
    normalize_patient_source,
    patient_source_label,
    validate_counselor_type,
    validate_patient_source,
)
from common import (
    _counselor_ids_with_available_slots,
    _normalize_gender_value,
    _profile_is_public_visible,
    _sort_counselor_list,
    normalize_counselor_mode,
)
from counselor_avatar import DEFAULT_COUNSELOR_PUBLIC_AVATAR, resolve_counselor_public_avatar_url
from account_deletion_service import hard_delete_account
from counselor_identity_service import (
    apply_legacy_doctor_to_profile,
    dedupe_counselor_profiles,
    find_legacy_doctor_by_name,
    link_counselor_role_to_legacy_doctor,
    list_legacy_unlinked_doctors,
    reconcile_existing_counselor_legacy_links,
    resolve_legacy_doctor_for_account,
)
from pricing_service import (
    default_base_price_cents_for_type,
    get_counselor_profile,
    sync_counselor_profile_billing_for_type,
)
from role_active import (
    get_account_role,
    set_account_role,
    invalidate_user_sessions,
)
from staff_remark_service import (
    get_staff_remark,
    get_staff_remarks_map,
    set_staff_remark,
)
from patient_contract_service import (
    batch_patient_contract_extras,
    bind_patient_counselor,
    patient_contract_extras,
    retire_counselor_booking_relationships,
)
from patient_registration import DEFAULT_PATIENT_SOURCE

router = APIRouter(prefix="/api/mini/admin", tags=["Admin"])


def require_staff_workbench(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    """咨询助理、运营、管理员共用管理工作台。"""
    if not account_has_staff_workbench(
        db, current_account.Id, getattr(current_account, "ActiveRole", None)
    ):
        raise HTTPException(status_code=403, detail="无管理工作台权限")
    return current_account


def require_admin(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    if get_account_role(db, current_account.Id) != "Admin":
        raise HTTPException(status_code=403, detail="无管理员权限")
    return current_account


def require_ops_or_admin(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    return require_staff_workbench(current_account, db)


def require_assessment_editor(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    """量表定义涉及发布版本，仅运营和管理员可编辑。"""
    if get_account_role(db, current_account.Id) not in {"Ops", "Admin"}:
        raise HTTPException(status_code=403, detail="无量表配置权限")
    return current_account


class BindRoleRequest(BaseModel):
    role: str
    target_id: Optional[int] = None
    counselor_type: Optional[str] = None
    patient_source: Optional[str] = None


class CreateUserByMobileRequest(BaseModel):
    mobile: str = Field(..., min_length=1, max_length=20)
    role: str
    nickname: Optional[str] = Field(None, max_length=100)
    patient_source: Optional[str] = None
    counselor_type: Optional[str] = None


BINDABLE_ROLE_TYPES = frozenset(
    {"Counselor", "Assistant", "Ops", "Patient", "Tester", "Admin"}
)


@router.get("/role-policy", summary="当前操作者可赋权的角色列表")
def get_role_policy(
    admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    actor_role = get_account_role(db, admin.Id)
    actor_is_key_admin = is_key_login_admin_account(admin)
    assignable = assignable_roles_for_actor(
        actor_role,
        BINDABLE_ROLE_TYPES,
        actor_is_key_admin=actor_is_key_admin,
    )
    return {
        "actorRole": actor_role,
        "actorIsKeyLoginAdmin": actor_is_key_admin,
        "assignableRoles": assignable,
    }


def _actor_role(db: Session, admin: AppAccount) -> str:
    return get_account_role(db, admin.Id)


def _guard_assign_role(db: Session, admin: AppAccount, target_role: str) -> None:
    try:
        assert_can_assign_role(
            _actor_role(db, admin),
            target_role,
            actor_is_key_admin=is_key_login_admin_account(admin),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


def _guard_manage_user(
    db: Session,
    admin: AppAccount,
    user_role: str,
    *,
    target_account: Optional[AppAccount] = None,
) -> None:
    try:
        assert_can_manage_user(
            _actor_role(db, admin),
            user_role,
            actor_is_key_admin=is_key_login_admin_account(admin),
            target_is_key_admin=is_key_login_admin_account(target_account),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


def _normalize_mobile(mobile: str) -> str:
    digits = re.sub(r"\D", "", mobile or "")
    if not re.fullmatch(r"1\d{10}", digits):
        raise HTTPException(status_code=400, detail="请输入有效的11位手机号")
    return digits


def _revoked_log_exists():
    return exists().where(
        AppRoleSwitchLog.AccountId == AppAccount.Id,
        AppRoleSwitchLog.ToRole == "REVOKED",
    )


def _role_binding_exists():
    return exists().where(
        AppRoleBinding.AccountId == AppAccount.Id,
    )


def _legacy_staff_revoked_clause():
    """AccessRevokedAt 上线前删除的用户：有 REVOKED 日志且无角色绑定。"""
    return _revoked_log_exists() & ~_role_binding_exists()


def _is_staff_revoked(db: Session, account: AppAccount) -> bool:
    if not account.IsActive:
        return False
    if getattr(account, "AccessRevokedAt", None):
        return True
    if db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == account.Id).first():
        return False
    return (
        db.query(AppRoleSwitchLog)
        .filter(
            AppRoleSwitchLog.AccountId == account.Id,
            AppRoleSwitchLog.ToRole == "REVOKED",
        )
        .first()
        is not None
    )


def _last_revoke_meta(db: Session, account_id: int, access_revoked_at=None) -> dict:
    log = (
        db.query(AppRoleSwitchLog)
        .filter(
            AppRoleSwitchLog.AccountId == account_id,
            AppRoleSwitchLog.ToRole == "REVOKED",
        )
        .order_by(AppRoleSwitchLog.SwitchedAt.desc())
        .first()
    )
    revoked_at = access_revoked_at or (log.SwitchedAt if log else None)
    return {
        "accessRevokedAt": revoked_at,
        "revokedAt": revoked_at,
        "formerActiveRole": log.FromRole if log else None,
    }


def _user_admin_out(db: Session, account: AppAccount, *, staff_remark: str = "") -> dict:
    profile = get_counselor_profile(db, account.Id)
    access_revoked_at = getattr(account, "AccessRevokedAt", None)
    counselor_name = (profile.Name if profile else None) or None
    display_name = (
        counselor_name
        or account.Nickname
        or account.RealName
        or (f"用户{account.Mobile[-4:]}" if account.Mobile else None)
        or f"用户{account.Id}"
    )
    roles = [get_account_role(db, account.Id)]
    active_role = roles[0]
    counselor_type = profile.CounselorType if profile else None
    patient_source = getattr(account, "PatientSource", None)
    if active_role == "Counselor" and counselor_type:
        active_role_label = counselor_type_label(counselor_type)
    elif active_role == "Patient" and is_charity_patient_source(patient_source):
        active_role_label = patient_source_label(patient_source)
    else:
        active_role_label = None
    out = {
        "id": account.Id,
        "mobile": account.Mobile,
        "nickname": account.Nickname,
        "displayName": display_name,
        "counselorName": counselor_name,
        "activeRole": active_role,
        "activeRoleLabel": active_role_label,
        "patientSource": normalize_patient_source(patient_source) if active_role == "Patient" else None,
        "patientSourceLabel": (
            patient_source_label(patient_source) if active_role == "Patient" else None
        ),
        "isCharityPatient": (
            is_charity_patient_source(patient_source) if active_role == "Patient" else False
        ),
        "counselorType": counselor_type if active_role == "Counselor" else None,
        "counselorTypeLabel": (
            counselor_type_label(counselor_type) if active_role == "Counselor" else None
        ),
        "roles": roles,
        "isKeyLoginAdmin": is_key_login_admin_account(account),
        "createdAt": getattr(account, "CreatedAt", None),
        "isSelfRegistered": getattr(account, "PatientSource", None) in {
            DEFAULT_PATIENT_SOURCE,
            "MINI_PROGRAM",
        },
    }
    if active_role in ("Counselor", "Patient"):
        out["staffRemark"] = staff_remark
    if active_role == "Patient":
        out["contractTag"] = patient_contract_extras(db, account).get("contractTag")
    if access_revoked_at or _is_staff_revoked(db, account):
        out.update(_last_revoke_meta(db, account.Id, access_revoked_at))
    return out


def _set_counselor_profile_active(db: Session, account_id: int, is_active: bool) -> None:
    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == account_id)
        .first()
    )
    if profile:
        profile.IsActive = is_active
        profile.UpdatedAt = datetime.utcnow()


def _ensure_counselor_profile(
    db: Session,
    account: AppAccount,
    counselor_type: str,
) -> None:
    dedupe_counselor_profiles(db, account.Id)
    profile = get_counselor_profile(db, account.Id)
    legacy_doc = resolve_legacy_doctor_for_account(
        db,
        account,
        preferred_name=account.Nickname or account.RealName,
    )
    display_name = (
        account.Nickname
        or account.RealName
        or (legacy_doc.get("name") if legacy_doc else None)
        or f"咨询师{account.Mobile[-4:] if account.Mobile else account.Id}"
    )
    if not profile:
        profile = AppCounselorProfile(
            AccountId=account.Id,
            Name=display_name,
            AvatarUrl=DEFAULT_COUNSELOR_PUBLIC_AVATAR,
            CounselorType=counselor_type,
            Billing=default_base_price_cents_for_type(counselor_type),
            IsActive=True,
        )
        db.add(profile)
    else:
        profile.CounselorType = counselor_type
        profile.IsActive = True
        if not profile.Name:
            profile.Name = display_name
        profile.UpdatedAt = datetime.utcnow()
    if legacy_doc:
        apply_legacy_doctor_to_profile(
            profile,
            legacy_doc,
            skip_billing=(counselor_type == "CHARITY"),
        )
    sync_counselor_profile_billing_for_type(profile)
    link_counselor_role_to_legacy_doctor(db, account, legacy_doc)


def _assert_no_duplicate_counselor_name(
    db: Session,
    name: Optional[str],
    *,
    exclude_account_id: Optional[int] = None,
) -> None:
    """同名且已有活跃咨询师档案时，拒绝重复创建。"""
    normalized = (name or "").strip()
    if not normalized:
        return
    q = db.query(AppCounselorProfile).filter(
        AppCounselorProfile.IsActive == True,
        AppCounselorProfile.Name == normalized,
    )
    if exclude_account_id:
        q = q.filter(AppCounselorProfile.AccountId != exclude_account_id)
    existing = q.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"已存在同名咨询师（账号 ID {existing.AccountId}），请直接为该账号绑定角色，勿重复创建",
        )


def _restore_counselor_on_rebind(db: Session, account: AppAccount) -> None:
    """解绑咨询师后再绑定：恢复档案可用状态，保留原有类型与历史数据。"""
    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == account.Id)
        .first()
    )
    if profile:
        profile.IsActive = True
        profile.UpdatedAt = datetime.utcnow()
        link_counselor_role_to_legacy_doctor(db, account)
        return
    _ensure_counselor_profile(db, account, "PROFESSIONAL")


def _restore_account_on_role_bind(db: Session, user: AppAccount, role: str) -> None:
    """解绑后再绑定：恢复账号与角色访问，历史咨询/个案等数据始终保留。"""
    user.IsActive = True
    user.AccessRevokedAt = None
    if role == "Counselor":
        _restore_counselor_on_rebind(db, user)


class RefundExemptionAdminOut(BaseModel):
    id: int
    consultationId: int
    accountId: int
    patientName: str
    patientMobile: Optional[str] = None
    patientContractTag: Optional[str] = None
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
    riskAssessment: Optional[dict] = None
    headerInfo: Optional[dict] = None
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
    keyword: Optional[str] = Query(None, description="搜索 ID、手机号、昵称或咨询师姓名"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    _admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    kw = (keyword or "").strip()
    if page == 1 and not kw:
        reconcile_existing_counselor_legacy_links(db)
        db.commit()

    q = db.query(AppAccount)
    if kw:
        profile_account_ids = [
            row[0]
            for row in db.query(AppCounselorProfile.AccountId)
            .filter(AppCounselorProfile.Name.like(f"%{kw}%"))
            .distinct()
            .all()
        ]
        filters = [
            AppAccount.Mobile.like(f"%{kw}%"),
            AppAccount.Nickname.like(f"%{kw}%"),
            AppAccount.RealName.like(f"%{kw}%"),
        ]
        if kw.isdigit():
            filters.append(AppAccount.Id == int(kw))
        if profile_account_ids:
            filters.append(AppAccount.Id.in_(profile_account_ids))
        q = q.filter(or_(*filters))

    total = q.count()
    accounts = (
        q.order_by(AppAccount.Id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    remarkable_ids = [
        u.Id for u in accounts if get_account_role(db, u.Id) in ("Counselor", "Patient")
    ]
    remarks_map = get_staff_remarks_map(db, remarkable_ids)
    items = [
        _user_admin_out(
            db,
            u,
            staff_remark=remarks_map.get(u.Id, ""),
        )
        for u in accounts
    ]

    if page == 1:
        legacy_items = list_legacy_unlinked_doctors(db, kw or None)
        items.extend(legacy_items)
        total += len(legacy_items)

    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


@router.post("/users/by-mobile", summary="通过手机号添加用户并绑定角色")
def create_user_by_mobile(
    body: CreateUserByMobileRequest,
    admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    mobile = _normalize_mobile(body.mobile)
    if body.role not in BINDABLE_ROLE_TYPES:
        raise HTTPException(status_code=400, detail="不支持绑定该角色")
    _guard_assign_role(db, admin, body.role)

    patient_source: Optional[str] = None
    counselor_type: Optional[str] = None
    if body.role == "Patient":
        try:
            patient_source = validate_patient_source(body.patient_source)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    elif body.role == "Counselor":
        try:
            counselor_type = validate_counselor_type(body.counselor_type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    account = db.query(AppAccount).filter(AppAccount.Mobile == mobile).first()
    if body.role == "Counselor" and body.nickname:
        counselor_name = body.nickname.strip()
        _assert_no_duplicate_counselor_name(
            db,
            counselor_name,
            exclude_account_id=account.Id if account else None,
        )
        if not account:
            legacy_by_name = find_legacy_doctor_by_name(db, counselor_name)
            if legacy_by_name:
                legacy_tel = re.sub(r"\D", "", legacy_by_name.get("tel") or "")
                if legacy_tel and legacy_tel != mobile:
                    raise HTTPException(
                        status_code=400,
                        detail=f"旧系统已有同名咨询师，请使用其手机号 {legacy_tel} 添加，勿重复创建",
                    )
    created = False
    if not account:
        openid = f"admin_invite_{mobile}"
        if db.query(AppAccount).filter(AppAccount.OpenId == openid).first():
            raise HTTPException(status_code=400, detail="该手机号已存在待激活账号")
        account = AppAccount(
            OpenId=openid,
            Mobile=mobile,
            Nickname=body.nickname or f"用户{mobile[-4:]}",
            ActiveRole=body.role,
            IsActive=True,
        )
        db.add(account)
        db.flush()
        created = True
    else:
        if not account.IsActive:
            raise HTTPException(status_code=400, detail="该手机号对应账号已注销")
        existing_role = get_account_role(db, account.Id)
        if existing_role != body.role:
            _guard_manage_user(db, admin, existing_role, target_account=account)
        if body.nickname:
            account.Nickname = body.nickname
        if getattr(account, "AccessRevokedAt", None):
            account.AccessRevokedAt = None

    if patient_source:
        account.PatientSource = patient_source

    set_account_role(db, account.Id, body.role)
    _restore_account_on_role_bind(db, account, body.role)
    if body.role == "Counselor" and counselor_type:
        _ensure_counselor_profile(db, account, counselor_type)
    elif body.role == "Counselor":
        _restore_counselor_on_rebind(db, account)
    invalidate_user_sessions(db, account.Id)
    account.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(account)

    return {
        **_user_admin_out(db, account),
        "created": created,
        "message": "用户已添加" if created else "已更换角色，用户重新登录后生效",
    }


@router.post("/users/{user_id}/roles", summary="设置用户角色（单账号仅一个角色）")
def bind_user_role(
    user_id: int,
    body: BindRoleRequest,
    admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    user = db.query(AppAccount).filter(AppAccount.Id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if body.role not in BINDABLE_ROLE_TYPES:
        raise HTTPException(status_code=400, detail="不支持绑定该角色")

    previous_role = get_account_role(db, user_id)
    new_role = body.role
    _guard_manage_user(db, admin, previous_role, target_account=user)
    if previous_role != new_role:
        _guard_assign_role(db, admin, new_role)

    counselor_type: Optional[str] = None
    if new_role == "Counselor":
        try:
            counselor_type = validate_counselor_type(body.counselor_type or "PROFESSIONAL")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if previous_role == "Counselor":
            _ensure_counselor_profile(db, user, counselor_type)
            user.UpdatedAt = datetime.utcnow()
            invalidate_user_sessions(db, user_id)
            db.commit()
            return {"message": "咨询师类型已更新"}
    elif new_role == "Patient":
        if not body.patient_source:
            raise HTTPException(status_code=400, detail="请选择来访类别")
        try:
            user.PatientSource = validate_patient_source(body.patient_source)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if previous_role == "Patient":
            user.UpdatedAt = datetime.utcnow()
            db.commit()
            return {"message": "来访类别已更新"}

    if previous_role == new_role:
        return {"message": "角色未变更"}

    if previous_role == "Counselor" and new_role != "Counselor":
        try:
            retire_counselor_booking_relationships(db, user_id)
            _set_counselor_profile_active(db, user_id, False)
        except ValueError as exc:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    set_account_role(db, user_id, new_role, body.target_id)
    _restore_account_on_role_bind(db, user, new_role)
    if new_role == "Counselor":
        _ensure_counselor_profile(db, user, counselor_type or "PROFESSIONAL")
    elif new_role == "Patient" and body.patient_source:
        user.PatientSource = validate_patient_source(body.patient_source)

    user.UpdatedAt = datetime.utcnow()
    db.add(AppRoleSwitchLog(
        AccountId=user_id,
        FromRole=previous_role,
        ToRole=new_role,
    ))
    invalidate_user_sessions(db, user_id)
    db.commit()
    return {"message": "角色已更换，用户重新登录后生效"}


@router.delete("/users/{user_id}/roles/{role}", summary="已废弃：请使用 POST 更换角色")
def unbind_user_role(
    user_id: int,
    role: str,
    admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=400,
        detail="单账号仅支持一个角色，请通过「更换角色」修改权限，不支持单独解绑",
    )


@router.delete("/users/{user_id}", summary="删除用户（物理删除账号）")
def delete_user_account(
    user_id: int,
    admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    """
    物理删除用户账号：
    - 从数据库中彻底移除 AppAccount 及会话、角色、档案等附属数据
    - 普通角色：若存在咨询记录、个案或已支付订单，则拒绝删除
    - Tester：即使有咨询/订单等业务数据，也级联删除后彻底移除账号
    """
    if user_id == admin.Id:
        raise HTTPException(status_code=400, detail="不能删除当前登录账号")

    account = db.query(AppAccount).filter(AppAccount.Id == user_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="用户不存在")

    user_role = get_account_role(db, user_id)
    _guard_manage_user(db, admin, user_role, target_account=account)

    try:
        hard_delete_account(db, user_id, purge_business=(user_role == "Tester"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.commit()
    return {"message": "用户已永久删除", "deletedUserId": user_id}


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
        or (counselor_acc.RealName if counselor_acc else None)
        or (counselor_acc.Mobile if counselor_acc else None)
        or "未留姓名咨询师"
    )
    patient_name = (
        (patient.RealName if patient and patient.RealName else None)
        or (patient.Nickname if patient else None)
        or (patient.Mobile if patient else None)
        or "未留姓名用户"
    )
    return RefundExemptionAdminOut(
        id=row.Id,
        consultationId=row.ConsultationId,
        accountId=row.AccountId,
        patientName=patient_name,
        patientMobile=patient.Mobile if patient else None,
        patientContractTag=patient_contract_extras(db, patient).get("contractTag"),
        counselorId=counselor_id,
        counselorName=counselor_name,
        amount=row.Amount,
        reason=row.Reason,
        screenshotUrl=row.ScreenshotUrl,
        status=row.Status,
        rejectReason=optional_model_value(row, "RejectReason"),
        consultationStartTime=consultation.StartTime if consultation else None,
        consultationStatus=consultation.Status if consultation else None,
        createdAt=row.CreatedAt,
        reviewedAt=row.ReviewedAt,
    )


@router.get(
    "/refund-exemptions",
    response_model=List[RefundExemptionAdminOut],
    summary="退款申请列表（管理工作台审核）",
)
def list_refund_exemptions(
    status: Optional[str] = Query(None, description="PENDING / APPROVED / REJECTED / ALL"),
    keyword: Optional[str] = Query(None, max_length=100, description="按来访者姓名或手机号筛选"),
    offset: int = Query(0, ge=0, description="Web 管理端分批加载偏移量；不传时保持原列表行为"),
    limit: int = Query(100, ge=1, le=500, description="Web 管理端分批加载数量；不传时仍返回前 100 条"),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    q = db.query(AppRefundExemption).order_by(
        AppRefundExemption.CreatedAt.desc(),
        AppRefundExemption.Id.desc(),
    )
    if status and status.upper() != "ALL":
        q = q.filter(AppRefundExemption.Status == status.upper())
    normalized_keyword = (keyword or "").strip()
    if normalized_keyword:
        like = f"%{normalized_keyword}%"
        matching_patient_ids = select(AppAccount.Id).where(
            or_(
                AppAccount.RealName.like(like),
                AppAccount.Nickname.like(like),
                AppAccount.Mobile.like(like),
            )
        )
        q = q.filter(AppRefundExemption.AccountId.in_(matching_patient_ids))
    rows = q.offset(offset).limit(limit).all()
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
    summary="同意退款申请",
)
def approve_refund_exemption_request(
    exemption_id: int,
    admin: AppAccount = Depends(require_staff_workbench),
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
    summary="拒绝退款申请",
)
def reject_refund_exemption_request(
    exemption_id: int,
    body: RejectRefundExemptionRequest,
    admin: AppAccount = Depends(require_staff_workbench),
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
        riskAssessment=data.get("risk_assessment"),
        headerInfo=data.get("header_info"),
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
        or (acc.RealName if acc else None)
        or (acc.Mobile if acc else None)
        or "未留姓名咨询师"
    )
    current = _snapshot_to_out(snapshot_case_record(record)) if record else CaseRecordSnapshotOut()
    proposed = CaseRecordSnapshotOut(
        subjective=row.Subjective,
        objective=row.Objective,
        assessment=row.Assessment,
        plan=row.Plan,
        riskAssessment=decode_risk_assessment(optional_model_value(row, "RiskAssessment")),
        headerInfo=decode_header_info(optional_model_value(row, "HeaderInfo")),
        photoUrls=decode_photo_urls(optional_model_value(row, "PhotoUrls")),
    )
    return CaseRecordAmendmentAdminOut(
        id=row.Id,
        caseRecordId=row.CaseRecordId,
        consultationId=row.ConsultationId,
        counselorId=row.CounselorId,
        counselorName=counselor_name,
        reason=row.Reason,
        status=row.Status,
        rejectReason=optional_model_value(row, "RejectReason"),
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
    try:
        rows = q.limit(100).all()
    except SQLAlchemyError:
        db.rollback()
        return []
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
        return "未留姓名咨询师"
    return acc.RealName or acc.Nickname or acc.Mobile or "未留姓名咨询师"


# 来访管理仅展示纯来访者，排除工作人员账号
_VISITOR_EXCLUDED_ROLES = ("Counselor", "Admin", "Ops", "Assistant")


def _admin_staff_account_ids(db: Session) -> set[int]:
    return {
        b.AccountId
        for b in db.query(AppRoleBinding)
        .filter(AppRoleBinding.RoleType.in_(_VISITOR_EXCLUDED_ROLES))
        .all()
    }


def _admin_visitor_patient_ids(db: Session) -> set[int]:
    staff_ids = _admin_staff_account_ids(db)
    tester_ids = {
        b.AccountId
        for b in db.query(AppRoleBinding)
        .filter(AppRoleBinding.RoleType == "Tester")
        .all()
    }
    role_ids = {
        b.AccountId
        for b in db.query(AppRoleBinding)
        .filter(AppRoleBinding.RoleType == "Patient")
        .all()
    } - staff_ids - tester_ids
    cons_rows = db.query(AppConsultation.PatientId).distinct().all()
    cons_ids = {row[0] for row in cons_rows if row[0]} - staff_ids - tester_ids
    return role_ids | cons_ids


def _admin_counselor_ids(db: Session) -> list[int]:
    bindings = db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Counselor").all()
    return sorted({b.AccountId for b in bindings})


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


def _assert_staff_remark_target(db: Session, account_id: int) -> None:
    """仅咨询师或来访者（含来访管理中的账号）可设置工作人员备注。"""
    role = get_account_role(db, account_id)
    if role in ("Counselor", "Patient"):
        return
    if account_id in _admin_visitor_patient_ids(db):
        return
    if account_id in _admin_counselor_ids(db):
        return
    raise HTTPException(status_code=400, detail="仅咨询师或来访者可添加备注")


class StaffRemarkUpdatePayload(BaseModel):
    remark: str = Field(default="", max_length=2000)


@router.put(
    "/accounts/{account_id}/staff-remark",
    summary="保存咨询师/来访者工作人员备注（仅管理工作台可见）",
)
def update_staff_account_remark(
    account_id: int,
    body: StaffRemarkUpdatePayload,
    admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    _assert_staff_remark_target(db, account_id)
    try:
        remark = set_staff_remark(db, account_id, body.remark, admin.Id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    return {"accountId": account_id, "staffRemark": remark}


class AdminPatientSummaryOut(BaseModel):
    patientId: int
    name: str
    mobile: Optional[str] = None
    gender: Optional[str] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None
    roleLabel: str = "来访"
    typeLabel: Optional[str] = None
    patientSource: Optional[str] = None
    patientSourceLabel: Optional[str] = None
    patientSourceDetail: Optional[str] = None
    isContractSigned: bool = False
    boundCounselorId: Optional[int] = None
    boundCounselorName: Optional[str] = None
    contractTag: Optional[str] = None
    totalConsultations: int = 0
    upcomingCount: int = 0
    completedCount: int = 0
    cancelledCount: int = 0
    lastConsultationTime: Optional[datetime] = None
    staffRemark: str = ""


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
    hasFeedback: bool = False


class AdminConsultationFeedbackOut(BaseModel):
    id: int
    consultationId: int
    patientId: int
    patientName: str
    patientMobile: Optional[str] = None
    patientContractTag: Optional[str] = None
    counselorId: int
    counselorName: str
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    goalScore: Optional[int] = None
    rhythmScore: Optional[int] = None
    improvements: List[str] = []
    summary: str
    createdAt: datetime


class AdminPatientDetailOut(BaseModel):
    patientId: int
    name: str
    mobile: Optional[str] = None
    gender: Optional[str] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None
    roleLabel: str = "来访"
    typeLabel: Optional[str] = None
    patientSource: Optional[str] = None
    patientSourceLabel: Optional[str] = None
    patientSourceDetail: Optional[str] = None
    isContractSigned: bool = False
    boundCounselorId: Optional[int] = None
    boundCounselorName: Optional[str] = None
    contractTag: Optional[str] = None
    createdAt: Optional[datetime] = None
    totalConsultations: int = 0
    upcomingCount: int = 0
    completedCount: int = 0
    cancelledCount: int = 0
    feedbackCount: int = 0
    staffRemark: str = ""
    consultations: List[AdminPatientConsultationOut] = []
    feedbacks: List[AdminConsultationFeedbackOut] = []


def _build_patient_consultation_outs(
    db: Session,
    consultations: List[AppConsultation],
    feedback_map: Optional[dict[int, AppConsultationFeedback]] = None,
) -> List[AdminPatientConsultationOut]:
    if not consultations:
        return []
    feedback_map = feedback_map or {}
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
                hasFeedback=c.Id in feedback_map,
            )
        )
    return items


def _build_admin_feedback_out(
    db: Session,
    fb: AppConsultationFeedback,
    consultation: AppConsultation,
) -> AdminConsultationFeedbackOut:
    patient = db.query(AppAccount).filter(AppAccount.Id == consultation.PatientId).first()
    sched = (
        db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if consultation.ScheduleId
        else None
    )
    start_time = consultation.StartTime or (sched.StartTime if sched else None)
    end_time = consultation.EndTime or (sched.EndTime if sched else None)
    detail = feedback_detail(fb.Content)
    contract = patient_contract_extras(db, patient)
    return AdminConsultationFeedbackOut(
        id=fb.Id,
        consultationId=consultation.Id,
        patientId=consultation.PatientId,
        patientName=_admin_patient_name(patient),
        patientMobile=patient.Mobile if patient else None,
        patientContractTag=contract.get("contractTag"),
        counselorId=consultation.CounselorId,
        counselorName=_admin_counselor_name(db, consultation.CounselorId),
        startTime=start_time,
        endTime=end_time,
        goalScore=detail.get("goalScore") if detail else None,
        rhythmScore=detail.get("rhythmScore") if detail else None,
        improvements=detail.get("improvements") or [] if detail else [],
        summary=feedback_summary(fb.Content) or fb.Content.strip(),
        createdAt=fb.CreatedAt,
    )


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
    PatientContractTag: Optional[str] = None
    StartTime: Optional[datetime] = None
    EndTime: Optional[datetime] = None
    Subjective: Optional[str] = None
    Objective: Optional[str] = None
    Assessment: Optional[str] = None
    Plan: Optional[str] = None
    RiskAssessment: Optional[dict] = None
    HeaderInfo: Optional[dict] = None
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
    RiskAssessment: Optional[dict] = None
    HeaderInfo: Optional[dict] = None
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
    patientContractTag: Optional[str] = None
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
            photo_count = len(case_record_photo_urls(record))
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
            or (account.Mobile if account else None)
            or "未留姓名咨询师"
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
    contract_map = batch_patient_contract_extras(db, list(patients.values()))
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
        photo_count = len(case_record_photo_urls(record)) if record else 0
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
                patientContractTag=contract_map.get(c.PatientId, {}).get("contractTag"),
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
        PatientContractTag=patient_contract_extras(db, patient).get("contractTag"),
        StartTime=consultation.StartTime if consultation else None,
        EndTime=consultation.EndTime if consultation else None,
        Subjective=record.Subjective,
        Objective=record.Objective,
        Assessment=record.Assessment,
        Plan=record.Plan,
        RiskAssessment=case_record_risk_assessment(record),
        HeaderInfo=case_record_header_info(record),
        PhotoUrls=case_record_photo_urls(record),
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
            RiskAssessment=decode_risk_assessment(optional_model_value(r, "RiskAssessment")),
            HeaderInfo=decode_header_info(optional_model_value(r, "HeaderInfo")),
            PhotoUrls=decode_photo_urls(optional_model_value(r, "PhotoUrls")),
            RevisedAt=r.RevisedAt,
            RevisedBy=r.RevisedBy,
        )
        for r in rows
    ]


from admin_board_routes import register_admin_board_routes

register_admin_board_routes(
    router,
    require_staff_workbench=require_staff_workbench,
    visitor_patient_ids=_admin_visitor_patient_ids,
    counselor_account_ids=_admin_counselor_ids,
)


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

    remarks_map = get_staff_remarks_map(db, account_ids)
    contract_map = batch_patient_contract_extras(db, accounts)

    result: List[AdminPatientSummaryOut] = []
    for acc in accounts:
        rows = cons_by_patient.get(acc.Id, [])
        total, upcoming, completed, cancelled, last_time = _summarize_patient_consultations(
            rows, schedules
        )
        contract = contract_map.get(acc.Id, {})
        result.append(
            AdminPatientSummaryOut(
                patientId=acc.Id,
                name=_admin_patient_name(acc),
                mobile=acc.Mobile,
                gender=acc.Gender,
                emergencyContact=acc.EmergencyContact,
                emergencyPhone=acc.EmergencyPhone,
                **_admin_patient_meta(acc),
                isContractSigned=bool(contract.get("isContractSigned")),
                boundCounselorId=contract.get("boundCounselorId"),
                boundCounselorName=contract.get("boundCounselorName"),
                contractTag=contract.get("contractTag"),
                totalConsultations=total,
                upcomingCount=upcoming,
                completedCount=completed,
                cancelledCount=cancelled,
                lastConsultationTime=last_time,
                staffRemark=remarks_map.get(acc.Id, ""),
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

    consultation_ids = [c.Id for c in consultations]
    feedback_rows: list[AppConsultationFeedback] = []
    if consultation_ids:
        feedback_rows = (
            db.query(AppConsultationFeedback)
            .filter(AppConsultationFeedback.ConsultationId.in_(consultation_ids))
            .order_by(AppConsultationFeedback.CreatedAt.desc())
            .all()
        )
    cons_by_id = {c.Id: c for c in consultations}
    feedback_map = {fb.ConsultationId: fb for fb in feedback_rows}
    cons_out = _build_patient_consultation_outs(db, consultations, feedback_map)
    cons_out.sort(
        key=lambda x: (
            x.startTime is None,
            -(x.startTime.timestamp() if x.startTime else x.createdAt.timestamp()),
        )
    )
    feedbacks_out = [
        _build_admin_feedback_out(db, fb, cons_by_id[fb.ConsultationId])
        for fb in feedback_rows
        if fb.ConsultationId in cons_by_id
    ]

    return AdminPatientDetailOut(
        patientId=patient.Id,
        name=_admin_patient_name(patient),
        mobile=patient.Mobile,
        gender=patient.Gender,
        emergencyContact=patient.EmergencyContact,
        emergencyPhone=patient.EmergencyPhone,
        **_admin_patient_meta(patient),
        **patient_contract_extras(db, patient),
        createdAt=patient.CreatedAt,
        totalConsultations=total,
        upcomingCount=upcoming,
        completedCount=completed,
        cancelledCount=cancelled,
        feedbackCount=len(feedbacks_out),
        staffRemark=get_staff_remark(db, patient_id),
        consultations=cons_out,
        feedbacks=feedbacks_out,
    )


class BindPatientCounselorPayload(BaseModel):
    counselorId: Optional[int] = Field(None, description="绑定咨询师账号 ID，传 null 表示解除绑定")


@router.put(
    "/patients/{patient_id}/bound-counselor",
    summary="绑定或更换来访者的签约咨询师",
)
def update_patient_bound_counselor(
    patient_id: int,
    body: BindPatientCounselorPayload,
    _staff: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="来访者不存在")
    if patient_id not in _admin_visitor_patient_ids(db):
        raise HTTPException(status_code=404, detail="来访者不存在")
    try:
        bind_patient_counselor(db, patient_id, body.counselorId)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(patient)
    return {
        "patientId": patient_id,
        **_admin_patient_meta(patient),
        "name": _admin_patient_name(patient),
        **patient_contract_extras(db, patient),
    }


@router.get(
    "/consultation-feedbacks",
    response_model=List[AdminConsultationFeedbackOut],
    summary="来访者咨询反馈列表",
)
def list_consultation_feedbacks(
    keyword: Optional[str] = Query(None, description="来访者/咨询师姓名搜索"),
    patient_id: Optional[int] = Query(None, description="按来访者筛选"),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AppConsultationFeedback)
        .order_by(AppConsultationFeedback.CreatedAt.desc())
        .limit(200)
        .all()
    )
    if not rows:
        return []

    consultation_ids = [r.ConsultationId for r in rows]
    consultations = {
        c.Id: c
        for c in db.query(AppConsultation).filter(AppConsultation.Id.in_(consultation_ids)).all()
    }

    result: List[AdminConsultationFeedbackOut] = []
    for fb in rows:
        consultation = consultations.get(fb.ConsultationId)
        if not consultation:
            continue
        if patient_id and consultation.PatientId != patient_id:
            continue
        item = _build_admin_feedback_out(db, fb, consultation)
        if keyword:
            kw = keyword.strip().lower()
            if kw and kw not in item.patientName.lower() and kw not in item.counselorName.lower():
                if not (item.patientMobile and kw in item.patientMobile):
                    continue
        result.append(item)
    return result


def _admin_record_is_filled(record: Optional[AppCaseRecord]) -> bool:
    if not record:
        return False
    photo_count = len(case_record_photo_urls(record))
    return bool(
        (record.Subjective or "").strip()
        or (record.Objective or "").strip()
        or (record.Assessment or "").strip()
        or (record.Plan or "").strip()
        or bool(case_record_risk_assessment(record))
        or bool(case_record_header_info(record))
        or photo_count > 0
    )


def _admin_patient_meta(account: AppAccount) -> dict:
    source = getattr(account, "PatientSource", None)
    return {
        "roleLabel": "来访",
        "typeLabel": patient_source_label(source),
        "patientSource": normalize_patient_source(source),
        "patientSourceLabel": patient_source_label(source),
        "patientSourceDetail": getattr(account, "PatientSourceDetail", None),
    }


def _admin_counselor_meta(profile: Optional[AppCounselorProfile]) -> dict:
    if not profile:
        return {"roleLabel": "咨询师", "typeLabel": None}
    ctype = profile.CounselorType or "PROFESSIONAL"
    return {
        "roleLabel": "咨询师",
        "typeLabel": counselor_type_label(ctype),
    }


def _admin_profile_dict(profile: Optional[AppCounselorProfile], counselor_id: int, db: Session) -> dict:
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    billing = int(profile.Billing or 0) if profile else 0
    face_billing = int(profile.FaceBilling or 0) if profile else 0
    if billing <= 0:
        billing = 60000
    if face_billing <= 0:
        face_billing = 30000
    return {
        "counselorId": counselor_id,
        "name": (profile.Name if profile else None) or (acc.Nickname if acc else None) or "",
        "avatarUrl": resolve_counselor_public_avatar_url(profile.AvatarUrl if profile else None),
        "title": profile.Title if profile else None,
        "specialty": profile.Specialty if profile else None,
        "field": profile.Field if profile else None,
        "introduce": profile.Introduce if profile else None,
        "career": profile.Career if profile else None,
        "trainingExperience": profile.TrainingExperience if profile else None,
        "qualification": profile.Qualification if profile else None,
        "targetGroup": profile.TargetGroup if profile else None,
        "gender": _normalize_gender_value(acc.Gender if acc else None),
        "mode": normalize_counselor_mode(profile.Mode if profile else None),
        "workYears": int(profile.WorkYears or 0) if profile else 0,
        "consultHours": int(profile.ConsultHours or 0) if profile else 0,
        "billing": billing,
        "faceBilling": face_billing,
        "billingYuan": billing // 100,
        "faceBillingYuan": face_billing // 100,
        "infoAuthenticityCommitted": bool(profile.InfoAuthenticityCommittedAt) if profile else False,
        "infoAuthenticityCommittedAt": profile.InfoAuthenticityCommittedAt if profile else None,
        "infoAuthenticitySignerName": profile.InfoAuthenticitySignerName if profile else None,
        "isActive": bool(profile.IsActive) if profile else True,
        **_admin_counselor_meta(profile),
    }


class AdminCounselorSummaryOut(BaseModel):
    counselorId: int
    name: str
    title: Optional[str] = None
    avatarUrl: Optional[str] = None
    roleLabel: str = "咨询师"
    typeLabel: Optional[str] = None
    activeBookingCount: int = 0
    cancelledCount: int = 0
    scheduleCount: int = 0
    recordedCount: int = 0
    missingRecordCount: int = 0
    visitorCount: int = 0
    billingYuan: int = 600
    faceBillingYuan: int = 300
    staffRemark: str = ""


class AdminCounselorVisitorOut(BaseModel):
    patientId: int
    patientName: str
    mobile: Optional[str] = None
    patientContractTag: Optional[str] = None
    consultationCount: int = 0


class AdminCounselorScheduleOut(BaseModel):
    scheduleId: int
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    status: str
    statusLabel: str
    patientName: Optional[str] = None
    patientContractTag: Optional[str] = None
    location: Optional[str] = None


class AdminCounselorConsultationBriefOut(BaseModel):
    consultationId: int
    patientId: int
    patientName: str
    patientContractTag: Optional[str] = None
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    status: str
    statusLabel: str
    hasRecord: bool = False


class AdminCounselorStatsOut(BaseModel):
    activeBookingCount: int = 0
    cancelledCount: int = 0
    scheduleCount: int = 0
    recordedCount: int = 0
    missingRecordCount: int = 0
    visitorCount: int = 0
    totalConsultations: int = 0


class AdminCounselorDetailOut(BaseModel):
    counselorId: int
    name: str
    avatarUrl: Optional[str] = None
    title: Optional[str] = None
    roleLabel: str = "咨询师"
    typeLabel: Optional[str] = None
    specialty: Optional[str] = None
    field: Optional[str] = None
    introduce: Optional[str] = None
    career: Optional[str] = None
    trainingExperience: Optional[str] = None
    qualification: Optional[str] = None
    targetGroup: Optional[str] = None
    gender: Optional[str] = None
    mode: Optional[str] = None
    workYears: int = 0
    consultHours: int = 0
    billing: int = 60000
    faceBilling: int = 30000
    billingYuan: int = 600
    faceBillingYuan: int = 300
    infoAuthenticityCommitted: bool = False
    infoAuthenticityCommittedAt: Optional[datetime] = None
    infoAuthenticitySignerName: Optional[str] = None
    isActive: bool = True
    stats: AdminCounselorStatsOut
    visitors: List[AdminCounselorVisitorOut] = []
    schedules: List[AdminCounselorScheduleOut] = []
    recordedConsultations: List[AdminCounselorConsultationBriefOut] = []
    unrecordedConsultations: List[AdminCounselorConsultationBriefOut] = []
    staffRemark: str = ""


class AdminCounselorUpdatePayload(BaseModel):
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    title: Optional[str] = None
    specialty: Optional[str] = None
    field: Optional[str] = None
    introduce: Optional[str] = None
    career: Optional[str] = None
    trainingExperience: Optional[str] = None
    qualification: Optional[str] = None
    targetGroup: Optional[str] = None
    gender: Optional[str] = None
    mode: Optional[str] = None
    workYears: Optional[int] = None
    consultHours: Optional[int] = None
    billingYuan: Optional[int] = Field(None, ge=0, le=99999)
    faceBillingYuan: Optional[int] = Field(None, ge=0, le=99999)
    isActive: Optional[bool] = None


def _admin_counselor_stats(
    db: Session,
    counselor_id: int,
    consultations: list,
    schedules: list,
    records_by_consultation: dict[int, AppCaseRecord],
) -> AdminCounselorStatsOut:
    now = china_now()
    active = 0
    cancelled = 0
    recorded = 0
    missing = 0
    patient_ids: set[int] = set()
    for c in consultations:
        patient_ids.add(c.PatientId)
        if c.Status == "CANCELLED":
            cancelled += 1
            continue
        if c.Status in ("PENDING", "CONFIRMED", "ONGOING"):
            active += 1
        if c.Status == "DONE":
            record = records_by_consultation.get(c.Id)
            if _admin_record_is_filled(record):
                recorded += 1
            else:
                missing += 1
    future_schedules = [
        s for s in schedules
        if s.StartTime and s.StartTime >= now and s.Status in ("AVAILABLE", "BOOKED")
    ]
    return AdminCounselorStatsOut(
        activeBookingCount=active,
        cancelledCount=cancelled,
        scheduleCount=len(future_schedules),
        recordedCount=recorded,
        missingRecordCount=missing,
        visitorCount=len(patient_ids),
        totalConsultations=len(consultations),
    )


@router.get(
    "/counselors",
    response_model=List[AdminCounselorSummaryOut],
    summary="咨询师管理列表",
)
def list_admin_counselors(
    keyword: Optional[str] = Query(None, description="姓名搜索"),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    counselor_ids = _admin_counselor_ids(db)
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

    if keyword:
        kw = keyword.strip().lower()
        if kw:
            filtered = []
            for cid in counselor_ids:
                prof = profiles.get(cid)
                acc = accounts.get(cid)
                name = (
                    (prof.Name if prof else None)
                    or (acc.Nickname if acc else None)
                    or (acc.RealName if acc else None)
                    or ""
                ).lower()
                if kw in name:
                    filtered.append(cid)
            counselor_ids = filtered

    consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.CounselorId.in_(counselor_ids))
        .all()
    ) if counselor_ids else []
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

    now = china_now()
    schedules = (
        db.query(AppSchedule)
        .filter(AppSchedule.CounselorId.in_(counselor_ids))
        .all()
    ) if counselor_ids else []
    schedules_by_counselor: dict[int, list] = {}
    for s in schedules:
        schedules_by_counselor.setdefault(s.CounselorId, []).append(s)

    remarks_map = get_staff_remarks_map(db, counselor_ids)

    result: List[AdminCounselorSummaryOut] = []
    for cid in counselor_ids:
        prof = profiles.get(cid)
        acc = accounts.get(cid)
        name = (
            (prof.Name if prof else None)
            or (acc.Nickname if acc else None)
            or (acc.RealName if acc else None)
            or (acc.Mobile if acc else None)
            or "未留姓名咨询师"
        )
        cons = cons_by_counselor.get(cid, [])
        scheds = schedules_by_counselor.get(cid, [])
        stats = _admin_counselor_stats(db, cid, cons, scheds, records_by_consultation)
        billing = int(prof.Billing or 0) if prof else 0
        face_billing = int(prof.FaceBilling or 0) if prof else 0
        if billing <= 0:
            billing = 60000
        if face_billing <= 0:
            face_billing = 30000
        result.append(
            AdminCounselorSummaryOut(
                counselorId=cid,
                name=name,
                title=prof.Title if prof else None,
                avatarUrl=resolve_counselor_public_avatar_url(prof.AvatarUrl if prof else None),
                **_admin_counselor_meta(prof),
                activeBookingCount=stats.activeBookingCount,
                cancelledCount=stats.cancelledCount,
                scheduleCount=stats.scheduleCount,
                recordedCount=stats.recordedCount,
                missingRecordCount=stats.missingRecordCount,
                visitorCount=stats.visitorCount,
                billingYuan=billing // 100,
                faceBillingYuan=face_billing // 100,
                staffRemark=remarks_map.get(cid, ""),
            )
        )
    result.sort(key=lambda x: x.name)
    return result


class CounselorDisplayOrderItemOut(BaseModel):
    counselorId: int
    name: str
    avatarUrl: Optional[str] = None
    title: Optional[str] = None
    billingYuan: int = 0
    isPinned: bool = False
    isPublicVisible: bool = True
    listSortRank: int = 0


class CounselorDisplayOrderItemIn(BaseModel):
    counselorId: int
    isPinned: bool = False
    isPublicVisible: bool = True
    listSortRank: int = Field(0, ge=0, le=100000)


class CounselorDisplayOrderSavePayload(BaseModel):
    items: List[CounselorDisplayOrderItemIn] = Field(default_factory=list)


def _build_counselor_display_order_items(db: Session) -> List[dict]:
    """管理工作台排序模块：含已隐藏咨询师，顺序与来访端公开列表算法一致。"""
    counselor_ids = _admin_counselor_ids(db)
    if not counselor_ids:
        return []

    profiles = (
        db.query(AppCounselorProfile)
        .filter(
            AppCounselorProfile.AccountId.in_(counselor_ids),
            AppCounselorProfile.IsActive == True,
        )
        .all()
    )
    accounts = {
        a.Id: a
        for a in db.query(AppAccount).filter(AppAccount.Id.in_(counselor_ids)).all()
    }
    sort_items: List[dict] = []
    for profile in profiles:
        cid = int(profile.AccountId or 0)
        if not cid:
            continue
        acc = accounts.get(cid)
        billing = int(profile.Billing or 0) or 60000
        sort_items.append(
            {
                "id": cid,
                "counselorId": cid,
                "name": (profile.Name or (acc.RealName if acc else None) or (acc.Nickname if acc else None) or f"咨询师{cid}"),
                "avatarUrl": resolve_counselor_public_avatar_url(profile.AvatarUrl),
                "title": profile.Title,
                "billing": float(billing),
                "billingYuan": billing // 100,
                "consultHours": int(profile.ConsultHours or 0),
                "workYears": int(profile.WorkYears or 0),
                "introduce": profile.Introduce,
                "specialty": profile.Specialty,
                "field": profile.Field,
                "career": profile.Career,
                "trainingExperience": getattr(profile, "TrainingExperience", None),
                "mode": profile.Mode,
                "avatarUrlRaw": profile.AvatarUrl,
                "isPinned": bool(getattr(profile, "IsPinned", False) or False),
                "listSortRank": int(getattr(profile, "ListSortRank", 0) or 0),
                "isPublicVisible": _profile_is_public_visible(profile),
                "_source": "AppCounselorProfile",
            }
        )

    available_ids = _counselor_ids_with_available_slots(
        db, [int(item["id"]) for item in sort_items]
    )
    _sort_counselor_list(sort_items, sort_mode="price_desc", available_ids=available_ids)
    return sort_items


@router.get(
    "/counselors/display-order",
    summary="咨询师公开展示排序（含隐藏，供管理工作台调整）",
)
def get_counselor_display_order(
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    items = _build_counselor_display_order_items(db)
    return {
        "items": [
            CounselorDisplayOrderItemOut(
                counselorId=int(item["counselorId"]),
                name=str(item.get("name") or ""),
                avatarUrl=item.get("avatarUrl"),
                title=item.get("title"),
                billingYuan=int(item.get("billingYuan") or 0),
                isPinned=bool(item.get("isPinned")),
                isPublicVisible=bool(item.get("isPublicVisible", True)),
                listSortRank=int(item.get("listSortRank") or 0),
            ).model_dump()
            for item in items
        ]
    }


@router.put(
    "/counselors/display-order",
    summary="保存咨询师公开展示排序与隐藏状态",
)
def save_counselor_display_order(
    body: CounselorDisplayOrderSavePayload,
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    allowed_ids = set(_admin_counselor_ids(db))
    if not body.items:
        raise HTTPException(status_code=400, detail="排序列表不能为空")

    seen: set[int] = set()
    normalized: List[CounselorDisplayOrderItemIn] = []
    for raw in body.items:
        cid = int(raw.counselorId)
        if cid not in allowed_ids:
            raise HTTPException(status_code=400, detail=f"咨询师不存在或不属于可管理范围: {cid}")
        if cid in seen:
            raise HTTPException(status_code=400, detail=f"咨询师重复: {cid}")
        seen.add(cid)
        normalized.append(raw)

    profiles = {
        int(p.AccountId): p
        for p in db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId.in_(list(seen)))
        .all()
    }
    missing = [cid for cid in seen if cid not in profiles]
    if missing:
        raise HTTPException(status_code=400, detail=f"咨询师资料不存在: {missing[0]}")

    now = datetime.utcnow()
    for index, item in enumerate(normalized, start=1):
        profile = profiles[int(item.counselorId)]
        profile.IsPinned = bool(item.isPinned)
        profile.IsPublicVisible = bool(item.isPublicVisible)
        profile.ListSortRank = index
        profile.UpdatedAt = now

    db.commit()
    items = _build_counselor_display_order_items(db)
    return {
        "items": [
            CounselorDisplayOrderItemOut(
                counselorId=int(item["counselorId"]),
                name=str(item.get("name") or ""),
                avatarUrl=item.get("avatarUrl"),
                title=item.get("title"),
                billingYuan=int(item.get("billingYuan") or 0),
                isPinned=bool(item.get("isPinned")),
                isPublicVisible=bool(item.get("isPublicVisible", True)),
                listSortRank=int(item.get("listSortRank") or 0),
            ).model_dump()
            for item in items
        ]
    }


@router.get(
    "/counselors/{counselor_id}",
    response_model=AdminCounselorDetailOut,
    summary="咨询师管理详情",
)
def get_admin_counselor_detail(
    counselor_id: int,
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    if counselor_id not in _admin_counselor_ids(db):
        raise HTTPException(status_code=404, detail="咨询师不存在")

    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    base = _admin_profile_dict(profile, counselor_id, db)

    consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.CounselorId == counselor_id)
        .order_by(AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
        .all()
    )
    consultation_ids = [c.Id for c in consultations]
    records_by_consultation: dict[int, AppCaseRecord] = {}
    if consultation_ids:
        for r in db.query(AppCaseRecord).filter(
            AppCaseRecord.ConsultationId.in_(consultation_ids)
        ).all():
            records_by_consultation[r.ConsultationId] = r

    schedules = (
        db.query(AppSchedule)
        .filter(AppSchedule.CounselorId == counselor_id)
        .order_by(AppSchedule.StartTime.asc())
        .all()
    )
    schedule_ids = {c.ScheduleId for c in consultations if c.ScheduleId}
    schedule_map = {s.Id: s for s in schedules}

    stats = _admin_counselor_stats(
        db, counselor_id, consultations, schedules, records_by_consultation
    )

    patient_ids = {c.PatientId for c in consultations}
    patients = {
        a.Id: a
        for a in db.query(AppAccount).filter(AppAccount.Id.in_(patient_ids)).all()
    } if patient_ids else {}
    contract_map = batch_patient_contract_extras(db, list(patients.values())) if patients else {}
    visitor_counts: dict[int, int] = {}
    for c in consultations:
        if c.Status == "CANCELLED":
            continue
        visitor_counts[c.PatientId] = visitor_counts.get(c.PatientId, 0) + 1
    visitors = [
        AdminCounselorVisitorOut(
            patientId=pid,
            patientName=_admin_patient_name(patients.get(pid)),
            mobile=patients[pid].Mobile if pid in patients else None,
            patientContractTag=contract_map.get(pid, {}).get("contractTag"),
            consultationCount=count,
        )
        for pid, count in sorted(visitor_counts.items(), key=lambda x: -x[1])
    ]

    now = china_now()
    schedule_out: List[AdminCounselorScheduleOut] = []
    for s in schedules:
        if s.StartTime and s.StartTime < now - timedelta(days=7):
            continue
        linked = next((c for c in consultations if c.ScheduleId == s.Id), None)
        patient_name = _admin_patient_name(patients.get(linked.PatientId)) if linked else None
        patient_tag = contract_map.get(linked.PatientId, {}).get("contractTag") if linked else None
        label = "已预约" if linked and linked.Status != "CANCELLED" else (
            "可预约" if s.Status == "AVAILABLE" else s.Status
        )
        schedule_out.append(
            AdminCounselorScheduleOut(
                scheduleId=s.Id,
                startTime=s.StartTime,
                endTime=s.EndTime,
                status=s.Status,
                statusLabel=label,
                patientName=patient_name if linked and linked.Status != "CANCELLED" else None,
                patientContractTag=patient_tag if linked and linked.Status != "CANCELLED" else None,
                location=_admin_consultation_location(db, linked, s) if linked else (
                    center_display_name(parse_center_id(s.Note or "")) if s.Note else None
                ),
            )
        )

    recorded_out: List[AdminCounselorConsultationBriefOut] = []
    unrecorded_out: List[AdminCounselorConsultationBriefOut] = []
    for c in consultations:
        if c.Status != "DONE":
            continue
        record = records_by_consultation.get(c.Id)
        filled = _admin_record_is_filled(record)
        brief = AdminCounselorConsultationBriefOut(
            consultationId=c.Id,
            patientId=c.PatientId,
            patientName=_admin_patient_name(patients.get(c.PatientId)),
            patientContractTag=contract_map.get(c.PatientId, {}).get("contractTag"),
            startTime=c.StartTime,
            endTime=c.EndTime,
            status=c.Status,
            statusLabel=_admin_consultation_status_label(c.Status, c.StartTime),
            hasRecord=filled,
        )
        if filled:
            recorded_out.append(brief)
        else:
            unrecorded_out.append(brief)

    return AdminCounselorDetailOut(
        stats=stats,
        visitors=visitors,
        schedules=schedule_out[:50],
        recordedConsultations=recorded_out[:30],
        unrecordedConsultations=unrecorded_out[:30],
        staffRemark=get_staff_remark(db, counselor_id),
        **{k: v for k, v in base.items() if k != "counselorId"},
        counselorId=counselor_id,
    )


@router.put(
    "/counselors/{counselor_id}",
    response_model=AdminCounselorDetailOut,
    summary="管理员更新咨询师资料与定价",
)
def update_admin_counselor(
    counselor_id: int,
    body: AdminCounselorUpdatePayload,
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    if counselor_id not in _admin_counselor_ids(db):
        raise HTTPException(status_code=404, detail="咨询师不存在")

    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if not profile:
        profile = AppCounselorProfile(
            AccountId=counselor_id,
            AvatarUrl=DEFAULT_COUNSELOR_PUBLIC_AVATAR,
            Billing=60000,
            FaceBilling=30000,
        )
        db.add(profile)

    if body.isActive is False:
        try:
            retire_counselor_booking_relationships(db, counselor_id)
        except ValueError as exc:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    mapping = {
        "name": "Name",
        "avatarUrl": "AvatarUrl",
        "title": "Title",
        "specialty": "Specialty",
        "field": "Field",
        "introduce": "Introduce",
        "career": "Career",
        "trainingExperience": "TrainingExperience",
        "qualification": "Qualification",
        "targetGroup": "TargetGroup",
        "workYears": "WorkYears",
        "consultHours": "ConsultHours",
        "isActive": "IsActive",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(profile, dst, val)
    if body.mode is not None:
        normalized_mode = normalize_counselor_mode(body.mode)
        if not normalized_mode:
            raise HTTPException(status_code=400, detail="咨询方式不能为空")
        profile.Mode = normalized_mode
    if body.gender is not None:
        normalized_gender = _normalize_gender_value(body.gender)
        if body.gender.strip() and not normalized_gender:
            raise HTTPException(status_code=400, detail="性别仅支持男或女")
        account = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="咨询师账号不存在")
        account.Gender = normalized_gender
    if body.billingYuan is not None:
        profile.Billing = int(body.billingYuan) * 100
    if body.faceBillingYuan is not None:
        profile.FaceBilling = int(body.faceBillingYuan) * 100
    profile.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return get_admin_counselor_detail(counselor_id, _admin, db)


@router.get("/leave-requests", summary="咨询师请假列表（管理工作台审批）")
def list_leave_requests(
    status: str = Query("ALL", description="PENDING|APPROVED|REJECTED|ALL"),
    keyword: Optional[str] = Query(None, max_length=100, description="按咨询师姓名或手机号筛选"),
    offset: int = Query(0, ge=0, description="Web 管理端分批加载偏移量；不传时保持原列表行为"),
    limit: int = Query(100, ge=1, le=500, description="Web 管理端分批加载数量；不传时仍返回前 100 条"),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    q = db.query(AppLeaveRequest).order_by(
        AppLeaveRequest.CreatedAt.desc(),
        AppLeaveRequest.Id.desc(),
    )
    normalized_status = (status or "ALL").upper()
    if normalized_status != "ALL":
        q = q.filter(AppLeaveRequest.Status == normalized_status)
    normalized_keyword = (keyword or "").strip()
    if normalized_keyword:
        like = f"%{normalized_keyword}%"
        matching_account_ids = select(AppAccount.Id).where(
            or_(
                AppAccount.RealName.like(like),
                AppAccount.Nickname.like(like),
                AppAccount.Mobile.like(like),
            )
        )
        matching_profile_ids = select(AppCounselorProfile.AccountId).where(
            AppCounselorProfile.Name.like(like)
        )
        q = q.filter(
            or_(
                AppLeaveRequest.CounselorId.in_(matching_account_ids),
                AppLeaveRequest.CounselorId.in_(matching_profile_ids),
            )
        )
    rows = q.offset(offset).limit(limit).all()
    return [build_leave_request_out(db, row) for row in rows]


@router.get("/leave-requests/{leave_id}", summary="咨询师请假详情（管理工作台审批）")
def get_leave_request(
    leave_id: int,
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    row = db.query(AppLeaveRequest).filter(AppLeaveRequest.Id == leave_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    return build_leave_request_out(db, row)


@router.post("/leave-requests/{leave_id}/approve", summary="通过咨询师请假")
def approve_leave_request_api(
    leave_id: int,
    admin: AppAccount = Depends(require_staff_workbench),
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


class LeaveRequestRejectPayload(BaseModel):
    rejectReason: Optional[str] = Field(None, max_length=500)


@router.post("/leave-requests/{leave_id}/reject", summary="拒绝咨询师请假")
def reject_leave_request_api(
    leave_id: int,
    body: Optional[LeaveRequestRejectPayload] = None,
    admin: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    row = db.query(AppLeaveRequest).filter(AppLeaveRequest.Id == leave_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    try:
        reject_leave_request(
            db,
            row,
            admin.Id,
            reject_reason=body.rejectReason if body else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": "已拒绝请假申请", "status": "REJECTED"}


# ---------------------------------------------------------------------------
# 定价管理（管理员）
# ---------------------------------------------------------------------------


class AdminPricingUpdatePayload(BaseModel):
    adjustmentYuan: int = Field(..., ge=-99999, le=99999, description="手动调价（元，可正可负）")
    shareMode: Optional[str] = Field(None, description="AMOUNT | PERCENT，空则使用咨询师默认分成")
    revenueShareYuan: Optional[int] = Field(None, ge=0, le=99999)
    revenueSharePercent: Optional[int] = Field(None, ge=0, le=100)


class AdminCounselorDefaultSharePayload(BaseModel):
    shareMode: Optional[str] = Field(None, description="AMOUNT | PERCENT，空则默认基础价的 50% 分成")
    revenueShareYuan: Optional[int] = Field(None, ge=0, le=99999)
    revenueSharePercent: Optional[int] = Field(None, ge=0, le=100)


class AdminCounselorBatchDefaultSharePayload(BaseModel):
    counselorIds: List[int] = Field(..., min_length=1, max_length=200)
    revenueSharePercent: int = Field(..., ge=0, le=100)
    overridePatientShares: bool = Field(
        True,
        description="是否清除所选咨询师现有的来访个体分成；默认与单项调整一致进行覆盖",
    )


class AdminCounselorBasePricePayload(BaseModel):
    basePriceYuan: int = Field(..., ge=0, le=99999, description="咨询师统一基础价（元）")
    defaultRevenueShareYuan: Optional[int] = Field(None, ge=0, le=99999, description="咨询师默认分成金额（元）")
    defaultRevenueSharePercent: Optional[int] = Field(None, ge=0, le=100, description="咨询师默认分成比例（百分比）")


@router.get("/pricing/counselors", summary="定价管理：咨询师列表（含统一基础价）")
def list_pricing_counselors(
    keyword: Optional[str] = Query(None),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    from pricing_service import list_counselor_pricing_summaries

    if not (keyword or "").strip():
        reconcile_existing_counselor_legacy_links(db)
        db.commit()

    items = list_counselor_pricing_summaries(db, keyword=keyword)
    return {"total": len(items), "items": items}


@router.post(
    "/pricing/counselors/default-share/batch-preview",
    summary="预览批量调整咨询师默认分成比例",
)
def preview_pricing_counselor_default_share_batch(
    body: AdminCounselorBatchDefaultSharePayload,
    _actor: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    from pricing_service import preview_batch_counselor_default_share_percent

    try:
        return preview_batch_counselor_default_share_percent(
            db,
            body.counselorIds,
            revenue_share_percent=body.revenueSharePercent,
            override_patient_shares=body.overridePatientShares,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/pricing/counselors/default-share/batch",
    summary="批量调整咨询师默认分成比例",
)
def update_pricing_counselor_default_share_batch(
    body: AdminCounselorBatchDefaultSharePayload,
    actor: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    from pricing_notify_service import notify_counselor_default_share_batch_updated
    from pricing_service import update_batch_counselor_default_share_percent

    try:
        result = update_batch_counselor_default_share_percent(
            db,
            body.counselorIds,
            revenue_share_percent=body.revenueSharePercent,
            override_patient_shares=body.overridePatientShares,
        )
        notify_counselor_default_share_batch_updated(
            db,
            actor_id=actor.Id,
            result=result,
        )
        db.commit()
        return result
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        db.rollback()
        raise


@router.put("/pricing/counselors/{counselor_id}", summary="更新咨询师统一基础价")
def update_pricing_counselor_base(
    counselor_id: int,
    body: AdminCounselorBasePricePayload,
    actor: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    from pricing_service import (
        _counselor_default_share_snapshot,
        counselor_pricing_summary,
        get_counselor_profile,
        resolve_counselor_base_price_cents,
        update_counselor_base_price_cents,
        update_counselor_base_pricing_cents,
    )
    from pricing_notify_service import notify_counselor_base_pricing_updated

    old_yuan = resolve_counselor_base_price_cents(db, counselor_id) // 100
    before_profile = get_counselor_profile(db, counselor_id)
    before_share = _counselor_default_share_snapshot(before_profile)
    try:
        if body.defaultRevenueShareYuan is not None and body.defaultRevenueSharePercent is not None:
            raise ValueError("默认分成金额与比例不能同时设置")
        if body.defaultRevenueShareYuan is None and body.defaultRevenueSharePercent is None:
            update_counselor_base_price_cents(db, counselor_id, body.basePriceYuan * 100)
        else:
            update_counselor_base_pricing_cents(
                db,
                counselor_id,
                base_price_cents=body.basePriceYuan * 100,
                default_share_cents=(
                    body.defaultRevenueShareYuan * 100
                    if body.defaultRevenueShareYuan is not None
                    else None
                ),
                default_share_percent=body.defaultRevenueSharePercent,
            )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    after_profile = get_counselor_profile(db, counselor_id)
    after_share = _counselor_default_share_snapshot(after_profile)
    if old_yuan != body.basePriceYuan or before_share != after_share:
        notify_counselor_base_pricing_updated(
            db,
            actor_id=actor.Id,
            counselor_id=counselor_id,
            old_base_yuan=old_yuan,
            new_base_yuan=body.basePriceYuan,
            before_share=before_share,
            after_share=after_share,
        )
    db.commit()
    return counselor_pricing_summary(db, counselor_id)


@router.put("/pricing/counselors/{counselor_id}/default-share", summary="更新咨询师默认分成（对该咨询师全部来访生效）")
def update_pricing_counselor_default_share(
    counselor_id: int,
    body: AdminCounselorDefaultSharePayload,
    actor: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    from pricing_service import (
        _counselor_default_share_snapshot,
        counselor_pricing_summary,
        get_counselor_profile,
        resolve_counselor_base_price_cents,
        update_counselor_default_share,
    )
    from pricing_notify_service import notify_counselor_base_pricing_updated

    before_profile = get_counselor_profile(db, counselor_id)
    if not before_profile:
        raise HTTPException(status_code=404, detail="咨询师不存在")
    before_share = _counselor_default_share_snapshot(before_profile)
    base_yuan = resolve_counselor_base_price_cents(db, counselor_id) // 100
    try:
        update_counselor_default_share(
            db,
            counselor_id,
            share_mode=body.shareMode or None,
            revenue_share_cents=body.revenueShareYuan * 100 if body.revenueShareYuan is not None else None,
            revenue_share_percent=body.revenueSharePercent,
            apply_to_all_patients=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    after_profile = get_counselor_profile(db, counselor_id)
    after_share = _counselor_default_share_snapshot(after_profile)
    if before_share != after_share:
        notify_counselor_base_pricing_updated(
            db,
            actor_id=actor.Id,
            counselor_id=counselor_id,
            old_base_yuan=base_yuan,
            new_base_yuan=base_yuan,
            before_share=before_share,
            after_share=after_share,
        )
    db.commit()
    return counselor_pricing_summary(db, counselor_id)


@router.get("/pricing/counselors/{counselor_id}/patients", summary="某咨询师下来访调价列表")
def list_pricing_counselor_patients(
    counselor_id: int,
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    from pricing_service import counselor_pricing_summary, get_counselor_profile, list_counselor_patient_pricing

    if not get_counselor_profile(db, counselor_id):
        raise HTTPException(status_code=404, detail="咨询师不存在")
    items, total = list_counselor_patient_pricing(
        db,
        counselor_id,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return {
        "counselor": counselor_pricing_summary(db, counselor_id),
        "total": total,
        "page": page,
        "pageSize": page_size,
        "items": items,
    }


@router.put("/pricing/counselors/{counselor_id}/patients/{patient_id}", summary="更新来访调价与分成")
def update_pricing_counselor_patient(
    counselor_id: int,
    patient_id: int,
    body: AdminPricingUpdatePayload,
    actor: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    from pricing_service import get_pricing_override, pricing_breakdown, upsert_patient_pricing
    from pricing_notify_service import _share_snapshot, notify_pricing_updates_after_patient_save

    before_override = get_pricing_override(db, counselor_id, patient_id)
    before_manual_cents = int(before_override.AdjustmentCents or 0) if before_override else 0
    before_share = _share_snapshot(before_override)
    try:
        upsert_patient_pricing(
            db,
            counselor_id,
            patient_id,
            adjustment_cents=body.adjustmentYuan * 100,
            share_mode=body.shareMode or None,
            revenue_share_cents=body.revenueShareYuan * 100 if body.revenueShareYuan is not None else None,
            revenue_share_percent=body.revenueSharePercent,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    after_breakdown = pricing_breakdown(db, patient_id, counselor_id)
    notify_pricing_updates_after_patient_save(
        db,
        actor_id=actor.Id,
        counselor_id=counselor_id,
        patient_id=patient_id,
        before_manual_cents=before_manual_cents,
        before_share=before_share,
        after_breakdown=after_breakdown,
    )
    db.commit()
    return after_breakdown


from proxy_booking_routes import router as proxy_booking_router
from assessment_routes import register_assessment_admin_routes
from assessment_report_routes import register_assessment_report_admin_routes
from assessment_share_routes import register_assessment_share_admin_routes
from system_settings_routes import register_system_settings_routes

register_assessment_admin_routes(
    router,
    require_assessment_editor=require_assessment_editor,
)

register_assessment_report_admin_routes(
    router,
    require_assessment_viewer=require_staff_workbench,
    visitor_patient_ids=_admin_visitor_patient_ids,
)

register_assessment_share_admin_routes(
    router,
    require_assessment_viewer=require_staff_workbench,
)

register_system_settings_routes(
    router,
    require_staff_workbench=require_staff_workbench,
    require_admin=require_admin,
)

router.include_router(proxy_booking_router)
