"""定制化企业站点人员：独立存储、独立权限，不接入 AppAccount。"""
from __future__ import annotations

import secrets
import string
from io import BytesIO
from typing import Any, Iterable, Optional
from urllib.parse import quote

from fastapi import HTTPException, Response
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy.orm import Session

from auth import create_access_token, decode_token
from models import AppAccount, EnterpriseSitePersonnel
from password_utils import hash_password, verify_password

ENTERPRISE_SITE_TOKEN_TYP = "enterprise_site"
ROLE_EMPLOYEE = "employee"
ROLE_ADMIN = "admin"
VALID_ROLES = frozenset({ROLE_EMPLOYEE, ROLE_ADMIN})
ACCOUNT_MODE_RANDOM = "random"
ACCOUNT_MODE_CUSTOM = "custom"
PASSWORD_MODE_UNIFIED = "unified"
PASSWORD_MODE_LAST4 = "account_last4"
PASSWORD_MODE_RANDOM = "random"
USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
RANDOM_PASSWORD_ALPHABET = string.ascii_letters + string.digits
MAX_EMPLOYEES = 2000
MAX_ADMINS = 200
EXCEL_HEADERS = ["账号", "密码", "电话", "工号", "姓名"]


class EnterprisePersonnelError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def personnel_count(db: Session, enterprise_id: str) -> int:
    return (
        db.query(EnterpriseSitePersonnel)
        .filter(EnterpriseSitePersonnel.EnterpriseId == enterprise_id)
        .count()
    )


def personnel_summary(db: Session, enterprise_id: str) -> dict[str, int]:
    rows = (
        db.query(EnterpriseSitePersonnel.Role, EnterpriseSitePersonnel.Id)
        .filter(EnterpriseSitePersonnel.EnterpriseId == enterprise_id)
        .all()
    )
    employee = sum(1 for role, _ in rows if role == ROLE_EMPLOYEE)
    admin = sum(1 for role, _ in rows if role == ROLE_ADMIN)
    return {
        "employeeCount": employee,
        "adminCount": admin,
        "totalCount": employee + admin,
    }


def personnel_summaries_by_enterprise_id(
    db: Session,
    enterprise_ids: Iterable[str],
) -> dict[str, dict[str, int]]:
    ids = [item for item in enterprise_ids if item]
    empty = {"employeeCount": 0, "adminCount": 0, "totalCount": 0}
    if not ids:
        return {}
    rows = (
        db.query(
            EnterpriseSitePersonnel.EnterpriseId,
            EnterpriseSitePersonnel.Role,
        )
        .filter(EnterpriseSitePersonnel.EnterpriseId.in_(ids))
        .all()
    )
    result: dict[str, dict[str, int]] = {enterprise_id: dict(empty) for enterprise_id in ids}
    for enterprise_id, role in rows:
        bucket = result.setdefault(enterprise_id, dict(empty))
        if role == ROLE_ADMIN:
            bucket["adminCount"] += 1
        else:
            bucket["employeeCount"] += 1
        bucket["totalCount"] += 1
    return result


def sync_personnel_enterprise_slug(db: Session, enterprise_id: str, slug: str) -> None:
    db.query(EnterpriseSitePersonnel).filter(
        EnterpriseSitePersonnel.EnterpriseId == enterprise_id
    ).update({"EnterpriseSlug": slug}, synchronize_session=False)
    db.commit()


def assert_enterprise_deletable(db: Session, enterprise_id: str) -> None:
    if personnel_count(db, enterprise_id) > 0:
        raise EnterprisePersonnelError(
            "该企业定制链接已有人员表，请先删除人员数据后再删除链接",
            status_code=409,
        )


