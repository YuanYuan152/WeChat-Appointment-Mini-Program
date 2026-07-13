"""定价与抽成调整成功后的工作人员/咨询师站内消息。"""
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from counselor_message_service import _message_payload, _notify_counselor
from models import AppAccount, AppCounselorPatientPricing
from pricing_service import SHARE_MODE_AMOUNT, SHARE_MODE_PERCENT, get_counselor_profile
from role_active import get_account_role
from staff_message_service import _account_display_name, notify_staff_workbench_inbox
from staff_roles import STAFF_WORKBENCH_ROLES, role_display_name

RELATED_TYPE_BASE_PRICE = "PRICING_COUNSELOR_BASE_UPDATED"
RELATED_TYPE_PATIENT_PRICE = "PRICING_PATIENT_PRICE_UPDATED"
RELATED_TYPE_PATIENT_SHARE = "PRICING_PATIENT_SHARE_UPDATED"


def _counselor_name(db: Session, counselor_id: int) -> str:
    profile = get_counselor_profile(db, counselor_id)
    if profile and profile.Name:
        return profile.Name
    return _account_display_name(db, counselor_id)


def _patient_name(db: Session, patient_id: int) -> str:
    acc = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not acc:
        return "来访者"
    return acc.RealName or acc.Nickname or acc.Mobile or "来访者"


def _actor_label(db: Session, actor_id: int) -> str:
    role = get_account_role(db, actor_id) or ""
    name = _account_display_name(db, actor_id)
    if role in STAFF_WORKBENCH_ROLES:
        return f"{role_display_name(role)}{name}"
    return name


def _share_snapshot(row: Optional[AppCounselorPatientPricing]) -> Dict[str, Any]:
    if not row:
        return {"shareMode": None, "revenueShareCents": None, "revenueSharePercent": None}
    return {
        "shareMode": row.ShareMode,
        "revenueShareCents": row.RevenueShareCents,
        "revenueSharePercent": row.RevenueSharePercent,
    }


def _share_changed(
    before: Dict[str, Any],
    after: Dict[str, Any],
) -> bool:
    return (
        before.get("shareMode") != after.get("shareMode")
        or before.get("revenueShareCents") != after.get("revenueShareCents")
        or before.get("revenueSharePercent") != after.get("revenueSharePercent")
    )


def _format_share_text(share: Dict[str, Any], *, display_yuan: Optional[int] = None) -> str:
    mode = share.get("shareMode")
    if mode == SHARE_MODE_PERCENT:
        percent = share.get("revenueSharePercent")
        return f"抽成比例 {percent}%" if percent is not None else "抽成比例已调整"
    if mode == SHARE_MODE_AMOUNT:
        cents = share.get("revenueShareCents")
        if cents is not None:
            return f"抽成金额 ¥{cents // 100}"
        return "抽成金额已调整"
    if display_yuan is not None:
        return f"默认抽成（展示价 ¥{display_yuan} 的 50%）"
    return "默认抽成比例"


def notify_counselor_base_pricing_updated(
    db: Session,
    *,
    actor_id: int,
    counselor_id: int,
    old_base_yuan: int,
    new_base_yuan: int,
    before_share: Dict[str, Any],
    after_share: Dict[str, Any],
) -> None:
    counselor_name = _counselor_name(db, counselor_id)
    actor = _actor_label(db, actor_id)

    parts: list[str] = []
    if old_base_yuan != new_base_yuan:
        parts.append(f"基础价格由 ¥{old_base_yuan} 修改为 ¥{new_base_yuan}")
    if _share_changed(before_share, after_share):
        parts.append(
            f"默认分成调整为 {_format_share_text(after_share, display_yuan=new_base_yuan)}"
        )
    if not parts:
        return

    change_text = "；".join(parts)
    staff_summary = f"{actor}已将{counselor_name}咨询师针对所有来访的{change_text}"
    counselor_summary = f"针对所有来访{change_text}"
    detail: Dict[str, Any] = {
        "actorId": actor_id,
        "actorLabel": actor,
        "counselorId": counselor_id,
        "counselorName": counselor_name,
        "oldBasePriceYuan": old_base_yuan,
        "newBasePriceYuan": new_base_yuan,
        "beforeShare": before_share,
        "afterShare": after_share,
        "messageText": staff_summary,
        "counselorMessageText": counselor_summary,
        "changeKind": "BASE_PRICING",
    }
    notify_staff_workbench_inbox(
        db,
        type_="SYSTEM",
        title="基础定价调整成功",
        content=_message_payload(staff_summary, detail),
        related_type=RELATED_TYPE_BASE_PRICE,
        related_id=counselor_id,
    )
    _notify_counselor(
        db,
        counselor_id,
        type_="SYSTEM",
        title="基础定价已修改",
        content=_message_payload(counselor_summary, detail),
        related_type=RELATED_TYPE_BASE_PRICE,
        related_id=counselor_id,
    )


