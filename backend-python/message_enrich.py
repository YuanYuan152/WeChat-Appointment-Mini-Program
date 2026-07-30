"""站内消息：返回给前端前按业务规则归一化展示字段（兼容历史脏数据）。"""
import json
import re
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app_time import china_now
from model_compat import optional_model_value
from models import (
    AppAccount,
    AppLeaveRequest,
    AppMessage,
    AppOrder,
    AppRefundExemption,
    AppSchedule,
)

_ROOM_SUFFIX = re.compile(r"\s*·\s*.+(?:咨询室|室\s*[A-Z]?)$")


def _center_only_location(location: Optional[str]) -> Optional[str]:
    if not location:
        return location
    if " · " in location:
        left, right = location.split(" · ", 1)
        if "咨询室" in right or re.search(r"室\s*[A-Z]?$", right):
            return left.strip()
    return location


def _parse_content(content: Optional[str]) -> Dict[str, Any]:
    if not content:
        return {}
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return {"summary": content}


def _dump_content(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _sync_exemption_payload(
    title: str,
    content: Optional[str],
    related_type: Optional[str],
    exemption: AppRefundExemption,
) -> tuple[str, str, Optional[str]]:
    status = exemption.Status or "PENDING"
    payload = _parse_content(content)
    detail = dict(payload.get("detail") or {})

    if status == "PENDING":
        title = "退款申请待审核"
        related_type = "REFUND_EXEMPTION_PENDING"
        amount_yuan = f"{exemption.Amount / 100:.2f}"
        detail.update(
            {
                "status": "PENDING",
                "approved": None,
                "amountYuan": amount_yuan,
                "reason": exemption.Reason,
                "exemptionId": exemption.Id,
                "consultationId": exemption.ConsultationId,
                "resultText": "您的退款申请正在审核中，审核结果将在此通知。",
            }
        )
        payload["summary"] = (
            f"您的退款申请已提交，金额 ¥{amount_yuan}，请等待审核"
        )
    elif status == "APPROVED":
        title = "退款申请已通过"
        related_type = "REFUND_EXEMPTION"
        amount_yuan = f"{exemption.Amount / 100:.2f}"
        detail.update(
            {
                "status": "APPROVED",
                "approved": True,
                "amountYuan": amount_yuan,
                "exemptionId": exemption.Id,
                "consultationId": exemption.ConsultationId,
                "resultText": "您的退款申请已审核通过，预约已取消。",
            }
        )
        payload["summary"] = f"退款 {amount_yuan} 元将原路退回"
    elif status == "REJECTED":
        title = "退款申请未通过"
        related_type = "REFUND_EXEMPTION"
        reason = (optional_model_value(exemption, "RejectReason") or "").strip() or "未说明具体原因"
        detail.update(
            {
                "status": "REJECTED",
                "approved": False,
                "rejectReason": reason,
                "exemptionId": exemption.Id,
                "consultationId": exemption.ConsultationId,
                "resultText": "您的退款申请未通过审核，预约与订单维持不变。",
            }
        )
        payload["summary"] = f"拒绝理由：{reason}"

    payload["detail"] = detail
    return title, _dump_content(payload), related_type


def _positive_int(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str):
        text = value.strip()
        if text.isdigit():
            parsed = int(text)
            return parsed if parsed > 0 else None
    return None


def _latest_leave_for_schedule(
    db: Session,
    schedule_id: int,
    counselor_id: Optional[int] = None,
) -> Optional[AppLeaveRequest]:
    query = db.query(AppLeaveRequest).filter(
        AppLeaveRequest.ScheduleId == schedule_id,
    )
    if counselor_id:
        query = query.filter(AppLeaveRequest.CounselorId == counselor_id)
    return (
        query.order_by(
            AppLeaveRequest.CreatedAt.desc(),
            AppLeaveRequest.Id.desc(),
        )
        .first()
    )


def _leave_request_for_message(
    msg: AppMessage,
    db: Session,
) -> Optional[AppLeaveRequest]:
    """Resolve both current leave messages and historical schedule-linked messages."""
    payload = _parse_content(msg.Content)
    raw_detail = payload.get("detail")
    detail = raw_detail if isinstance(raw_detail, dict) else {}

    leave_request_id = _positive_int(detail.get("leaveRequestId"))
    if leave_request_id:
        leave = (
            db.query(AppLeaveRequest)
            .filter(AppLeaveRequest.Id == leave_request_id)
            .first()
        )
        if leave:
            return leave

    counselor_id = _positive_int(detail.get("counselorId"))
    schedule_id = _positive_int(detail.get("scheduleId"))
    if schedule_id:
        leave = _latest_leave_for_schedule(db, schedule_id, counselor_id)
        if leave:
            return leave

    related_id = _positive_int(msg.RelatedId)
    if not related_id:
        return None

    leave_by_id = (
        db.query(AppLeaveRequest)
        .filter(AppLeaveRequest.Id == related_id)
        .first()
    )
    leave_by_schedule = _latest_leave_for_schedule(db, related_id, counselor_id)

    if leave_by_id and leave_by_schedule and leave_by_id.Id != leave_by_schedule.Id:
        leave_reason = detail.get("leaveReason")
        if isinstance(leave_reason, str) and leave_reason.strip():
            reason = leave_reason.strip()
            id_matches = (leave_by_id.Reason or "").strip() == reason
            schedule_matches = (leave_by_schedule.Reason or "").strip() == reason
            if id_matches != schedule_matches:
                return leave_by_id if id_matches else leave_by_schedule
    return leave_by_id or leave_by_schedule


def _iso_datetime(value: Any) -> Optional[str]:
    if value is None:
        return None
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        return isoformat()
    text = str(value).strip()
    return text or None


def _leave_summary(detail: Dict[str, Any], status_text: str) -> str:
    context = [
        detail.get("counselorName"),
        detail.get("startTime"),
        detail.get("location"),
    ]
    parts = [str(value).strip() for value in context if str(value or "").strip()]
    parts.append(status_text)
    return " · ".join(parts)


def _sync_leave_payload(
    title: str,
    content: Optional[str],
    leave: AppLeaveRequest,
) -> tuple[str, str]:
    status = (leave.Status or "PENDING").upper()
    if status not in ("PENDING", "APPROVED", "REJECTED"):
        status = "PENDING"

    payload = _parse_content(content)
    raw_detail = payload.get("detail")
    detail = dict(raw_detail) if isinstance(raw_detail, dict) else {}
    detail.update(
        {
            "status": status,
            "leaveRequestId": leave.Id,
            "scheduleId": leave.ScheduleId,
            "leaveReason": leave.Reason,
        }
    )

    reviewed_by = optional_model_value(leave, "ReviewedBy")
    reviewed_at = optional_model_value(leave, "ReviewedAt")
    if reviewed_by is not None:
        detail["reviewedBy"] = reviewed_by
    else:
        detail.pop("reviewedBy", None)
    reviewed_at_text = _iso_datetime(reviewed_at)
    if reviewed_at_text:
        detail["reviewedAt"] = reviewed_at_text
    else:
        detail.pop("reviewedAt", None)

    if status == "APPROVED":
        title = "咨询师请假已通过"
        detail.update(
            {
                "approved": True,
                "statusLabel": "已通过",
                "resultText": "请假申请已通过，相关预约已取消；已支付订单将按原支付路径退款。",
            }
        )
        detail.pop("rejectReason", None)
        status_text = "审核已通过"
    elif status == "REJECTED":
        title = "咨询师请假未通过"
        reason = (
            optional_model_value(leave, "RejectReason") or ""
        ).strip() or "未说明具体原因"
        detail.update(
            {
                "approved": False,
                "statusLabel": "已拒绝",
                "rejectReason": reason,
                "resultText": "请假申请未通过审核，关联排期和预约维持不变。",
            }
        )
        status_text = f"审核未通过：{reason}"
    else:
        title = "咨询师请假待审核"
        detail.update(
            {
                "approved": None,
                "statusLabel": "待审核",
                "resultText": "请假申请正在审核中，请等待处理。",
            }
        )
        detail.pop("rejectReason", None)
        status_text = "待审核"

    payload["summary"] = _leave_summary(detail, status_text)
    payload["detail"] = detail
    return title, _dump_content(payload)


def _sync_patient_appointment_content(
    content: Optional[str],
    related_type: Optional[str],
) -> Optional[str]:
    if related_type not in (
        "PATIENT_APPOINTMENT_SUCCESS",
        "PATIENT_APPOINTMENT_REMIND",
        "PATIENT_PROXY_ORDER_PENDING",
    ):
        return content

    payload = _parse_content(content)
    detail = dict(payload.get("detail") or {})
    center = detail.get("centerName") or _center_only_location(detail.get("location"))
    if not center:
        summary = payload.get("summary") or ""
        if isinstance(summary, str) and " · " in summary:
            parts = summary.split(" · ")
            if len(parts) >= 3:
                center = _center_only_location(parts[-1])
        if not center:
            return content

    detail["centerName"] = center
    detail["location"] = center
    detail.pop("roomName", None)
    payload["detail"] = detail

    summary = payload.get("summary")
    if isinstance(summary, str) and " · " in summary:
        parts = summary.split(" · ")
        if len(parts) >= 3:
            parts[-1] = center
            payload["summary"] = " · ".join(parts)
        elif _ROOM_SUFFIX.search(summary):
            payload["summary"] = _ROOM_SUFFIX.sub("", summary)

    return _dump_content(payload)


def _message_datetime(value: Any) -> Optional[str]:
    if value is None:
        return None
    formatter = getattr(value, "strftime", None)
    if callable(formatter):
        return formatter("%Y-%m-%d %H:%M")
    text = str(value).strip()
    return text or None


def _sync_counselor_proxy_order_payload(
    title: str,
    content: Optional[str],
    order: AppOrder,
    db: Session,
) -> tuple[str, str]:
    """代理预约通知使用订单和当前绑定关系，而不是创建时的状态快照。"""
    payload = _parse_content(content)
    raw_detail = payload.get("detail")
    detail = dict(raw_detail) if isinstance(raw_detail, dict) else {}
    schedule = (
        db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
        if order.SlotId
        else None
    )
    patient = (
        db.query(AppAccount).filter(AppAccount.Id == order.AccountId).first()
        if order.AccountId
        else None
    )

    from patient_contract_service import patient_contract_extras

    contract = patient_contract_extras(db, patient)
    patient_name = (
        (patient.RealName or patient.Nickname or patient.Mobile or "来访者").strip()
        if patient
        else str(detail.get("patientName") or "来访者").strip()
    )
    patient_tag = contract.get("contractTag")

    status = (order.Status or "PENDING").upper()
    if status == "PENDING" and order.ExpiresAt and order.ExpiresAt < china_now():
        status = "EXPIRED"
    if status == "CANCELED":
        status = "CANCELLED"

    display = {
        "PENDING": (
            "代理预约待支付",
            "待支付",
            "助理已为来访推送预约订单，待来访支付后生效",
        ),
        "PAID": ("代理预约已支付", "已支付", "来访已完成支付，预约已生效"),
        "CANCELLED": ("代理预约已取消", "已取消", "该代理预约订单已取消"),
        "REFUNDED": ("代理预约已退款", "已退款", "该代理预约订单已退款"),
        "EXPIRED": ("代理预约已过期", "已过期", "该代理预约订单已过期"),
    }
    title, status_label, result_text = display.get(
        status,
        (title, status, f"订单当前状态：{status}"),
    )

    start_time = _message_datetime(schedule.StartTime) if schedule else detail.get("startTime")
    end_time = _message_datetime(schedule.EndTime) if schedule else detail.get("endTime")
    detail.update(
        {
            "patientName": patient_name,
            "patientContractTag": patient_tag,
            "startTime": start_time,
            "endTime": end_time,
            "orderId": order.Id,
            "scheduleId": order.SlotId,
            "status": status,
            "statusLabel": status_label,
            "resultText": result_text,
            "tip": result_text,
            "expiresAt": _iso_datetime(order.ExpiresAt),
        }
    )
    patient_label = f"{patient_name} {patient_tag}" if patient_tag else patient_name
    summary_parts = [
        patient_label,
        start_time,
        detail.get("location"),
        status_label,
    ]
    payload["summary"] = " · ".join(
        str(value).strip() for value in summary_parts if str(value or "").strip()
    )
    payload["detail"] = detail
    return title, _dump_content(payload)


def enrich_message(msg: AppMessage, db: Session) -> AppMessage:
    """内存中归一化消息展示字段，不写回数据库。"""
    title = msg.Title
    content = msg.Content
    related_type = msg.RelatedType

    if related_type in ("REFUND_EXEMPTION", "REFUND_EXEMPTION_PENDING") and msg.RelatedId:
        exemption = (
            db.query(AppRefundExemption)
            .filter(AppRefundExemption.Id == msg.RelatedId)
            .first()
        )
        if exemption:
            title, content, related_type = _sync_exemption_payload(
                title, content, related_type, exemption,
            )
        elif related_type == "REFUND_EXEMPTION_PENDING":
            title = "退款申请待审核"

    if related_type == "COUNSELOR_LEAVE":
        leave = _leave_request_for_message(msg, db)
        if leave:
            title, content = _sync_leave_payload(title, content, leave)

    if related_type == "COUNSELOR_PROXY_ORDER_PENDING" and msg.RelatedId:
        order = db.query(AppOrder).filter(AppOrder.Id == msg.RelatedId).first()
        if order:
            title, content = _sync_counselor_proxy_order_payload(
                title, content, order, db,
            )

    content = _sync_patient_appointment_content(content, related_type)

    msg.Title = title
    msg.Content = content
    msg.RelatedType = related_type
    return msg
