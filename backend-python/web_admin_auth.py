"""Web 管理端（admin-web）短信验证码 / 密码登录与改密。"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_account
from database import get_db
from models import AppAccount, AppLoginSession
from password_utils import hash_password, verify_password
from role_active import get_account_role
from sms_service import normalize_phone, send_verification_code, verify_code

router = APIRouter(prefix="/api/web/admin/auth", tags=["Web Admin Auth"])

WEB_ADMIN_ROLES = frozenset({"Admin", "Ops", "Assistant", "Counselor"})
ADMIN_LOGIN_PURPOSE = "admin_login"
ADMIN_RESET_PASSWORD_PURPOSE = "admin_reset_password"
MIN_PASSWORD_LENGTH = 6


class AdminSendCodeRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    purpose: str = Field(default="login", pattern="^(login|reset_password)$")


class AdminSmsLoginRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    code: str = Field(..., min_length=4, max_length=8)


class AdminPasswordLoginRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    password: str = Field(..., min_length=1, max_length=128)


class AdminResetPasswordRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    code: str = Field(..., min_length=4, max_length=8)
    newPassword: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)


class AdminAuthTokenResponse(BaseModel):
    token: str


class AdminMessageResponse(BaseModel):
    message: str


def _find_active_account_by_mobile(db: Session, mobile: str) -> Optional[AppAccount]:
    return (
        db.query(AppAccount)
        .filter(AppAccount.Mobile == mobile, AppAccount.IsActive == True)
        .order_by(AppAccount.Id.desc())
        .first()
    )


def _ensure_admin_web_staff(db: Session, account: AppAccount) -> str:
    role = get_account_role(db, account.Id)
    if role not in WEB_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="该账号无权进入 Web 管理端")
    return role


def _validate_new_password(password: str) -> str:
    value = (password or "").strip()
    if len(value) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"密码至少 {MIN_PASSWORD_LENGTH} 位")
    return value


def _issue_token(db: Session, account: AppAccount) -> str:
    openid = account.OpenId or f"web_admin_{account.Id}"
    token, expire = create_access_token({"sub": str(account.Id), "openid": openid})
    db.add(
        AppLoginSession(
            AccountId=account.Id,
            Token=token,
            SessionKey=None,
            ExpiresAt=expire,
        )
    )
    db.commit()
    return token


@router.post("/send-code", summary="管理端发送短信验证码（登录 / 改密）")
def admin_send_code(body: AdminSendCodeRequest, db: Session = Depends(get_db)):
    mobile = normalize_phone(body.phone)
    account = _find_active_account_by_mobile(db, mobile)
    if not account:
        raise HTTPException(status_code=404, detail="该手机号未绑定账号")
    _ensure_admin_web_staff(db, account)
    purpose = (
        ADMIN_RESET_PASSWORD_PURPOSE
        if body.purpose == "reset_password"
        else ADMIN_LOGIN_PURPOSE
    )
    return send_verification_code(db, mobile, purpose)


@router.post("/login", response_model=AdminAuthTokenResponse, summary="管理端短信验证码登录")
def admin_sms_login(body: AdminSmsLoginRequest, db: Session = Depends(get_db)):
    mobile = normalize_phone(body.phone)
    verify_code(db, mobile, body.code, ADMIN_LOGIN_PURPOSE)

    account = _find_active_account_by_mobile(db, mobile)
    if not account:
        raise HTTPException(status_code=404, detail="该手机号未绑定账号")

    _ensure_admin_web_staff(db, account)
    account.UpdatedAt = datetime.utcnow()
    db.commit()

    token = _issue_token(db, account)
    return AdminAuthTokenResponse(token=token)


@router.post(
    "/login-password",
    response_model=AdminAuthTokenResponse,
    summary="管理端手机号+密码登录",
)
def admin_password_login(body: AdminPasswordLoginRequest, db: Session = Depends(get_db)):
    mobile = normalize_phone(body.phone)
    account = _find_active_account_by_mobile(db, mobile)
    if not account:
        raise HTTPException(status_code=404, detail="该手机号未绑定账号")
    _ensure_admin_web_staff(db, account)
    if not account.PasswordHash:
        raise HTTPException(status_code=400, detail="该账号尚未设置密码，请先通过短信验证码设置")
    if not verify_password(body.password, account.PasswordHash):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    account.UpdatedAt = datetime.utcnow()
    db.commit()
    token = _issue_token(db, account)
    return AdminAuthTokenResponse(token=token)


@router.post(
    "/reset-password",
    response_model=AdminMessageResponse,
    summary="管理端短信验证后设置/修改密码",
)
def admin_reset_password(body: AdminResetPasswordRequest, db: Session = Depends(get_db)):
    mobile = normalize_phone(body.phone)
    new_password = _validate_new_password(body.newPassword)
    verify_code(db, mobile, body.code, ADMIN_RESET_PASSWORD_PURPOSE)

    account = _find_active_account_by_mobile(db, mobile)
    if not account:
        raise HTTPException(status_code=404, detail="该手机号未绑定账号")
    _ensure_admin_web_staff(db, account)

    account.PasswordHash = hash_password(new_password)
    account.UpdatedAt = datetime.utcnow()
    db.commit()
    return AdminMessageResponse(message="密码已更新")


@router.post(
    "/change-password",
    response_model=AdminMessageResponse,
    summary="已登录用户短信验证后修改密码",
)
def admin_change_password(
    body: AdminResetPasswordRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    mobile = normalize_phone(body.phone)
    new_password = _validate_new_password(body.newPassword)
    _ensure_admin_web_staff(db, current_account)

    account_mobile = (current_account.Mobile or "").strip()
    if not account_mobile:
        raise HTTPException(status_code=400, detail="当前账号未绑定手机号，无法修改密码")
    if account_mobile != mobile:
        raise HTTPException(status_code=400, detail="请使用当前账号绑定的手机号接收验证码")

    verify_code(db, mobile, body.code, ADMIN_RESET_PASSWORD_PURPOSE)
    current_account.PasswordHash = hash_password(new_password)
    current_account.UpdatedAt = datetime.utcnow()
    db.commit()
    return AdminMessageResponse(message="密码已更新")
