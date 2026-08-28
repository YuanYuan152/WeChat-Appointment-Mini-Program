"""心理咨询签约协议类型（同心理 / 扬帆 / 启航）。"""
from __future__ import annotations

from typing import Any, Literal, Optional

ConsultationAgreementType = Literal["TONGXIN", "YANGFAN", "QIHANG"]

VALID_AGREEMENT_TYPES = frozenset({"TONGXIN", "YANGFAN", "QIHANG"})

AGREEMENT_TYPE_LABELS: dict[str, str] = {
    "TONGXIN": "同心理咨询协议",
    "YANGFAN": "“扬帆计划”协议",
    "QIHANG": "启航咨询协议",
}


def agreement_type_label(agreement_type: Optional[str]) -> Optional[str]:
    if not agreement_type:
        return None
    return AGREEMENT_TYPE_LABELS.get(str(agreement_type).upper())


def agreement_type_from_legacy_is_adult(is_adult: Optional[bool]) -> Optional[str]:
    if is_adult is True:
        return "TONGXIN"
    if is_adult is False:
        return "YANGFAN"
    return None


def normalize_agreement_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().upper()
    if normalized not in VALID_AGREEMENT_TYPES:
        raise ValueError("无效的签约协议类型")
    return normalized


def resolve_proxy_agreement_type(order: Any) -> Optional[str]:
    raw = getattr(order, "ProxyAgreementType", None)
    if raw:
        try:
            return normalize_agreement_type(raw)
        except ValueError:
            return None
    return agreement_type_from_legacy_is_adult(getattr(order, "ProxyAgreementIsAdult", None))


def resolve_intake_agreement_type(order: Any) -> Optional[str]:
    raw = getattr(order, "IntakeAgreementType", None)
    if raw:
        try:
            return normalize_agreement_type(raw)
        except ValueError:
            return None
    return agreement_type_from_legacy_is_adult(getattr(order, "IntakeIsAdult", None))


def legacy_is_adult_for_agreement_type(agreement_type: Optional[str]) -> Optional[bool]:
    if agreement_type == "TONGXIN":
        return True
    if agreement_type == "YANGFAN":
        return False
    return None


def resolve_push_agreement_type(
    *,
    agreement_type: Optional[str] = None,
    agreement_is_adult: Optional[bool] = None,
) -> Optional[str]:
    if agreement_type:
        return normalize_agreement_type(agreement_type)
    return agreement_type_from_legacy_is_adult(agreement_is_adult)
