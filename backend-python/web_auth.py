"""
官网（front_site）注册登录 API。

与小程序共用 AppAccount / AppLoginSession 表及 JWT 配置。
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import UserInfo, create_access_token, get_current_account, get_me
from database import get_db
from models import AppAccount, AppLoginSession
from role_active import set_account_role
from password_utils import hash_password, verify_password
from preference_tags import (
    get_account_tags,
    get_tag_options,
    has_preference_tags,
    save_preference_tags,
)
from sms_service import normalize_phone, send_verification_code, verify_code

router = APIRouter(prefix="/api/web/auth", tags=["Web Auth"])


class SendCodeRequest(BaseModel):
    phone: str
    purpose: str = Field(default="login", pattern="^(login|register)$")


class RegisterRequest(BaseModel):
    phone: str
    code: Optional[str] = None
    password: Optional[str] = None
    nickname: Optional[str] = None


class LoginRequest(BaseModel):
    phone: str
    code: Optional[str] = None
    password: Optional[str] = None


class AuthTokenResponse(BaseModel):
    token: str
    is_new_user: bool = False


class WebUserInfo(UserInfo):
    hasPreferenceTags: bool = False
    personalTags: list[str] = []
    interestTags: list[str] = []


class PreferenceTagsPayload(BaseModel):
    personalTags: list[str] = Field(default_factory=list, min_length=1)
    interestTags: list[str] = Field(default_factory=list, min_length=1)


def _web_user_info(
    current_account: AppAccount,
    db: Session,
) -> WebUserInfo:
    base = get_me(current_account=current_account, db=db)
    personal, interest = get_account_tags(db, current_account.Id)
    return WebUserInfo(
        **base.model_dump(),
        hasPreferenceTags=has_preference_tags(current_account),
        personalTags=personal,
        interestTags=interest,
    )


def _find_active_account_by_mobile(db: Session, mobile: str) -> Optional[AppAccount]:
    return (
        db.query(AppAccount)
        .filter(AppAccount.Mobile == mobile, AppAccount.IsActive == True)
        .order_by(AppAccount.Id.desc())
        .first()
    )


def _is_claimable_staff_invite(account: AppAccount, mobile: str) -> bool:
    """助理代建的来访账号可由手机号本人通过短信完成激活。"""
    return (
        (account.OpenId or "") == f"admin_invite_{mobile}"
        and (account.ActiveRole or "Patient") == "Patient"
    )


def _ensure_patient_role(db: Session, account: AppAccount) -> None:
    if not account.ActiveRole:
        set_account_role(db, account.Id, "Patient")


def _issue_token(db: Session, account: AppAccount) -> str:
    openid = account.OpenId or f"web_{account.Id}"
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


def _validate_register_payload(body: RegisterRequest) -> None:
    if not body.code and not body.password:
        raise HTTPException(status_code=400, detail="请提供验证码或密码")
    if body.password is not None and len(body.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")


def _validate_login_payload(body: LoginRequest) -> None:
    if not body.code and not body.password:
        raise HTTPException(status_code=400, detail="请提供验证码或密码")


@router.post("/send-code", summary="发送短信验证码")
def web_send_code(body: SendCodeRequest, db: Session = Depends(get_db)):
    mobile = normalize_phone(body.phone)

    if body.purpose == "register":
        existing = _find_active_account_by_mobile(db, mobile)
        if existing and not _is_claimable_staff_invite(existing, mobile):
            raise HTTPException(status_code=409, detail="该手机号已注册，请直接登录")

    return send_verification_code(db, mobile, body.purpose)


@router.post("/register", response_model=AuthTokenResponse, summary="手机号注册")
def web_register(body: RegisterRequest, db: Session = Depends(get_db)):
    _validate_register_payload(body)
    mobile = normalize_phone(body.phone)

    existing = _find_active_account_by_mobile(db, mobile)
    if existing:
        if not _is_claimable_staff_invite(existing, mobile):
            raise HTTPException(status_code=409, detail="该手机号已注册，请直接登录")
        if not body.code:
            raise HTTPException(status_code=400, detail="待激活账号请使用短信验证码完成注册")
        verify_code(db, mobile, body.code, "register")
        existing.OpenId = f"web_phone_{mobile}"
        if body.password:
            existing.PasswordHash = hash_password(body.password)
        if body.nickname:
            existing.Nickname = body.nickname
        _ensure_patient_role(db, existing)
        existing.UpdatedAt = datetime.utcnow()
        db.commit()
        token = _issue_token(db, existing)
        return AuthTokenResponse(token=token, is_new_user=True)

    if body.code:
        verify_code(db, mobile, body.code, "register")
    elif not body.password:
        raise HTTPException(status_code=400, detail="首次注册请使用短信验证码")

    account = AppAccount(
        Mobile=mobile,
        OpenId=f"web_phone_{mobile}",
        Nickname=body.nickname or f"用户{mobile[-4:]}",
        IsActive=True,
    )
    if body.password:
        account.PasswordHash = hash_password(body.password)

    db.add(account)
    db.commit()
    db.refresh(account)

    _ensure_patient_role(db, account)
    account.UpdatedAt = datetime.utcnow()
    db.commit()

    token = _issue_token(db, account)
    return AuthTokenResponse(token=token, is_new_user=True)


@router.post("/login", response_model=AuthTokenResponse, summary="手机号登录")
def web_login(body: LoginRequest, db: Session = Depends(get_db)):
    _validate_login_payload(body)
    mobile = normalize_phone(body.phone)

    account = _find_active_account_by_mobile(db, mobile)
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在，请先注册")

    if body.code:
        verify_code(db, mobile, body.code, "login")
    elif body.password:
        if not verify_password(body.password, account.PasswordHash):
            raise HTTPException(status_code=401, detail="手机号或密码错误")
    else:
        raise HTTPException(status_code=400, detail="请提供验证码或密码")

    _ensure_patient_role(db, account)
    account.UpdatedAt = datetime.utcnow()
    db.commit()

    token = _issue_token(db, account)
    return AuthTokenResponse(token=token, is_new_user=False)


@router.get("/me", response_model=WebUserInfo, summary="获取当前登录用户")
def web_me(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    return _web_user_info(current_account, db)


@router.get("/tag-options", summary="获取可选偏好标签列表")
def web_tag_options():
    return get_tag_options()


@router.post("/preference-tags", response_model=WebUserInfo, summary="保存用户偏好标签（仅首次）")
def web_save_preference_tags(
    body: PreferenceTagsPayload,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    save_preference_tags(db, current_account, body.personalTags, body.interestTags)
    db.refresh(current_account)
    return _web_user_info(current_account, db)
