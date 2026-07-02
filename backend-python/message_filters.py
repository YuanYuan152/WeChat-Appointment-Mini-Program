"""站内消息：分类筛选与关键词搜索。"""
from typing import Optional, Tuple

from sqlalchemy import false, or_
from sqlalchemy.orm import Query, Session

from models import AppMessage
from staff_roles import STAFF_WORKBENCH_ROLES, account_has_staff_workbench

ADMIN_OPS_INBOX_RELATED_TYPES: Tuple[str, ...] = (
    "REFUND_EXEMPTION",
    "REFUND_EXEMPTION_PENDING",
    "COUNSELOR_LEAVE",
    "CASE_RECORD_AMENDMENT",
    "CASE_RECORD_AMENDMENT_PENDING",
    "CASE_RECORD_CRISIS_REPORT",
)

ADMIN_OPS_INBOX_CATEGORIES: Tuple[str, ...] = (
    "exemption",
    "counselor_leave",
    "case_record_amendment",
    "case_record_crisis",
)

CATEGORY_RELATED_TYPES: dict[str, list[str]] = {
    "appointment_new": ["APPOINTMENT_NEW", "COUNSELOR_APPOINTMENT_NEW"],
    "appointment_cancel": ["APPOINTMENT_CANCEL", "COUNSELOR_APPOINTMENT_CANCEL", "PATIENT_APPOINTMENT_CANCEL"],
    "counselor_leave": ["COUNSELOR_LEAVE"],
    "leave_submitted": ["COUNSELOR_LEAVE_SUBMITTED", "COUNSELOR_LEAVE_SUCCESS"],
    "exemption": ["REFUND_EXEMPTION", "REFUND_EXEMPTION_PENDING"],
    "case_record_amendment": ["CASE_RECORD_AMENDMENT", "CASE_RECORD_AMENDMENT_PENDING"],
    "case_record_crisis": ["CASE_RECORD_CRISIS_REPORT"],
    "activity": ["PATIENT_NEW_ACTIVITY"],
    "appointment_success": ["PATIENT_APPOINTMENT_SUCCESS"],
    "appointment_remind": ["PATIENT_APPOINTMENT_REMIND", "COUNSELOR_CONSULTATION_REMIND"],
    "consultation_done": ["COUNSELOR_CONSULTATION_DONE"],
    "leave_notice": ["PATIENT_LEAVE_APPROVED"],
}

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "appointment_new": ["新增预约", "新预约"],
    "appointment_cancel": ["预约已取消", "预约取消"],
    "counselor_leave": ["咨询师请假"],
    "leave_submitted": ["请假申请已提交", "请假已成功", "请假已提交"],
    "exemption": ["豁免", "退款豁免", "待审核"],
    "case_record_amendment": ["咨询记录修改", "记录修改", "待审核"],
    "case_record_crisis": ["个案风险需上报", "风险需上报", "需上报"],
    "activity": ["有新活动", "新活动"],
    "appointment_success": ["预约成功"],
    "appointment_remind": ["咨询即将开始", "30分钟后"],
    "consultation_done": ["咨询已完成", "请尽快填写咨询记录"],
    "leave_notice": ["咨询师请假，预约已取消"],
}


def apply_message_category(
    q: Query,
    category: Optional[str],
    active_role: Optional[str] = None,
    *,
    db: Optional[Session] = None,
    account_id: Optional[int] = None,
) -> Query:
    if not category or category in ("ALL", "UNREAD"):
        return q
    has_admin_ops = is_admin_ops_inbox_role(active_role)
    if not has_admin_ops and db is not None and account_id is not None:
        has_admin_ops = account_has_admin_ops_inbox(db, account_id, active_role)
    if has_admin_ops and category not in ADMIN_OPS_INBOX_CATEGORIES:
        return q.filter(false())
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


def is_admin_ops_inbox_role(active_role: Optional[str]) -> bool:
    return active_role in STAFF_WORKBENCH_ROLES


def account_has_admin_ops_inbox(
    db: Session,
    account_id: int,
    active_role: Optional[str] = None,
) -> bool:
    return account_has_staff_workbench(db, account_id, active_role)


def apply_admin_ops_inbox_scope(
    q: Query,
    active_role: Optional[str],
    *,
    db: Optional[Session] = None,
    account_id: Optional[int] = None,
) -> Query:
    """管理员/Ops 我的消息仅展示：豁免、请假、记录修改、风险上报。"""
    use_scope = is_admin_ops_inbox_role(active_role)
    if not use_scope and db is not None and account_id is not None:
        use_scope = account_has_admin_ops_inbox(db, account_id, active_role)
    if not use_scope:
        return q
    return q.filter(AppMessage.RelatedType.in_(ADMIN_OPS_INBOX_RELATED_TYPES))
