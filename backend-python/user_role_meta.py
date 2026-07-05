"""添加用户时的来访来源 / 咨询师类型常量。"""

from typing import Optional

PATIENT_SOURCES = {
    "MINI_PROGRAM": "小程序注册",
    "CHARITY_VISITOR": "公益来访",
    "CHARITY_PROJECT_1": "公益项目1",
    "CHARITY_PROJECT_2": "公益项目2",
    "HOSPITAL": "医院",
}

# 可查看公益咨询师的来访来源
CHARITY_PATIENT_SOURCES = frozenset({
    "CHARITY_VISITOR",
    "CHARITY_PROJECT_1",
    "CHARITY_PROJECT_2",
})

COUNSELOR_TYPES = {
    "CHARITY": "公益咨询师",
    "PROFESSIONAL": "专业咨询师",
}


def patient_source_label(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    return PATIENT_SOURCES.get(code, code)


def counselor_type_label(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    return COUNSELOR_TYPES.get(code, code)


def is_charity_patient_source(code: Optional[str]) -> bool:
    return (code or "") in CHARITY_PATIENT_SOURCES


def counselor_visible_to_patient(
    counselor_type: Optional[str],
    patient_source: Optional[str],
) -> bool:
    """公益咨询师仅对公益来访可见；专业咨询师对所有来访可见。"""
    ctype = (counselor_type or "") or "PROFESSIONAL"
    if ctype != "CHARITY":
        return True
    return is_charity_patient_source(patient_source)


def validate_patient_source(code: Optional[str]) -> str:
    if code not in PATIENT_SOURCES:
        raise ValueError("请选择来访来源")
    return code


def validate_counselor_type(code: Optional[str]) -> str:
    if code not in COUNSELOR_TYPES:
        raise ValueError("请选择咨询师类型")
    return code
