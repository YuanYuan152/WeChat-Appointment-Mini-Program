"""Web 管理端聚合接口。

这些接口只读取现有 App* 表，不创建或修改数据库表。它们用于 Web 管理端
把小程序后台里分散的业务数据整理成更适合桌面端查看的列表和看板。
"""

from datetime import datetime, time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_account
from database import get_db
from model_compat import optional_model_value
from models import (
    AppAccount,
    AppActivity,
    AppArticle,
    AppBanner,
    AppCaseRecord,
    AppConsultation,
    AppLeaveRequest,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
    AppRoleSwitchLog,
    AppSchedule,
    AppScheduleCancelLog,
)
from schedule_meta import center_display_name, parse_center_id, parse_room_id, room_display_name

router = APIRouter(prefix="/api/web/admin", tags=["WebAdmin"])


def require_ops_or_admin(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType.in_(["Ops", "Admin"]),
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无 Web 管理端权限")
    return current_account


def _dt(value: Optional[datetime]) -> Optional[datetime]:
    return value if value else None


def _day_start(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.combine(datetime.fromisoformat(value).date(), time.min)
    except ValueError:
        raise HTTPException(status_code=400, detail="start_at 格式应为 YYYY-MM-DD")


def _day_end(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.combine(datetime.fromisoformat(value).date(), time.max)
    except ValueError:
        raise HTTPException(status_code=400, detail="end_at 格式应为 YYYY-MM-DD")


def _account_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "-"
    return account.RealName or account.Nickname or account.Mobile or f"用户#{account.Id}"


def _account_contact(account: Optional[AppAccount]) -> Optional[str]:
    if not account:
        return None
    return account.Mobile or account.OpenId


def _roles_for_accounts(db: Session, account_ids: set[int]) -> dict[int, list[str]]:
    if not account_ids:
        return {}
    result: dict[int, list[str]] = {}
    rows = db.query(AppRoleBinding).filter(AppRoleBinding.AccountId.in_(account_ids)).all()
    for row in rows:
        result.setdefault(row.AccountId, []).append(row.RoleType)
    return result


def _accounts_by_id(db: Session, account_ids: set[int]) -> dict[int, AppAccount]:
    if not account_ids:
        return {}
    return {a.Id: a for a in db.query(AppAccount).filter(AppAccount.Id.in_(account_ids)).all()}


def _counselor_name(accounts: dict[int, AppAccount], counselor_id: Optional[int]) -> str:
    if not counselor_id:
        return "-"
    return _account_name(accounts.get(counselor_id))


def _consultation_subject(
    consultation: AppConsultation,
    accounts: dict[int, AppAccount],
) -> str:
    patient = _account_name(accounts.get(consultation.PatientId))
    counselor = _counselor_name(accounts, consultation.CounselorId)
    return f"{patient} / {counselor}"


def _room_payload_from_note(note: Optional[str]) -> dict[str, Any]:
    if not note:
        return {"centerId": None, "centerName": None, "roomId": None, "roomName": None}
    center_id = parse_center_id(note)
    room_id = parse_room_id(note)
    return {
        "centerId": center_id,
        "centerName": center_display_name(center_id),
        "roomId": room_id,
        "roomName": room_display_name(center_id, room_id, None),
    }


def _room_payload(schedule: Optional[AppSchedule]) -> dict[str, Any]:
    return _room_payload_from_note(schedule.Note if schedule else None)


def _consultation_room_payload(
    consultation: AppConsultation,
    schedules: dict[int, AppSchedule],
) -> dict[str, Any]:
    payload = _room_payload(schedules.get(consultation.ScheduleId))
    if not payload.get("roomId") and consultation.Note:
        payload = _room_payload_from_note(consultation.Note)
    return payload


def _paginate(items: list[dict[str, Any]], page: int, page_size: int) -> dict[str, Any]:
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "items": items[start:end],
    }


def _within_range(value: Optional[datetime], start_at: Optional[datetime], end_at: Optional[datetime]) -> bool:
    if not value:
        return False
    if start_at and value < start_at:
        return False
    if end_at and value > end_at:
        return False
    return True


def _schedule_action_label(schedule: AppSchedule) -> str:
    status = (schedule.Status or "").upper()
    if status in ("CANCELLED", "CANCELED"):
        return "取消排期"
    if status == "BOOKED":
        return "排期已预约"
    if schedule.UpdatedAt and schedule.UpdatedAt != schedule.CreatedAt:
        return "更新排期"
    return "新建排期"


@router.get("/operation-records", summary="Web 操作/业务记录聚合列表（不依赖新增审计表）")
def operation_records(
    role: Optional[str] = Query(None, description="角色筛选：Admin/Ops/Counselor/Patient 等"),
    operator_id: Optional[int] = Query(None),
    action_type: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    start_at: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_at: Optional[str] = Query(None, description="YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    start_dt = _day_start(start_at)
    end_dt = _day_end(end_at)

    records: list[dict[str, Any]] = []
    account_ids: set[int] = set()
    all_consultations = db.query(AppConsultation).all()
    consultations_by_id = {c.Id: c for c in all_consultations}
    all_schedules = db.query(AppSchedule).all()
    schedules_by_id = {s.Id: s for s in all_schedules}

    for row in db.query(AppRoleSwitchLog).all():
        account_ids.add(row.AccountId)
        records.append({
            "id": f"role-switch-{row.Id}",
            "occurredAt": row.SwitchedAt,
            "actionType": "ROLE_SWITCH",
            "actionLabel": "角色切换",
            "operatorId": row.AccountId,
            "operatorRole": row.ToRole,
            "targetType": "Account",
            "targetId": row.AccountId,
            "targetName": None,
            "summary": f"{row.FromRole or '-'} → {row.ToRole}",
            "amount": None,
            "status": "DONE",
        })

    exemptions = db.query(AppRefundExemption).all()
    for row in exemptions:
        consultation = consultations_by_id.get(row.ConsultationId)
        if consultation:
            account_ids.update({consultation.PatientId, consultation.CounselorId})
        account_ids.add(row.AccountId)
        if row.ReviewedBy:
            account_ids.add(row.ReviewedBy)
        records.append({
            "id": f"refund-exemption-{row.Id}",
            "occurredAt": row.ReviewedAt or row.CreatedAt,
            "actionType": "REFUND_EXEMPTION",
            "actionLabel": "豁免审核",
            "operatorId": row.ReviewedBy or row.AccountId,
            "operatorRole": "Admin/Ops" if row.ReviewedBy else "Patient",
            "targetType": "RefundExemption",
            "targetId": row.Id,
            "targetName": None,
            "summary": row.Reason,
            "amount": row.Amount,
            "status": row.Status,
            "relatedConsultationId": row.ConsultationId,
            "patientId": consultation.PatientId if consultation else row.AccountId,
            "counselorId": consultation.CounselorId if consultation else None,
            "scheduleId": consultation.ScheduleId if consultation else None,
            "startTime": consultation.StartTime if consultation else None,
            "endTime": consultation.EndTime if consultation else None,
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
            **(_consultation_room_payload(consultation, schedules_by_id) if consultation else {}),
        })

    for row in db.query(AppOrder).all():
        account_ids.add(row.AccountId)
        records.append({
            "id": f"order-{row.Id}",
            "occurredAt": row.PaidAt or row.UpdatedAt or row.CreatedAt,
            "actionType": "ORDER",
            "actionLabel": "退款订单" if row.Status == "REFUNDED" else "取消订单" if row.Status == "CANCELLED" else "支付订单",
            "operatorId": row.AccountId,
            "operatorRole": "Patient",
            "targetType": "Order",
            "targetId": row.Id,
            "targetName": row.Description,
            "summary": row.OutTradeNo,
            "amount": row.TotalFee,
            "status": row.Status,
            "relatedOrderId": row.Id,
            "patientId": row.AccountId,
            "scheduleId": row.SlotId,
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
        })

    for row in all_consultations:
        account_ids.update({row.PatientId, row.CounselorId})
        room_payload = _consultation_room_payload(row, schedules_by_id)
        is_cancelled = row.Status in ("CANCELLED", "CANCELED")
        summary_parts = [
            row.Note,
            f"咨询时间：{row.StartTime.strftime('%Y-%m-%d %H:%M')}" if row.StartTime else None,
            f"地点：{room_payload.get('centerName') or '-'} {room_payload.get('roomName') or ''}".strip(),
        ]
        records.append({
            "id": f"consultation-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "CONSULTATION",
            "actionLabel": "取消预约" if is_cancelled else "预约记录",
            "operatorId": row.PatientId,
            "operatorRole": "Patient",
            "targetType": "Consultation",
            "targetId": row.Id,
            "targetName": None,
            "summary": "；".join(part for part in summary_parts if part),
            "amount": None,
            "status": row.Status,
            "relatedOrderId": row.OrderId,
            "relatedConsultationId": row.Id,
            "patientId": row.PatientId,
            "counselorId": row.CounselorId,
            "scheduleId": row.ScheduleId,
            "startTime": row.StartTime,
            "endTime": row.EndTime,
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
            **room_payload,
        })

    for row in all_schedules:
        account_ids.add(row.CounselorId)
        records.append({
            "id": f"schedule-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "SCHEDULE",
            "actionLabel": _schedule_action_label(row),
            "operatorId": row.CounselorId,
            "operatorRole": "Counselor",
            "targetType": "Schedule",
            "targetId": row.Id,
            "targetName": None,
            "summary": row.Note,
            "amount": None,
            "status": row.Status,
            "counselorId": row.CounselorId,
            "scheduleId": row.Id,
            "startTime": row.StartTime,
            "endTime": row.EndTime,
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
            **_room_payload(row),
        })

    for row in db.query(AppCaseRecord).all():
        account_ids.add(row.CounselorId)
        consultation = consultations_by_id.get(row.ConsultationId)
        if consultation:
            account_ids.update({consultation.PatientId, consultation.CounselorId})
        records.append({
            "id": f"case-record-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "CASE_RECORD",
            "actionLabel": "咨询记录",
            "operatorId": row.CounselorId,
            "operatorRole": "Counselor",
            "targetType": "CaseRecord",
            "targetId": row.Id,
            "targetName": None,
            "summary": (row.Subjective or row.Assessment or row.Plan or "")[:120],
            "amount": None,
            "status": "UPDATED" if row.UpdatedAt else "CREATED",
            "relatedConsultationId": row.ConsultationId,
            "counselorId": row.CounselorId,
            "patientId": consultation.PatientId if consultation else None,
            "scheduleId": consultation.ScheduleId if consultation else None,
            "startTime": consultation.StartTime if consultation else None,
            "endTime": consultation.EndTime if consultation else None,
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
            **(_consultation_room_payload(consultation, schedules_by_id) if consultation else {}),
        })

    for row in db.query(AppLeaveRequest).all():
        account_ids.add(row.CounselorId)
        schedule = schedules_by_id.get(row.ScheduleId)
        records.append({
            "id": f"leave-request-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "LEAVE_REQUEST",
            "actionLabel": "咨询师请假",
            "operatorId": row.CounselorId,
            "operatorRole": "Counselor",
            "targetType": "LeaveRequest",
            "targetId": row.Id,
            "targetName": None,
            "summary": row.Reason,
            "amount": None,
            "status": row.Status,
            "counselorId": row.CounselorId,
            "scheduleId": row.ScheduleId,
            "startTime": schedule.StartTime if schedule else None,
            "endTime": schedule.EndTime if schedule else None,
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
            **(_room_payload(schedule) if schedule else {}),
        })

    for row in db.query(AppScheduleCancelLog).all():
        account_ids.add(row.CounselorId)
        consultation = consultations_by_id.get(row.ConsultationId) if row.ConsultationId else None
        schedule = schedules_by_id.get(row.ScheduleId)
        if consultation:
            account_ids.add(consultation.PatientId)
        records.append({
            "id": f"schedule-cancel-{row.Id}",
            "occurredAt": row.CreatedAt,
            "actionType": "SCHEDULE_CANCEL",
            "actionLabel": "咨询师取消",
            "operatorId": row.CounselorId,
            "operatorRole": "Counselor",
            "targetType": "Schedule",
            "targetId": row.ScheduleId,
            "targetName": None,
            "summary": row.ScreenshotUrl,
            "amount": None,
            "status": "CANCELLED",
            "relatedConsultationId": row.ConsultationId,
            "counselorId": row.CounselorId,
            "patientId": consultation.PatientId if consultation else None,
            "scheduleId": row.ScheduleId,
            "startTime": consultation.StartTime if consultation else (schedule.StartTime if schedule else None),
            "endTime": consultation.EndTime if consultation else (schedule.EndTime if schedule else None),
            "createdAt": row.CreatedAt,
            **(_consultation_room_payload(consultation, schedules_by_id) if consultation else _room_payload(schedule)),
        })

    for row in db.query(AppBanner).all():
        records.append({
            "id": f"banner-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "CONTENT",
            "actionLabel": "Banner 内容",
            "operatorId": None,
            "operatorRole": "Ops",
            "targetType": "Banner",
            "targetId": row.Id,
            "targetName": row.Title,
            "summary": row.LinkValue,
            "amount": None,
            "status": "ACTIVE" if row.IsActive else "INACTIVE",
        })

    for row in db.query(AppActivity).all():
        records.append({
            "id": f"activity-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "CONTENT",
            "actionLabel": "活动/公告",
            "operatorId": None,
            "operatorRole": "Ops",
            "targetType": "Activity",
            "targetId": row.Id,
            "targetName": row.Title,
            "summary": row.Content,
            "amount": None,
            "status": "ACTIVE" if row.IsActive else "INACTIVE",
        })

    for row in db.query(AppArticle).all():
        records.append({
            "id": f"article-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "CONTENT",
            "actionLabel": "文章内容",
            "operatorId": None,
            "operatorRole": "Ops",
            "targetType": "Article",
            "targetId": row.Id,
            "targetName": row.Title,
            "summary": row.Summary,
            "amount": None,
            "status": "ACTIVE" if row.IsActive else "INACTIVE",
        })

    accounts = _accounts_by_id(db, account_ids)
    roles_by_account = _roles_for_accounts(db, account_ids)
    keyword_norm = keyword.strip().lower() if keyword else None
    action_norm = action_type.strip().upper() if action_type else None
    role_norm = role.strip() if role else None

    filtered: list[dict[str, Any]] = []
    for item in records:
        occurred_at = item.get("occurredAt")
        if not _within_range(occurred_at, start_dt, end_dt):
            continue
        if action_norm and item.get("actionType") != action_norm:
            continue
        if operator_id and item.get("operatorId") != operator_id:
            continue
        item_roles = roles_by_account.get(item.get("operatorId"), [])
        if role_norm and role_norm not in item_roles and item.get("operatorRole") != role_norm:
            continue
        operator = accounts.get(item.get("operatorId"))
        item["operatorName"] = _account_name(operator) if operator else "-"
        item["operatorContact"] = _account_contact(operator)
        item["operatorRoles"] = item_roles
        patient = accounts.get(item.get("patientId"))
        counselor = accounts.get(item.get("counselorId"))
        if patient:
            item["patientName"] = _account_name(patient)
            item["patientContact"] = _account_contact(patient)
        if counselor:
            item["counselorName"] = _counselor_name(accounts, item["counselorId"])
            item["counselorContact"] = _account_contact(counselor)
        if not item.get("targetName"):
            if patient and counselor:
                item["targetName"] = f"{_account_name(patient)} / {_account_name(counselor)}"
            elif patient:
                item["targetName"] = _account_name(patient)
        if item.get("counselorId"):
            item["counselorName"] = _counselor_name(accounts, item["counselorId"])
        text = " ".join(
            str(part or "")
            for part in [
                item.get("operatorName"),
                item.get("targetName"),
                item.get("summary"),
                item.get("status"),
                item.get("actionLabel"),
                item.get("operatorContact"),
                item.get("patientName"),
                item.get("patientContact"),
                item.get("counselorName"),
                item.get("counselorContact"),
                item.get("centerName"),
                item.get("roomName"),
                item.get("relatedOrderId"),
                item.get("relatedConsultationId"),
                item.get("scheduleId"),
            ]
        ).lower()
        if keyword_norm and keyword_norm not in text:
            continue
        filtered.append(item)

    filtered.sort(key=lambda x: x.get("occurredAt") or datetime.min, reverse=True)
    return _paginate(filtered, page, page_size)


def _user_summary(db: Session, account: AppAccount, roles: list[str]) -> dict[str, Any]:
    orders = db.query(AppOrder).filter(AppOrder.AccountId == account.Id).all()
    consultations = db.query(AppConsultation).filter(AppConsultation.PatientId == account.Id).all()
    exemptions = db.query(AppRefundExemption).filter(AppRefundExemption.AccountId == account.Id).all()
    paid_orders = [o for o in orders if o.Status == "PAID"]
    refunded_orders = [o for o in orders if o.Status == "REFUNDED"]
    return {
        "id": account.Id,
        "name": _account_name(account),
        "mobile": account.Mobile,
        "gender": account.Gender,
        "roles": roles,
        "activeRole": account.ActiveRole,
        "orderCount": len(orders),
        "paidOrderCount": len(paid_orders),
        "paidAmount": sum(o.TotalFee or 0 for o in paid_orders),
        "refundCount": len(refunded_orders),
        "refundAmount": sum(o.TotalFee or 0 for o in refunded_orders),
        "exemptionCount": len(exemptions),
        "pendingExemptionCount": len([e for e in exemptions if e.Status == "PENDING"]),
        "consultationCount": len(consultations),
        "completedConsultationCount": len([c for c in consultations if c.Status == "DONE"]),
        "cancelledConsultationCount": len([c for c in consultations if c.Status in ("CANCELLED", "CANCELED")]),
        "latestConsultationAt": max([c.StartTime for c in consultations if c.StartTime] or [None]),
        "createdAt": account.CreatedAt,
    }


@router.get("/users/board", summary="用户看板列表")
def user_board_list(
    keyword: Optional[str] = Query(None, description="姓名/昵称/手机号"),
    gender: Optional[str] = Query(None),
    mobile: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AppAccount)
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            or_(
                AppAccount.Nickname.like(like),
                AppAccount.RealName.like(like),
                AppAccount.Mobile.like(like),
            )
        )
    if gender:
        query = query.filter(AppAccount.Gender == gender)
    if mobile:
        query = query.filter(AppAccount.Mobile.like(f"%{mobile}%"))

    accounts = query.order_by(AppAccount.Id.desc()).limit(300).all()
    roles_by_account = _roles_for_accounts(db, {a.Id for a in accounts})
    items = [_user_summary(db, account, roles_by_account.get(account.Id, [])) for account in accounts]
    return _paginate(items, page, page_size)


@router.get("/users/{account_id}/board", summary="用户看板详情")
def user_board_detail(
    account_id: int,
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="用户不存在")

    roles = _roles_for_accounts(db, {account_id}).get(account_id, [])
    orders = db.query(AppOrder).filter(AppOrder.AccountId == account_id).order_by(AppOrder.CreatedAt.desc()).all()
    consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.PatientId == account_id)
        .order_by(AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
        .all()
    )
    schedule_ids = {c.ScheduleId for c in consultations if c.ScheduleId}
    schedules = {
        s.Id: s for s in db.query(AppSchedule).filter(AppSchedule.Id.in_(schedule_ids)).all()
    } if schedule_ids else {}
    counselor_ids = {c.CounselorId for c in consultations}
    counselors = _accounts_by_id(db, counselor_ids)
    exemptions = (
        db.query(AppRefundExemption)
        .filter(AppRefundExemption.AccountId == account_id)
        .order_by(AppRefundExemption.CreatedAt.desc())
        .all()
    )

    return {
        "profile": _user_summary(db, account, roles),
        "orders": [
            {
                "id": o.Id,
                "outTradeNo": o.OutTradeNo,
                "transactionId": o.TransactionId,
                "totalFee": o.TotalFee,
                "status": o.Status,
                "description": o.Description,
                "createdAt": o.CreatedAt,
                "paidAt": o.PaidAt,
                "updatedAt": o.UpdatedAt,
            }
            for o in orders
        ],
        "payments": [
            {"id": o.Id, "amount": o.TotalFee, "paidAt": o.PaidAt, "status": o.Status}
            for o in orders if o.PaidAt or o.Status == "PAID"
        ],
        "refunds": [
            {"id": o.Id, "amount": o.TotalFee, "updatedAt": o.UpdatedAt, "status": o.Status}
            for o in orders if o.Status == "REFUNDED"
        ],
        "exemptions": [
            {
                "id": e.Id,
                "consultationId": e.ConsultationId,
                "amount": e.Amount,
                "reason": e.Reason,
                "status": e.Status,
                "rejectReason": optional_model_value(e, "RejectReason"),
                "reviewedAt": e.ReviewedAt,
                "createdAt": e.CreatedAt,
            }
            for e in exemptions
        ],
        "consultations": [
            {
                "id": c.Id,
                "orderId": c.OrderId,
                "counselorId": c.CounselorId,
                "counselorName": _counselor_name(counselors, c.CounselorId),
                "status": c.Status,
                "startTime": c.StartTime,
                "endTime": c.EndTime,
                "note": c.Note,
                **_consultation_room_payload(c, schedules),
            }
            for c in consultations
        ],
        "roomBookings": [
            {
                "consultationId": c.Id,
                "startTime": c.StartTime,
                "endTime": c.EndTime,
                **_consultation_room_payload(c, schedules),
            }
            for c in consultations if c.ScheduleId
        ],
    }


def _counselor_summary(db: Session, account: AppAccount) -> dict[str, Any]:
    consultations = db.query(AppConsultation).filter(AppConsultation.CounselorId == account.Id).all()
    records = db.query(AppCaseRecord).filter(AppCaseRecord.CounselorId == account.Id).all()
    schedules = db.query(AppSchedule).filter(AppSchedule.CounselorId == account.Id).all()
    leave_requests = db.query(AppLeaveRequest).filter(AppLeaveRequest.CounselorId == account.Id).all()
    completed = [c for c in consultations if c.Status == "DONE"]
    cancelled = [c for c in consultations if c.Status in ("CANCELLED", "CANCELED")]
    recorded_consultation_ids = {r.ConsultationId for r in records}
    return {
        "id": account.Id,
        "name": _account_name(account),
        "mobile": account.Mobile,
        "activeRole": account.ActiveRole,
        "consultationCount": len(consultations),
        "completedConsultationCount": len(completed),
        "cancelledConsultationCount": len(cancelled),
        "caseRecordCount": len(records),
        "missingRecordCount": len([c for c in completed if c.Id not in recorded_consultation_ids]),
        "scheduleCount": len(schedules),
        "bookedScheduleCount": len([s for s in schedules if s.Status == "BOOKED"]),
        "leaveRequestCount": len(leave_requests),
        "latestScheduleAt": max([s.StartTime for s in schedules if s.StartTime] or [None]),
    }


@router.get("/counselors/board", summary="咨询师看板列表")
def counselor_board_list(
    keyword: Optional[str] = Query(None, description="姓名/昵称/手机号"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    bindings = db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Counselor").all()
    counselor_ids = sorted({b.AccountId for b in bindings})
    accounts = _accounts_by_id(db, set(counselor_ids))
    items = [_counselor_summary(db, accounts[cid]) for cid in counselor_ids if cid in accounts]
    if keyword:
        keyword_norm = keyword.lower()
        items = [
            item for item in items
            if keyword_norm in " ".join(str(v or "") for v in [item["name"], item["mobile"]]).lower()
        ]
    items.sort(key=lambda item: (-item["consultationCount"], item["name"]))
    return _paginate(items, page, page_size)


@router.get("/counselors/{account_id}/board", summary="咨询师看板详情")
def counselor_board_detail(
    account_id: int,
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == account_id,
        AppRoleBinding.RoleType == "Counselor",
    ).first()
    if not binding:
        raise HTTPException(status_code=404, detail="咨询师不存在")
    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="咨询师账号不存在")

    consultations = (
        db.query(AppConsultation)
        .filter(AppConsultation.CounselorId == account_id)
        .order_by(AppConsultation.StartTime.desc(), AppConsultation.Id.desc())
        .all()
    )
    patient_ids = {c.PatientId for c in consultations}
    patients = _accounts_by_id(db, patient_ids)
    records = db.query(AppCaseRecord).filter(AppCaseRecord.CounselorId == account_id).all()
    records_by_consultation = {r.ConsultationId: r for r in records}
    schedules = (
        db.query(AppSchedule)
        .filter(AppSchedule.CounselorId == account_id)
        .order_by(AppSchedule.StartTime.desc(), AppSchedule.Id.desc())
        .all()
    )
    leave_requests = (
        db.query(AppLeaveRequest)
        .filter(AppLeaveRequest.CounselorId == account_id)
        .order_by(AppLeaveRequest.CreatedAt.desc())
        .all()
    )
    cancel_logs = (
        db.query(AppScheduleCancelLog)
        .filter(AppScheduleCancelLog.CounselorId == account_id)
        .order_by(AppScheduleCancelLog.CreatedAt.desc())
        .all()
    )
    schedule_map = {s.Id: s for s in schedules}
    consultations_by_id = {c.Id: c for c in consultations}
    consultations_by_schedule_id = {c.ScheduleId: c for c in consultations if c.ScheduleId}
    order_ids = {c.OrderId for c in consultations if c.OrderId}
    orders = {
        o.Id: o for o in db.query(AppOrder).filter(AppOrder.Id.in_(order_ids)).all()
    } if order_ids else {}

    def consultation_business_payload(consultation: Optional[AppConsultation]) -> dict[str, Any]:
        if not consultation:
            return {
                "patientName": None,
                "patientMobile": None,
                "status": None,
                "startTime": None,
                "endTime": None,
                "centerName": None,
                "roomName": None,
            }
        patient = patients.get(consultation.PatientId)
        return {
            "patientName": _account_name(patient),
            "patientMobile": _account_contact(patient),
            "status": consultation.Status,
            "startTime": consultation.StartTime,
            "endTime": consultation.EndTime,
            **_consultation_room_payload(consultation, schedule_map),
        }

    def schedule_business_payload(schedule: Optional[AppSchedule]) -> dict[str, Any]:
        consultation = consultations_by_schedule_id.get(schedule.Id) if schedule else None
        patient = patients.get(consultation.PatientId) if consultation else None
        return {
            "startTime": schedule.StartTime if schedule else None,
            "endTime": schedule.EndTime if schedule else None,
            "patientName": _account_name(patient) if patient else None,
            "patientMobile": _account_contact(patient),
            "consultationStatus": consultation.Status if consultation else None,
            **_room_payload(schedule),
        }

    visitors_by_patient: dict[int, dict[str, Any]] = {}
    for consultation in consultations:
        patient = patients.get(consultation.PatientId)
        visitor = visitors_by_patient.setdefault(
            consultation.PatientId,
            {
                "patientId": consultation.PatientId,
                "patientName": _account_name(patient),
                "patientMobile": _account_contact(patient),
                "consultationCount": 0,
                "appointmentCount": 0,
                "cancelledCount": 0,
                "paidAmount": 0,
                "latestAppointment": None,
                "_countedOrderIds": set(),
            },
        )
        visitor["consultationCount"] += 1
        visitor["appointmentCount"] += 1
        if consultation.Status in ("CANCELLED", "CANCELED"):
            visitor["cancelledCount"] += 1
        if consultation.OrderId and consultation.OrderId not in visitor["_countedOrderIds"]:
            order = orders.get(consultation.OrderId)
            if order and order.Status == "PAID":
                visitor["paidAmount"] += order.TotalFee or 0
            visitor["_countedOrderIds"].add(consultation.OrderId)
        if not visitor["latestAppointment"]:
            visitor["latestAppointment"] = {
                "consultationId": consultation.Id,
                "orderId": consultation.OrderId,
                "scheduleId": consultation.ScheduleId,
                "status": consultation.Status,
                "startTime": consultation.StartTime,
                "endTime": consultation.EndTime,
                "note": consultation.Note,
                **_consultation_room_payload(consultation, schedule_map),
            }

    visitors = []
    for visitor in visitors_by_patient.values():
        visitor.pop("_countedOrderIds", None)
        visitors.append(visitor)
    visitors.sort(key=lambda item: (-item["consultationCount"], item["patientName"]))

    return {
        "profile": _counselor_summary(db, account),
        "visitors": visitors,
        "consultations": [
            {
                "id": c.Id,
                "orderId": c.OrderId,
                "patientId": c.PatientId,
                "patientName": _account_name(patients.get(c.PatientId)),
                "patientMobile": _account_contact(patients.get(c.PatientId)),
                "scheduleId": c.ScheduleId,
                "status": c.Status,
                "startTime": c.StartTime,
                "endTime": c.EndTime,
                "note": c.Note,
                "hasCaseRecord": c.Id in records_by_consultation,
                **_consultation_room_payload(c, schedule_map),
            }
            for c in consultations
        ],
        "caseRecords": [
            {
                "id": r.Id,
                "consultationId": r.ConsultationId,
                "createdAt": r.CreatedAt,
                "updatedAt": r.UpdatedAt,
                "preview": (r.Subjective or r.Assessment or r.Plan or "")[:120],
                **consultation_business_payload(consultations_by_id.get(r.ConsultationId)),
            }
            for r in records
        ],
        "leaveRequests": [
            {
                "id": r.Id,
                "scheduleId": r.ScheduleId,
                "reason": r.Reason,
                "status": r.Status,
                "createdAt": r.CreatedAt,
                "updatedAt": r.UpdatedAt,
                **schedule_business_payload(schedule_map.get(r.ScheduleId)),
            }
            for r in leave_requests
        ],
        "schedules": [
            {
                "id": s.Id,
                "status": s.Status,
                **schedule_business_payload(s),
            }
            for s in schedules
        ],
        "roomUsage": [
            {
                "scheduleId": s.Id,
                "status": s.Status,
                **schedule_business_payload(s),
            }
            for s in schedules if parse_room_id(s.Note)
        ],
        "scheduleCancelLogs": [
            {
                "id": r.Id,
                "scheduleId": r.ScheduleId,
                "consultationId": r.ConsultationId,
                "screenshotUrl": r.ScreenshotUrl,
                "createdAt": r.CreatedAt,
                **(
                    consultation_business_payload(consultations_by_id.get(r.ConsultationId))
                    if r.ConsultationId
                    else schedule_business_payload(schedule_map.get(r.ScheduleId))
                ),
            }
            for r in cancel_logs
        ],
    }