def generate_personnel(
    db: Session,
    *,
    enterprise_id: str,
    enterprise_slug: str,
    employee_count: int,
    admin_count: int,
    account_mode: str,
    account_prefix: str = "",
    password_mode: str,
    unified_password: str = "",
) -> dict[str, int]:
    if personnel_count(db, enterprise_id) > 0:
        raise EnterprisePersonnelError("该企业已有人员数据，请先删除人员表后再生成")
    employees = _require_count(employee_count, "员工数量", minimum=1, maximum=MAX_EMPLOYEES)
    admins = _require_count(admin_count, "后台管理员数量", minimum=0, maximum=MAX_ADMINS)
    mode = (account_mode or "").strip()
    if mode not in {ACCOUNT_MODE_RANDOM, ACCOUNT_MODE_CUSTOM}:
        raise EnterprisePersonnelError("账号设置仅支持随机生成或定制生成")
    pwd_mode = (password_mode or "").strip()
    if pwd_mode not in {PASSWORD_MODE_UNIFIED, PASSWORD_MODE_LAST4, PASSWORD_MODE_RANDOM}:
        raise EnterprisePersonnelError("密码设置无效")
    prefix = _normalize_prefix(account_prefix) if mode == ACCOUNT_MODE_CUSTOM else ""
    unified = _normalize_unified_password(unified_password) if pwd_mode == PASSWORD_MODE_UNIFIED else ""

    records: list[EnterpriseSitePersonnel] = []
    used: set[str] = set()
    sequence = 1
    for role, count in ((ROLE_EMPLOYEE, employees), (ROLE_ADMIN, admins)):
        for _ in range(count):
            username = _next_username(mode, prefix, sequence, used)
            password = _make_password(pwd_mode, username, unified)
            emp_no = f"{sequence:05d}"
            records.append(
                EnterpriseSitePersonnel(
                    EnterpriseId=enterprise_id,
                    EnterpriseSlug=enterprise_slug,
                    Role=role,
                    Username=username,
                    PasswordHash=hash_password(password),
                    PasswordExport=password,
                    Phone="",
                    EmpNo=emp_no,
                    RealName="",
                )
            )
            used.add(username)
            sequence += 1

    db.add_all(records)
    db.commit()
    return {
        "employeeCount": employees,
        "adminCount": admins,
        "totalCount": employees + admins,
    }


def delete_personnel(db: Session, enterprise_id: str) -> int:
    count = personnel_count(db, enterprise_id)
    if count == 0:
        raise EnterprisePersonnelError("该企业没有人员数据", status_code=404)
    db.query(EnterpriseSitePersonnel).filter(
        EnterpriseSitePersonnel.EnterpriseId == enterprise_id
    ).delete(synchronize_session=False)
    db.commit()
    return count


def export_personnel_xlsx(db: Session, enterprise_id: str, role: str) -> Response:
    if role not in VALID_ROLES:
        raise EnterprisePersonnelError("导出角色无效")
    rows = (
        db.query(EnterpriseSitePersonnel)
        .filter(
            EnterpriseSitePersonnel.EnterpriseId == enterprise_id,
            EnterpriseSitePersonnel.Role == role,
        )
        .order_by(EnterpriseSitePersonnel.Id.asc())
        .all()
    )
    if not rows:
        raise EnterprisePersonnelError(
            "没有可导出的员工表" if role == ROLE_EMPLOYEE else "没有可导出的后台管理员表",
            status_code=404,
        )
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "员工表" if role == ROLE_EMPLOYEE else "后台管理员表"
    header_fill = PatternFill("solid", fgColor="1E4C9A")
    header_font = Font(color="FFFFFF", bold=True)
    for index, title in enumerate(EXCEL_HEADERS, start=1):
        cell = sheet.cell(1, index, title)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
        sheet.column_dimensions[cell.column_letter].width = 18
    for offset, item in enumerate(rows, start=2):
        sheet.cell(offset, 1, item.Username or "")
        sheet.cell(offset, 2, item.PasswordExport or "")
        sheet.cell(offset, 3, item.Phone or "")
        sheet.cell(offset, 4, item.EmpNo or "")
        sheet.cell(offset, 5, item.RealName or "")
    sheet.freeze_panes = "A2"
    output = BytesIO()
    workbook.save(output)
    filename = "员工账号.xlsx" if role == ROLE_EMPLOYEE else "后台管理员账号.xlsx"
    encoded = quote(filename)
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="personnel.xlsx"; filename*=UTF-8\'\'{encoded}'
            )
        },
    )


def login_personnel(db: Session, *, slug: str, username: str, password: str) -> dict[str, Any]:
    account_name = (username or "").strip()
    secret = password or ""
    if not account_name or not secret:
        raise EnterprisePersonnelError("请输入账号和密码", status_code=422)
    if not login_required(db, slug):
        raise EnterprisePersonnelError("该企业站点未启用人员表登录", status_code=404)
    row = (
        db.query(EnterpriseSitePersonnel)
        .filter(
            EnterpriseSitePersonnel.EnterpriseSlug == slug,
            EnterpriseSitePersonnel.Username == account_name,
        )
        .first()
    )
    if not row or not verify_password(secret, row.PasswordHash):
        raise EnterprisePersonnelError("账号或密码错误", status_code=401)
    token, expires = create_access_token(
        {
            "sub": f"enterprise-site:{row.Id}",
            "typ": ENTERPRISE_SITE_TOKEN_TYP,
            "enterpriseId": row.EnterpriseId,
            "slug": row.EnterpriseSlug,
            "role": row.Role,
            "username": row.Username,
        }
    )
    return {
        "token": token,
        "expiresAt": expires.isoformat() + "Z",
        "profile": _public_profile(row),
    }


