"""来访者取消咨询：24 小时规则与排期释放。"""
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app_time import china_now, hours_until as _hours_until
from models import AppConsultation, AppOrder, AppSchedule
from schedule_meta import release_assigned_room

CANCEL_REFUND_HOURS = 24


def hours_until_appointment(start_time: Optional[datetime]) -> Optional[float]:
    return _hours_until(start_time)


def has_appointment_started(start_time: Optional[datetime]) -> bool:
    """当前时间是否已到或超过咨询开始时间。"""
    hours = hours_until_appointment(start_time)
    if hours is None:
        return True
    return hours <= 0


def has_appointment_ended(end_time: Optional[datetime]) -> bool:
    """当前时间是否已到或超过咨询结束时间。"""
    hours = hours_until_appointment(end_time)
    if hours is None:
        return False
    return hours <= 0


def is_refund_eligible(start_time: Optional[datetime]) -> bool:
    hours = hours_until_appointment(start_time)
    if hours is None:
        return False
    return hours >= CANCEL_REFUND_HOURS


def refund_ineligible_reason(start_time: Optional[datetime]) -> Optional[str]:
    """不可全额退款时的说明文案。"""
    if is_refund_eligible(start_time):
        return None
    hours = hours_until_appointment(start_time)
    if hours is None:
        return "咨询开始时间未确定，暂无法全额退款"
    if hours < 0:
        return "咨询已开始或已结束，按规定不予全额退款"
    return f"距咨询开始不足{CANCEL_REFUND_HOURS}小时，按规定不予全额退款"


def can_visitor_cancel(status: str) -> bool:
    return status in ("PENDING", "CONFIRMED", "ONGOING")


def order_created_proxy_schedule(order: Optional[AppOrder]) -> bool:
    """助理/管理员推送时新建的时段，不是咨询师原先放出的排期。"""
    if order is None:
        return False
    return "schedule:new" in (order.Description or "")


def order_is_offline_payment(order: Optional[AppOrder]) -> bool:
    """助理/管理员推送并由来访确认的线下支付单，没有微信在线收款。"""
    if order is None:
        return False
    if bool(getattr(order, "ProxyIsOfflinePayment", False)):
        return True
    return str(getattr(order, "TransactionId", None) or "").startswith("OFFLINE_")


def order_is_confirm_only(order: Optional[AppOrder]) -> bool:
    """免费体验单和线下支付单只确认预约，取消时不产生退款。"""
    if order is None:
        return False
    if order_is_offline_payment(order):
        return True
    if bool(getattr(order, "ProxyIsFreeExperience", False)):
        return True
    return int(getattr(order, "TotalFee", 0) or 0) <= 0


def visitor_must_apply_to_cancel(
    start_time: Optional[datetime],
    order: Optional[AppOrder],
) -> bool:
    """距咨询开始不足 24 小时时，线上单和线下支付单都要提交申请后才能取消。"""
    del order
    return not is_refund_eligible(start_time)


def cancellation_refund_text(*, refunded: bool, offline: bool, confirm_only: bool = False) -> str:
    if offline:
        return "线下支付，不涉及线上退款"
    if confirm_only:
        return "免费体验，不涉及退款"
    if refunded:
        return "款项将原路退回"
    return "按规定不予退款"


def _refund_paid_order(order: AppOrder, *, reason: str) -> None:
    """
    已支付订单退款：
    - 真实支付：申请退款并查单确认受理（PROCESSING/SUCCESS）后本地标 REFUNDED；
      资金到账以退款结果回调 SUCCESS 再确认。
    - 模拟：仅更新本地订单为 REFUNDED。
    """
    from wechat_pay_service import (
        WeChatPayV3Error,
        apply_local_refund,
        refund_status_accepted,
        request_wechat_refund,
    )

    if order_is_offline_payment(order):
        order.Status = "CANCELLED"
        order.UpdatedAt = datetime.utcnow()
        return

    try:
        result = request_wechat_refund(order, reason=reason)
    except WeChatPayV3Error as exc:
        raise ValueError("微信退款未受理，请稍后重试") from exc
    if result is not None and not refund_status_accepted(result):
        status = (result.get("status") or "未知")
        raise ValueError(f"微信退款未受理成功（{status}），请稍后重试")
    # 受理成功即本地关单，避免重复退款；终态由退款回调 SUCCESS 确认
    apply_local_refund(order)


