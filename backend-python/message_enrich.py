"""站内消息：返回给前端前按业务规则归一化展示字段（兼容历史脏数据）。"""
import json
import re
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models import AppMessage, AppRefundExemption

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
        reason = (exemption.RejectReason or "").strip() or "未说明具体原因"
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


def _sync_patient_appointment_content(
    content: Optional[str],
    related_type: Optional[str],
) -> Optional[str]:
    if related_type not in (
        "PATIENT_APPOINTMENT_SUCCESS",
        "PATIENT_APPOINTMENT_REMIND",
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

    content = _sync_patient_appointment_content(content, related_type)

    msg.Title = title
    msg.Content = content
    msg.RelatedType = related_type
    return msg
