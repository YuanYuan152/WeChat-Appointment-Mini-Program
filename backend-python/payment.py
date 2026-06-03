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
from models import AppAccount, AppOrder
from config import settings

router = APIRouter(prefix="/api/payment", tags=["Payment"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


class CreateOrderResponse(BaseModel):
    out_trade_no: str
    pay_params: dict      # 直接透传给小程序端 wx.requestPayment


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/wechat/create", response_model=CreateOrderResponse, summary="小程序统一下单")
def create_order(
    req: CreateOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    out_trade_no = f"LXXL{int(time.time())}{random.randint(1000, 9999)}"

    order = AppOrder(
        AccountId=current_account.Id,
        SlotId=req.slot_id,
        OutTradeNo=out_trade_no,
        TotalFee=req.total_fee,
        Status="PENDING",
        Description=req.description,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # 真实环境：调用微信统一下单 API，获取 prepay_id，再签名
    # 本地 mock：直接返回 mock 参数
    if settings.WECHAT_APPID and settings.WECHAT_PAY_MCH_ID and settings.WECHAT_PAY_KEY:
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

    return CreateOrderResponse(out_trade_no=out_trade_no, pay_params=pay_params)


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
            order.Status = "PAID"
            order.PaidAt = datetime.utcnow()
            order.TransactionId = result.get("transaction_id")
            db.commit()

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
