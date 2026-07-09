from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import jwt

from fastapi import Request

from database import get_db
from models import AppAccount, AppLoginSession, AppRoleBinding, AppRoleSwitchLog
from config import settings
from role_active import (
    consolidate_account_role_bindings,
    get_account_role,
    set_account_role,
)
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
DEV_MOCK_CODES = frozenset(DEV_MOCK_CODE_OPENIDS.keys())
_WECHAT_PLACEHOLDER_APPIDS = frozenset({"", "wx_your_appid_here"})
_WECHAT_PLACEHOLDER_SECRETS = frozenset({"", "your_wechat_secret_here"})


def _is_wechat_configured() -> bool:
    appid = (settings.WECHAT_APPID or "").strip()
    secret = (settings.WECHAT_SECRET or "").strip()
    return appid not in _WECHAT_PLACEHOLDER_APPIDS and secret not in _WECHAT_PLACEHOLDER_SECRETS


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


class SwitchRoleRequest(BaseModel):
    role: str


class ProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    avatarUrl: Optional[str] = None
    realName: Optional[str] = None
    gender: Optional[str] = None

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
    if getattr(account, "IsActive", True) is False:
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
    use_mock_login = request.code in DEV_MOCK_CODES or not _is_wechat_configured()

    if use_mock_login:
        openid = _mock_openid_for_code(request.code)
        unionid = None
        session_key = "mock_session_key"
    else:
        try:
            from wechatpy import WeChatClient
            client = WeChatClient(settings.WECHAT_APPID, settings.WECHAT_SECRET)
            session_info = client.wxa.code_to_session(request.code)
            openid = session_info.get("openid")
            unionid = session_info.get("unionid")
            session_key = session_info.get("session_key", "")
            if not openid:
                raise HTTPException(status_code=400, detail="无法获取 openid，请检查 code 是否有效")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"微信登录失败: {str(e)}")

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
        if getattr(account, "IsActive", True) is False:
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

    return LoginResponse(token=token, is_new_user=is_new_user)


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
    if settings.WECHAT_APPID and settings.WECHAT_SECRET:
        try:
            from wechatpy import WeChatClient
            client = WeChatClient(settings.WECHAT_APPID, settings.WECHAT_SECRET)
            phone_info = client.wxa.get_phone_number(request.phoneCode)
            mobile = phone_info.get("phone_info", {}).get("phoneNumber")
            if not mobile:
                raise HTTPException(status_code=400, detail="无法获取手机号")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"获取手机号失败: {str(e)}")
    else:
        mobile = f"138{request.phoneCode[-8:].zfill(8)}"

    # 检查手机号是否已被其他账号绑定
    existing = db.query(AppAccount).filter(
        AppAccount.Mobile == mobile,
        AppAccount.Id != current_account.Id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="该手机号已被其他账号绑定")

    current_account.Mobile = mobile
    current_account.UpdatedAt = datetime.utcnow()
    db.commit()

    return {"message": "手机号绑定成功", "mobile": mobile}


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
        avatarUrl=current_account.AvatarUrl,
        realName=current_account.RealName,
        gender=current_account.Gender,
        roles=[role],
        activeRole=role,
    )


@router.put("/me", response_model=UserInfo, summary="更新当前用户基本资料")
def update_me(
    body: ProfileUpdateRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    mapping = {
        "nickname": "Nickname",
        "avatarUrl": "AvatarUrl",
        "realName": "RealName",
        "gender": "Gender",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(current_account, dst, val)
    current_account.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(current_account)
    return get_me(current_account=current_account, db=db)


@router.delete("/account", summary="注销当前账号（软删除，保留业务表追溯）")
def delete_account(
    request: Request,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """
    微信小程序合规要求：用户必须能在 App 内自主注销账号。
    本接口采取"软注销"策略：
      - AppAccount 行不物理删除，避免咨询记录 / 订单 / 提醒任务出现悬挂引用
      - 清空可识别字段（OpenId / UnionId / Mobile / Nickname / AvatarUrl / RealName / 紧急联系）
      - 保留 Id 与历史 CreatedAt 用于审计
      - 删除该账号所有 AppRoleBinding（防止越权）
      - 把所有 AppLoginSession 失效
    """
    # 1. 失效所有 token
    db.query(AppLoginSession).filter(
        AppLoginSession.AccountId == current_account.Id
    ).delete(synchronize_session=False)

    # 2. 解绑所有角色
    db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id
    ).delete(synchronize_session=False)

    # 3. 写一条注销日志（复用 RoleSwitchLog，FromRole=current, ToRole=DELETED）
    db.add(AppRoleSwitchLog(
        AccountId=current_account.Id,
        FromRole=getattr(current_account, "ActiveRole", None),
        ToRole="DELETED",
        Ip=request.client.host if request.client else None,
        UserAgent=request.headers.get("user-agent", "")[:200] if request.headers else None,
    ))

    # 4. 清空可识别字段并标记为已注销
    # 用 bulk UPDATE 写库，避免 InstrumentedAttribute 在某些刷新模式下漏字段
    now = datetime.utcnow()
    new_openid = f"deleted_{current_account.Id}_{int(now.timestamp())}"
    db.query(AppAccount).filter(AppAccount.Id == current_account.Id).update(
        {
            AppAccount.OpenId: new_openid,
            AppAccount.UnionId: None,
            AppAccount.Mobile: None,
            AppAccount.Nickname: None,
            AppAccount.AvatarUrl: None,
            AppAccount.RealName: None,
            AppAccount.Gender: None,
            AppAccount.Birthday: None,
            AppAccount.EmergencyContact: None,
            AppAccount.EmergencyPhone: None,
            AppAccount.ActiveRole: None,
            AppAccount.IsActive: False,
            AppAccount.DeletedAt: now,
            AppAccount.UpdatedAt: now,
        },
        synchronize_session=False,
    )

    db.commit()
    return {"message": "账号已注销，所有登录会话已失效"}


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
