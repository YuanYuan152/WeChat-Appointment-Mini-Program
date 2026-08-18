"""
1.3 统一支付链路（微信支付 APIv3 / 小程序支付）

POST /api/payment/wechat/create       → JSAPI/小程序下单，返回 uni.requestPayment 参数
POST /api/payment/wechat/pay-order   → 已有待支付订单再次下单
POST /api/payment/wechat/sync-order  → 支付后查单同步入账（官方查单）
POST /api/payment/wechat/callback    → 支付成功回调通知（V3 JSON）
POST /api/payment/wechat/refund-callback → 退款结果回调通知（V3 JSON）

未配置真实微信支付凭证时返回 mock 签名参数，并允许 simulate-pay / confirm-dev。

官方开发指引：https://pay.weixin.qq.com/doc/v3/merchant/4012791911
"""

from __future__ import annotations

import json
import random
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app_time import china_now
from auth import get_current_account
from database import get_db
from intake_agreement import attach_intake_to_order
from models import AppAccount, AppOrder, AppSchedule
from payment_service import _assert_order_binding_current, complete_paid_order
from pricing_service import (
    get_counselor_profile,
    resolve_display_price_cents,
    resolve_price_negotiation_required,
)
from schedule_meta import parse_center_id
from schedule_slots import validate_booking_lead_time
from user_role_meta import counselor_visible_to_patient
from wechat_pay_service import (
    build_jsapi_pay_params,
    close_wechat_order_quietly,
    confirm_refund_success_from_callback,
    format_wechat_time_expire,
    is_real_wechat_pay_configured,
    sync_paid_order_from_wechat,
)
from wechat_pay_v3 import WeChatPayV3Error, get_wechat_pay_client

router = APIRouter(prefix="/api/payment", tags=["Payment"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateOrderRequest(BaseModel):
    slot_id: int
    total_fee: int
    description: Optional[str] = "心理咨询预约"
    center_id: Optional[str] = None
    is_adult: Optional[bool] = None
    signature_url: Optional[str] = None
    real_name: Optional[str] = None
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
    real_name: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_relation: Optional[str] = None
    emergency_phone: Optional[str] = None


class AttachOrderAgreementRequest(BaseModel):
    order_id: int
    is_adult: bool
    signature_url: str
    real_name: Optional[str] = None
    emergency_contact: str
    emergency_relation: str
    emergency_phone: str


class SyncOrderRequest(BaseModel):
    order_id: Optional[int] = None
    out_trade_no: Optional[str] = None


class CreateOrderResponse(BaseModel):
    out_trade_no: str
    pay_params: dict


# ---------------------------------------------------------------------------
# Order helpers
# ---------------------------------------------------------------------------

def _build_order_description(req: CreateOrderRequest, *, center_id: Optional[str] = None) -> str:
    desc = req.description or "心理咨询预约"
    resolved_center = center_id or req.center_id
    if resolved_center:
        desc = f"{desc}|center:{resolved_center}"
    return desc


def _center_id_from_order(order: AppOrder) -> Optional[str]:
    if order.Description and "center:" in order.Description:
        for part in order.Description.split("|"):
            if part.strip().lower().startswith("center:"):
                return part.split(":", 1)[1].strip()
    return None


def _create_pending_order(
    db: Session,
    account: AppAccount,
    req: CreateOrderRequest,
    out_trade_no: str,
) -> tuple[AppOrder, AppSchedule]:
    from proxy_booking_service import expire_pending_proxy_orders, pending_proxy_order_for_schedule
    from patient_contract_service import (
        acquire_patient_contract_lock,
        assert_counselor_active_for_booking,
    )

    expire_pending_proxy_orders(db)
    acquire_patient_contract_lock(db, account.Id)
    db.refresh(account)
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == req.slot_id).first()
    if not schedule or schedule.Status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="该时段已被预约或不存在")
    try:
        validate_booking_lead_time(schedule.StartTime)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
            real_name=req.real_name,
            emergency_contact=req.emergency_contact,
            emergency_relation=req.emergency_relation,
            emergency_phone=req.emergency_phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.add(order)
    db.flush()
    return order, schedule


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
        close_wechat_order_quietly(order.OutTradeNo)
        raise HTTPException(status_code=400, detail="订单已过期，请重新预约")
    schedule = None
    if order.SlotId:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
        if not schedule or schedule.Status != "AVAILABLE":
            raise HTTPException(status_code=400, detail="预约时段已不可用")
        try:
            validate_booking_lead_time(schedule.StartTime)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        _assert_order_binding_current(db, account, order)
        if order.SlotId and schedule is not None:
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
    real_name: Optional[str] = None,
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
        real_name=real_name,
        emergency_contact=emergency_contact,
        emergency_relation=emergency_relation,
        emergency_phone=emergency_phone,
    )


