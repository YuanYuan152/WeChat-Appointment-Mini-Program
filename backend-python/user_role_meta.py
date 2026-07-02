"""添加用户时的来访来源 / 咨询师类型常量。"""

from typing import Optional

PATIENT_SOURCES = {
    "MINI_PROGRAM": "小程序注册",
    "CHARITY_PROJECT_1": "公益项目1",
    "CHARITY_PROJECT_2": "公益项目2",
    "HOSPITAL": "医院",
}

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


def validate_patient_source(code: Optional[str]) -> str:
    if code not in PATIENT_SOURCES:
        raise ValueError("请选择来访来源")
    return code


def validate_counselor_type(code: Optional[str]) -> str:
    if code not in COUNSELOR_TYPES:
        raise ValueError("请选择咨询师类型")
    return code
