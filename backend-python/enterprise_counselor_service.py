"""企业定制页咨询师：候选与展示都读当前后端所连的 AppCounselorProfile。

勾选、本企业置顶、本企业顺序和介绍文案只写在企业配置里。
不修改主档 IsPinned、介绍、价格或排期。
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from assessment_enterprise_service import (
    ENTERPRISE_COUNSELOR_COPY_FIELDS,
    EnterpriseConfigError,
    build_stored_counselor,
    effective_counselor_copy,
    get_enterprise_by_id,
    normalize_enterprise_counselors,
    save_enterprise_counselor_config,
)
from counselor_avatar import resolve_counselor_public_avatar_url
from counselor_work_years import display_work_years, display_work_years_label
from models import AppCounselorProfile
from pricing_service import _pick_canonical_counselor_profile


def _is_public_visible(profile: AppCounselorProfile) -> bool:
    value = getattr(profile, "IsPublicVisible", None)
    if value is None:
        return True
    return bool(value)


def _master_copy(profile: AppCounselorProfile) -> dict[str, str]:
    return {
        "introduce": str(profile.Introduce or "").strip(),
        "qualification": str(getattr(profile, "Qualification", None) or "").strip(),
        "specialty": str(profile.Specialty or "").strip(),
        "field": str(profile.Field or "").strip(),
        "trainingExperience": str(getattr(profile, "TrainingExperience", None) or "").strip(),
        "targetGroup": str(getattr(profile, "TargetGroup", None) or "").strip(),
    }


def profile_public_fields(profile: AppCounselorProfile) -> dict[str, Any]:
    """前台卡片实时字段。不含价格、排期和主档置顶。"""
    account_id = int(profile.AccountId or 0)
    copy = _master_copy(profile)
    return {
        "accountId": account_id,
        "id": account_id,
        "slug": f"c-{account_id}",
        "name": str(profile.Name or "").strip() or "咨询师",
        "avatarUrl": resolve_counselor_public_avatar_url(profile.AvatarUrl),
        "title": str(profile.Title or "").strip(),
        "workYears": display_work_years(profile.WorkYears),
        "workYearsLabel": display_work_years_label(profile.WorkYears),
        "consultHours": int(profile.ConsultHours or 0),
        **copy,
    }


def eligible_profiles(db: Session) -> dict[int, AppCounselorProfile]:
    """当前库里在职且对外可见的咨询师，按账号去重。"""
    rows = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.IsActive == True)  # noqa: E712
        .all()
    )
    grouped: dict[int, list[AppCounselorProfile]] = {}
    for row in rows:
        account_id = int(row.AccountId or 0)
        if account_id <= 0:
            continue
        grouped.setdefault(account_id, []).append(row)
    result: dict[int, AppCounselorProfile] = {}
    for account_id, profiles in grouped.items():
        chosen = _pick_canonical_counselor_profile(profiles)
        if chosen and bool(chosen.IsActive) and _is_public_visible(chosen):
            result[account_id] = chosen
    return result


def list_counselor_candidates(db: Session) -> list[dict[str, Any]]:
    candidates = [profile_public_fields(profile) for profile in eligible_profiles(db).values()]
    candidates.sort(key=lambda item: (str(item.get("name") or ""), int(item.get("accountId") or 0)))
    return candidates


def _public_card(profile: AppCounselorProfile, stored: dict[str, Any]) -> dict[str, Any]:
    master = profile_public_fields(profile)
    card = {
        "accountId": master["accountId"],
        "id": master["accountId"],
        "slug": master["slug"],
        "name": master["name"],
        "avatarUrl": master["avatarUrl"],
        "title": master["title"],
        "workYears": master["workYears"],
        "workYearsLabel": master["workYearsLabel"],
        "consultHours": master["consultHours"],
    }
    for key in ENTERPRISE_COUNSELOR_COPY_FIELDS:
        card[key] = effective_counselor_copy(stored, key, str(master.get(key) or ""))
    return card


def resolve_enterprise_counselors(db: Session, enterprise: dict[str, Any]) -> list[dict[str, Any]]:
    """按这家企业的勾选、置顶和顺序输出。主档不再对外可见的人不出现。"""
    profiles = eligible_profiles(db)
    cards: list[dict[str, Any]] = []
    for stored in normalize_enterprise_counselors(enterprise.get("counselors")):
        profile = profiles.get(int(stored["accountId"]))
        if not profile:
            continue
        cards.append(_public_card(profile, stored))
    return cards


def editor_counselor_payload(db: Session, enterprise_id: str) -> dict[str, Any]:
    enterprise = get_enterprise_by_id(enterprise_id)
    profiles = eligible_profiles(db)
    candidates = [profile_public_fields(profile) for profile in profiles.values()]
    candidates.sort(key=lambda item: (str(item.get("name") or ""), int(item.get("accountId") or 0)))
    selected: list[dict[str, Any]] = []
    for stored in normalize_enterprise_counselors(enterprise.get("counselors")):
        account_id = int(stored["accountId"])
        profile = profiles.get(account_id)
        entry: dict[str, Any] = {
            "accountId": account_id,
            "pinned": bool(stored["pinned"]),
            "sortOrder": int(stored["sortOrder"]),
            "eligible": profile is not None,
            "profile": profile_public_fields(profile) if profile else None,
        }
        for key in ENTERPRISE_COUNSELOR_COPY_FIELDS:
            entry[key] = stored[key] if key in stored else None
        selected.append(entry)
    return {"candidates": candidates, "selected": selected}


def save_enterprise_counselors(
    db: Session,
    enterprise_id: str,
    submitted: list[dict[str, Any]],
) -> dict[str, Any]:
    """只接受当前库在职且对外可见的账号，文案与主档相同则不写入覆盖。"""
    get_enterprise_by_id(enterprise_id)
    profiles = eligible_profiles(db)
    stored: list[dict[str, Any]] = []
    seen: set[int] = set()
    for raw in submitted:
        if not isinstance(raw, dict):
            continue
        try:
            account_id = int(raw.get("accountId") or 0)
        except (TypeError, ValueError):
            raise EnterpriseConfigError("咨询师账号无效") from None
        if account_id in seen:
            continue
        seen.add(account_id)
        profile = profiles.get(account_id)
        if not profile:
            raise EnterpriseConfigError(
                f"咨询师 {account_id} 不在当前环境在职且对外可见的名单中"
            )
        stored.append(build_stored_counselor(raw, _master_copy(profile)))
    save_enterprise_counselor_config(enterprise_id, stored)
    return editor_counselor_payload(db, enterprise_id)
