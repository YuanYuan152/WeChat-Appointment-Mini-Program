"""添加用户时的来访类别 / 咨询师类型常量。"""

from typing import Optional

PATIENT_SOURCES = {
    "CHARITY": "公益",
    "PROFESSIONAL": "正价",
    "HOSPITAL": "医院",
}

# 历史值仅用于兼容读取和业务判断；新写入统一使用上面的三值。
LEGACY_PATIENT_SOURCE_ALIASES = {
    "MINI_PROGRAM": "PROFESSIONAL",
    "CHARITY_VISITOR": "CHARITY",
    "CHARITY_PROJECT_1": "CHARITY",
    "CHARITY_PROJECT_2": "CHARITY",
}

# 库内原始来源码（含历史别名），供 SQL PatientSource.in_(...) 判断公益来访
CHARITY_PATIENT_SOURCES = frozenset(
    {"CHARITY", *(code for code, norm in LEGACY_PATIENT_SOURCE_ALIASES.items() if norm == "CHARITY")}
)
PATIENT_SOURCE_DETAILS = (
    "小红书",
    "大众点评",
    "公众号",
    "医院转出",
    "来访推荐",
    "老来访",
    "医生推荐",
    "其他",
)

COUNSELOR_TYPES = {
    "CHARITY": "公益咨询师",
    "PROFESSIONAL": "专业咨询师",
}

# 心理咨询列表/详情：以下角色可见全部咨询师（含公益）
COUNSELOR_DIRECTORY_FULL_VISIBILITY_ROLES = frozenset({
    "Counselor",
    "Assistant",
    "Ops",
    "Admin",
})


def patient_source_label(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    normalized = normalize_patient_source(code)
    return PATIENT_SOURCES.get(normalized, code)


def normalize_patient_source(code: Optional[str]) -> Optional[str]:
    """对外统一三值，但不要求迁移数据库中的历史来源。"""
    if not code:
        return None
    return LEGACY_PATIENT_SOURCE_ALIASES.get(code, code)


def counselor_type_label(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    return COUNSELOR_TYPES.get(code, code)


def is_charity_patient_source(code: Optional[str]) -> bool:
    return normalize_patient_source(code) == "CHARITY"


def counselor_visible_to_patient(
    counselor_type: Optional[str],
    patient_source: Optional[str],
) -> bool:
    """心理咨询列表/详情/预约：专业与公益咨询师对所有来访来源均可见。"""
    _ = counselor_type, patient_source
    return True


def can_view_all_counselors_in_directory(viewer_role: Optional[str]) -> bool:
    return (viewer_role or "") in COUNSELOR_DIRECTORY_FULL_VISIBILITY_ROLES


def counselor_visible_to_viewer(
    counselor_type: Optional[str],
    patient_source: Optional[str],
    viewer_role: Optional[str] = None,
) -> bool:
    """心理咨询模块列表/详情可见性：全部咨询师对所有用户可见。"""
    _ = counselor_type, patient_source, viewer_role
    return True


def validate_patient_source(code: Optional[str]) -> str:
    if code not in PATIENT_SOURCES:
        raise ValueError("请选择来访类别")
    return code


def validate_patient_source_detail(value: Optional[str]) -> Optional[str]:
    detail = (value or "").strip()
    if not detail:
        return None
    if detail not in PATIENT_SOURCE_DETAILS:
        raise ValueError("请选择有效的来访来源")
    return detail


def validate_counselor_type(code: Optional[str]) -> str:
    if code not in COUNSELOR_TYPES:
        raise ValueError("请选择咨询师类型")
    return code
