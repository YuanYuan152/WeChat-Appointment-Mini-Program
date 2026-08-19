"""咨询师对外展示头像（首页 / 预约列表 / 详情），与个人中心账号头像分离。"""

from typing import Optional

DEFAULT_COUNSELOR_PUBLIC_AVATAR = "/static/images-opt/counselor-avatar.png"


def resolve_counselor_public_avatar_url(value: Optional[str]) -> str:
    trimmed = (value or "").strip()
    return trimmed or DEFAULT_COUNSELOR_PUBLIC_AVATAR