def login_required(db: Session, slug: str) -> bool:
    return (
        db.query(EnterpriseSitePersonnel.Id)
        .filter(EnterpriseSitePersonnel.EnterpriseSlug == slug)
        .first()
        is not None
    )


def resolve_personnel_from_authorization(
    db: Session,
    authorization: Optional[str],
    slug: str,
) -> Optional[EnterpriseSitePersonnel]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        payload = decode_token(authorization[7:])
    except HTTPException:
        return None
    if payload.get("typ") != ENTERPRISE_SITE_TOKEN_TYP:
        return None
    if str(payload.get("slug") or "") != slug:
        return None
    sub = str(payload.get("sub") or "")
    prefix = "enterprise-site:"
    if not sub.startswith(prefix):
        return None
    try:
        personnel_id = int(sub[len(prefix):])
    except ValueError:
        return None
    row = db.query(EnterpriseSitePersonnel).filter(EnterpriseSitePersonnel.Id == personnel_id).first()
    if not row or row.EnterpriseSlug != slug:
        return None
    return row


def auth_status(
    db: Session,
    *,
    slug: str,
    authorization: Optional[str],
    branding: dict[str, Any],
) -> dict[str, Any]:
    required = login_required(db, slug)
    person = resolve_personnel_from_authorization(db, authorization, slug) if required else None
    return {
        "loginRequired": required,
        "authenticated": bool(person) if required else True,
        "siteName": branding.get("siteName") or "",
        "companyName": branding.get("companyName") or "",
        "logoUrl": branding.get("logoUrl") or "",
        "slogan": branding.get("slogan") or "",
        "profile": _public_profile(person) if person else None,
    }


def assert_not_app_account_table() -> None:
    """防御性断言：人员表名不得与自有账号表混淆。"""
    assert EnterpriseSitePersonnel.__tablename__ != AppAccount.__tablename__


def _public_profile(row: EnterpriseSitePersonnel) -> dict[str, Any]:
    return {
        "username": row.Username,
        "role": row.Role,
        "realName": row.RealName or "",
        "empNo": row.EmpNo or "",
    }


def _require_count(value: int, label: str, *, minimum: int, maximum: int) -> int:
    try:
        count = int(value)
    except (TypeError, ValueError) as exc:
        raise EnterprisePersonnelError(f"{label}无效") from exc
    if count < minimum or count > maximum:
        raise EnterprisePersonnelError(f"{label}须在 {minimum}–{maximum} 之间")
    return count


def _normalize_prefix(raw: str) -> str:
    prefix = (raw or "").strip()
    if not prefix or len(prefix) > 20:
        raise EnterprisePersonnelError("定制账号前缀须为 1–20 个字符")
    if not all(ch.isalnum() or ch in "-_" for ch in prefix):
        raise EnterprisePersonnelError("定制账号前缀仅支持字母、数字、连字符和下划线")
    return prefix


def _normalize_unified_password(raw: str) -> str:
    password = (raw or "").strip()
    if len(password) < 6 or len(password) > 32:
        raise EnterprisePersonnelError("统一密码长度须为 6–32 位")
    return password


def _next_username(mode: str, prefix: str, sequence: int, used: set[str]) -> str:
    if mode == ACCOUNT_MODE_CUSTOM:
        username = f"{prefix}{sequence:05d}"
        if username in used:
            raise EnterprisePersonnelError("生成的账号发生重复，请更换前缀后重试")
        return username
    for _ in range(40):
        username = "".join(secrets.choice(USERNAME_ALPHABET) for _ in range(8))
        if username not in used:
            return username
    raise EnterprisePersonnelError("随机账号生成失败，请重试")


def _make_password(mode: str, username: str, unified: str) -> str:
    if mode == PASSWORD_MODE_UNIFIED:
        return unified
    if mode == PASSWORD_MODE_LAST4:
        tail = username[-4:] if len(username) >= 4 else username.ljust(4, "0")
        return tail
    return "".join(secrets.choice(RANDOM_PASSWORD_ALPHABET) for _ in range(10))
