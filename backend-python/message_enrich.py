"""站内消息：返回给前端前按业务规则归一化展示字段（兼容历史脏数据）。"""
import json
import re
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from model_compat import optional_model_value
from models import AppLeaveRequest, AppMessage, AppRefundExemption

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
        title = "豁免申请待审核"
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
                "resultText": "您的退款豁免申请正在审核中，审核结果将在此通知。",
            }
        )
        payload["summary"] = (
            f"您的退款豁免申请已提交，金额 ¥{amount_yuan}，请等待审核"
        )
    elif status == "APPROVED":
        title = "豁免申请已通过"
        related_type = "REFUND_EXEMPTION"
        amount_yuan = f"{exemption.Amount / 100:.2f}"
        detail.update(
            {
                "status": "APPROVED",
                "approved": True,
                "amountYuan": amount_yuan,
                "exemptionId": exemption.Id,
                "consultationId": exemption.ConsultationId,
                "resultText": "您的退款豁免申请已审核通过，预约已取消。",
            }
        )
        payload["summary"] = f"退款 {amount_yuan} 元将原路退回"
    elif status == "REJECTED":
        title = "豁免申请未通过"
        related_type = "REFUND_EXEMPTION"
        reason = (optional_model_value(exemption, "RejectReason") or "").strip() or "未说明具体原因"
        detail.update(
            {
                "status": "REJECTED",
                "approved": False,
                "rejectReason": reason,
                "exemptionId": exemption.Id,
                "consultationId": exemption.ConsultationId,
                "resultText": "您的退款豁免申请未通过审核，预约与订单维持不变。",
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
            title = "豁免申请待审核"

    if related_type == "COUNSELOR_LEAVE":
        leave = _leave_request_for_message(msg, db)
        if leave:
            title, content = _sync_leave_payload(title, content, leave)

    content = _sync_patient_appointment_content(content, related_type)

    msg.Title = title
    msg.Content = content
    msg.RelatedType = related_type
    return msg
