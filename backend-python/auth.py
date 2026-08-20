from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import jwt

from fastapi import Request
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import AppAccount, AppLoginSession, AppRoleBinding, AppRoleSwitchLog
from config import settings
from role_active import (
    consolidate_account_role_bindings,
    get_account_role,
    set_account_role,
)
from user_avatar import resolve_user_avatar_for_account, uses_visitor_default_avatar
from patient_registration import ensure_default_patient_registration

router = APIRouter(prefix="/api/mini/auth", tags=["Auth"])

# 本地联调固定 code → seed 脚本演示账号（即使 .env 填了占位微信凭证也走 mock）
DEV_MOCK_CODE_OPENIDS = {
    "dev_local": "demo-openid-patient-xiaomei",    # 兼容旧版，等同来访·小美
    "dev_patient": "demo-openid-patient-xiaomei",
    "dev_patient_xiaomei": "demo-openid-patient-xiaomei",
    "dev_patient_xiaogang": "demo-openid-patient-xiaogang",
    "dev_patient_xiaoli": "demo-openid-patient-xiaoli",
    "dev_patient_charity_test": "demo-openid-patient-charity-test",
    "dev_patient_professional_milestone_test": "demo-openid-patient-professional-milestone-test",
    # 与 seed_demo_data.py 三位咨询师账号对齐
    "dev_counselor": "demo-counselor-lixinyi",
    "dev_counselor_lixinyi": "demo-counselor-lixinyi",
    "dev_counselor_zhangmingyuan": "demo-counselor-zhangmingyuan",
    "dev_counselor_wangwanqing": "demo-counselor-wangwanqing",
    "dev_counselor_chenqiming": "demo-counselor-chenqiming",
    "dev_assistant": "demo-openid-assistant",
    "dev_ops": "demo-openid-ops",
    "dev_admin": "demo-openid-admin",
}
DEV_MOCK_CODE_ACTIVE_ROLES = {
    "dev_local": "Patient",
    "dev_patient": "Patient",
    "dev_patient_xiaomei": "Patient",
    "dev_patient_xiaogang": "Patient",
    "dev_patient_xiaoli": "Patient",
    "dev_patient_charity_test": "Patient",
    "dev_patient_professional_milestone_test": "Patient",
    "dev_counselor": "Counselor",
    "dev_counselor_lixinyi": "Counselor",
    "dev_counselor_zhangmingyuan": "Counselor",
    "dev_counselor_wangwanqing": "Counselor",
    "dev_counselor_chenqiming": "Counselor",
    "dev_assistant": "Assistant",
    "dev_ops": "Ops",
    "dev_admin": "Admin",
}

# 管理后台 / EAP 密钥登录使用的固定 code（生产可走正规密钥登录，不依赖 ALLOW_DEV_LOGIN）
ACCESS_KEY_LOGIN_CODES = frozenset(
    {
        "dev_admin",
        "dev_ops",
        "dev_assistant",
        "dev_counselor",
    }
)
DEV_MOCK_CODES = frozenset(DEV_MOCK_CODE_OPENIDS.keys())
_WECHAT_PLACEHOLDER_APPIDS = frozenset({"", "wx_your_appid_here"})
_WECHAT_PLACEHOLDER_SECRETS = frozenset({"", "your_wechat_secret_here"})


def _is_wechat_configured() -> bool:
    appid = (settings.WECHAT_APPID or "").strip()
    secret = (settings.WECHAT_SECRET or "").strip()
    return appid not in _WECHAT_PLACEHOLDER_APPIDS and secret not in _WECHAT_PLACEHOLDER_SECRETS


def _wechat_http():
    """直连微信 API，忽略系统/环境代理（避免 ProxyError / SSL EOF）。"""
    import requests

    session = requests.Session()
    session.trust_env = False
    return session