def notify_counselor_base_price_updated(
    db: Session,
    *,
    actor_id: int,
    counselor_id: int,
    old_base_yuan: int,
    new_base_yuan: int,
) -> None:
    notify_counselor_base_pricing_updated(
        db,
        actor_id=actor_id,
        counselor_id=counselor_id,
        old_base_yuan=old_base_yuan,
        new_base_yuan=new_base_yuan,
        before_share={"shareMode": None, "revenueShareCents": None, "revenueSharePercent": None},
        after_share={"shareMode": None, "revenueShareCents": None, "revenueSharePercent": None},
    )


def notify_patient_price_adjustment_updated(
    db: Session,
    *,
    actor_id: int,
    counselor_id: int,
    patient_id: int,
    breakdown: Dict[str, Any],
) -> None:
    counselor_name = _counselor_name(db, counselor_id)
    patient_name = _patient_name(db, patient_id)
    actor = _actor_label(db, actor_id)
    display_yuan = int(breakdown.get("displayPriceYuan") or 0)
    adjustment_yuan = int(breakdown.get("adjustmentYuan") or 0)

    staff_summary = (
        f"{actor}为{counselor_name}咨询师的{patient_name}来访改价成功，"
        f"现展示价 ¥{display_yuan}（调价 ¥{adjustment_yuan}）"
    )
    counselor_summary = f"针对来访{patient_name}已调价成功"
    detail: Dict[str, Any] = {
        "actorId": actor_id,
        "actorLabel": actor,
        "counselorId": counselor_id,
        "counselorName": counselor_name,
        "patientId": patient_id,
        "patientName": patient_name,
        "displayPriceYuan": display_yuan,
        "adjustmentYuan": adjustment_yuan,
        "basePriceYuan": breakdown.get("basePriceYuan"),
        "messageText": staff_summary,
        "counselorMessageText": counselor_summary,
        "changeKind": "PATIENT_PRICE",
    }
    notify_staff_workbench_inbox(
        db,
        type_="SYSTEM",
        title="来访调价成功",
        content=_message_payload(staff_summary, detail),
        related_type=RELATED_TYPE_PATIENT_PRICE,
        related_id=patient_id,
    )
    _notify_counselor(
        db,
        counselor_id,
        type_="SYSTEM",
        title="来访调价成功",
        content=_message_payload(counselor_summary, detail),
        related_type=RELATED_TYPE_PATIENT_PRICE,
        related_id=patient_id,
    )


def notify_patient_share_updated(
    db: Session,
    *,
    actor_id: int,
    counselor_id: int,
    patient_id: int,
    breakdown: Dict[str, Any],
    share_after: Dict[str, Any],
) -> None:
    counselor_name = _counselor_name(db, counselor_id)
    patient_name = _patient_name(db, patient_id)
    actor = _actor_label(db, actor_id)
    display_yuan = int(breakdown.get("displayPriceYuan") or 0)
    share_text = _format_share_text(share_after, display_yuan=display_yuan)

    staff_summary = (
        f"{actor}已将{counselor_name}咨询师针对来访{patient_name}的{share_text}调整成功"
    )
    counselor_summary = f"针对来访{patient_name}{share_text}已调整"
    detail: Dict[str, Any] = {
        "actorId": actor_id,
        "actorLabel": actor,
        "counselorId": counselor_id,
        "counselorName": counselor_name,
        "patientId": patient_id,
        "patientName": patient_name,
        "displayPriceYuan": display_yuan,
        "revenueShareYuan": breakdown.get("revenueShareYuan"),
        "shareMode": share_after.get("shareMode"),
        "revenueSharePercent": share_after.get("revenueSharePercent"),
        "revenueShareCents": share_after.get("revenueShareCents"),
        "shareText": share_text,
        "messageText": staff_summary,
        "counselorMessageText": counselor_summary,
        "changeKind": "PATIENT_SHARE",
    }
    notify_staff_workbench_inbox(
        db,
        type_="SYSTEM",
        title="抽成比例调整成功",
        content=_message_payload(staff_summary, detail),
        related_type=RELATED_TYPE_PATIENT_SHARE,
        related_id=patient_id,
    )
    _notify_counselor(
        db,
        counselor_id,
        type_="SYSTEM",
        title="抽成已调整",
        content=_message_payload(counselor_summary, detail),
        related_type=RELATED_TYPE_PATIENT_SHARE,
        related_id=patient_id,
    )


def notify_pricing_updates_after_patient_save(
    db: Session,
    *,
    actor_id: int,
    counselor_id: int,
    patient_id: int,
    before_manual_cents: int,
    before_share: Dict[str, Any],
    after_breakdown: Dict[str, Any],
) -> None:
    after_manual = int(after_breakdown.get("manualAdjustmentCents") or 0)

    share_after = {
        "shareMode": after_breakdown.get("shareMode"),
        "revenueShareCents": after_breakdown.get("revenueShareAmountCents"),
        "revenueSharePercent": after_breakdown.get("revenueSharePercent"),
    }

    if before_manual_cents != after_manual:
        notify_patient_price_adjustment_updated(
            db,
            actor_id=actor_id,
            counselor_id=counselor_id,
            patient_id=patient_id,
            breakdown=after_breakdown,
        )
    if _share_changed(before_share, share_after):
        notify_patient_share_updated(
            db,
            actor_id=actor_id,
            counselor_id=counselor_id,
            patient_id=patient_id,
            breakdown=after_breakdown,
            share_after=share_after,
        )
