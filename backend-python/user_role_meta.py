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

# 角色&权限绑定列表：一级角色分组
ADMIN_ROLE_GROUPS = {
    "counselor": frozenset({"Counselor"}),
    "patient": frozenset({"Patient"}),
    "staff": frozenset({"Assistant", "Ops", "Admin", "Tester"}),
}

VALID_ADMIN_ROLE_GROUPS = frozenset(ADMIN_ROLE_GROUPS.keys())

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


def normalize_admin_user_list_filters(
    role_group: Optional[str],
    subtype: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """校验并规范化用户列表的角色分组 / 二级类型筛选参数。"""
    group = (role_group or "").strip().lower() or None
    sub = (subtype or "").strip().upper() or None
    if group and group not in VALID_ADMIN_ROLE_GROUPS:
        raise ValueError("无效的角色分组")
    if sub and not group:
        raise ValueError("请先选择角色分组")
    if sub and group == "staff":
        raise ValueError("后台管理者不支持二级类型筛选")
    if sub and group == "counselor" and sub not in COUNSELOR_TYPES:
        raise ValueError("无效的咨询师类型")
    if sub and group == "patient" and sub not in PATIENT_SOURCES:
        raise ValueError("无效的来访类型")
    return group, sub
