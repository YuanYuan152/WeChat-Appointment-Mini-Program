"""Web 管理端聚合接口。

大部分接口只读取现有 App* 表，不创建或修改数据库表。导入类接口只写入
现有订单、排期、咨询和用户表，用于把线下整理的数据接入当前业务模型。
"""

import hashlib
import re
import zipfile
from datetime import date, datetime, time, timedelta
from io import BytesIO
from typing import Any, Optional
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import or_
from sqlalchemy.exc import OperationalError, ProgrammingError
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
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppConsultationFeedback,
    AppConsultationRoom,
    AppConsultationRoomSlot,
    AppCounselorProfile,
    AppLeaveRequest,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
    AppRoleSwitchLog,
    AppSchedule,
    AppScheduleCancelLog,
)
from consultation_feedback import feedback_summary
from schedule_meta import center_display_name, parse_center_id, parse_room_id, room_display_name
from schedule_meta import schedule_note
from patient_contract_service import patient_contract_extras
from staff_remark_service import get_staff_remark, get_staff_remarks_map
from staff_roles import account_has_staff_workbench, staff_workbench_account_ids
from data_transfer_service import export_bytes, import_workbook, template_bytes

router = APIRouter(prefix="/api/web/admin", tags=["WebAdmin"])


def _xlsx_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


