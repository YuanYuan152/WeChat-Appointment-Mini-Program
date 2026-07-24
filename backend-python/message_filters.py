"""站内消息：分类筛选与关键词搜索。"""
from typing import Optional, Tuple

from sqlalchemy import false, or_
from sqlalchemy.orm import Query, Session

from models import AppMessage

ADMIN_OPS_INBOX_RELATED_TYPES: Tuple[str, ...] = (
    "APPOINTMENT_NEW",
    "APPOINTMENT_CANCEL",
    "REFUND_EXEMPTION",
    "REFUND_EXEMPTION_PENDING",
    "COUNSELOR_LEAVE",
    "CASE_RECORD_AMENDMENT",
    "CASE_RECORD_AMENDMENT_PENDING",
    "CASE_RECORD_CRISIS_REPORT",
    "CHARITY_CONSULTATION_30_BOOKING",
    "CHARITY_CONSULTATION_30_DONE",
    "PROFESSIONAL_PAIR_CONSULTATION_30_BOOKING",
    "PRICING_COUNSELOR_BASE_UPDATED",
    "PRICING_PATIENT_PRICE_UPDATED",
    "PRICING_PATIENT_SHARE_UPDATED",
    "STAFF_PROXY_ORDER_PUSHED",
)

ADMIN_OPS_INBOX_CATEGORIES: Tuple[str, ...] = (
    "appointment_new",
    "appointment_cancel",
    "exemption",
    "counselor_leave",
    "case_record_amendment",
    "case_record_crisis",
    "charity_milestone",
    "professional_pair_milestone",
    "pricing",
    "proxy_booking",
)

CATEGORY_RELATED_TYPES: dict[str, list[str]] = {
    "appointment_new": ["APPOINTMENT_NEW", "COUNSELOR_APPOINTMENT_NEW"],
    "appointment_cancel": ["APPOINTMENT_CANCEL", "COUNSELOR_APPOINTMENT_CANCEL", "PATIENT_APPOINTMENT_CANCEL"],
    "counselor_leave": ["COUNSELOR_LEAVE"],
    "leave_submitted": [
        "COUNSELOR_LEAVE_SUBMITTED",
        "COUNSELOR_LEAVE_SUCCESS",
        "COUNSELOR_LEAVE_REJECTED",
    ],
    "exemption": ["REFUND_EXEMPTION", "REFUND_EXEMPTION_PENDING"],
    "case_record_amendment": ["CASE_RECORD_AMENDMENT", "CASE_RECORD_AMENDMENT_PENDING", "CASE_RECORD_AMENDMENT_SUBMITTED"],
    "case_record_crisis": ["CASE_RECORD_CRISIS_REPORT"],
    "activity": ["PATIENT_NEW_ACTIVITY"],
    "appointment_success": ["PATIENT_APPOINTMENT_SUCCESS"],
    "appointment_remind": ["PATIENT_APPOINTMENT_REMIND", "COUNSELOR_CONSULTATION_REMIND"],
    "consultation_done": ["COUNSELOR_CONSULTATION_DONE"],
    "charity_milestone": ["CHARITY_CONSULTATION_30_BOOKING", "CHARITY_CONSULTATION_30_DONE"],
    "professional_pair_milestone": ["PROFESSIONAL_PAIR_CONSULTATION_30_BOOKING"],
    "pricing": [
        "PRICING_COUNSELOR_BASE_UPDATED",
        "PRICING_PATIENT_PRICE_UPDATED",
        "PRICING_PATIENT_SHARE_UPDATED",
    ],
    "proxy_booking": [
        "STAFF_PROXY_ORDER_PUSHED",
        "PATIENT_PROXY_ORDER_PENDING",
        "COUNSELOR_PROXY_ORDER_PENDING",
    ],
    "leave_notice": ["PATIENT_LEAVE_APPROVED"],
    "charity_negotiation": ["PATIENT_CHARITY_NEGOTIATION_TIP"],
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
    "charity_milestone": ["公益咨询第30次", "第三十次公益咨询", "30次公益咨询"],
    "professional_pair_milestone": ["正价咨询第30次", "第三十次预约", "调整抽成比例"],
    "pricing": ["改价成功", "调价成功", "基础价格", "抽成比例", "价格调整", "抽成已调整"],
    "proxy_booking": ["代理预约", "代理预约已推送", "待支付预约"],
    "charity_negotiation": ["公益咨询议价", "议价后方可再次预约"],
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
    """仅咨询主任/管理员使用受限收件箱；咨询助理可见全部投递给自己的消息。"""
    return active_role in ("Ops", "Admin")


def account_has_admin_ops_inbox(
    db: Session,
    account_id: int,
    active_role: Optional[str] = None,
) -> bool:
    from role_active import get_account_role

    role = active_role or get_account_role(db, account_id)
    return role in ("Ops", "Admin")


def apply_admin_ops_inbox_scope(
    q: Query,
    active_role: Optional[str],
    *,
    db: Optional[Session] = None,
    account_id: Optional[int] = None,
) -> Query:
    """管理员/Ops 我的消息展示管理工作台相关类型（含预约、豁免、请假、记录、风险、定价、代理预约等）。"""
    use_scope = is_admin_ops_inbox_role(active_role)
    if not use_scope and db is not None and account_id is not None:
        use_scope = account_has_admin_ops_inbox(db, account_id, active_role)
    if not use_scope:
        return q
    return q.filter(AppMessage.RelatedType.in_(ADMIN_OPS_INBOX_RELATED_TYPES))
