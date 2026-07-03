"""咨询师账号与旧系统 T_Doctor 的关联、去重。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session
from sqlalchemy import text

from models import AppAccount, AppCounselorProfile, AppRoleBinding
from pricing_service import sync_counselor_profile_billing_for_type, _pick_canonical_counselor_profile


def _safe_legacy_query(db: Session, sql: str, **params) -> List[Dict[str, Any]]:
    try:
        rs = db.execute(text(sql), params)
        cols = rs.keys()
        return [dict(zip(cols, row)) for row in rs.fetchall()]
    except (OperationalError, ProgrammingError):
        return []
    except Exception:
        return []


def _normalize_counselor_name(name: Optional[str]) -> str:
    return (name or "").strip().casefold()


def find_legacy_doctor_by_name(db: Session, name: str) -> Optional[Dict[str, Any]]:
    normalized = _normalize_counselor_name(name)
    if not normalized:
        return None
    rows = _safe_legacy_query(
        db,
        "SELECT ID, name, tel, topUrl, url, position, Specialty, Field, introduce, "
        "Billing, FaceBilling, ConsultHours, WorkYears "
        "FROM T_Doctor WHERE isDelete = 0 AND name = :name",
        name=(name or "").strip(),
    )
    if not rows:
        rows = _safe_legacy_query(
            db,
            "SELECT ID, name, tel, topUrl, url, position, Specialty, Field, introduce, "
            "Billing, FaceBilling, ConsultHours, WorkYears "
            "FROM T_Doctor WHERE isDelete = 0",
        )
        rows = [r for r in rows if _normalize_counselor_name(r.get("name")) == normalized]
    return rows[0] if rows else None


def resolve_legacy_doctor_for_account(
    db: Session,
    account: AppAccount,
    *,
    preferred_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """优先手机号匹配，其次姓名（昵称/档案名）匹配旧系统咨询师。"""
    doc = find_legacy_doctor_by_mobile(db, account.Mobile or "")
    if doc:
        return doc
    for candidate in (preferred_name, account.Nickname, account.RealName):
        if not candidate:
            continue
        doc = find_legacy_doctor_by_name(db, candidate)
        if doc:
            return doc
    return None


def hide_legacy_doctor(db: Session, legacy_id: int) -> None:
    """新系统接管后，旧表不再对外展示。"""
    if not legacy_id:
        return
    try:
        db.execute(
            text("UPDATE T_Doctor SET IsShow = 0 WHERE ID = :id"),
            {"id": legacy_id},
        )
    except (OperationalError, ProgrammingError):
        pass
    except Exception:
        pass


def counselor_account_ids(db: Session) -> List[int]:
    """已绑定 Counselor 角色的账号 ID（咨询师唯一来源）。"""
    return sorted(
        {
            b.AccountId
            for b in db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Counselor").all()
        }
    )


_MERGE_PROFILE_FIELDS = (
    "Name",
    "AvatarUrl",
    "Title",
    "Specialty",
    "Field",
    "Introduce",
    "Career",
    "Qualification",
    "TargetGroup",
    "Mode",
    "WorkYears",
    "ConsultHours",
    "FaceBilling",
    "InfoAuthenticityCommittedAt",
    "InfoAuthenticitySignerName",
)


def _merge_counselor_profile_fields(
    keeper: AppCounselorProfile,
    other: AppCounselorProfile,
) -> None:
    for field in _MERGE_PROFILE_FIELDS:
        if not getattr(keeper, field) and getattr(other, field):
            setattr(keeper, field, getattr(other, field))
    other_type = (other.CounselorType or "").strip()
    keeper_type = (keeper.CounselorType or "").strip()
    if other_type == "CHARITY":
        keeper.CounselorType = "CHARITY"
    elif not keeper_type and other_type:
        keeper.CounselorType = other_type
    keeper.IsActive = bool(keeper.IsActive or other.IsActive)


def dedupe_counselor_profiles(db: Session, account_id: Optional[int] = None) -> int:
    """合并同一账号下重复的咨询师档案，保留公益类型优先的那条。"""
    q = db.query(AppCounselorProfile)
    if account_id is not None:
        q = q.filter(AppCounselorProfile.AccountId == account_id)
    by_account: Dict[int, List[AppCounselorProfile]] = {}
    for profile in q.all():
        by_account.setdefault(profile.AccountId, []).append(profile)

    deduped = 0
    for profiles in by_account.values():
        if len(profiles) <= 1:
            continue
        keeper = _pick_canonical_counselor_profile(profiles)
        if not keeper:
            continue
        for other in profiles:
            if other.Id == keeper.Id:
                continue
            _merge_counselor_profile_fields(keeper, other)
            db.delete(other)
        sync_counselor_profile_billing_for_type(keeper)
        deduped += 1
    return deduped


def list_legacy_unlinked_doctors(
    db: Session,
    keyword: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """旧系统 T_Doctor 中尚未关联 AppAccount 的咨询师。"""
    covered = legacy_doctor_ids_covered_by_new_system(db)
    rows = _safe_legacy_query(
        db,
        "SELECT ID, name, tel FROM T_Doctor WHERE isDelete = 0 ORDER BY name ASC, ID ASC",
    )
    result: List[Dict[str, Any]] = []
    kw = (keyword or "").strip().lower()
    for row in rows:
        doc_id = int(row.get("ID") or 0)
        if not doc_id or doc_id in covered:
            continue
        name = (row.get("name") or "").strip()
        tel = (row.get("tel") or "").strip()
        if kw and kw not in name.lower() and kw not in tel and kw != str(doc_id):
            continue
        result.append(
            {
                "id": -doc_id,
                "legacyDoctorId": doc_id,
                "mobile": tel or None,
                "nickname": name or None,
                "displayName": name or f"旧系统咨询师#{doc_id}",
                "counselorName": name or None,
                "activeRole": None,
                "roles": [],
                "isLegacyOnly": True,
                "createdAt": None,
            }
        )
    return result


def find_legacy_doctor_by_mobile(db: Session, mobile: str) -> Optional[Dict[str, Any]]:
    tel = (mobile or "").strip()
    if not tel:
        return None
    rows = _safe_legacy_query(
        db,
        "SELECT TOP 1 ID, name, topUrl, url, position, Specialty, Field, introduce, "
        "Billing, FaceBilling, ConsultHours, WorkYears, tel "
        "FROM T_Doctor WHERE isDelete = 0 AND tel = :tel",
        tel=tel,
    )
    return rows[0] if rows else None


def legacy_doctor_ids_covered_by_new_system(db: Session) -> Set[int]:
    """已由新系统接管的 T_Doctor ID，公开列表中应排除。"""
    covered: Set[int] = set()
    counselor_ids = counselor_account_ids(db)

    known_names: Set[str] = set()
    for profile in db.query(AppCounselorProfile).filter(AppCounselorProfile.IsActive == True).all():
        n = _normalize_counselor_name(profile.Name)
        if n:
            known_names.add(n)
    if counselor_ids:
        for account in db.query(AppAccount).filter(AppAccount.Id.in_(counselor_ids)).all():
            for field in (account.Nickname, account.RealName):
                n = _normalize_counselor_name(field)
                if n:
                    known_names.add(n)

    for binding in db.query(AppRoleBinding).filter(
        AppRoleBinding.RoleType == "Counselor",
        AppRoleBinding.TargetId.isnot(None),
    ).all():
        target_id = int(binding.TargetId or 0)
        if target_id and target_id != binding.AccountId:
            covered.add(target_id)

    if counselor_ids:
        for account in db.query(AppAccount).filter(AppAccount.Id.in_(counselor_ids)).all():
            doc = find_legacy_doctor_by_mobile(db, account.Mobile or "")
            if doc:
                covered.add(int(doc["ID"]))

    if known_names:
        for row in _safe_legacy_query(db, "SELECT ID, name FROM T_Doctor WHERE isDelete = 0"):
            doc_id = int(row.get("ID") or 0)
            if not doc_id:
                continue
            if _normalize_counselor_name(row.get("name")) in known_names:
                covered.add(doc_id)

    return covered


def link_counselor_role_to_legacy_doctor(
    db: Session,
    account: AppAccount,
    legacy_doc: Optional[Dict[str, Any]] = None,
) -> Optional[int]:
    """关联旧档案：更新 TargetId，并在旧表隐藏该咨询师。"""
    doc = legacy_doc or resolve_legacy_doctor_for_account(db, account)
    if not doc:
        return None
    legacy_id = int(doc["ID"])
    binding = (
        db.query(AppRoleBinding)
        .filter(
            AppRoleBinding.AccountId == account.Id,
            AppRoleBinding.RoleType == "Counselor",
        )
        .first()
    )
    if binding:
        binding.TargetId = legacy_id
    hide_legacy_doctor(db, legacy_id)
    return legacy_id


def reconcile_existing_counselor_legacy_links(db: Session) -> int:
    """为已绑定咨询师批量关联并隐藏旧系统同名/同手机号档案。"""
    dedupe_counselor_profiles(db)
    linked = 0
    for account_id in counselor_account_ids(db):
        account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
        if not account:
            continue
        profiles = (
            db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == account_id)
            .all()
        )
        profile = _pick_canonical_counselor_profile(profiles)
        if profile and (profile.CounselorType or "") == "CHARITY":
            sync_counselor_profile_billing_for_type(profile)
        legacy_doc = resolve_legacy_doctor_for_account(
            db,
            account,
            preferred_name=(profile.Name if profile else None),
        )
        if legacy_doc and link_counselor_role_to_legacy_doctor(db, account, legacy_doc):
            linked += 1
    return linked


def apply_legacy_doctor_to_profile(
    profile: AppCounselorProfile,
    doc: Dict[str, Any],
    *,
    overwrite_name: bool = False,
    skip_billing: bool = False,
) -> None:
    if overwrite_name or not (profile.Name or "").strip():
        profile.Name = doc.get("name") or profile.Name
    if not profile.AvatarUrl:
        profile.AvatarUrl = doc.get("topUrl") or doc.get("url")
    if not profile.Title:
        profile.Title = doc.get("position")
    if not profile.Specialty:
        profile.Specialty = doc.get("Specialty")
    if not profile.Field:
        profile.Field = doc.get("Field")
    if not profile.Introduce:
        profile.Introduce = doc.get("introduce")
    if skip_billing or (profile.CounselorType or "") == "CHARITY":
        pass
    else:
        billing = int(doc.get("Billing") or 0)
        if billing > 0 and (not profile.Billing or profile.Billing <= 0):
            profile.Billing = billing * 100 if billing < 1000 else billing
        face_billing = int(doc.get("FaceBilling") or 0)
        if face_billing > 0 and (not profile.FaceBilling or profile.FaceBilling <= 0):
            profile.FaceBilling = face_billing * 100 if face_billing < 1000 else face_billing
    work_years = int(doc.get("WorkYears") or 0)
    if work_years > 0 and not profile.WorkYears:
        profile.WorkYears = work_years
    consult_hours = int(doc.get("ConsultHours") or 0)
    if consult_hours > 0 and not profile.ConsultHours:
        profile.ConsultHours = consult_hours
