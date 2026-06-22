"""站内消息：分类筛选与关键词搜索。"""
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Query

from models import AppMessage

CATEGORY_RELATED_TYPES: dict[str, list[str]] = {
    "appointment_new": ["APPOINTMENT_NEW"],
    "appointment_cancel": ["APPOINTMENT_CANCEL", "COUNSELOR_APPOINTMENT_CANCEL"],
    "counselor_leave": ["COUNSELOR_LEAVE"],
    "exemption": ["REFUND_EXEMPTION", "REFUND_EXEMPTION_PENDING"],
    "activity": ["PATIENT_NEW_ACTIVITY"],
    "appointment_success": ["PATIENT_APPOINTMENT_SUCCESS"],
    "appointment_remind": ["PATIENT_APPOINTMENT_REMIND", "COUNSELOR_CONSULTATION_REMIND"],
    "consultation_done": ["COUNSELOR_CONSULTATION_DONE"],
    "leave_notice": ["PATIENT_LEAVE_APPROVED"],
}

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "appointment_new": ["新增预约"],
    "appointment_cancel": ["预约已取消", "预约取消"],
    "counselor_leave": ["咨询师请假"],
    "exemption": ["豁免", "退款豁免", "待审核"],
    "activity": ["有新活动", "新活动"],
    "appointment_success": ["预约成功"],
    "appointment_remind": ["预约即将开始", "咨询即将开始"],
    "consultation_done": ["咨询已完成", "请尽快填写咨询记录"],
    "leave_notice": ["咨询师请假，预约已取消"],
}


def apply_message_category(q: Query, category: Optional[str]) -> Query:
    if not category or category in ("ALL", "UNREAD"):
        return q
    related_types = CATEGORY_RELATED_TYPES.get(category)
    if related_types:
        return q.filter(AppMessage.RelatedType.in_(related_types))
    if category == "consultation_remind":
        return q.filter(
            or_(
                AppMessage.RelatedType.in_(CATEGORY_RELATED_TYPES["appointment_remind"]),
                AppMessage.Type == "REMIND",
            )
        )
    return q


def apply_message_search(q: Query, keyword: Optional[str]) -> Query:
    text = (keyword or "").strip()
    if not text:
        return q
    pattern = f"%{text}%"
    clauses = [
        AppMessage.Title.like(pattern),
        AppMessage.Content.like(pattern),
        AppMessage.Type.like(pattern),
        AppMessage.RelatedType.like(pattern),
    ]
    lowered = text.lower()
    for labels in CATEGORY_KEYWORDS.values():
        for label in labels:
            if lowered in label.lower() or label.lower() in lowered:
                clauses.append(AppMessage.Title.like(f"%{label}%"))
    return q.filter(or_(*clauses))
