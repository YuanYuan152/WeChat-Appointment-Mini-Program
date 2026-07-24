"""
1.3 统一支付链路
POST /api/payment/wechat/create  → 小程序统一下单，返回 wx.requestPayment 所需参数
POST /api/payment/wechat/callback → 微信支付异步回调（更新订单状态）

未配置真实微信支付凭证时返回 mock 签名参数，方便本地联调。
"""

import hashlib
import hmac
import random
import string
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from models import AppAccount, AppOrder, AppSchedule
from config import settings
from payment_service import _assert_order_binding_current, complete_paid_order
from pricing_service import (
    get_counselor_profile,
    resolve_display_price_cents,
    resolve_price_negotiation_required,
)
from user_role_meta import counselor_visible_to_patient
from intake_agreement import attach_intake_to_order
from app_time import china_now
from schedule_meta import parse_center_id

router = APIRouter(prefix="/api/payment", tags=["Payment"])

_PAY_PLACEHOLDERS = frozenset({"", "your_mch_id", "your_pay_api_key"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_real_wechat_pay_configured() -> bool:
    """占位符视为未配置，本地开发可走 mock + confirm-dev。"""
    appid = (settings.WECHAT_APPID or "").strip()
    mch_id = (settings.WECHAT_PAY_MCH_ID or "").strip()
    pay_key = (settings.WECHAT_PAY_KEY or "").strip()
    return bool(
        appid
        and mch_id not in _PAY_PLACEHOLDERS
        and pay_key not in _PAY_PLACEHOLDERS
    )


def _random_nonce(length: int = 16) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def _mock_pay_params(out_trade_no: str, total_fee: int) -> dict:
    """返回 mock wx.requestPayment 参数，方便在未配置真实支付时前端联调流程。"""
    nonce_str = _random_nonce()
    timestamp = str(int(time.time()))
    return {
        "appId": settings.WECHAT_APPID or "wx_mock_appid",
        "timeStamp": timestamp,
        "nonceStr": nonce_str,
        "package": f"prepay_id=mock_{out_trade_no}",
        "signType": "MD5",
        "paySign": "MOCK_SIGN_" + hashlib.md5(f"{out_trade_no}{nonce_str}".encode()).hexdigest()[:16].upper(),
        "out_trade_no": out_trade_no,
    }


def _wechat_callback_signature_valid(values: dict[str, Optional[str]]) -> bool:
    """真实微信支付回调必须校验商户号、AppId 和 V2 签名。"""
    if not _is_real_wechat_pay_configured():
        return True
    if values.get("appid") != settings.WECHAT_APPID:
        return False
    if values.get("mch_id") != settings.WECHAT_PAY_MCH_ID:
        return False
    provided = (values.get("sign") or "").strip().upper()
    if not provided:
        return False
    sign_values = {
        key: value
        for key, value in values.items()
        if key != "sign" and value is not None and str(value) != ""
    }
    sign_text = "&".join(f"{key}={sign_values[key]}" for key in sorted(sign_values))
    sign_text += f"&key={settings.WECHAT_PAY_KEY}"
    sign_type = (values.get("sign_type") or "MD5").upper()
    if sign_type == "HMAC-SHA256":
        expected = hmac.new(
            settings.WECHAT_PAY_KEY.encode("utf-8"),
            sign_text.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest().upper()
    else:
        expected = hashlib.md5(sign_text.encode("utf-8")).hexdigest().upper()
    return hmac.compare_digest(provided, expected)


def _wechat_callback_response(success: bool, message: str) -> Response:
    code = "SUCCESS" if success else "FAIL"
    return Response(
        content=f"<xml><return_code>{code}</return_code><return_msg>{message}</return_msg></xml>",
        media_type="application/xml",
    )


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateOrderRequest(BaseModel):
    slot_id: int          # 预约时段 ID
    total_fee: int        # 金额（分）
    description: Optional[str] = "心理咨询预约"
    center_id: Optional[str] = None
    is_adult: Optional[bool] = None
    signature_url: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_relation: Optional[str] = None
    emergency_phone: Optional[str] = None


class ConfirmDevPaymentRequest(BaseModel):
    out_trade_no: str
    center_id: Optional[str] = None


class PayExistingOrderRequest(BaseModel):
    order_id: int
    is_adult: Optional[bool] = None
    signature_url: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_relation: Optional[str] = None
    emergency_phone: Optional[str] = None


class AttachOrderAgreementRequest(BaseModel):
    order_id: int
    is_adult: bool
    signature_url: str
    emergency_contact: str
    emergency_relation: str
    emergency_phone: str


class CreateOrderResponse(BaseModel):
    out_trade_no: str
    pay_params: dict      # 直接透传给小程序端 wx.requestPayment


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _build_order_description(req: CreateOrderRequest, *, center_id: Optional[str] = None) -> str:
    desc = req.description or "心理咨询预约"
    resolved_center = center_id or req.center_id
    if resolved_center:
        desc = f"{desc}|center:{resolved_center}"
    return desc


def _create_pending_order(
    db: Session,
    account: AppAccount,
    req: CreateOrderRequest,
    out_trade_no: str,
) -> tuple[AppOrder, AppSchedule]:
    from proxy_booking_service import expire_pending_proxy_orders, pending_proxy_order_for_schedule

    expire_pending_proxy_orders(db)
    from patient_contract_service import (
        acquire_patient_contract_lock,
        assert_counselor_active_for_booking,
    )

    # 与换绑、咨询师退役和支付完成共用来访级事务锁；等待后刷新账号，
    # 避免使用锁等待期间已经失效的签约绑定快照创建新订单。
    acquire_patient_contract_lock(db, account.Id)
    db.refresh(account)
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == req.slot_id).first()
    if not schedule or schedule.Status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="该时段已被预约或不存在")
    try:
        assert_counselor_active_for_booking(db, schedule.CounselorId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    schedule_center = parse_center_id(schedule.Note)
    if req.center_id and schedule_center and req.center_id != schedule_center:
        raise HTTPException(status_code=400, detail="预约中心与排期不一致，请刷新后重试")
    if pending_proxy_order_for_schedule(db, schedule.Id):
        raise HTTPException(status_code=400, detail="该时段已有待支付订单")

    from charity_milestone_service import assert_charity_patient_can_book_charity
    from patient_contract_service import assert_patient_can_self_book

    assert_charity_patient_can_book_charity(db, account.Id, schedule.CounselorId)
    try:
        assert_patient_can_self_book(db, account.Id, schedule.CounselorId)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    profile = get_counselor_profile(db, schedule.CounselorId)
    if not profile or not counselor_visible_to_patient(
        profile.CounselorType,
        getattr(account, "PatientSource", None),
    ):
        raise HTTPException(status_code=403, detail="您无法预约该咨询师")

    if resolve_price_negotiation_required(db, account.Id, schedule.CounselorId):
        raise HTTPException(status_code=400, detail="该公益咨询师已进入需议价阶段，请联系助理确认价格后再预约")

    expected_fee = resolve_display_price_cents(db, account.Id, schedule.CounselorId)
    if req.total_fee != expected_fee:
        raise HTTPException(
            status_code=400,
            detail=f"价格已变更，请刷新后重试（应付 {expected_fee / 100:.0f} 元）",
        )

    order = AppOrder(
        AccountId=account.Id,
        SlotId=req.slot_id,
        OutTradeNo=out_trade_no,
        TotalFee=req.total_fee,
        Status="PENDING",
        Description=_build_order_description(req, center_id=schedule_center),
    )
    try:
        attach_intake_to_order(
            db,
            account,
            order,
            is_adult=req.is_adult,
            signature_url=req.signature_url,
            emergency_contact=req.emergency_contact,
            emergency_relation=req.emergency_relation,
            emergency_phone=req.emergency_phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.add(order)
    db.flush()
    return order, schedule


@router.post("/wechat/create", response_model=CreateOrderResponse, summary="小程序统一下单")
def create_order(
    req: CreateOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    out_trade_no = f"LXXL{int(time.time())}{random.randint(1000, 9999)}"
    order, _schedule = _create_pending_order(db, current_account, req, out_trade_no)
    db.commit()
    db.refresh(order)

    # 真实环境：调用微信统一下单 API，获取 prepay_id，再签名
    # 本地 mock：直接返回 mock 参数
    if _is_real_wechat_pay_configured():
        try:
            pay_params = _real_unified_order(
                out_trade_no=out_trade_no,
                total_fee=req.total_fee,
                description=req.description or "心理咨询预约",
                openid=current_account.OpenId,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"微信下单失败: {str(e)}")
    else:
        pay_params = _mock_pay_params(out_trade_no, req.total_fee)

    return CreateOrderResponse(
        out_trade_no=out_trade_no,
        pay_params={**pay_params, "order_id": order.Id},
    )


def _load_payable_order(
    db: Session,
    account: AppAccount,
    order_id: int,
) -> AppOrder:
    from proxy_booking_service import expire_pending_proxy_orders

    expire_pending_proxy_orders(db)
    order = (
        db.query(AppOrder)
        .filter(AppOrder.Id == order_id, AppOrder.AccountId == account.Id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.Status != "PENDING":
        raise HTTPException(status_code=400, detail="订单不可支付")
    if order.ExpiresAt and order.ExpiresAt < china_now():
        raise HTTPException(status_code=400, detail="订单已过期，请重新预约")
    if order.SlotId:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
        if not schedule or schedule.Status != "AVAILABLE":
            raise HTTPException(status_code=400, detail="预约时段已不可用")
    try:
        _assert_order_binding_current(db, account, order)
        if order.SlotId:
            from patient_contract_service import assert_counselor_active_for_booking

            assert_counselor_active_for_booking(db, schedule.CounselorId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return order


def _attach_order_agreement_if_needed(
    db: Session,
    account: AppAccount,
    order: AppOrder,
    *,
    is_adult: Optional[bool],
    signature_url: Optional[str],
    emergency_contact: Optional[str] = None,
    emergency_relation: Optional[str] = None,
    emergency_phone: Optional[str] = None,
) -> None:
    from order_contract_agreement import attach_contract_agreement_to_order

    attach_contract_agreement_to_order(
        db,
        account,
        order,
        is_adult=is_adult,
        signature_url=signature_url,
        emergency_contact=emergency_contact,
        emergency_relation=emergency_relation,
        emergency_phone=emergency_phone,
    )


@router.post("/wechat/attach-order-agreement", summary="待支付订单签署心理咨询协议")
def attach_order_agreement(
    req: AttachOrderAgreementRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    order = _load_payable_order(db, current_account, req.order_id)
    try:
        _attach_order_agreement_if_needed(
            db,
            current_account,
            order,
            is_adult=req.is_adult,
            signature_url=req.signature_url,
            emergency_contact=req.emergency_contact,
            emergency_relation=req.emergency_relation,
            emergency_phone=req.emergency_phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(order)
    from patient import _build_order_out

    return {"code": 0, "msg": "协议已签署", "data": _build_order_out(db, order, current_account)}


@router.post("/wechat/pay-order", response_model=CreateOrderResponse, summary="支付已有待支付订单")
def pay_existing_order(
    req: PayExistingOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    order = _load_payable_order(db, current_account, req.order_id)
    try:
        _attach_order_agreement_if_needed(
            db,
            current_account,
            order,
            is_adult=req.is_adult,
            signature_url=req.signature_url,
            emergency_contact=req.emergency_contact,
            emergency_relation=req.emergency_relation,
            emergency_phone=req.emergency_phone,
        )
        from order_contract_agreement import assert_order_contract_agreement_ready

        assert_order_contract_agreement_ready(db, current_account, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(order)
    if _is_real_wechat_pay_configured():
        try:
            pay_params = _real_unified_order(
                out_trade_no=order.OutTradeNo,
                total_fee=order.TotalFee,
                description=order.Description or "心理咨询预约",
                openid=current_account.OpenId,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"微信下单失败: {str(e)}")
    else:
        pay_params = _mock_pay_params(order.OutTradeNo, order.TotalFee)
    return CreateOrderResponse(
        out_trade_no=order.OutTradeNo,
        pay_params={**pay_params, "order_id": order.Id},
    )


@router.post("/wechat/simulate-pay-order", summary="开发环境：支付已有待支付订单")
def simulate_pay_existing_order(
    req: PayExistingOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if _is_real_wechat_pay_configured():
        raise HTTPException(status_code=403, detail="已配置真实支付，请使用微信支付流程")
    order = _load_payable_order(db, current_account, req.order_id)
    try:
        _attach_order_agreement_if_needed(
            db,
            current_account,
            order,
            is_adult=req.is_adult,
            signature_url=req.signature_url,
            emergency_contact=req.emergency_contact,
            emergency_relation=req.emergency_relation,
            emergency_phone=req.emergency_phone,
        )
        from order_contract_agreement import assert_order_contract_agreement_ready

        assert_order_contract_agreement_ready(db, current_account, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    center_id = None
    if order.Description and "center:" in order.Description:
        for part in order.Description.split("|"):
            if part.strip().lower().startswith("center:"):
                center_id = part.split(":", 1)[1].strip()
                break
    try:
        complete_paid_order(
            db,
            order,
            center_id=center_id,
            transaction_id=f"SIM_{order.OutTradeNo}",
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(order)
    return {
        "code": 0,
        "msg": "支付成功",
        "data": {"order_id": order.Id, "out_trade_no": order.OutTradeNo, "status": order.Status},
    }


@router.post("/wechat/simulate-pay", summary="开发环境一键模拟支付并预约成功")
def simulate_pay(
    req: CreateOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """
    点击「确认支付」即完成：创建订单 → 标记 PAID → 时段 BOOKED → 写入咨询记录。
    未配置真实微信支付时可用；上线后请改用 create + 微信回调。
    """
    if _is_real_wechat_pay_configured():
        raise HTTPException(status_code=403, detail="已配置真实支付，请使用微信支付流程")

    out_trade_no = f"LXXL{int(time.time())}{random.randint(1000, 9999)}"
    order, _schedule = _create_pending_order(db, current_account, req, out_trade_no)

    center_id = req.center_id
    if not center_id and order.Description and "center:" in order.Description:
        for part in order.Description.split("|"):
            if part.strip().lower().startswith("center:"):
                center_id = part.split(":", 1)[1].strip()
                break

    try:
        complete_paid_order(
            db,
            order,
            center_id=center_id,
            transaction_id=f"SIM_{out_trade_no}",
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(order)

    return {
        "code": 0,
        "msg": "预约成功",
        "data": {
            "order_id": order.Id,
            "out_trade_no": out_trade_no,
            "status": order.Status,
        },
    }


@router.post("/wechat/confirm-dev", summary="开发环境模拟支付到账")
def confirm_dev_payment(
    req: ConfirmDevPaymentRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """未配置真实微信支付时，由后端确认到账并 BOOKED 时段（全员置灰）。"""
    if _is_real_wechat_pay_configured():
        raise HTTPException(status_code=403, detail="已配置真实支付，不可使用开发确认接口")

    order = (
        db.query(AppOrder)
        .filter(AppOrder.OutTradeNo == req.out_trade_no, AppOrder.AccountId == current_account.Id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    center_id = req.center_id
    if not center_id and order.Description and "center:" in order.Description:
        for part in order.Description.split("|"):
            if part.strip().lower().startswith("center:"):
                center_id = part.split(":", 1)[1].strip()
                break

    try:
        complete_paid_order(db, order, center_id=center_id, transaction_id=f"DEV_{req.out_trade_no}")
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"code": 0, "msg": "支付确认成功", "order_id": order.Id}


@router.post("/wechat/callback", summary="微信支付异步回调", include_in_schema=False)
async def payment_callback(request: Request, db: Session = Depends(get_db)):
    """
    接收微信支付结果通知，解析 XML，验签后更新订单状态。
    """
    body = await request.body()
    try:
        xml_data = ET.fromstring(body.decode("utf-8"))
        result = {child.tag: child.text for child in xml_data}
    except Exception:
        return _wechat_callback_response(False, "解析失败")

    if not _wechat_callback_signature_valid(result):
        return _wechat_callback_response(False, "签名校验失败")

    return_code = result.get("return_code")
    result_code = result.get("result_code")
    out_trade_no = result.get("out_trade_no")

    if return_code == "SUCCESS" and result_code == "SUCCESS":
        if not out_trade_no:
            return _wechat_callback_response(False, "缺少商户订单号")
        order = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
        if not order:
            return _wechat_callback_response(False, "订单不存在")
        callback_fee = result.get("total_fee")
        if callback_fee is None and _is_real_wechat_pay_configured():
            return _wechat_callback_response(False, "缺少支付金额")
        if callback_fee is not None:
            try:
                amount_matches = int(callback_fee) == int(order.TotalFee)
            except (TypeError, ValueError):
                amount_matches = False
            if not amount_matches:
                return _wechat_callback_response(False, "支付金额不一致")

        if order.Status != "PAID":
            center_id = None
            if order.Description and "center:" in order.Description:
                for part in order.Description.split("|"):
                    if part.strip().lower().startswith("center:"):
                        center_id = part.split(":", 1)[1].strip()
                        break
            try:
                complete_paid_order(
                    db, order, center_id=center_id, transaction_id=result.get("transaction_id")
                )
                db.commit()
            except ValueError:
                db.rollback()
                return _wechat_callback_response(
                    False,
                    "订单业务校验失败，请重试或联系工作人员",
                )
            except Exception:
                db.rollback()
                return _wechat_callback_response(False, "订单处理失败，请稍后重试")

    return _wechat_callback_response(True, "OK")


# ---------------------------------------------------------------------------
# Real WeChat unified order (only called when credentials configured)
# ---------------------------------------------------------------------------

def _real_unified_order(out_trade_no: str, total_fee: int, description: str, openid: str) -> dict:
    import requests as req_lib

    nonce_str = _random_nonce()
    params = {
        "appid": settings.WECHAT_APPID,
        "mch_id": settings.WECHAT_PAY_MCH_ID,
        "nonce_str": nonce_str,
        "body": description,
        "out_trade_no": out_trade_no,
        "total_fee": total_fee,
        "spbill_create_ip": "127.0.0.1",
        "notify_url": settings.WECHAT_PAY_NOTIFY_URL,
        "trade_type": "JSAPI",
        "openid": openid,
    }
    # 签名
    sign_str = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    sign_str += f"&key={settings.WECHAT_PAY_KEY}"
    sign = hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()
    params["sign"] = sign

    xml_body = "<xml>" + "".join(f"<{k}>{v}</{k}>" for k, v in params.items()) + "</xml>"
    resp = req_lib.post("https://api.mch.weixin.qq.com/pay/unifiedorder",
                        data=xml_body.encode("utf-8"), timeout=10)
    result = {child.tag: child.text for child in ET.fromstring(resp.content)}

    if result.get("return_code") != "SUCCESS" or result.get("result_code") != "SUCCESS":
        raise Exception(result.get("err_code_des", "统一下单失败"))

    prepay_id = result["prepay_id"]
    timestamp = str(int(time.time()))
    pay_sign_params = {
        "appId": settings.WECHAT_APPID,
        "timeStamp": timestamp,
        "nonceStr": nonce_str,
        "package": f"prepay_id={prepay_id}",
        "signType": "MD5",
    }
    pay_sign_str = "&".join(f"{k}={v}" for k, v in sorted(pay_sign_params.items()))
    pay_sign_str += f"&key={settings.WECHAT_PAY_KEY}"
    pay_sign = hashlib.md5(pay_sign_str.encode("utf-8")).hexdigest().upper()

    return {**pay_sign_params, "paySign": pay_sign, "out_trade_no": out_trade_no}