def _resolve_pay_params(order: AppOrder, account: AppAccount, description: str) -> dict:
    time_expire = None
    if order.ExpiresAt:
        time_expire = format_wechat_time_expire(order.ExpiresAt)
    try:
        return build_jsapi_pay_params(
            out_trade_no=order.OutTradeNo,
            total_fee=order.TotalFee,
            description=description,
            openid=account.OpenId or "",
            time_expire=time_expire,
        )
    except WeChatPayV3Error as e:
        raise HTTPException(status_code=500, detail=f"微信下单失败: {e}") from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"微信下单失败: {e}") from e


def _v3_callback_success() -> Response:
    """官方：验签通过应答 HTTP 200/204，无需应答包体。"""
    return Response(status_code=204)


def _v3_callback_fail(message: str, *, status_code: int = 400) -> JSONResponse:
    """官方：验签/处理失败应答 4XX/5XX，并返回 code/message。"""
    return JSONResponse(
        status_code=status_code,
        content={"code": "FAIL", "message": message},
    )


async def _parse_v3_notification(request: Request) -> dict:
    """验签并解密 V3 支付/退款回调，返回 resource 明文 dict。"""
    body = (await request.body()).decode("utf-8")
    timestamp = request.headers.get("Wechatpay-Timestamp", "")
    nonce = request.headers.get("Wechatpay-Nonce", "")
    signature = request.headers.get("Wechatpay-Signature", "")
    serial = request.headers.get("Wechatpay-Serial", "")

    if is_real_wechat_pay_configured():
        client = get_wechat_pay_client()
        if not client.verify_notification_signature(
            timestamp=timestamp,
            nonce=nonce,
            body=body,
            signature=signature,
            serial=serial,
        ):
            raise HTTPException(status_code=401, detail="回调签名校验失败")
        envelope = json.loads(body)
        resource = envelope.get("resource") or {}
        return client.decrypt_notification_resource(resource)

    # 模拟模式：允许直接投递明文 JSON（便于本地联调）
    envelope = json.loads(body) if body.strip() else {}
    if "resource" in envelope and isinstance(envelope["resource"], dict):
        if "plaintext" in envelope["resource"]:
            return envelope["resource"]["plaintext"]
    return envelope


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/wechat/create", response_model=CreateOrderResponse, summary="小程序统一下单(V3)")
def create_order(
    req: CreateOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    out_trade_no = f"LXXL{int(time.time())}{random.randint(1000, 9999)}"
    order, _schedule = _create_pending_order(db, current_account, req, out_trade_no)
    db.commit()
    db.refresh(order)

    pay_params = _resolve_pay_params(
        order,
        current_account,
        req.description or "心理咨询预约",
    )
    return CreateOrderResponse(
        out_trade_no=out_trade_no,
        pay_params={**pay_params, "order_id": order.Id},
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
            real_name=req.real_name,
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


@router.post("/wechat/pay-order", response_model=CreateOrderResponse, summary="支付已有待支付订单(V3)")
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
            real_name=req.real_name,
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

    pay_params = _resolve_pay_params(
        order,
        current_account,
        order.Description or "心理咨询预约",
    )
    return CreateOrderResponse(
        out_trade_no=order.OutTradeNo,
        pay_params={**pay_params, "order_id": order.Id},
    )


@router.post("/wechat/sync-order", summary="支付后查单同步（官方查单）")
def sync_order_payment(
    req: SyncOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """
    对应官方指引 2.3：requestPayment 返回后调用查单确认状态。
    接口：GET /v3/pay/transactions/out-trade-no/{out_trade_no}
    """
    if not req.order_id and not req.out_trade_no:
        raise HTTPException(status_code=400, detail="请提供 order_id 或 out_trade_no")

    query = db.query(AppOrder).filter(AppOrder.AccountId == current_account.Id)
    if req.order_id:
        order = query.filter(AppOrder.Id == req.order_id).first()
    else:
        order = query.filter(AppOrder.OutTradeNo == req.out_trade_no).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order.Status == "PAID":
        return {
            "code": 0,
            "msg": "已支付",
            "data": {"order_id": order.Id, "out_trade_no": order.OutTradeNo, "status": order.Status},
        }

    if not is_real_wechat_pay_configured():
        return {
            "code": 0,
            "msg": "模拟模式未接微信查单，请使用 simulate-pay 或等待回调",
            "data": {"order_id": order.Id, "out_trade_no": order.OutTradeNo, "status": order.Status},
        }

    try:
        paid = sync_paid_order_from_wechat(db, order)
        if paid:
            db.commit()
            db.refresh(order)
        else:
            db.rollback()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    except WeChatPayV3Error as e:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"微信查单失败: {e}") from e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"同步支付状态失败: {e}") from e

    return {
        "code": 0,
        "msg": "已支付" if order.Status == "PAID" else "尚未支付成功",
        "data": {"order_id": order.Id, "out_trade_no": order.OutTradeNo, "status": order.Status},
    }


@router.post("/wechat/simulate-pay-order", summary="开发环境：支付已有待支付订单")
def simulate_pay_existing_order(
    req: PayExistingOrderRequest,
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if is_real_wechat_pay_configured():
        raise HTTPException(status_code=403, detail="已配置真实支付，请使用微信支付流程")
    order = _load_payable_order(db, current_account, req.order_id)
    try:
        _attach_order_agreement_if_needed(
            db,
            current_account,
            order,
            is_adult=req.is_adult,
            signature_url=req.signature_url,
            real_name=req.real_name,
            emergency_contact=req.emergency_contact,
            emergency_relation=req.emergency_relation,
            emergency_phone=req.emergency_phone,
        )
        from order_contract_agreement import assert_order_contract_agreement_ready

        assert_order_contract_agreement_ready(db, current_account, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        complete_paid_order(
            db,
            order,
            center_id=_center_id_from_order(order),
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
    if is_real_wechat_pay_configured():
        raise HTTPException(status_code=403, detail="已配置真实支付，请使用微信支付流程")

    out_trade_no = f"LXXL{int(time.time())}{random.randint(1000, 9999)}"
    order, _schedule = _create_pending_order(db, current_account, req, out_trade_no)
    center_id = req.center_id or _center_id_from_order(order)

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
    if is_real_wechat_pay_configured():
        raise HTTPException(status_code=403, detail="已配置真实支付，不可使用开发确认接口")

    order = (
        db.query(AppOrder)
        .filter(AppOrder.OutTradeNo == req.out_trade_no, AppOrder.AccountId == current_account.Id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    center_id = req.center_id or _center_id_from_order(order)
    try:
        complete_paid_order(db, order, center_id=center_id, transaction_id=f"DEV_{req.out_trade_no}")
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"code": 0, "msg": "支付确认成功", "order_id": order.Id}


@router.post("/wechat/callback", summary="微信支付成功回调(V3)", include_in_schema=False)
async def payment_callback(request: Request, db: Session = Depends(get_db)):
    """
    官方支付成功回调通知。
    验签通过 → HTTP 204 空包体；失败 → 4XX/5XX + JSON。
    """
    try:
        result = await _parse_v3_notification(request)
    except HTTPException as exc:
        return _v3_callback_fail(str(exc.detail), status_code=exc.status_code)
    except Exception:
        return _v3_callback_fail("解析失败", status_code=400)

    trade_state = result.get("trade_state")
    out_trade_no = result.get("out_trade_no")
    if trade_state and trade_state != "SUCCESS":
        return _v3_callback_success()
    if not out_trade_no:
        return _v3_callback_fail("缺少商户订单号")

    order = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
    if not order:
        return _v3_callback_fail("订单不存在")

    amount_total = (result.get("amount") or {}).get("total")
    if amount_total is None and result.get("total_fee") is not None:
        amount_total = result.get("total_fee")
    if amount_total is not None and is_real_wechat_pay_configured():
        try:
            amount_matches = int(amount_total) == int(order.TotalFee)
        except (TypeError, ValueError):
            amount_matches = False
        if not amount_matches:
            return _v3_callback_fail("支付金额不一致")

    if order.Status != "PAID":
        try:
            complete_paid_order(
                db,
                order,
                center_id=_center_id_from_order(order),
                transaction_id=result.get("transaction_id"),
            )
            db.commit()
        except ValueError:
            db.rollback()
            # 业务失败仍应答成功，避免微信无限重试；以查单/人工处理兜底
            return _v3_callback_success()
        except Exception:
            db.rollback()
            return _v3_callback_fail("订单处理失败，请稍后重试", status_code=500)

    return _v3_callback_success()


@router.post("/wechat/refund-callback", summary="微信退款结果回调(V3)", include_in_schema=False)
async def refund_callback(request: Request, db: Session = Depends(get_db)):
    """
    退款结果通知：仅 refund_status=SUCCESS 视为到账终态。
    验签通过 → HTTP 204；失败 → 4XX/5XX。
    """
    try:
        result = await _parse_v3_notification(request)
    except HTTPException as exc:
        return _v3_callback_fail(str(exc.detail), status_code=exc.status_code)
    except Exception:
        return _v3_callback_fail("解析失败", status_code=400)

    refund_status = (result.get("refund_status") or result.get("status") or "").upper()
    out_trade_no = result.get("out_trade_no")
    if not out_trade_no:
        return _v3_callback_fail("缺少商户订单号")

    order = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
    if not order:
        return _v3_callback_fail("订单不存在")

    try:
        if confirm_refund_success_from_callback(order, refund_status=refund_status):
            db.commit()
        elif refund_status in ("ABNORMAL", "CLOSED"):
            # 异常/关闭：应答成功停止重推，本地已取消预约保持 REFUNDED 或人工处理
            db.rollback()
        else:
            # PROCESSING 等：已在申请退款时本地关单，此处不改状态
            db.rollback()
    except Exception:
        db.rollback()
        return _v3_callback_fail("退款回调处理失败", status_code=500)

    return _v3_callback_success()