def refund_order_for_counselor_leave(db: Session, consultation: AppConsultation) -> bool:
    """咨询师请假导致预约取消：已支付订单无条件全额退款。"""
    if not consultation.OrderId:
        return False
    order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
    if order and order.Status == "PAID":
        if order_is_confirm_only(order):
            order.Status = "CANCELLED"
            order.UpdatedAt = datetime.utcnow()
            return False
        _refund_paid_order(order, reason="咨询师请假取消预约")
        return True
    return bool(order and order.Status == "REFUNDED")


def cancel_consultation_for_visitor(
    db: Session,
    consultation: AppConsultation,
    *,
    patient_id: int,
    force_refund: bool = False,
) -> Tuple[bool, str]:
    """
    取消咨询单。返回 (是否退款, 提示文案)。
    仅本人、待确认/已确认/进行中可取消。
    force_refund=True 时无视 24 小时规则（管理员退款审核通过）。
    """
    if consultation.PatientId != patient_id:
        raise PermissionError("无权取消该咨询")
    if not can_visitor_cancel(consultation.Status):
        raise ValueError("当前状态不可取消")

    primary_order = (
        db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
        if consultation.OrderId
        else None
    )
    confirm_only = order_is_confirm_only(primary_order)
    if not force_refund and visitor_must_apply_to_cancel(consultation.StartTime, primary_order):
        if confirm_only:
            raise ValueError("距咨询开始不足24小时，请提交取消申请，审核通过后才会取消")
        raise ValueError("距咨询开始不足24小时，请提交取消申请")

    if not force_refund:
        from models import AppRefundExemption

        pending = (
            db.query(AppRefundExemption)
            .filter(
                AppRefundExemption.ConsultationId == consultation.Id,
                AppRefundExemption.Status == "PENDING",
            )
            .first()
        )
        if pending:
            raise ValueError("取消申请正在审核中，请等待审核结果")

    refund = (not confirm_only) and (force_refund or is_refund_eligible(consultation.StartTime))
    consultation.Status = "CANCELLED"
    consultation.UpdatedAt = datetime.utcnow()

    from consultation_status_service import cancel_consultation_auto_done_tasks

    cancel_consultation_auto_done_tasks(db, consultation.Id)

    # 关闭关联已支付订单：优先 OrderId，同时兜底同排期同来访的 PAID 单，
    # 避免缺 OrderId 时不退款取消后仍留下 PAID 单阻断换绑/解绑。
    paid_orders = []
    seen_order_ids: set[int] = set()
    if consultation.OrderId:
        order = db.query(AppOrder).filter(AppOrder.Id == consultation.OrderId).first()
        if order and order.Status == "PAID":
            paid_orders.append(order)
            seen_order_ids.add(int(order.Id))
    if consultation.ScheduleId:
        for order in (
            db.query(AppOrder)
            .filter(
                AppOrder.SlotId == consultation.ScheduleId,
                AppOrder.AccountId == consultation.PatientId,
                AppOrder.Status == "PAID",
            )
            .all()
        ):
            if int(order.Id) in seen_order_ids:
                continue
            paid_orders.append(order)
            seen_order_ids.add(int(order.Id))

    for order in paid_orders:
        if order_is_confirm_only(order):
            order.Status = "CANCELLED"
            order.UpdatedAt = datetime.utcnow()
        elif refund:
            _refund_paid_order(order, reason="用户取消预约退款")
        else:
            # 不退款：预约取消但款项不退；本地关单避免仍被当成未完成预约
            order.Status = "CANCELLED"
            order.UpdatedAt = datetime.utcnow()

    if consultation.ScheduleId:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == consultation.ScheduleId).first()
        if schedule and schedule.Status == "BOOKED":
            # 推送时新建的时段取消后不再回到咨询师排期；咨询师原排期仍释放为空闲。
            created_by_push = order_created_proxy_schedule(primary_order) or any(
                order_created_proxy_schedule(order) for order in paid_orders
            )
            schedule.Note = release_assigned_room(schedule.Note)
            schedule.Status = "CANCELLED" if created_by_push else "AVAILABLE"
            schedule.UpdatedAt = datetime.utcnow()

    if confirm_only:
        msg = "预约已取消"
    elif refund:
        msg = "预约已取消，款项将原路退回"
    else:
        msg = "预约已取消；距咨询不足24小时，不予退款"
    return refund, msg
