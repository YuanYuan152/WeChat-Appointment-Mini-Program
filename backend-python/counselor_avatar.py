"""咨询师对外展示头像（首页 / 预约列表 / 详情），与个人中心账号头像分离。"""

from typing import Optional

# 后端可公开访问的唯一默认头像（static/images，经 /static/ 反代）
DEFAULT_COUNSELOR_PUBLIC_AVATAR = "/static/images/counselor-avatar.png"

_LEGACY_DEFAULT_COUNSELOR_AVATARS = frozenset(
    {
        "/static/images-opt/counselor-avatar.png",
        "/static/images-opt/counselor-avatar.jpg",
    }
)


def resolve_counselor_public_avatar_url(value: Optional[str]) -> str:
    trimmed = (value or "").strip()
    if not trimmed or trimmed in _LEGACY_DEFAULT_COUNSELOR_AVATARS:
        return DEFAULT_COUNSELOR_PUBLIC_AVATAR
    return trimmed