def _sanitize_wechat_error(exc: BaseException) -> str:
    """去掉 URL 中的 secret，避免把凭证回显到前端。"""
    import re

    text = str(exc)
    text = re.sub(r"(secret=)[^&\s]+", r"\1***", text, flags=re.IGNORECASE)
    text = re.sub(r"(appsecret=)[^&\s]+", r"\1***", text, flags=re.IGNORECASE)
    if "ProxyError" in text or "proxy" in text.lower():
        return (
            "无法连接微信服务器（代理/SSL 异常）。"
            "请关闭系统代理或 VPN 后重启后端，或确认本机可直连 api.weixin.qq.com"
        )
    if "Max retries exceeded" in text or "SSLEOFError" in text or "SSLError" in text:
        return "连接微信服务器失败，请检查本机网络是否可访问 api.weixin.qq.com"
    return text[:240]


def _code_to_session(js_code: str) -> dict:
    """wx.login code → openid / session_key（不经 wechatpy，避免代理与 token 干扰）。"""
    session = _wechat_http()
    resp = session.get(
        "https://api.weixin.qq.com/sns/jscode2session",
        params={
            "appid": settings.WECHAT_APPID,
            "secret": settings.WECHAT_SECRET,
            "js_code": js_code,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    data = resp.json() if resp.content else {}
    errcode = data.get("errcode", 0)
    if errcode not in (0, None):
        raise RuntimeError(f"{errcode}: {data.get('errmsg', 'jscode2session failed')}")
    if not data.get("openid"):
        raise RuntimeError("微信未返回 openid")
    return data


def _get_access_token() -> str:
    session = _wechat_http()
    resp = session.get(
        "https://api.weixin.qq.com/cgi-bin/token",
        params={
            "grant_type": "client_credential",
            "appid": settings.WECHAT_APPID,
            "secret": settings.WECHAT_SECRET,
        },
        timeout=15,
    )
    data = resp.json() if resp.content else {}
    token = data.get("access_token")
    if not token:
        raise RuntimeError(
            f"{data.get('errcode', '')}: {data.get('errmsg', '获取 access_token 失败')}"
        )
    return token


def _exchange_wechat_phone_number(phone_code: str) -> str:
    """用 getPhoneNumber 返回的 code 换取手机号。"""
    session = _wechat_http()
    access_token = _get_access_token()
    resp = session.post(
        "https://api.weixin.qq.com/wxa/business/getuserphonenumber",
        params={"access_token": access_token},
        json={"code": phone_code},
        timeout=15,
    )
    data = resp.json() if resp.content else {}
    errcode = data.get("errcode", 0)
    if errcode not in (0, None):
        raise RuntimeError(f"{errcode}: {data.get('errmsg', 'unknown')}")
    phone_info = data.get("phone_info") or {}
    mobile = phone_info.get("purePhoneNumber") or phone_info.get("phoneNumber")
    if not mobile:
        raise RuntimeError("微信未返回手机号，请确认已开通手机号快速验证能力")
    return str(mobile).strip()


def _mock_openid_for_code(code: str) -> str:
    mapped = DEV_MOCK_CODE_OPENIDS.get(code)
    if mapped:
        return mapped
    return f"mock_openid_{code}"

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    code: str

class LoginResponse(BaseModel):
    token: str
    is_new_user: bool
    openId: Optional[str] = None
    activeRole: Optional[str] = None
    roles: list[str] = []
    nickname: Optional[str] = None
    avatarUrl: Optional[str] = None
    id: Optional[int] = None
    mobile: Optional[str] = None
    # True = 后端走了 mock openid（未配置真实微信凭证）
    isMockAuth: bool = False
    # 新用户引导：完善资料 / 订阅消息
    needProfileSetup: bool = False
    needSubscribeGuide: bool = False


class BindMobileRequest(BaseModel):
    # 微信获取手机号的 code（微信基础库 >= 2.21.2 的新版方式）
    phoneCode: str


class UserInfo(BaseModel):
    id: int
    openId: Optional[str] = None
    mobile: Optional[str] = None
    nickname: Optional[str] = None
    avatarUrl: Optional[str] = None
    realName: Optional[str] = None
    gender: Optional[str] = None
    roles: list[str] = []
    activeRole: Optional[str] = None
    profileCompleted: bool = False
    subscribeOptIn: bool = False
    needProfileSetup: bool = False
    needSubscribeGuide: bool = False


class SwitchRoleRequest(BaseModel):
    role: str


class ProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    avatarUrl: Optional[str] = None
    realName: Optional[str] = None
    gender: Optional[str] = None
    markProfileCompleted: Optional[bool] = True


def _profile_completed(account: AppAccount) -> bool:
    return bool(getattr(account, "ProfileCompletedAt", None) or (account.Nickname or "").strip())


def _subscribe_opt_in(account: AppAccount) -> bool:
    return bool(getattr(account, "SubscribeOptInAt", None))


def _need_profile_setup(account: AppAccount, is_new_user: bool = False) -> bool:
    return is_new_user or not _profile_completed(account)


def _need_subscribe_guide(account: AppAccount, is_new_user: bool = False) -> bool:
    # 仅新用户注册链路强制引导一次；老用户在业务页再次订阅
    if _subscribe_opt_in(account):
        return False
    return bool(is_new_user)
# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict) -> tuple[str, datetime]:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    to_encode["exp"] = expire
    token = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expire


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token 无效")


def _account_is_active(account: AppAccount) -> bool:
    try:
        value = getattr(account, "IsActive", None)
    except SQLAlchemyError:
        return True
    return value is not False


def get_current_account(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> AppAccount:
    """全局 Token 鉴权依赖：解析 Authorization: Bearer <token>，返回对应 AppAccount。"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的 Authorization 头")
    token = authorization[7:]
    payload = decode_token(token)
    account_id = payload.get("sub")
    if not account_id:
        raise HTTPException(status_code=401, detail="Token 无效：缺少 sub 字段")

    account = db.query(AppAccount).filter(AppAccount.Id == int(account_id)).first()
    if not account:
        raise HTTPException(status_code=401, detail="用户不存在")
    # 注销后的账号即使持有未过期 JWT 也应被拒绝（升级方案 §6 合规要求）
    if not _account_is_active(account):
        raise HTTPException(status_code=401, detail="账号已注销")
    return account


def get_optional_account(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[AppAccount]:
    """可选鉴权：未登录或 Token 无效时返回 None，不抛错。"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization[7:]
        payload = decode_token(token)
        account_id = payload.get("sub")
        if not account_id:
            return None
        account = db.query(AppAccount).filter(AppAccount.Id == int(account_id)).first()
        if not account or getattr(account, "IsActive", True) is False:
            return None
        return account
    except HTTPException:
        return None

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _ensure_role_binding(db: Session, account_id: int, role: str) -> None:
    set_account_role(db, account_id, role)


def _restore_demo_staff_on_mock_login(
    db: Session, account: AppAccount, code: str, openid: str
) -> None:
    """本地 mock 登录时，若演示员工账号曾被解绑/删除，自动恢复绑定（与 seed 一致）。"""
    staff_role = DEV_MOCK_CODE_ACTIVE_ROLES.get(code)
    if staff_role not in {"Assistant", "Ops", "Admin"}:
        return
    account.IsActive = True
    if hasattr(account, "AccessRevokedAt"):
        account.AccessRevokedAt = None
    _ensure_role_binding(db, account.Id, staff_role)
    account.ActiveRole = staff_role
    db.commit()


def _should_use_mock_login(code: str) -> bool:
    """Resolve auth mode：密钥登录与开发 mock 登录解耦，生产可仅开密钥登录。"""

    if code in DEV_MOCK_CODES:
        if code in ACCESS_KEY_LOGIN_CODES and settings.access_key_login_enabled:
            return True
        if not settings.dev_login_enabled:
            raise HTTPException(status_code=403, detail="当前环境未启用开发登录")
        return True

    if _is_wechat_configured():
        return False

    if not settings.dev_login_enabled:
        raise HTTPException(status_code=503, detail="微信登录服务尚未配置")
    return True


@router.post("/login", response_model=LoginResponse, summary="微信小程序一键登录")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    接受小程序 wx.login 返回的 code。
    若未配置真实微信凭证，则用 mock openid 方便本地联调。

    账号归并策略（升级方案 §6 / §7.1）：
      1. 优先以 unionid 归并：如果当前 openid 没有匹配账号，但能在 AppAccount 找到同 unionid 的旧账号，
         直接复用并把 mp_openid 写回，避免公众号/H5 用户回流时被开新号。
      2. 其次以 openid 命中。
      3. 都没有命中再创建新账号。
    """
    unionid: Optional[str] = None
    use_mock_login = _should_use_mock_login(request.code)

    if use_mock_login:
        openid = _mock_openid_for_code(request.code)
        unionid = None
        session_key = "mock_session_key"
    else:
        try:
            session_info = _code_to_session(request.code)
            openid = session_info.get("openid")
            unionid = session_info.get("unionid")
            session_key = session_info.get("session_key", "")
            if not openid:
                raise HTTPException(status_code=400, detail="无法获取 openid，请检查 code 是否有效")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"微信登录失败: {_sanitize_wechat_error(e)}")

    is_new_user = False
    account: Optional[AppAccount] = (
        db.query(AppAccount).filter(AppAccount.OpenId == openid).first()
    )

    if not account and unionid:
        # 通过 unionid 把跨端账号归并到同一条记录
        account = (
            db.query(AppAccount).filter(AppAccount.UnionId == unionid).first()
        )
        if account and not account.OpenId:
            account.OpenId = openid

    if not account:
        account = AppAccount(OpenId=openid, UnionId=unionid, ActiveRole="Patient")
        db.add(account)
        db.commit()
        db.refresh(account)
        is_new_user = True

        # 本地开发 mock：新账号默认来访，具体角色由 dev_* 登录码决定
        if openid.startswith("mock_openid_"):
            set_account_role(db, account.Id, "Patient")
            db.commit()
    else:
        # 现有账号若之前没有 unionid，本次拿到了就回写；不会覆盖已有的 unionid
        if unionid and not account.UnionId:
            account.UnionId = unionid
            db.commit()

    # 所有账号登录时确保具备来访基础身份（含首次注册与历史未绑定账号）
    if ensure_default_patient_registration(db, account):
        db.commit()
        db.refresh(account)

    if use_mock_login:
        if not _account_is_active(account):
            raise HTTPException(
                status_code=403,
                detail="演示账号已注销，请在 backend-python 目录重新运行 python seed_demo_data.py",
            )
        target_role = DEV_MOCK_CODE_ACTIVE_ROLES.get(request.code)
        if target_role:
            _restore_demo_staff_on_mock_login(db, account, request.code, openid)
            set_account_role(db, account.Id, target_role)
            db.commit()

    token, expire = create_access_token({"sub": str(account.Id), "openid": openid})

    session = AppLoginSession(
        AccountId=account.Id,
        Token=token,
        SessionKey=session_key,
        ExpiresAt=expire,
    )
    db.add(session)
    db.commit()

    consolidate_account_role_bindings(db, account.Id)
    role = get_account_role(db, account.Id)
    if getattr(account, "ActiveRole", None) != role:
        account.ActiveRole = role
        account.UpdatedAt = datetime.utcnow()
        db.commit()
        db.refresh(account)

    return LoginResponse(
        token=token,
        is_new_user=is_new_user,
        openId=account.OpenId or openid,
        activeRole=role,
        roles=[role],
        nickname=account.Nickname,
        avatarUrl=resolve_user_avatar_for_account(db, account),
        id=account.Id,
        mobile=account.Mobile,
        isMockAuth=use_mock_login,
        needProfileSetup=_need_profile_setup(account, is_new_user),
        needSubscribeGuide=_need_subscribe_guide(account, is_new_user),
    )


@router.get("/wechat-status", summary="微信凭证是否已配置（前端据此切换正式/联调流程）")
def wechat_status():
    return {
        "configured": _is_wechat_configured(),
        "appIdConfigured": bool((settings.WECHAT_APPID or "").strip())
        and (settings.WECHAT_APPID or "").strip() not in _WECHAT_PLACEHOLDER_APPIDS,
    }


@router.post("/bind-mobile", summary="绑定微信手机号")
def bind_mobile(
    request: BindMobileRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """
    使用微信 getPhoneNumber 返回的 code 换取真实手机号并绑定到当前账号。
    未配置真实凭证时返回 mock 手机号方便本地测试。
    """
    if _is_wechat_configured():
        try:
            mobile = _exchange_wechat_phone_number(request.phoneCode)
        except HTTPException:
            raise
        except Exception as e:
            err = _sanitize_wechat_error(e)
            raise HTTPException(
                status_code=400,
                detail=f"获取手机号失败: {err}",
            )
    else:
        if not settings.dev_login_enabled:
            raise HTTPException(status_code=503, detail="微信手机号服务尚未配置")
        # 仅开发联调：用 phoneCode 生成可区分的 mock 手机号。
        tail = "".join(ch for ch in request.phoneCode if ch.isalnum())[-8:].zfill(8)
        mobile = f"138{tail}"

    # 手机号已由工作人员预建，或仅在官网注册时，微信验号后应认领原账号，
    # 以保留代理预约、签约关系等历史数据，而不是提示“已被绑定”。
    existing = db.query(AppAccount).filter(
        AppAccount.Mobile == mobile,
        AppAccount.Id != current_account.Id,
    ).first()
    if existing:
        placeholder_openids = {
            f"admin_invite_{mobile}",
            f"web_phone_{mobile}",
        }
        if (existing.OpenId or "") not in placeholder_openids:
            raise HTTPException(status_code=409, detail="该手机号已被其他微信账号绑定")
        if current_account.Mobile and current_account.Mobile != mobile:
            raise HTTPException(status_code=409, detail="当前微信账号已绑定其他手机号")

        current_openid = current_account.OpenId
        if not current_openid:
            raise HTTPException(status_code=400, detail="当前微信账号缺少身份信息")

        current_session = (
            db.query(AppLoginSession)
            .filter(AppLoginSession.AccountId == current_account.Id)
            .order_by(AppLoginSession.Id.desc())
            .first()
        )
        session_key = current_session.SessionKey if current_session else None

        # 先释放当前临时账号的微信身份，再写入预建账号。
        current_account.OpenId = f"merged_account_{current_account.Id}"
        current_account.IsActive = False
        current_account.DeletedAt = datetime.utcnow()
        current_account.UpdatedAt = datetime.utcnow()
        db.query(AppLoginSession).filter(
            AppLoginSession.AccountId == current_account.Id
        ).delete(synchronize_session=False)

        existing.OpenId = current_openid
        if current_account.UnionId and not existing.UnionId:
            existing.UnionId = current_account.UnionId
        existing.UpdatedAt = datetime.utcnow()

        token, expire = create_access_token(
            {"sub": str(existing.Id), "openid": current_openid}
        )
        db.add(
            AppLoginSession(
                AccountId=existing.Id,
                Token=token,
                SessionKey=session_key,
                ExpiresAt=expire,
            )
        )
        db.commit()
        db.refresh(existing)

        role = get_account_role(db, existing.Id)
        return {
            "message": "手机号绑定成功",
            "mobile": mobile,
            "token": token,
            "openId": existing.OpenId,
            "activeRole": role,
            "roles": [role],
            "nickname": existing.Nickname,
            "avatarUrl": existing.AvatarUrl,
            "id": existing.Id,
            "is_new_user": False,
            "needProfileSetup": _need_profile_setup(existing, False),
            "needSubscribeGuide": _need_subscribe_guide(existing, False),
            "isMockAuth": not _is_wechat_configured() and settings.dev_login_enabled,
        }

    current_account.Mobile = mobile
    current_account.UpdatedAt = datetime.utcnow()
    db.commit()

    return {
        "message": "手机号绑定成功",
        "mobile": mobile,
        "isMockAuth": not _is_wechat_configured() and settings.dev_login_enabled,
    }


@router.get("/me", response_model=UserInfo, summary="获取当前用户信息及角色")
def get_me(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if ensure_default_patient_registration(db, current_account):
        current_account.UpdatedAt = datetime.utcnow()
        db.commit()
        db.refresh(current_account)

    consolidate_account_role_bindings(db, current_account.Id)
    role = get_account_role(db, current_account.Id)
    if getattr(current_account, "ActiveRole", None) != role:
        current_account.ActiveRole = role
        current_account.UpdatedAt = datetime.utcnow()
        db.commit()
        db.refresh(current_account)

    return UserInfo(
        id=current_account.Id,
        openId=current_account.OpenId,
        mobile=current_account.Mobile,
        nickname=current_account.Nickname,
        avatarUrl=resolve_user_avatar_for_account(db, current_account),
        realName=current_account.RealName,
        gender=current_account.Gender,
        roles=[role],
        activeRole=role,
        profileCompleted=_profile_completed(current_account),
        subscribeOptIn=_subscribe_opt_in(current_account),
        needProfileSetup=_need_profile_setup(current_account),
        needSubscribeGuide=_need_subscribe_guide(current_account),
    )


@router.put("/me", response_model=UserInfo, summary="更新当前用户基本资料")
def update_me(
    body: ProfileUpdateRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    mapping = {
        "nickname": "Nickname",
        "realName": "RealName",
        "gender": "Gender",
    }
    if not uses_visitor_default_avatar(db, current_account.Id):
        mapping["avatarUrl"] = "AvatarUrl"
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(current_account, dst, val)
    if uses_visitor_default_avatar(db, current_account.Id):
        current_account.AvatarUrl = None
    if body.markProfileCompleted and (
        (body.nickname is not None and str(body.nickname).strip())
        or (current_account.Nickname or "").strip()
    ):
        if not getattr(current_account, "ProfileCompletedAt", None):
            current_account.ProfileCompletedAt = datetime.utcnow()
    current_account.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(current_account)
    return get_me(current_account=current_account, db=db)


@router.delete("/account", summary="注销当前账号（软删除，保留业务表追溯）")
@router.post("/account/deactivate", summary="注销当前账号（POST 兼容，逻辑同 DELETE）")
def delete_account(
    request: Request,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """
    微信小程序合规：用户可自主注销。

    软注销策略（合规追溯）：
      - 不物理删除 AppAccount，也不删除咨询 / 订单 / 个案等业务行
      - 清空 OpenId / 手机号 / 昵称等可识别字段，会话与角色失效
      - 同一微信再次登录会创建新账号，与旧业务数据通过旧 AccountId 隔离保留
    """
    from account_deletion_service import soft_delete_account

    try:
        result = soft_delete_account(
            db,
            current_account,
            ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"注销失败: {str(e)[:200]}")


@router.post("/switch-role", summary="切换角色（单账号仅一个角色，已禁用）")
def switch_role(
    body: SwitchRoleRequest,
    request: Request,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    current = get_account_role(db, current_account.Id)
    if body.role != current:
        raise HTTPException(
            status_code=400,
            detail="单账号仅支持一个角色，如需变更请联系管理员在工作台更换",
        )
    return {"message": "当前角色未变更", "activeRole": current}
