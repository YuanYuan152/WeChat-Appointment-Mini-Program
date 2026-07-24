"""用户自选偏好标签（个人人群 / 感兴趣的心理问题）。"""

from datetime import datetime
from typing import Iterable, List, Tuple

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from models import AppAccount, AppUserPreferenceTag

PERSONAL_TAG_OPTIONS = [
    "学生",
    "职场人士",
    "宝妈/宝爸",
    "创业者",
    "退休人群",
    "情感困惑者",
    "青少年",
    "其他",
]

INTEREST_TAG_OPTIONS = [
    "焦虑与压力",
    "抑郁情绪",
    "人际关系",
    "亲密关系",
    "亲子教育",
    "自我成长",
    "睡眠问题",
    "职场心理",
    "情绪管理",
    "创伤疗愈",
]

TAG_CATEGORY_PERSONAL = "personal"
TAG_CATEGORY_INTEREST = "interest"
MAX_TAGS_PER_CATEGORY = 5


def has_preference_tags(account: AppAccount) -> bool:
    try:
        return account.PreferenceTagsCompletedAt is not None
    except SQLAlchemyError:
        return False


def get_account_tags(db: Session, account_id: int) -> Tuple[List[str], List[str]]:
    rows = (
        db.query(AppUserPreferenceTag)
        .filter(AppUserPreferenceTag.AccountId == account_id)
        .order_by(AppUserPreferenceTag.Id.asc())
        .all()
    )
    personal = [row.Tag for row in rows if row.Category == TAG_CATEGORY_PERSONAL]
    interest = [row.Tag for row in rows if row.Category == TAG_CATEGORY_INTEREST]
    return personal, interest


def _validate_tag_selection(tags: Iterable[str], allowed: List[str], label: str) -> List[str]:
    selected = []
    seen = set()
    for tag in tags:
        value = (tag or "").strip()
        if not value or value in seen:
            continue
        if value not in allowed:
            raise HTTPException(status_code=400, detail=f"「{value}」不是有效的{label}")
        seen.add(value)
        selected.append(value)

    if not selected:
        raise HTTPException(status_code=400, detail=f"请至少选择 1 个{label}")
    if len(selected) > MAX_TAGS_PER_CATEGORY:
        raise HTTPException(status_code=400, detail=f"{label}最多选择 {MAX_TAGS_PER_CATEGORY} 个")
    return selected


def save_preference_tags(
    db: Session,
    account: AppAccount,
    personal_tags: List[str],
    interest_tags: List[str],
) -> Tuple[List[str], List[str]]:
    if has_preference_tags(account):
        raise HTTPException(status_code=409, detail="您已填写过偏好标签")

    personal = _validate_tag_selection(personal_tags, PERSONAL_TAG_OPTIONS, "个人标签")
    interest = _validate_tag_selection(interest_tags, INTEREST_TAG_OPTIONS, "感兴趣的心理问题")

    for tag in personal:
        db.add(
            AppUserPreferenceTag(
                AccountId=account.Id,
                Category=TAG_CATEGORY_PERSONAL,
                Tag=tag,
            )
        )
    for tag in interest:
        db.add(
            AppUserPreferenceTag(
                AccountId=account.Id,
                Category=TAG_CATEGORY_INTEREST,
                Tag=tag,
            )
        )

    try:
        account.PreferenceTagsCompletedAt = datetime.utcnow()
    except SQLAlchemyError:
        pass
    account.UpdatedAt = datetime.utcnow()
    db.commit()
    return personal, interest


def get_tag_options() -> dict:
    return {
        "personalTags": PERSONAL_TAG_OPTIONS,
        "interestTags": INTEREST_TAG_OPTIONS,
        "maxPerCategory": MAX_TAGS_PER_CATEGORY,
    }