def require_staff_workbench(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    """与小程序管理工作台一致：咨询助理、咨询主任和管理员可访问。"""
    if not account_has_staff_workbench(
        db,
        current_account.Id,
        getattr(current_account, "ActiveRole", None),
    ):
        raise HTTPException(status_code=403, detail="无管理工作台权限")
    return current_account


@router.get("/data-transfer/{kind}/template", summary="下载数据导入模板")
def data_transfer_template(
    kind: str,
    _admin: AppAccount = Depends(require_ops_or_admin),
):
    try:
        content = template_bytes(kind)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _xlsx_response(content, f"{kind}-template.xlsx")


@router.post("/data-transfer/{kind}/import", summary="导入管理数据")
async def data_transfer_import(
    kind: str,
    file: UploadFile = File(...),
    current_admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    try:
        template_bytes(kind)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not (file.filename or "").lower().endswith(".xlsx"):
        return {
            "message": "导入失败，共发现 1 个错误，未写入任何数据",
            "totalRows": 0,
            "importedCount": 0,
            "errors": [{"sheet": "文件", "cell": "", "message": "请上传 .xlsx 格式文件"}],
        }
    return import_workbook(kind, await file.read(), db, current_admin.Id)


@router.get("/data-transfer/{kind}/export", summary="导出管理数据")
def data_transfer_export(
    kind: str,
    start_date: Optional[date] = Query(None, alias="startDate"),
    end_date: Optional[date] = Query(None, alias="endDate"),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    try:
        content = export_bytes(
            kind,
            db,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _xlsx_response(content, f"{kind}-export.xlsx")


def _visitor_account_ids(db: Session) -> set[int]:
    """与小程序来访管理一致，兼容缺少 Patient 角色的历史来访数据。"""
    staff_ids = set(staff_workbench_account_ids(db))
    staff_ids.update(
        int(value)
        for (value,) in db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Counselor")
        .all()
    )
    role_ids = {
        int(value)
        for (value,) in db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Patient")
        .all()
    } - staff_ids
    consultation_ids = {
        int(value)
        for (value,) in db.query(AppConsultation.PatientId).distinct().all()
        if value
    } - staff_ids
    return role_ids | consultation_ids


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


IMPORT_HEADERS = (
    "日期",
    "星期",
    "时间",
    "咨询师",
    "来访者",
    "付费状况",
    "付费时间",
    "付费方式",
    "付费金额",
    "取消备注",
    "形式",
    "地点",
    "咨询室",
    "次数",
    "咨询时数",
    "备注",
    "助理",
    "目前阶段",
    "最后咨询次数",
    "总时长",
    "合计收入",
)
REQUIRED_IMPORT_HEADERS = set(IMPORT_HEADERS)
IMPORT_DESCRIPTION_HEADERS = (
    "星期",
    "付费状况",
    "付费方式",
    "取消备注",
    "次数",
    "咨询时数",
    "备注",
    "助理",
    "目前阶段",
    "最后咨询次数",
    "总时长",
    "合计收入",
)
PHONE_PATTERN = re.compile(r"1[3-9]\d{9}")


def _strip_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _extract_name_and_phone(raw: Any) -> tuple[str, Optional[str]]:
    text = _strip_value(raw)
    phone_match = PHONE_PATTERN.search(text)
    phone = phone_match.group(0) if phone_match else None
    name = PHONE_PATTERN.sub("", text).replace("（", "(").replace("）", ")")
    name = re.sub(r"[\s,，/|;；()（）-]+", " ", name).strip()
    return name or text, phone


def _excel_serial_datetime(value: float) -> datetime:
    return datetime(1899, 12, 30) + timedelta(days=float(value))


def _parse_import_date(value: Any, field: str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        return _excel_serial_datetime(float(value)).date()

    text = _strip_value(value)
    if not text:
        raise ValueError(f"{field}不能为空")
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text).date()
    except ValueError:
        raise ValueError(f"{field}格式无法识别")


def _parse_import_time(value: Any) -> time:
    if isinstance(value, datetime):
        return value.time().replace(second=0, microsecond=0)
    if isinstance(value, time):
        return value.replace(second=0, microsecond=0)
    if isinstance(value, (int, float)):
        return _excel_serial_datetime(float(value)).time().replace(second=0, microsecond=0)

    text = _strip_value(value)
    if not text:
        raise ValueError("时间不能为空")
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).time().replace(second=0, microsecond=0)
        except ValueError:
            pass
    raise ValueError("时间格式无法识别")


def _parse_optional_datetime(value: Any, reference_date: Optional[date] = None) -> Optional[datetime]:
    if value is None or _strip_value(value) == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    if isinstance(value, (int, float)):
        return _excel_serial_datetime(float(value))
    text = _strip_value(value)
    for fmt in ("%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M", "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        pass

    month_day_match = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})", text)
    if not month_day_match or not reference_date:
        return None

    month, day = (int(part) for part in month_day_match.groups())
    try:
        candidate = datetime(reference_date.year, month, day)
        if candidate.date() > reference_date:
            candidate = candidate.replace(year=reference_date.year - 1)
        return candidate
    except ValueError:
        return None


def _parse_amount_cents(value: Any) -> int:
    text = _strip_value(value).replace(",", "").replace("￥", "").replace("¥", "")
    if not text:
        raise ValueError("付费金额不能为空")
    try:
        amount = float(text)
    except ValueError:
        raise ValueError("付费金额格式无法识别")
    if amount < 0:
        raise ValueError("付费金额不能为负数")
    return int(round(amount * 100))


def _parse_duration_minutes(value: Any) -> int:
    text = _strip_value(value)
    if not text:
        return 50
    try:
        hours = float(text)
    except ValueError:
        return 50
    if hours <= 0:
        return 50
    if abs(hours - 1) < 0.001:
        return 50
    return max(1, int(round(hours * 60)))


def _resolve_center_id(kind: Any, location: Any, room: Any) -> Optional[str]:
    text = " ".join([_strip_value(kind), _strip_value(location), _strip_value(room)]).lower()
    if any(keyword in text for keyword in ("线上", "视频", "video", "online")):
        return "video"
    if "杨浦" in text or "yangpu" in text:
        return "yangpu"
    if "浦东" in text or "pudong" in text:
        return "pudong"
    return None


def _resolve_room_id(center_id: Optional[str], room: Any) -> Optional[str]:
    if not center_id or center_id == "video":
        return None
    text = _strip_value(room)
    if not text:
        return None
    lowered = text.lower()
    if lowered.startswith(f"{center_id}-r"):
        return lowered
    if "a" in lowered or "Ａ" in text or "一" in text:
        return f"{center_id}-r1"
    if "b" in lowered or "Ｂ" in text or "二" in text:
        return f"{center_id}-r2"
    if "c" in lowered or "Ｃ" in text or "三" in text:
        return f"{center_id}-r3"
    match = re.search(r"([123])", text)
    if match:
        return f"{center_id}-r{match.group(1)}"
    return None


def _xlsx_col_index(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    value = 0
    for ch in letters:
        value = value * 26 + (ord(ch.upper()) - ord("A") + 1)
    return value - 1


def _xlsx_text_from_node(node: ET.Element) -> str:
    return "".join(text_node.text or "" for text_node in node.iter() if text_node.tag.endswith("}t"))


def _xlsx_cell_value(cell: ET.Element, shared_strings: list[str]) -> Any:
    cell_type = cell.attrib.get("t")
    value_node = next((child for child in cell if child.tag.endswith("}v")), None)

    if cell_type == "inlineStr":
        inline_node = next((child for child in cell if child.tag.endswith("}is")), None)
        return _xlsx_text_from_node(inline_node) if inline_node is not None else ""

    if value_node is None or value_node.text is None:
        return None

    raw = value_node.text
    if cell_type == "s":
        try:
            return shared_strings[int(raw)]
        except (ValueError, IndexError):
            return raw
    if cell_type == "b":
        return raw == "1"
    try:
        number = float(raw)
    except ValueError:
        return raw
    return int(number) if number.is_integer() else number


def _read_xlsx_rows(file_bytes: bytes) -> list[list[Any]]:
    try:
        with zipfile.ZipFile(BytesIO(file_bytes)) as workbook:
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in workbook.namelist():
                shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
                shared_strings = [_xlsx_text_from_node(item) for item in shared_root if item.tag.endswith("}si")]

            workbook_root = ET.fromstring(workbook.read("xl/workbook.xml"))
            first_sheet = next(node for node in workbook_root.iter() if node.tag.endswith("}sheet"))
            rel_id = first_sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            rel_root = ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
            target = None
            for rel in rel_root:
                if rel.attrib.get("Id") == rel_id:
                    target = rel.attrib.get("Target")
                    break
            if not target:
                raise ValueError("未找到第一个工作表")
            sheet_path = f"xl/{target.lstrip('/')}" if not target.startswith("xl/") else target
            sheet_root = ET.fromstring(workbook.read(sheet_path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"无法读取 Excel 文件：{exc}") from exc

    rows: list[list[Any]] = []
    for row_node in sheet_root.iter():
        if not row_node.tag.endswith("}row"):
            continue
        row_values: list[Any] = []
        for cell in row_node:
            if not cell.tag.endswith("}c"):
                continue
            ref = cell.attrib.get("r", "")
            index = _xlsx_col_index(ref)
            while len(row_values) <= index:
                row_values.append(None)
            row_values[index] = _xlsx_cell_value(cell, shared_strings)
        rows.append(row_values)
    return rows


def _normalize_import_headers(row: list[Any]) -> list[str]:
    return [_strip_value(value).replace(" ", "") for value in row]


def _row_value(row_map: dict[str, Any], *headers: str) -> Any:
    for header in headers:
        if header in row_map:
            return row_map.get(header)
    return None


def _ensure_role_binding(db: Session, account_id: int, role_type: str) -> None:
    exists = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == account_id,
        AppRoleBinding.RoleType == role_type,
    ).first()
    if not exists:
        db.add(AppRoleBinding(AccountId=account_id, RoleType=role_type))


def _find_counselor_for_import(db: Session, raw: Any) -> Optional[AppAccount]:
    name, mobile = _extract_name_and_phone(raw)
    query = (
        db.query(AppAccount)
        .join(AppRoleBinding, AppRoleBinding.AccountId == AppAccount.Id)
        .filter(AppRoleBinding.RoleType == "Counselor")
    )
    if mobile:
        by_mobile = query.filter(AppAccount.Mobile == mobile).first()
        if by_mobile:
            return by_mobile
    if name:
        by_account = query.filter(or_(AppAccount.RealName == name, AppAccount.Nickname == name)).first()
        if by_account:
            return by_account
        profile = db.query(AppCounselorProfile).filter(AppCounselorProfile.Name == name).first()
        if profile:
            return db.query(AppAccount).filter(AppAccount.Id == profile.AccountId).first()
    return None


def _find_or_create_patient_for_import(db: Session, raw: Any) -> AppAccount:
    name, mobile = _extract_name_and_phone(raw)
    if not name:
        raise ValueError("来访者不能为空")
    identity = mobile or name
    import_open_id = f"import-patient-{hashlib.sha1(identity.encode('utf-8')).hexdigest()[:24]}"

    account = None
    if mobile:
        account = db.query(AppAccount).filter(AppAccount.Mobile == mobile).first()
    if not account:
        account = (
            db.query(AppAccount)
            .join(AppRoleBinding, AppRoleBinding.AccountId == AppAccount.Id)
            .filter(AppRoleBinding.RoleType == "Patient")
            .filter(or_(AppAccount.RealName == name, AppAccount.Nickname == name))
            .first()
        )
    if not account:
        account = AppAccount(
            OpenId=import_open_id,
            RealName=name,
            Nickname=name,
            Mobile=mobile,
            ActiveRole="Patient",
        )
        db.add(account)
        db.flush()
    _ensure_role_binding(db, account.Id, "Patient")
    if name and not account.RealName:
        account.RealName = name
    if mobile and not account.Mobile:
        account.Mobile = mobile
    return account


def _import_description(row_map: dict[str, Any], counselor_name: str, patient_name: str) -> str:
    parts = [f"导入完成订单：{patient_name}/{counselor_name}"]
    for header in IMPORT_DESCRIPTION_HEADERS:
        value = _strip_value(row_map.get(header))
        if value:
            parts.append(f"{header}:{value}")
    return "；".join(parts)[:200]


def _import_completed_order_row(db: Session, row_number: int, row_map: dict[str, Any]) -> dict[str, Any]:
    consultation_date = _parse_import_date(_row_value(row_map, "日期"), "日期")
    consultation_time = _parse_import_time(_row_value(row_map, "时间"))
    start_at = datetime.combine(consultation_date, consultation_time)
    duration_minutes = _parse_duration_minutes(_row_value(row_map, "咨询时数"))
    end_at = start_at + timedelta(minutes=duration_minutes)
    paid_at = _parse_optional_datetime(_row_value(row_map, "付费时间"), consultation_date) or start_at
    amount = _parse_amount_cents(_row_value(row_map, "付费金额"))

    counselor = _find_counselor_for_import(db, _row_value(row_map, "咨询师"))
    if not counselor:
        raise ValueError(f"未找到咨询师：{_strip_value(_row_value(row_map, '咨询师'))}")
    patient = _find_or_create_patient_for_import(db, _row_value(row_map, "来访者"))

    center_id = _resolve_center_id(_row_value(row_map, "形式"), _row_value(row_map, "地点"), _row_value(row_map, "咨询室"))
    if not center_id:
        raise ValueError("无法识别咨询地点，请在“形式/地点/咨询室”中填写线上、杨浦或浦东")
    room_id = _resolve_room_id(center_id, _row_value(row_map, "咨询室"))
    note = schedule_note(center_id, None if center_id == "video" else room_id)

    existing_consultation = db.query(AppConsultation).filter(
        AppConsultation.PatientId == patient.Id,
        AppConsultation.CounselorId == counselor.Id,
        AppConsultation.StartTime == start_at,
    ).first()
    if existing_consultation:
        return {
            "rowNumber": row_number,
            "status": "SKIPPED",
            "message": "同一来访者、咨询师和开始时间的咨询已存在",
            "patientName": _account_name(patient),
            "patientContractTag": patient_contract_extras(db, patient).get("contractTag"),
            "counselorName": _account_name(counselor),
            "startTime": start_at,
            "endTime": existing_consultation.EndTime,
            "amount": amount,
            "orderId": existing_consultation.OrderId,
            "consultationId": existing_consultation.Id,
        }

    unique_key = f"{patient.Id}|{counselor.Id}|{start_at.isoformat()}|{amount}"
    out_trade_no = f"IMPORT-{hashlib.sha1(unique_key.encode('utf-8')).hexdigest()[:24].upper()}"
    existing_order = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
    if existing_order:
        return {
            "rowNumber": row_number,
            "status": "SKIPPED",
            "message": "导入订单号已存在",
            "patientName": _account_name(patient),
            "patientContractTag": patient_contract_extras(db, patient).get("contractTag"),
            "counselorName": _account_name(counselor),
            "startTime": start_at,
            "endTime": end_at,
            "amount": amount,
            "orderId": existing_order.Id,
            "consultationId": None,
        }

    schedule = db.query(AppSchedule).filter(
        AppSchedule.CounselorId == counselor.Id,
        AppSchedule.StartTime == start_at,
    ).first()
    if not schedule:
        schedule = AppSchedule(
            CounselorId=counselor.Id,
            StartTime=start_at,
            EndTime=end_at,
            Status="BOOKED",
            Note=note,
            CreatedAt=start_at,
        )
        db.add(schedule)
        db.flush()
    else:
        active = db.query(AppConsultation).filter(
            AppConsultation.ScheduleId == schedule.Id,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING", "DONE"]),
        ).first()
        if active:
            raise ValueError(f"该咨询师在 {start_at:%Y-%m-%d %H:%M} 已有咨询记录")
        schedule.EndTime = end_at
        schedule.Status = "BOOKED"
        schedule.Note = note

    order = AppOrder(
        AccountId=patient.Id,
        SlotId=schedule.Id,
        OutTradeNo=out_trade_no,
        TransactionId=f"IMPORT-{row_number}",
        TotalFee=amount,
        Status="PAID",
        Description=_import_description(row_map, _account_name(counselor), _account_name(patient)),
        CreatedAt=paid_at,
        PaidAt=paid_at,
    )
    db.add(order)
    db.flush()

    consultation = AppConsultation(
        OrderId=order.Id,
        PatientId=patient.Id,
        CounselorId=counselor.Id,
        ScheduleId=schedule.Id,
        Status="DONE",
        StartTime=start_at,
        EndTime=end_at,
        Note=note,
        CreatedAt=start_at,
        UpdatedAt=end_at,
    )
    db.add(consultation)
    db.flush()

    return {
        "rowNumber": row_number,
        "status": "IMPORTED",
        "message": "已导入为完成订单",
        "patientName": _account_name(patient),
        "patientContractTag": patient_contract_extras(db, patient).get("contractTag"),
        "counselorName": _account_name(counselor),
        "startTime": start_at,
        "endTime": end_at,
        "amount": amount,
        "orderId": order.Id,
        "consultationId": consultation.Id,
    }


@router.post("/data-import/completed-orders", summary="导入历史完成订单")
async def import_completed_orders(
    file: UploadFile = File(...),
    _admin: AppAccount = Depends(require_ops_or_admin),
    db: Session = Depends(get_db),
):
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 格式文件")

    rows = _read_xlsx_rows(await file.read())
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="导入文件没有可导入的数据行")

    headers = _normalize_import_headers(rows[0])
    header_set = {header for header in headers if header}
    missing_headers = [header for header in IMPORT_HEADERS if header not in header_set]
    if missing_headers:
        raise HTTPException(status_code=400, detail=f"缺少必填表头：{', '.join(missing_headers)}")

    results: list[dict[str, Any]] = []
    for index, row in enumerate(rows[1:], start=2):
        if not any(_strip_value(cell) for cell in row):
            continue
        row_map = {header: row[pos] if pos < len(row) else None for pos, header in enumerate(headers) if header}
        try:
            result = _import_completed_order_row(db, index, row_map)
            results.append(result)
        except Exception as exc:
            db.rollback()
            results.append({
                "rowNumber": index,
                "status": "FAILED",
                "message": str(exc),
                "patientName": _strip_value(_row_value(row_map, "来访者")) or None,
                "patientContractTag": None,
                "counselorName": _strip_value(_row_value(row_map, "咨询师")) or None,
                "startTime": None,
                "endTime": None,
                "amount": None,
                "orderId": None,
                "consultationId": None,
            })
        else:
            db.commit()

    imported = len([item for item in results if item["status"] == "IMPORTED"])
    skipped = len([item for item in results if item["status"] == "SKIPPED"])
    failed = len([item for item in results if item["status"] == "FAILED"])
    return {
        "message": f"导入完成：成功 {imported} 条，跳过 {skipped} 条，失败 {failed} 条",
        "totalRows": len(results),
        "importedCount": imported,
        "skippedCount": skipped,
        "failedCount": failed,
        "rows": results,
    }


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
            "actionLabel": "用户豁免审核",
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

    for row in db.query(AppCaseRecordAmendmentRequest).all():
        consultation = consultations_by_id.get(row.ConsultationId)
        reviewed_by = optional_model_value(row, "ReviewedBy")
        reviewed_at = optional_model_value(row, "ReviewedAt")
        reject_reason = optional_model_value(row, "RejectReason")
        account_ids.add(row.CounselorId)
        if reviewed_by:
            account_ids.add(reviewed_by)
        if consultation:
            account_ids.update({consultation.PatientId, consultation.CounselorId})
        records.append({
            "id": f"case-record-amendment-{row.Id}",
            "occurredAt": reviewed_at or row.CreatedAt,
            "actionType": "CASE_RECORD_AMENDMENT",
            "actionLabel": "咨询记录修改审核" if reviewed_by else "咨询记录修改申请",
            "operatorId": reviewed_by or row.CounselorId,
            "operatorRole": "Admin/Ops" if reviewed_by else "Counselor",
            "targetType": "CaseRecordAmendment",
            "targetId": row.Id,
            "targetName": None,
            "summary": row.Reason or reject_reason or (row.Subjective or row.Assessment or row.Plan or "")[:120],
            "amount": None,
            "status": row.Status,
            "relatedConsultationId": row.ConsultationId,
            "counselorId": row.CounselorId,
            "patientId": consultation.PatientId if consultation else None,
            "scheduleId": consultation.ScheduleId if consultation else None,
            "startTime": consultation.StartTime if consultation else None,
            "endTime": consultation.EndTime if consultation else None,
            "createdAt": row.CreatedAt,
            "updatedAt": reviewed_at,
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

    for row in db.query(AppConsultationFeedback).all():
        consultation = consultations_by_id.get(row.ConsultationId)
        account_ids.add(row.AccountId)
        if consultation:
            account_ids.update({consultation.PatientId, consultation.CounselorId})
        records.append({
            "id": f"consultation-feedback-{row.Id}",
            "occurredAt": row.CreatedAt,
            "actionType": "CONSULTATION_FEEDBACK",
            "actionLabel": "咨询反馈",
            "operatorId": row.AccountId,
            "operatorRole": "Patient",
            "targetType": "ConsultationFeedback",
            "targetId": row.Id,
            "targetName": None,
            "summary": feedback_summary(row.Content) or row.Content,
            "amount": None,
            "status": "SUBMITTED",
            "relatedConsultationId": row.ConsultationId,
            "patientId": consultation.PatientId if consultation else row.AccountId,
            "counselorId": consultation.CounselorId if consultation else None,
            "scheduleId": consultation.ScheduleId if consultation else None,
            "startTime": consultation.StartTime if consultation else None,
            "endTime": consultation.EndTime if consultation else None,
            "createdAt": row.CreatedAt,
            **(_consultation_room_payload(consultation, schedules_by_id) if consultation else {}),
        })

    try:
        rooms = db.query(AppConsultationRoom).all()
    except (OperationalError, ProgrammingError):
        db.rollback()
        rooms = []
    rooms_by_id = {room.Id: room for room in rooms}
    for row in rooms:
        records.append({
            "id": f"consultation-room-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "ROOM",
            "actionLabel": "更新咨询室" if row.UpdatedAt else "新增咨询室",
            "operatorId": None,
            "operatorRole": "Ops",
            "targetType": "ConsultationRoom",
            "targetId": row.Id,
            "targetName": f"{center_display_name(row.CenterId)} {row.Name}",
            "summary": f"咨询室编号：{row.RoomCode}",
            "amount": None,
            "status": row.Status,
            "centerId": row.CenterId,
            "centerName": center_display_name(row.CenterId),
            "roomId": row.RoomCode,
            "roomName": row.Name,
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
        })

    try:
        room_slots = db.query(AppConsultationRoomSlot).all()
    except (OperationalError, ProgrammingError):
        db.rollback()
        room_slots = []

    for row in room_slots:
        room = rooms_by_id.get(row.RoomId)
        records.append({
            "id": f"consultation-room-slot-{row.Id}",
            "occurredAt": row.UpdatedAt or row.CreatedAt,
            "actionType": "ROOM",
            "actionLabel": "更新咨询室时段",
            "operatorId": None,
            "operatorRole": "Ops",
            "targetType": "RoomSlot",
            "targetId": row.Id,
            "targetName": (
                f"{center_display_name(room.CenterId)} {room.Name} {row.StartTime.strftime('%Y-%m-%d %H:%M')}"
                if room else f"咨询室时段 {row.StartTime.strftime('%Y-%m-%d %H:%M')}"
            ),
            "summary": f"时段状态：{row.Status}",
            "amount": None,
            "status": row.Status,
            "centerId": room.CenterId if room else None,
            "centerName": center_display_name(room.CenterId) if room else None,
            "roomId": room.RoomCode if room else None,
            "roomName": room.Name if room else None,
            "startTime": row.StartTime,
            "endTime": row.StartTime + timedelta(minutes=50),
            "createdAt": row.CreatedAt,
            "updatedAt": row.UpdatedAt,
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
    from patient_contract_service import batch_patient_contract_extras

    operation_patient_ids = {
        int(item["patientId"])
        for item in records
        if item.get("patientId") and int(item["patientId"]) in accounts
    }
    operation_patient_contracts = batch_patient_contract_extras(
        db,
        [accounts[patient_id] for patient_id in operation_patient_ids],
    )
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
            item["patientContractTag"] = operation_patient_contracts.get(
                int(patient.Id), {}
            ).get("contractTag")
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
    # 与小程序 _admin_visitor_patient_ids 保持同一口径，
    # 避免 Web 端把咨询师账号当成来访并展示无法执行的绑定入口。
    is_staff = any(role in ("Counselor", "Assistant", "Ops", "Admin") for role in roles)
    is_visitor = not is_staff and ("Patient" in roles or bool(consultations))
    summary = {
        "id": account.Id,
        "name": _account_name(account),
        "mobile": account.Mobile,
        "gender": account.Gender,
        "roles": roles,
        "activeRole": account.ActiveRole,
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
        "cancelledConsultationCount": len([c for c in consultations if c.Status in ("CANCELLED", "CANCELED")]),
        "latestConsultationAt": max([c.StartTime for c in consultations if c.StartTime] or [None]),
        "createdAt": account.CreatedAt,
        "staffRemark": staff_remark if staff_remark is not None else get_staff_remark(db, account.Id),
    }
    if is_visitor:
        from patient_contract_service import patient_contract_extras

        summary.update(patient_contract_extras(db, account))
    return summary


@router.get("/users/board", summary="来访管理列表")
def user_board_list(
    keyword: Optional[str] = Query(None, description="姓名/昵称/手机号"),
    gender: Optional[str] = Query(None),
    mobile: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    # 来访管理对所有管理角色使用同一数据口径。即使管理员拥有更高权限，
    # 咨询师与工作人员账号也只能从咨询师管理或权限管理进入。
    visitor_ids = _visitor_account_ids(db)
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


@router.get("/users/{account_id}/board", summary="来访管理详情")
def user_board_detail(
    account_id: int,
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    if account_id not in _visitor_account_ids(db):
        raise HTTPException(status_code=404, detail="来访者不存在")
    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="来访者不存在")

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
        "staffRemark": staff_remark if staff_remark is not None else get_staff_remark(db, account.Id),
    }


@router.get("/counselors/board", summary="咨询师管理列表")
def counselor_board_list(
    keyword: Optional[str] = Query(None, description="姓名/昵称/手机号"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _staff: AppAccount = Depends(require_staff_workbench),
    db: Session = Depends(get_db),
):
    bindings = db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Counselor").all()
    counselor_ids = sorted({b.AccountId for b in bindings})
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
            item for item in items
            if keyword_norm in " ".join(str(v or "") for v in [item["name"], item["mobile"]]).lower()
        ]
    items.sort(key=lambda item: (-item["consultationCount"], item["name"]))
    return _paginate(items, page, page_size)


@router.get("/counselors/{account_id}/board", summary="咨询师管理详情")
def counselor_board_detail(
    account_id: int,
    _staff: AppAccount = Depends(require_staff_workbench),
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
    from patient_contract_service import batch_patient_contract_extras

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
                "patientContractTag": patient_contracts.get(consultation.PatientId, {}).get("contractTag"),
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
