"""微信订阅消息（服务通知）发送与用户授权状态。

层级：
- 前端：用户点击后调用 uni.requestSubscribeMessage
- 本模块：记录授权 + 调用微信 subscribeMessage.send 推送到服务通知
- 站内 AppMessage 仍由各 *_message_service 负责
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from config import settings
from models import AppAccount, AppMessageLog, AppSubscribeTemplate, AppUserSubscribeAuth

logger = logging.getLogger("uvicorn.error")

# 按角色需要用户授权的事件（前端一次最多拉 3 个模板）
# 首期只接 3 条真实模板：预约成功 / 咨询提醒 / 待审核
ROLE_EVENT_KEYS: Dict[str, List[str]] = {
    # 注册保存昵称时一次授权：咨询提醒 + 预约成功（支付页可再拉一次用完后的额度）
    "Patient": ["APPOINTMENT_REMIND", "APPOINTMENT_OK"],
    "Tester": ["APPOINTMENT_REMIND", "APPOINTMENT_OK"],
    "Counselor": ["APPOINTMENT_REMIND"],
    "Assistant": ["STAFF_APPROVAL_PENDING"],
    "Ops": ["STAFF_APPROVAL_PENDING"],
    "Admin": ["STAFF_APPROVAL_PENDING"],
}

# 事件 → 微信模板字段映射（与公众平台「我的模板」关键词一致）
# tuple: (微信字段名, 业务 payload 键名)
EVENT_FIELD_MAP: Dict[str, List[tuple]] = {
    # 预约成功通知：姓名 name1 / 预约时段 date2 / 预约地点 thing9
    "APPOINTMENT_OK": [("name1", "name"), ("date2", "slot"), ("thing9", "location")],
    # 咨询提醒：咨询时间 time1 / 咨询人 thing2 / 咨询师 thing3
    "APPOINTMENT_REMIND": [("time1", "time"), ("thing2", "patient"), ("thing3", "counselor")],
    "ORDER_STATUS": [("character_string1", "orderNo"), ("amount2", "amount"), ("thing3", "tip")],
    "PAY_SUCCESS": [("thing1", "title"), ("amount2", "amount"), ("thing3", "tip")],
    "COUNSELOR_APPOINTMENT_NEW": [("thing1", "title"), ("time2", "time"), ("thing3", "patient")],
    "COUNSELOR_APPOINTMENT_CANCEL": [
        ("time2", "time"),
        ("thing3", "reason"),
        ("thing9", "patient"),
        ("character_string5", "slot"),
    ],
    # 待审核提醒：申请时间 time1 / 申请人 thing2 / 业务类型 thing3
    "STAFF_APPROVAL_PENDING": [("time1", "applyTime"), ("thing2", "applicant"), ("thing3", "bizType")],
}

DEFAULT_PAGES: Dict[str, str] = {
    "APPOINTMENT_OK": "pages/patient/orders/list",
    "APPOINTMENT_REMIND": "pages/tab-slot/index",
    "ORDER_STATUS": "pages/patient/orders/list",
    "PAY_SUCCESS": "pages/patient/orders/list",
    "COUNSELOR_APPOINTMENT_NEW": "pages/counselor/workbench/index",
    "COUNSELOR_APPOINTMENT_CANCEL": "pages/counselor/workbench/index",
    "STAFF_APPROVAL_PENDING": "pages/ops/index/index",
}


def event_keys_for_role(role: Optional[str]) -> List[str]:
    if not role:
        return ROLE_EVENT_KEYS["Patient"]
    return list(ROLE_EVENT_KEYS.get(role, ROLE_EVENT_KEYS["Patient"]))


def _is_mock_template(template_id: Optional[str]) -> bool:
    tid = (template_id or "").strip()
    return (not tid) or tid.startswith("mock_") or tid.endswith("_MOCK") or "MOCK" in tid


def _wechat_http():
    import requests

    session = requests.Session()
    session.trust_env = False
    return session


def _get_access_token() -> str:
    from auth import _get_access_token as auth_token

    return auth_token()


def get_template(db: Session, event_key: str) -> Optional[AppSubscribeTemplate]:
    return (
        db.query(AppSubscribeTemplate)
        .filter(
            AppSubscribeTemplate.EventKey == event_key,
            AppSubscribeTemplate.IsActive == True,  # noqa: E712
        )
        .first()
    )


def user_accepted(db: Session, account_id: int, event_key: str) -> bool:
    row = (
        db.query(AppUserSubscribeAuth)
        .filter(
            AppUserSubscribeAuth.AccountId == account_id,
            AppUserSubscribeAuth.EventKey == event_key,
            AppUserSubscribeAuth.Status == "accept",
        )
        .first()
    )
    return bool(row)


def save_subscribe_auth_results(
    db: Session,
    account: AppAccount,
    *,
    results: Dict[str, str],
    event_keys: Optional[List[str]] = None,
    role: Optional[str] = None,
) -> Dict[str, Any]:
    """保存 requestSubscribeMessage 返回的 tmplId → accept|reject|ban。"""
    role = role or getattr(account, "ActiveRole", None) or "Patient"
    items = (
        db.query(AppSubscribeTemplate)
        .filter(AppSubscribeTemplate.IsActive == True)  # noqa: E712
        .all()
    )
    tmpl_to_event = {r.TemplateId: r.EventKey for r in items}
    accepted_events: List[str] = []
    now = datetime.utcnow()

    # 按 tmplId 写状态
    for tmpl_id, status in (results or {}).items():
        event_key = tmpl_to_event.get(str(tmpl_id))
        if not event_key and event_keys and len(event_keys) == 1:
            event_key = event_keys[0]
        if not event_key:
            continue
        st = str(status or "reject").lower()
        if st not in ("accept", "reject", "ban"):
            st = "reject"
        row = (
            db.query(AppUserSubscribeAuth)
            .filter(
                AppUserSubscribeAuth.AccountId == account.Id,
                AppUserSubscribeAuth.EventKey == event_key,
            )
            .first()
        )
        if not row:
            row = AppUserSubscribeAuth(
                AccountId=account.Id,
                EventKey=event_key,
            )
            db.add(row)
        row.TemplateId = str(tmpl_id)
        row.Status = st
        row.RoleAtAuth = role
        row.UpdatedAt = now
        if st == "accept":
            accepted_events.append(event_key)

    # 仅开发 mock 模板且无 results 时，才按 event_keys 记 accept（真实模板禁止假授权）
    if not results and event_keys:
        real_any = False
        for event_key in event_keys:
            tpl = get_template(db, event_key)
            if tpl and not _is_mock_template(tpl.TemplateId):
                real_any = True
                break
        if not real_any:
            for event_key in event_keys:
                tpl = get_template(db, event_key)
                row = (
                    db.query(AppUserSubscribeAuth)
                    .filter(
                        AppUserSubscribeAuth.AccountId == account.Id,
                        AppUserSubscribeAuth.EventKey == event_key,
                    )
                    .first()
                )
                if not row:
                    row = AppUserSubscribeAuth(AccountId=account.Id, EventKey=event_key)
                    db.add(row)
                row.TemplateId = tpl.TemplateId if tpl else f"mock_{event_key}"
                row.Status = "accept"
                row.RoleAtAuth = role
                row.UpdatedAt = now
                accepted_events.append(event_key)

    account.SubscribeOptInAt = now
    account.SubscribeRoleVersion = role
    clear_subscribe_prompt_trigger(account)
    account.UpdatedAt = now
    db.commit()
    return {
        "acceptedEvents": accepted_events,
        "role": role,
        "subscribeOptIn": True,
    }


STAFF_WORKBENCH_ROLES = {"Assistant", "Ops", "Admin"}


def is_preassigned_openid(openid: Optional[str]) -> bool:
    """后台预创建、尚未用真实微信 openid 登录的账号。"""
    o = (openid or "").strip()
    return o.startswith("admin_invite_")


def clear_subscribe_prompt_trigger(account: AppAccount) -> None:
    if hasattr(account, "SubscribePromptTrigger"):
        account.SubscribePromptTrigger = None


def invalidate_subscribe_for_role_change(db: Session, account: AppAccount, new_role: str) -> None:
    """管理员改角色后：清空授权记录，并按场景设置订阅弹窗时机。"""
    account.SubscribeOptInAt = None
    account.SubscribeRoleVersion = None
    account.UpdatedAt = datetime.utcnow()
    db.query(AppUserSubscribeAuth).filter(
        AppUserSubscribeAuth.AccountId == account.Id
    ).delete(synchronize_session=False)
    apply_subscribe_prompt_trigger(account, new_role)
    db.flush()


def apply_subscribe_prompt_trigger(account: AppAccount, new_role: str) -> None:
    """
    订阅弹窗时机（须在用户点击手势内调官方 requestSubscribeMessage）：
    - Patient：不弹角色订阅
    - Counselor：排期提交时弹（真机与预授账号一致）
    - Assistant/Ops/Admin：工作台操作时弹
    """
    if not hasattr(account, "SubscribePromptTrigger"):
        return
    if new_role == "Patient":
        account.SubscribePromptTrigger = None
        return
    if new_role == "Counselor":
        account.SubscribePromptTrigger = "schedule"
        return
    if new_role in STAFF_WORKBENCH_ROLES:
        account.SubscribePromptTrigger = "workbench"
        return
    account.SubscribePromptTrigger = None


def need_role_subscribe_guide(account: AppAccount, role: Optional[str] = None) -> bool:
    """来访以外角色：改角色后或从未按当前角色授权时仍缺订阅。"""
    role = role or getattr(account, "ActiveRole", None) or "Patient"
    if role == "Patient":
        return False
    version = getattr(account, "SubscribeRoleVersion", None)
    if not getattr(account, "SubscribeOptInAt", None):
        return True
    return version != role


def resolve_subscribe_prompt_flags(account: AppAccount, role: Optional[str] = None) -> Dict[str, Any]:
    """前端按场景决定何时弹出 requestSubscribeMessage。"""
    role = role or getattr(account, "ActiveRole", None) or "Patient"
    needs = need_role_subscribe_guide(account, role)
    trigger = getattr(account, "SubscribePromptTrigger", None)
    show_login = False
    show_schedule = False
    show_workbench = False
    if needs and role != "Patient":
        # 咨询师：排期场景；历史 trigger=login 的真机数据也允许在排期时弹
        if role == "Counselor":
            show_schedule = trigger in (None, "schedule", "login")
            show_login = trigger == "login"
        elif role in STAFF_WORKBENCH_ROLES:
            show_workbench = trigger in (None, "workbench", "login")
            show_login = trigger == "login"
    return {
        "trigger": trigger,
        "showLoginSubscribe": show_login,
        "showScheduleSubscribe": show_schedule,
        "showWorkbenchSubscribe": show_workbench,
        "needRoleSubscribeGuide": needs and role != "Patient",
    }


def _clip(value: Any, max_len: int = 20) -> str:
    text = str(value if value is not None else "-").strip() or "-"
    if len(text) > max_len:
        return text[: max_len - 1] + "…"
    return text


def build_template_data(event_key: str, payload: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    mapping = EVENT_FIELD_MAP.get(event_key) or [
        ("thing1", "title"),
        ("thing2", "tip"),
        ("time3", "time"),
    ]
    data: Dict[str, Dict[str, str]] = {}
    for field, key in mapping:
        raw = payload.get(key) or payload.get("title") or "-"
        # amount 字段特殊
        if field.startswith("amount"):
            data[field] = {"value": _clip(raw, 10)}
        elif field.startswith("time"):
            data[field] = {"value": _clip(raw, 20)}
        elif field.startswith("phrase"):
            data[field] = {"value": _clip(raw, 5)}
        else:
            data[field] = {"value": _clip(raw, 20)}
    return data


def send_subscribe_message(
    db: Session,
    account_id: int,
    event_key: str,
    payload: Optional[Dict[str, Any]] = None,
    *,
    page: Optional[str] = None,
) -> Dict[str, Any]:
    """
    向用户微信「服务通知」推送一条订阅消息。
    需用户曾对该 event_key 授权 accept；一次性订阅用完后需再次授权。
    """
    payload = payload or {}
    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account or not account.OpenId or str(account.OpenId).startswith("deleted_"):
        return {"ok": False, "reason": "no_openid"}

    if not user_accepted(db, account_id, event_key):
        # 仍记日志，方便排查「未授权导致未推送」
        log = AppMessageLog(
            AccountId=account_id,
            EventKey=event_key,
            TemplateId=None,
            Payload=json.dumps(payload, ensure_ascii=False),
            Status="SKIPPED_NO_AUTH",
            ErrorMessage="用户未授权该订阅模板",
        )
        db.add(log)
        db.commit()
        return {"ok": False, "reason": "no_auth"}

    tpl = get_template(db, event_key)
    template_id = tpl.TemplateId if tpl else f"mock_{event_key}"
    data = build_template_data(event_key, payload)
    page = page or DEFAULT_PAGES.get(event_key) or "pages/index/index"

    log = AppMessageLog(
        AccountId=account_id,
        EventKey=event_key,
        TemplateId=template_id,
        Payload=json.dumps({"page": page, "data": data, "biz": payload}, ensure_ascii=False),
        Status="PENDING",
    )
    db.add(log)
    db.flush()

    if _is_mock_template(template_id):
        log.Status = "MOCK"
        log.SentAt = datetime.utcnow()
        log.ErrorMessage = "开发环境 mock 模板，未真实调用微信；配置真实 template_id 后生效"
        db.commit()
        return {"ok": True, "mock": True, "logId": log.Id}

    try:
        access_token = _get_access_token()
        session = _wechat_http()
        # developer | trial | formal
        state = (getattr(settings, "WECHAT_MINIPROGRAM_STATE", None) or "developer").strip()
        resp = session.post(
            "https://api.weixin.qq.com/cgi-bin/message/subscribe/send",
            params={"access_token": access_token},
            json={
                "touser": account.OpenId,
                "template_id": template_id,
                "page": page,
                "data": data,
                "miniprogram_state": state,
                "lang": "zh_CN",
            },
            timeout=15,
        )
        body = resp.json() if resp.content else {}
        errcode = body.get("errcode", 0)
        if errcode in (0, None):
            log.Status = "SENT"
            log.SentAt = datetime.utcnow()
            # 一次性订阅：发送成功后清掉 accept，需用户再次授权
            db.query(AppUserSubscribeAuth).filter(
                AppUserSubscribeAuth.AccountId == account_id,
                AppUserSubscribeAuth.EventKey == event_key,
            ).update(
                {"Status": "consumed", "UpdatedAt": datetime.utcnow()},
                synchronize_session=False,
            )
            db.commit()
            return {"ok": True, "logId": log.Id}
        log.Status = "FAILED"
        log.ErrorMessage = f"{errcode}: {body.get('errmsg', '')}"[:500]
        db.commit()
        # 43101：微信侧无有效一次性订阅；清掉本地假 accept，避免下次误判已授权
        if errcode == 43101:
            db.query(AppUserSubscribeAuth).filter(
                AppUserSubscribeAuth.AccountId == account_id,
                AppUserSubscribeAuth.EventKey == event_key,
            ).update(
                {"Status": "reject", "UpdatedAt": datetime.utcnow()},
                synchronize_session=False,
            )
            db.commit()
        logger.warning("subscribe send failed account=%s event=%s body=%s", account_id, event_key, body)
        return {"ok": False, "reason": "wechat_error", "detail": body}
    except Exception as e:
        log.Status = "FAILED"
        log.ErrorMessage = str(e)[:500]
        db.commit()
        logger.exception("subscribe send exception")
        return {"ok": False, "reason": "exception", "detail": str(e)}


def try_send(
    db: Session,
    account_id: int,
    event_key: str,
    payload: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> None:
    """业务钩子用：失败不影响主流程。"""
    try:
        send_subscribe_message(db, account_id, event_key, payload, **kwargs)
    except Exception:
        logger.exception("try_send subscribe failed event=%s account=%s", event_key, account_id)
