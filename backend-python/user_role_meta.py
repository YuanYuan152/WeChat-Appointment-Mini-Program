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
        raise ValueError("请选择来访来源")
    return code


def validate_counselor_type(code: Optional[str]) -> str:
    if code not in COUNSELOR_TYPES:
        raise ValueError("请选择咨询师类型")
    return code
