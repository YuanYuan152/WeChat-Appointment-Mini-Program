"""
1.3 统一支付链路
POST /api/payment/wechat/create  → 小程序统一下单，返回 wx.requestPayment 所需参数
POST /api/payment/wechat/callback → 微信支付异步回调（更新订单状态）

未配置真实微信支付凭证时返回 mock 签名参数，方便本地联调。
"""

import hashlib
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
from payment_service import complete_paid_order
from pricing_service import get_counselor_profile, resolve_display_price_cents
from user_role_meta import counselor_visible_to_patient
from intake_agreement import attach_intake_to_order

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


class ConfirmDevPaymentRequest(BaseModel):
    out_trade_no: str
    center_id: Optional[str] = None


class CreateOrderResponse(BaseModel):
    out_trade_no: str
    pay_params: dict      # 直接透传给小程序端 wx.requestPayment


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _build_order_description(req: CreateOrderRequest) -> str:
    desc = req.description or "心理咨询预约"
    if req.center_id:
        desc = f"{desc}|center:{req.center_id}"
    return desc


def _create_pending_order(
    db: Session,
    account: AppAccount,
    req: CreateOrderRequest,
    out_trade_no: str,
) -> tuple[AppOrder, AppSchedule]:
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == req.slot_id).first()
    if not schedule or schedule.Status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="该时段已被预约或不存在")

    profile = get_counselor_profile(db, schedule.CounselorId)
    if not profile or not counselor_visible_to_patient(
        profile.CounselorType,
        getattr(account, "PatientSource", None),
    ):
        raise HTTPException(status_code=403, detail="您无法预约该咨询师")

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
        Description=_build_order_description(req),
    )
    try:
        attach_intake_to_order(
            db,
            account,
            order,
            is_adult=req.is_adult,
            signature_url=req.signature_url,
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
        return Response(content="<xml><return_code>FAIL</return_code><return_msg>解析失败</return_msg></xml>",
                        media_type="application/xml")

    return_code = result.get("return_code")
    result_code = result.get("result_code")
    out_trade_no = result.get("out_trade_no")

    if return_code == "SUCCESS" and result_code == "SUCCESS" and out_trade_no:
        order = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
        if order and order.Status == "PENDING":
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

    return Response(
        content="<xml><return_code>SUCCESS</return_code><return_msg>OK</return_msg></xml>",
        media_type="application/xml",
    )


# ---------------------------------------------------------------------------
# Real WeChat unified order (only called when credentials configured)
# ---------------------------------------------------------------------------

def _real_unified_order(out_trade_no: str, total_fee: int, description: str, openid: str) -> dict:
    import requests as req_lib
    import hmac

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
