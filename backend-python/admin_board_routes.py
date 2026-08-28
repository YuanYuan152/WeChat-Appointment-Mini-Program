"""来访/咨询师管理看板（聚合读接口）。

挂在 /api/mini/admin 下，与小程序 patients/counselors 管理同一前缀；
供 admin-web 与小程序共用，替代原 /api/web/admin/.../board。
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import (
    AppAccount,
    AppCaseRecord,
    AppConsultation,
    AppLeaveRequest,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
    AppSchedule,
    AppScheduleCancelLog,
)
from patient_contract_service import (
    batch_patient_contract_extras,
    contract_signature_file_path,
    current_patient_contract_order,
    patient_contract_extras,
    patient_contract_material,
)
from schedule_meta import center_display_name, parse_center_id, parse_room_id, room_display_name
from staff_remark_service import get_staff_remark, get_staff_remarks_map
from pricing_service import get_counselor_profile
from common import _profile_is_public_visible
from user_role_meta import (
    normalize_patient_source,
    patient_source_label,
    validate_patient_source,
    validate_patient_source_detail,
)


class PatientSourceDetailUpdate(BaseModel):
    patientSource: Optional[str] = None
    patientSourceDetail: Optional[str] = Field(default=None, max_length=200)
    # 兼容旧管理端仅以 source 传详细来源。
    source: Optional[str] = Field(default=None, max_length=200)


def _account_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "-"
    return account.RealName or account.Nickname or account.Mobile or "未留姓名用户"


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


def _user_summary(
    db: Session,
    account: AppAccount,
    roles: list[str],
    staff_remark: Optional[str] = None,
) -> dict[str, Any]:
    orders = db.query(AppOrder).filter(AppOrder.AccountId == account.Id).all()
    consultations = db.query(AppConsultation).filter(AppConsultation.PatientId == account.Id).all()
    exemptions = db.query(AppRefundExemption).filter(AppRefundExemption.AccountId == account.Id).all()
    paid_orders = [o for o in orders if o.Status == "PAID"]
    refunded_orders = [o for o in orders if o.Status == "REFUNDED"]
    is_staff = any(role in ("Counselor", "Assistant", "Ops", "Admin") for role in roles)
    is_visitor = not is_staff and ("Patient" in roles or bool(consultations))
    summary: dict[str, Any] = {
        "id": account.Id,
        "name": _account_name(account),
        "mobile": account.Mobile,
        "gender": account.Gender,
        "roles": roles,
        "activeRole": account.ActiveRole,
        "patientSource": normalize_patient_source(account.PatientSource),
        "patientSourceLabel": patient_source_label(account.PatientSource),
        "patientSourceDetail": account.PatientSourceDetail,
        "isVisitor": is_visitor,
        "orderCount": len(orders),
        "paidOrderCount": len(paid_orders),
        "paidAmount": sum(o.TotalFee or 0 for o in paid_orders),
        "refundCount": len(refunded_orders),
        "refundAmount": sum(o.TotalFee or 0 for o in refunded_orders),
        "exemptionCount": len(exemptions),
        "pendingExemptionCount": len([e for e in exemptions if e.Status == "PENDING"]),
        "consultationCount": len(consultations),
        "completedConsultationCount": len([c for c in consultations if c.Status == "DONE"]),
        "cancelledConsultationCount": len(
            [c for c in consultations if c.Status in ("CANCELLED", "CANCELED")]
        ),
        "latestConsultationAt": max([c.StartTime for c in consultations if c.StartTime] or [None]),
        "createdAt": account.CreatedAt,
        "staffRemark": staff_remark if staff_remark is not None else get_staff_remark(db, account.Id),
    }
    if is_visitor:
        summary.update(patient_contract_extras(db, account))
    return summary


def _counselor_summary(
    db: Session,
    account: AppAccount,
    staff_remark: Optional[str] = None,
) -> dict[str, Any]:
    consultations = db.query(AppConsultation).filter(AppConsultation.CounselorId == account.Id).all()
    records = db.query(AppCaseRecord).filter(AppCaseRecord.CounselorId == account.Id).all()
    schedules = db.query(AppSchedule).filter(AppSchedule.CounselorId == account.Id).all()
    leave_requests = db.query(AppLeaveRequest).filter(AppLeaveRequest.CounselorId == account.Id).all()
    completed = [c for c in consultations if c.Status == "DONE"]
    cancelled = [c for c in consultations if c.Status in ("CANCELLED", "CANCELED")]
    recorded_consultation_ids = {r.ConsultationId for r in records}
    profile = get_counselor_profile(db, account.Id)
    return {
        "id": account.Id,
        "name": _account_name(account),
        "mobile": account.Mobile,
        "activeRole": account.ActiveRole,
        "isPublicVisible": _profile_is_public_visible(profile),
        "consultationCount": len(consultations),
        "completedConsultationCount": len(completed),
        "cancelledConsultationCount": len(cancelled),
        "caseRecordCount": len(records),
        "missingRecordCount": len([c for c in completed if c.Id not in recorded_consultation_ids]),
        "scheduleCount": len(schedules),
        "bookedScheduleCount": len([s for s in schedules if s.Status == "BOOKED"]),
        "leaveRequestCount": len(leave_requests),
        "latestScheduleAt": max([s.StartTime for s in schedules if s.StartTime] or [None]),
        "staffRemark": staff_remark if staff_remark is not None else get_staff_remark(db, account.Id),
    }


def register_admin_board_routes(
    router: APIRouter,
    *,
    require_staff_workbench: Callable,
    visitor_patient_ids: Callable[[Session], set[int]],
    counselor_account_ids: Callable[[Session], list[int]],
) -> None:
    """注册看板路由。

    使用 /boards/* 前缀，避免与 /patients/{id}、/counselors/{id} 的路径参数冲突
   （例如 /patients/board 被解析成 patient_id=\"board\" 导致 422）。
    """

    @router.get("/boards/patients", summary="来访管理看板列表")
    def patient_board_list(
        keyword: Optional[str] = Query(None, description="姓名/昵称/手机号"),
        gender: Optional[str] = Query(None),
        mobile: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        _staff: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        visitor_ids = visitor_patient_ids(db)
        if not visitor_ids:
            return _paginate([], page, page_size)
        query = db.query(AppAccount).filter(AppAccount.Id.in_(visitor_ids))
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

        total = query.count()
        accounts = (
            query.order_by(AppAccount.Id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        roles_by_account = _roles_for_accounts(db, {a.Id for a in accounts})
        staff_remarks = get_staff_remarks_map(db, [account.Id for account in accounts])
        items = [
            _user_summary(
                db,
                account,
                roles_by_account.get(account.Id, []),
                staff_remarks.get(account.Id, ""),
            )
            for account in accounts
        ]
        return {
            "total": total,
            "page": page,
            "pageSize": page_size,
            "items": items,
        }

    @router.get("/boards/patients/{account_id}", summary="来访管理看板详情")
    def patient_board_detail(
        account_id: int,
        _staff: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        if account_id not in visitor_patient_ids(db):
            raise HTTPException(status_code=404, detail="来访者不存在")
        account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="来访者不存在")

        roles = _roles_for_accounts(db, {account_id}).get(account_id, [])
        orders = (
            db.query(AppOrder)
            .filter(AppOrder.AccountId == account_id)
            .order_by(AppOrder.CreatedAt.desc())
            .all()
        )
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
                for o in orders
                if o.PaidAt or o.Status == "PAID"
            ],
            "refunds": [
                {"id": o.Id, "amount": o.TotalFee, "updatedAt": o.UpdatedAt, "status": o.Status}
                for o in orders
                if o.Status == "REFUNDED"
            ],
            "exemptions": [
                {
                    "id": e.Id,
                    "consultationId": e.ConsultationId,
                    "amount": e.Amount,
                    "reason": e.Reason,
                    "status": e.Status,
                    "rejectReason": getattr(e, "RejectReason", None),
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
                for c in consultations
                if c.ScheduleId
            ],
        }

    @router.put("/boards/patients/{account_id}/source", summary="修改来访类型与详细来源")
    def update_patient_source_detail(
        account_id: int,
        body: PatientSourceDetailUpdate,
        _staff: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        if account_id not in visitor_patient_ids(db):
            raise HTTPException(status_code=404, detail="来访者不存在")
        account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="来访者不存在")
        if body.patientSource is not None:
            try:
                account.PatientSource = validate_patient_source(body.patientSource)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        detail_value = (
            body.patientSourceDetail
            if "patientSourceDetail" in body.model_fields_set
            else body.source
        )
        if detail_value is not None or "patientSourceDetail" in body.model_fields_set:
            try:
                account.PatientSourceDetail = validate_patient_source_detail(detail_value)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        db.commit()
        db.refresh(account)
        roles = _roles_for_accounts(db, {account_id}).get(account_id, [])
        return _user_summary(db, account, roles)

    @router.get(
        "/boards/patients/{account_id}/contract-material",
        summary="获取来访当前签约材料",
    )
    def patient_contract_material_detail(
        account_id: int,
        _staff: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        if account_id not in visitor_patient_ids(db):
            raise HTTPException(status_code=404, detail="签约材料不存在")
        account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
        material = patient_contract_material(
            db,
            account,
            signature_download_url=(
                f"/api/mini/admin/boards/patients/{account_id}/"
                "contract-material/signature"
            ),
        )
        if not material:
            raise HTTPException(status_code=404, detail="签约材料不存在")
        return material

    @router.get(
        "/boards/patients/{account_id}/contract-material/signature",
        summary="下载来访当前签约签名",
    )
    def download_patient_contract_signature(
        account_id: int,
        _staff: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        if account_id not in visitor_patient_ids(db):
            raise HTTPException(status_code=404, detail="签名文件不存在")
        account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
        order = current_patient_contract_order(db, account)
        signature_path = (
            contract_signature_file_path(order.IntakeSignatureUrl)
            if order
            else None
        )
        if not order or not signature_path:
            raise HTTPException(status_code=404, detail="签名文件不存在")
        return FileResponse(
            path=str(signature_path),
            filename=f"contract-signature-{order.Id}{signature_path.suffix.lower()}",
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )

    @router.get("/boards/counselors", summary="咨询师管理看板列表")
    def counselor_board_list(
        keyword: Optional[str] = Query(None, description="姓名/昵称/手机号"),
        visibility: Optional[str] = Query(
            None,
            description="展示状态：visible=展示中，hidden=已隐藏",
        ),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        _staff: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        visibility_norm = (visibility or "").strip().lower()
        if visibility_norm and visibility_norm not in {"visible", "hidden"}:
            raise HTTPException(status_code=400, detail="无效的展示状态筛选")

        counselor_ids = counselor_account_ids(db)
        accounts = _accounts_by_id(db, set(counselor_ids))
        staff_remarks = get_staff_remarks_map(db, [cid for cid in counselor_ids if cid in accounts])
        items = [
            _counselor_summary(db, accounts[cid], staff_remarks.get(cid, ""))
            for cid in counselor_ids
            if cid in accounts
        ]
        if keyword:
            keyword_norm = keyword.lower()
            items = [
                item
                for item in items
                if keyword_norm in " ".join(str(v or "") for v in [item["name"], item["mobile"]]).lower()
            ]
        if visibility_norm == "visible":
            items = [item for item in items if item.get("isPublicVisible")]
        elif visibility_norm == "hidden":
            items = [item for item in items if not item.get("isPublicVisible")]
        items.sort(key=lambda item: (-item["consultationCount"], item["name"]))
        return _paginate(items, page, page_size)

    @router.get("/boards/counselors/{account_id}", summary="咨询师管理看板详情")
    def counselor_board_detail(
        account_id: int,
        _staff: AppAccount = Depends(require_staff_workbench),
        db: Session = Depends(get_db),
    ):
        if account_id not in set(counselor_account_ids(db)):
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
        patient_contracts = batch_patient_contract_extras(db, list(patients.values())) if patients else {}
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
                    "patientContractTag": None,
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
                "patientContractTag": patient_contracts.get(consultation.PatientId, {}).get("contractTag"),
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
                "patientContractTag": (
                    patient_contracts.get(consultation.PatientId, {}).get("contractTag")
                    if consultation
                    else None
                ),
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
                    "patientContractTag": patient_contracts.get(consultation.PatientId, {}).get(
                        "contractTag"
                    ),
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
                    "patientContractTag": patient_contracts.get(c.PatientId, {}).get("contractTag"),
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
                for s in schedules
                if parse_room_id(s.Note)
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
