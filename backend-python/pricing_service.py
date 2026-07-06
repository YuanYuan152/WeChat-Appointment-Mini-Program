"""咨询师-来访定价：咨询师统一基础价 + 来访个体调价 + 分成。"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models import (
    AppAccount,
    AppConsultation,
    AppCounselorPatientPricing,
    AppCounselorProfile,
    AppRoleBinding,
)
from user_role_meta import counselor_type_label

# 单位：分
CHARITY_BASE_LOW_CENTS = 10_000   # ¥100
PROFESSIONAL_BASE_CENTS = 60_000  # ¥600
CHARITY_NEGOTIATION_THRESHOLD = 30
PRICE_LABEL_NEGOTIABLE = "需议价"
MODEL_DEFAULT_BILLING_CENTS = PROFESSIONAL_BASE_CENTS  # ORM 新建档案时的默认值
MODEL_DEFAULT_FACE_BILLING_CENTS = 30_000  # ORM 新建档案时的默认分成金额

VISITOR_EXCLUDED_ROLES = frozenset({"Counselor", "Assistant", "Ops", "Admin"})

SHARE_MODE_AMOUNT = "AMOUNT"
SHARE_MODE_PERCENT = "PERCENT"
DEFAULT_SHARE_PERCENT_OF_BASE = 50  # 未单独配置时，咨询师分成 = 基础价 × 50%


def default_base_price_cents_for_type(counselor_type: Optional[str]) -> int:
    if counselor_type == "CHARITY":
        return CHARITY_BASE_LOW_CENTS
    return PROFESSIONAL_BASE_CENTS


def default_revenue_share_cents_for_base(base_price_cents: int) -> int:
    return max(0, int(base_price_cents * DEFAULT_SHARE_PERCENT_OF_BASE / 100))


def is_legacy_unset_billing(profile: AppCounselorProfile) -> bool:
    """未在定价管理中显式设置过基础价（含公益咨询师沿用 ORM 默认 ¥600 的旧数据）。"""
    billing = int(profile.Billing or 0)
    if billing <= 0:
        return True
    counselor_type = (profile.CounselorType or "") or "PROFESSIONAL"
    if counselor_type == "CHARITY":
        return billing != CHARITY_BASE_LOW_CENTS
    if billing == MODEL_DEFAULT_BILLING_CENTS:
        return True
    return False


def is_legacy_unset_face_billing(profile: AppCounselorProfile, base_price_cents: int) -> bool:
    """未显式设置过分成金额；公益咨询师旧档案会沿用 ORM 默认 ¥300，需要按当前基础价重算。"""
    face_billing = int(profile.FaceBilling or 0)
    if face_billing <= 0:
        return True
    if face_billing == MODEL_DEFAULT_FACE_BILLING_CENTS and base_price_cents != PROFESSIONAL_BASE_CENTS:
        return True
    return False


def _staff_account_ids(db: Session) -> set[int]:
    return {
        b.AccountId
        for b in db.query(AppRoleBinding)
        .filter(AppRoleBinding.RoleType.in_(VISITOR_EXCLUDED_ROLES))
        .all()
    }


def all_visitor_patient_ids(db: Session) -> list[int]:
    """全部来访账号（与来访者管理列表口径一致）。"""
    staff_ids = _staff_account_ids(db)
    role_ids = {
        b.AccountId
        for b in db.query(AppRoleBinding)
        .filter(AppRoleBinding.RoleType == "Patient")
        .all()
    } - staff_ids
    cons_ids = {
        row[0]
        for row in db.query(AppConsultation.PatientId).distinct().all()
        if row[0]
    } - staff_ids
    return sorted(role_ids | cons_ids)


def _batch_patient_consultation_stats(
    db: Session,
    patient_ids: list[int],
    counselor_account_id: int,
) -> dict[int, dict[str, int]]:
    if not patient_ids:
        return {}
    total_map: dict[int, int] = {}
    for pid, cnt in (
        db.query(AppConsultation.PatientId, func.count(AppConsultation.Id))
        .filter(
            AppConsultation.PatientId.in_(patient_ids),
            AppConsultation.Status == "DONE",
        )
        .group_by(AppConsultation.PatientId)
        .all()
    ):
        total_map[int(pid)] = int(cnt)

    counselor_map: dict[int, int] = {}
    for pid, cnt in (
        db.query(AppConsultation.PatientId, func.count(AppConsultation.Id))
        .filter(
            AppConsultation.PatientId.in_(patient_ids),
            AppConsultation.CounselorId == counselor_account_id,
            AppConsultation.Status == "DONE",
        )
        .group_by(AppConsultation.PatientId)
        .all()
    ):
        counselor_map[int(pid)] = int(cnt)

    return {
        pid: {
            "totalCompletedConsultations": total_map.get(pid, 0),
            "counselorCompletedConsultations": counselor_map.get(pid, 0),
        }
        for pid in patient_ids
    }


def count_counselor_completed_consultations(db: Session, counselor_account_id: int) -> int:
    """咨询师已完成咨询次数；公益咨询师第 31 次开始进入需议价阶段。"""
    return int(
        db.query(func.count(AppConsultation.Id))
        .filter(
            AppConsultation.CounselorId == counselor_account_id,
            AppConsultation.Status == "DONE",
        )
        .scalar()
        or 0
    )


def sync_counselor_profile_billing_for_type(profile: AppCounselorProfile) -> None:
    """创建/绑定咨询师时，按类型同步档案中的基础价字段。"""
    counselor_type = (profile.CounselorType or "") or "PROFESSIONAL"
    if counselor_type == "CHARITY":
        profile.Billing = CHARITY_BASE_LOW_CENTS
        if is_legacy_unset_face_billing(profile, CHARITY_BASE_LOW_CENTS):
            profile.FaceBilling = default_revenue_share_cents_for_base(CHARITY_BASE_LOW_CENTS)
        return
    if is_legacy_unset_billing(profile):
        profile.Billing = default_base_price_cents_for_type(counselor_type)
    if is_legacy_unset_face_billing(profile, int(profile.Billing or PROFESSIONAL_BASE_CENTS)):
        profile.FaceBilling = default_revenue_share_cents_for_base(int(profile.Billing or PROFESSIONAL_BASE_CENTS))


def _pick_canonical_counselor_profile(
    profiles: list[AppCounselorProfile],
) -> Optional[AppCounselorProfile]:
    """同一账号多条档案时，优先保留已设类型（公益优先）且最近更新的那条。"""
    if not profiles:
        return None
    if len(profiles) == 1:
        return profiles[0]

    def rank(p: AppCounselorProfile) -> tuple:
        ctype = (p.CounselorType or "").strip()
        has_type = 0 if ctype else 1
        is_charity = 0 if ctype == "CHARITY" else 1
        updated = p.UpdatedAt or p.CreatedAt
        ts = updated.timestamp() if updated else 0
        return (has_type, is_charity, -ts, -int(p.Id or 0))

    return min(profiles, key=rank)


def get_counselor_profile(db: Session, counselor_account_id: int) -> Optional[AppCounselorProfile]:
    rows = (
        db.query(AppCounselorProfile)
        .filter(
            AppCounselorProfile.AccountId == counselor_account_id,
            AppCounselorProfile.IsActive == True,
        )
        .all()
    )
    if not rows:
        rows = (
            db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == counselor_account_id)
            .all()
        )
    return _pick_canonical_counselor_profile(rows)


def resolve_counselor_base_price_cents(db: Session, counselor_account_id: int) -> int:
    """咨询师统一基础价（对所有来访相同），存于 AppCounselorProfile.Billing。"""
    profile = get_counselor_profile(db, counselor_account_id)
    if not profile:
        return PROFESSIONAL_BASE_CENTS
    if is_legacy_unset_billing(profile):
        return default_base_price_cents_for_type(profile.CounselorType or "PROFESSIONAL")
    return int(profile.Billing or 0)


def resolve_counselor_default_share_cents(
    db: Session,
    counselor_account_id: int,
    display_price_cents: Optional[int] = None,
) -> int:
    """咨询师默认分成金额，存于 AppCounselorProfile.FaceBilling，返回时不超过当前来访可见价。"""
    base = resolve_counselor_base_price_cents(db, counselor_account_id)
    profile = get_counselor_profile(db, counselor_account_id)
    if not profile or is_legacy_unset_face_billing(profile, base):
        amount = default_revenue_share_cents_for_base(base)
    else:
        amount = int(profile.FaceBilling or 0)
    cap = base if display_price_cents is None else display_price_cents
    return max(0, min(amount, max(cap, 0)))


def resolve_charity_tier_adjustment_cents(
    db: Session,
    patient_account_id: int,
    counselor_account_id: int,
) -> int:
    """
    公益咨询师不再自动加价。

    当前准确规则是：公益咨询师前 30 次完成咨询默认 ¥100；第 31 次起未做来访个体调价时
    显示「需议价」。具体议价后的价格通过 AppCounselorPatientPricing 保存为手动调价。
    """
    _ = (db, patient_account_id, counselor_account_id)
    return 0


def resolve_price_negotiation_required(
    db: Session,
    patient_account_id: Optional[int],
    counselor_account_id: int,
) -> bool:
    """公益咨询师完成 30 次后，未对当前来访单独调价时需要先议价。"""
    profile = get_counselor_profile(db, counselor_account_id)
    if not profile or (profile.CounselorType or "") != "CHARITY":
        return False
    base = resolve_counselor_base_price_cents(db, counselor_account_id)
    if base != CHARITY_BASE_LOW_CENTS:
        return False
    if patient_account_id and get_pricing_override(db, counselor_account_id, patient_account_id):
        return False
    return count_counselor_completed_consultations(db, counselor_account_id) >= CHARITY_NEGOTIATION_THRESHOLD


def resolve_price_label(
    db: Session,
    patient_account_id: Optional[int],
    counselor_account_id: int,
) -> Optional[str]:
    return PRICE_LABEL_NEGOTIABLE if resolve_price_negotiation_required(db, patient_account_id, counselor_account_id) else None


def get_pricing_override(
    db: Session,
    counselor_account_id: int,
    patient_account_id: int,
) -> Optional[AppCounselorPatientPricing]:
    return (
        db.query(AppCounselorPatientPricing)
        .filter(
            AppCounselorPatientPricing.CounselorAccountId == counselor_account_id,
            AppCounselorPatientPricing.PatientAccountId == patient_account_id,
        )
        .first()
    )


def resolve_manual_adjustment_cents(
    db: Session,
    counselor_account_id: int,
    patient_account_id: int,
) -> int:
    row = get_pricing_override(db, counselor_account_id, patient_account_id)
    return int(row.AdjustmentCents or 0) if row else 0


def resolve_total_adjustment_cents(
    db: Session,
    patient_account_id: int,
    counselor_account_id: int,
) -> Tuple[int, int, int]:
    """返回 (手动调价, 系统调价, 合计调价)。"""
    manual = resolve_manual_adjustment_cents(db, counselor_account_id, patient_account_id)
    auto = resolve_charity_tier_adjustment_cents(db, patient_account_id, counselor_account_id)
    return manual, auto, manual + auto


def resolve_display_price_cents(
    db: Session,
    patient_account_id: int,
    counselor_account_id: int,
) -> int:
    base = resolve_counselor_base_price_cents(db, counselor_account_id)
    _, _, adjustment = resolve_total_adjustment_cents(db, patient_account_id, counselor_account_id)
    return max(base + adjustment, 0)


def resolve_revenue_share_cents(
    db: Session,
    patient_account_id: int,
    counselor_account_id: int,
    display_price_cents: Optional[int] = None,
) -> int:
    display = (
        display_price_cents
        if display_price_cents is not None
        else resolve_display_price_cents(db, patient_account_id, counselor_account_id)
    )
    if display <= 0:
        return 0

    row = get_pricing_override(db, counselor_account_id, patient_account_id)
    if not row or not row.ShareMode:
        return resolve_counselor_default_share_cents(db, counselor_account_id, display)

    if row.ShareMode == SHARE_MODE_AMOUNT:
        amount = int(row.RevenueShareCents or 0)
        return max(0, min(amount, display))

    if row.ShareMode == SHARE_MODE_PERCENT:
        percent = int(row.RevenueSharePercent or 0)
        percent = max(0, min(percent, 100))
        return int(display * percent / 100)

    return resolve_counselor_default_share_cents(db, counselor_account_id, display)


def resolve_default_display_price_cents(db: Session, counselor_account_id: int) -> int:
    """未登录来访浏览：咨询师基础价（无个体调价）。"""
    return resolve_counselor_base_price_cents(db, counselor_account_id)


def counselor_pricing_summary(db: Session, counselor_account_id: int) -> Dict[str, Any]:
    profile = get_counselor_profile(db, counselor_account_id)
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_account_id).first()
    counselor_type = (profile.CounselorType if profile else None) or "PROFESSIONAL"
    base = resolve_counselor_base_price_cents(db, counselor_account_id)
    default_share = resolve_counselor_default_share_cents(db, counselor_account_id, base)
    default_base = default_base_price_cents_for_type(counselor_type)
    using_default = bool(profile and is_legacy_unset_billing(profile))
    default_share_percent = int(round(default_share * 100 / base)) if base > 0 else 0
    patient_count = (
        db.query(func.count(func.distinct(AppConsultation.PatientId)))
        .filter(AppConsultation.CounselorId == counselor_account_id)
        .scalar()
        or 0
    )
    total_patient_count = len(all_visitor_patient_ids(db))
    override_count = (
        db.query(func.count(AppCounselorPatientPricing.Id))
        .filter(AppCounselorPatientPricing.CounselorAccountId == counselor_account_id)
        .scalar()
        or 0
    )
    completed_consultation_count = count_counselor_completed_consultations(db, counselor_account_id)
    name = (
        (profile.Name if profile else None)
        or (acc.RealName if acc else None)
        or (acc.Nickname if acc else None)
        or f"咨询师#{counselor_account_id}"
    )
    return {
        "counselorId": counselor_account_id,
        "counselorName": name,
        "counselorType": counselor_type,
        "counselorTypeLabel": counselor_type_label(counselor_type),
        "basePriceCents": base,
        "basePriceYuan": base // 100,
        "defaultBasePriceYuan": default_base // 100,
        "defaultRevenueShareCents": default_share,
        "defaultRevenueShareYuan": default_share // 100,
        "defaultSharePercent": default_share_percent,
        "usingDefaultBase": using_default,
        "patientCount": int(patient_count),
        "totalPatientCount": total_patient_count,
        "configuredPatientCount": int(override_count),
        "completedConsultationCount": completed_consultation_count,
        "charityNegotiationThreshold": CHARITY_NEGOTIATION_THRESHOLD,
        "needsNegotiation": resolve_price_negotiation_required(db, None, counselor_account_id),
        "priceLabel": resolve_price_label(db, None, counselor_account_id),
    }


def list_counselor_pricing_summaries(
    db: Session,
    *,
    keyword: Optional[str] = None,
) -> list[Dict[str, Any]]:
    from counselor_identity_service import counselor_account_ids

    rows = [counselor_pricing_summary(db, cid) for cid in counselor_account_ids(db)]
    if keyword:
        kw = keyword.strip().lower()
        if kw:
            rows = [
                r
                for r in rows
                if kw in str(r["counselorId"])
                or kw in (r.get("counselorName") or "").lower()
                or kw in (r.get("counselorTypeLabel") or "").lower()
            ]
    return rows


def update_counselor_base_price_cents(
    db: Session,
    counselor_account_id: int,
    base_price_cents: int,
) -> AppCounselorProfile:
    return update_counselor_base_pricing_cents(
        db,
        counselor_account_id,
        base_price_cents=base_price_cents,
        default_share_cents=None,
    )


def update_counselor_base_pricing_cents(
    db: Session,
    counselor_account_id: int,
    *,
    base_price_cents: int,
    default_share_cents: Optional[int] = None,
) -> AppCounselorProfile:
    if base_price_cents < 0:
        raise ValueError("基础价格不能为负数")
    if default_share_cents is not None:
        if default_share_cents < 0:
            raise ValueError("默认分成金额不能为负数")
        if default_share_cents > base_price_cents:
            raise ValueError("默认分成金额不能超过基础价格")
    profile = get_counselor_profile(db, counselor_account_id)
    if not profile:
        raise ValueError("咨询师档案不存在")
    profile.Billing = base_price_cents
    if default_share_cents is not None:
        profile.FaceBilling = default_share_cents
    db.flush()
    return profile


def pricing_breakdown(
    db: Session,
    patient_account_id: int,
    counselor_account_id: int,
    *,
    consultation_stats: Optional[dict[str, int]] = None,
) -> Dict[str, Any]:
    profile = get_counselor_profile(db, counselor_account_id)
    override = get_pricing_override(db, counselor_account_id, patient_account_id)
    base = resolve_counselor_base_price_cents(db, counselor_account_id)
    manual_adj, auto_adj, total_adj = resolve_total_adjustment_cents(
        db, patient_account_id, counselor_account_id
    )
    display = max(base + total_adj, 0)
    share = resolve_revenue_share_cents(db, patient_account_id, counselor_account_id, display)

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_account_id).first()
    counselor_type = (profile.CounselorType if profile else None) or "PROFESSIONAL"
    completed_count = count_counselor_completed_consultations(db, counselor_account_id)
    needs_negotiation = resolve_price_negotiation_required(db, patient_account_id, counselor_account_id)

    if consultation_stats is None:
        consultation_stats = _batch_patient_consultation_stats(
            db, [patient_account_id], counselor_account_id
        ).get(
            patient_account_id,
            {"totalCompletedConsultations": 0, "counselorCompletedConsultations": 0},
        )

    return {
        "patientId": patient_account_id,
        "patientName": _account_display_name(patient, patient_account_id),
        "patientMobile": patient.Mobile if patient else None,
        "counselorId": counselor_account_id,
        "counselorName": profile.Name if profile and profile.Name else _account_display_name(
            db.query(AppAccount).filter(AppAccount.Id == counselor_account_id).first(),
            counselor_account_id,
        ),
        "counselorType": counselor_type,
        "lowPriceOrderCount": completed_count,
        "completedCharityConsultationCount": completed_count,
        "charityNegotiationThreshold": CHARITY_NEGOTIATION_THRESHOLD,
        "needsNegotiation": needs_negotiation,
        "priceLabel": PRICE_LABEL_NEGOTIABLE if needs_negotiation else None,
        "totalCompletedConsultations": consultation_stats["totalCompletedConsultations"],
        "counselorCompletedConsultations": consultation_stats["counselorCompletedConsultations"],
        "basePriceCents": base,
        "manualAdjustmentCents": manual_adj,
        "autoAdjustmentCents": auto_adj,
        "adjustmentCents": total_adj,
        "displayPriceCents": display,
        "revenueShareCents": share,
        "shareMode": override.ShareMode if override else None,
        "revenueShareAmountCents": override.RevenueShareCents if override else None,
        "revenueSharePercent": override.RevenueSharePercent if override else None,
        "basePriceYuan": base // 100,
        "manualAdjustmentYuan": manual_adj // 100,
        "autoAdjustmentYuan": auto_adj // 100,
        "adjustmentYuan": total_adj // 100,
        "displayPriceYuan": display // 100,
        "revenueShareYuan": share // 100,
    }


def upsert_patient_pricing(
    db: Session,
    counselor_account_id: int,
    patient_account_id: int,
    *,
    adjustment_cents: int,
    share_mode: Optional[str],
    revenue_share_cents: Optional[int],
    revenue_share_percent: Optional[int],
) -> AppCounselorPatientPricing:
    base = resolve_counselor_base_price_cents(db, counselor_account_id)
    auto_adj = resolve_charity_tier_adjustment_cents(db, patient_account_id, counselor_account_id)
    display = max(base + adjustment_cents + auto_adj, 0)

    if share_mode == SHARE_MODE_AMOUNT:
        if revenue_share_cents is None:
            raise ValueError("请填写分成金额")
        if revenue_share_cents < 0 or revenue_share_cents > display:
            raise ValueError("分成金额不能超过显示价格")
    elif share_mode == SHARE_MODE_PERCENT:
        if revenue_share_percent is None:
            raise ValueError("请填写分成比例")
        if revenue_share_percent < 0 or revenue_share_percent > 100:
            raise ValueError("分成比例须在 0–100 之间")
    elif share_mode:
        raise ValueError("无效的分成方式")

    row = get_pricing_override(db, counselor_account_id, patient_account_id)
    if not row:
        row = AppCounselorPatientPricing(
            CounselorAccountId=counselor_account_id,
            PatientAccountId=patient_account_id,
        )
        db.add(row)

    row.AdjustmentCents = adjustment_cents
    row.ShareMode = share_mode
    row.RevenueShareCents = revenue_share_cents if share_mode == SHARE_MODE_AMOUNT else None
    row.RevenueSharePercent = revenue_share_percent if share_mode == SHARE_MODE_PERCENT else None
    db.flush()
    return row


def list_counselor_patient_pricing(
    db: Session,
    counselor_account_id: int,
    *,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[list[Dict[str, Any]], int]:
    patient_ids = all_visitor_patient_ids(db)

    if keyword:
        kw = keyword.strip()
        if kw:
            like = f"%{kw}%"
            filters = [
                AppAccount.RealName.like(like),
                AppAccount.Nickname.like(like),
                AppAccount.Mobile.like(like),
            ]
            if kw.isdigit():
                filters.append(AppAccount.Id == int(kw))
            matched = (
                db.query(AppAccount.Id)
                .filter(AppAccount.Id.in_(patient_ids), or_(*filters))
                .all()
            )
            patient_ids = sorted({int(row[0]) for row in matched})

    total = len(patient_ids)
    start = (page - 1) * page_size
    end = start + page_size
    page_ids = patient_ids[start:end]

    stats_map = _batch_patient_consultation_stats(db, page_ids, counselor_account_id)
    rows = [
        pricing_breakdown(
            db,
            pid,
            counselor_account_id,
            consultation_stats=stats_map.get(
                pid,
                {"totalCompletedConsultations": 0, "counselorCompletedConsultations": 0},
            ),
        )
        for pid in page_ids
    ]
    return rows, total


def _account_display_name(account: Optional[AppAccount], fallback_id: int) -> str:
    if not account:
        return f"用户#{fallback_id}"
    return account.RealName or account.Nickname or account.Mobile or f"用户#{fallback_id}"
