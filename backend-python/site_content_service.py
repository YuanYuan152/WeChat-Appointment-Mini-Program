"""站点静态页文案：品牌介绍 / 关于咨询条目 / 公益咨询 / 联系我们 / 首页封面。"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models import AppSiteGuideItem, AppSitePage

SITE_PAGE_KEYS = frozenset({"brand", "charity", "contact", "home"})
SITE_PAGE_LABELS = {
    "brand": "品牌介绍",
    "charity": "公益咨询",
    "contact": "联系我们",
    "home": "首页封面",
}

DEFAULT_HOME_COVER = "/static/images-opt/slide11.jpg"
DEFAULT_HOME_CROP = {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}

DEFAULT_PAGE_BODIES: Dict[str, str] = {
    "brand": (
        "同心理致力于为来访者提供专业、温暖的心理服务，帮助每一位需要支持的人更好地理解自己、照顾自己。\n\n"
        "平台连接专业心理咨询师，以规范、安全和可信赖的服务陪伴来访者面对情绪、关系与成长中的困扰。\n\n"
        "提供心理咨询、心理测评、心理健康科普及相关支持服务；通过清晰的预约流程和持续的服务保障，让专业心理支持更容易获得。\n\n"
        "尊重每一份真实感受，重视每一次真诚连接，以专业守护信任，以温暖陪伴成长。"
    ),
    "charity": (
        "公益咨询是同心理面向有心理支持需求、但经济压力较大的来访者推出的低价咨询项目。\n\n"
        "参与本项目的咨询师为受训中的实习或新手心理咨询师，在督导师的督导下以公益价格独立接待个案。\n\n"
        "来访者需本人申请，经评估筛选，符合要求方能参与本项目。符合要求的来访者可获得 30 次或为期一年的低价公益咨询（满足其一即算期满）。\n\n"
        "如需了解当前开放名额与申请方式，可通过「联系我们」与咨询助理沟通。"
    ),
    "contact": (
        "欢迎通过下方咨询中心地址、助理微信或电话与我们取得联系。\n\n"
        "咨询助理工作时间为工作日 9:00–18:00，我们会在工作时间内尽快回复您的留言。"
    ),
    "home": "专业.温暖的心理服务平台",
}

DEFAULT_GUIDE_ITEMS: List[Dict[str, str]] = [
    {
        "title": "什么是心理咨询",
        "body": "心理咨询是来访者与专业咨询师在保密、尊重的关系中，共同探讨情绪、关系与成长议题的专业支持过程。",
    },
    {
        "title": "咨询流程是怎样的",
        "body": "从预约、首次访谈、持续咨询到结束，每一步都有清晰说明。首次访谈后咨询师会与您讨论初步计划。",
    },
    {
        "title": "适合哪些人寻求咨询",
        "body": "情绪困扰、关系难题、成长议题——当您感到难以独自应对时，都可以考虑寻求专业支持。",
    },
    {
        "title": "费用与时长说明",
        "body": "每次咨询通常为 50 分钟标准节次，具体费用与改期取消规则以预约页面及协议说明为准。",
    },
]


def _parse_cover_crop(raw: Optional[str]) -> Dict[str, float]:
    if not raw:
        return dict(DEFAULT_HOME_CROP)
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return dict(DEFAULT_HOME_CROP)
        x = float(data.get("x", 0))
        y = float(data.get("y", 0))
        width = float(data.get("width", 1))
        height = float(data.get("height", 1))
        if width <= 0 or height <= 0:
            return dict(DEFAULT_HOME_CROP)
        return {
            "x": max(0.0, min(1.0, x)),
            "y": max(0.0, min(1.0, y)),
            "width": max(0.01, min(1.0, width)),
            "height": max(0.01, min(1.0, height)),
        }
    except (TypeError, ValueError, json.JSONDecodeError):
        return dict(DEFAULT_HOME_CROP)


def _serialize_cover_crop(crop: Optional[Dict[str, Any]]) -> Optional[str]:
    if not crop:
        return None
    normalized = _parse_cover_crop(json.dumps(crop))
    return json.dumps(normalized, separators=(",", ":"))


def _page_to_dict(row: AppSitePage) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": row.Id,
        "pageKey": row.PageKey,
        "title": row.Title or SITE_PAGE_LABELS.get(row.PageKey, row.PageKey),
        "body": row.Body or "",
        "updatedAt": row.UpdatedAt or row.CreatedAt,
    }
    if row.PageKey == "contact":
        out["assistantQrcodeUrl"] = row.AssistantQrcodeUrl or None
    if row.PageKey == "home":
        out["coverImageUrl"] = row.CoverImageUrl or None
        out["coverCrop"] = _parse_cover_crop(row.CoverCropJson)
    return out


def _guide_to_dict(row: AppSiteGuideItem, *, include_body: bool = False) -> Dict[str, Any]:
    body = row.Body or ""
    out: Dict[str, Any] = {
        "id": row.Id,
        "title": row.Title,
        "sortOrder": row.SortOrder,
        "isActive": bool(row.IsActive),
        "updatedAt": row.UpdatedAt or row.CreatedAt,
    }
    if include_body:
        out["body"] = body
    else:
        summary = body.replace("\n", " ").strip()
        out["summary"] = summary[:120] + ("…" if len(summary) > 120 else "")
    return out


def ensure_default_site_content(db: Session) -> None:
    """首次访问时写入默认文案，便于后台直接编辑。"""
    for key in SITE_PAGE_KEYS:
        exists = db.query(AppSitePage.Id).filter(AppSitePage.PageKey == key).first()
        if exists:
            continue
        row = AppSitePage(
            PageKey=key,
            Title=SITE_PAGE_LABELS[key],
            Body=DEFAULT_PAGE_BODIES.get(key, ""),
        )
        if key == "home":
            row.CoverImageUrl = DEFAULT_HOME_COVER
            row.CoverCropJson = _serialize_cover_crop(DEFAULT_HOME_CROP)
        db.add(row)
    if not db.query(AppSiteGuideItem.Id).first():
        for idx, item in enumerate(DEFAULT_GUIDE_ITEMS):
            db.add(
                AppSiteGuideItem(
                    Title=item["title"],
                    Body=item["body"],
                    SortOrder=idx,
                    IsActive=True,
                )
            )
    db.flush()


def list_site_pages_manage(db: Session) -> List[Dict[str, Any]]:
    ensure_default_site_content(db)
    db.commit()
    rows = db.query(AppSitePage).order_by(AppSitePage.PageKey.asc()).all()
    return [_page_to_dict(row) for row in rows]


def upsert_site_page(
    db: Session,
    page_key: str,
    *,
    body: str,
    title: Optional[str] = None,
    account_id: Optional[int] = None,
    assistant_qrcode_url: Optional[str] = None,
    update_assistant_qrcode: bool = False,
    cover_image_url: Optional[str] = None,
    cover_crop: Optional[Dict[str, Any]] = None,
    update_cover: bool = False,
) -> Dict[str, Any]:
    key = (page_key or "").strip().lower()
    if key not in SITE_PAGE_KEYS:
        raise ValueError("无效的站点页类型")
    row = db.query(AppSitePage).filter(AppSitePage.PageKey == key).first()
    if not row:
        row = AppSitePage(PageKey=key)
        db.add(row)

    if key == "home":
        text = (body or "").strip() or DEFAULT_PAGE_BODIES["home"]
        row.Body = text
        row.Title = (title or "同心理").strip() or "同心理"
        if update_cover:
            image = (cover_image_url or "").strip()
            if not image:
                raise ValueError("请上传首页封面图片")
            row.CoverImageUrl = image
            row.CoverCropJson = _serialize_cover_crop(cover_crop or DEFAULT_HOME_CROP)
    else:
        text = (body or "").strip()
        if not text:
            raise ValueError("请填写正文")
        row.Title = (title or SITE_PAGE_LABELS[key]).strip() or SITE_PAGE_LABELS[key]
        row.Body = text
        if key == "contact" and update_assistant_qrcode:
            row.AssistantQrcodeUrl = (assistant_qrcode_url or "").strip() or None

    row.UpdatedByAccountId = account_id
    row.UpdatedAt = datetime.utcnow()
    db.flush()
    return _page_to_dict(row)


def list_site_guide_items_manage(db: Session) -> List[Dict[str, Any]]:
    ensure_default_site_content(db)
    db.commit()
    rows = (
        db.query(AppSiteGuideItem)
        .order_by(AppSiteGuideItem.SortOrder.asc(), AppSiteGuideItem.Id.asc())
        .all()
    )
    return [_guide_to_dict(row, include_body=True) for row in rows]


def create_site_guide_item(
    db: Session,
    *,
    title: str,
    body: str,
    sort_order: Optional[int] = None,
) -> Dict[str, Any]:
    topic = (title or "").strip()
    text = (body or "").strip()
    if not topic:
        raise ValueError("请填写主题")
    if not text:
        raise ValueError("请填写正文")
    if sort_order is None:
        max_order = db.query(AppSiteGuideItem.SortOrder).order_by(AppSiteGuideItem.SortOrder.desc()).first()
        sort_order = (max_order[0] + 1) if max_order else 0
    row = AppSiteGuideItem(
        Title=topic,
        Body=text,
        SortOrder=int(sort_order),
        IsActive=True,
    )
    db.add(row)
    db.flush()
    return _guide_to_dict(row, include_body=True)


def update_site_guide_item(
    db: Session,
    item_id: int,
    *,
    title: Optional[str] = None,
    body: Optional[str] = None,
    sort_order: Optional[int] = None,
    is_active: Optional[bool] = None,
) -> Dict[str, Any]:
    row = db.query(AppSiteGuideItem).filter(AppSiteGuideItem.Id == item_id).first()
    if not row:
        raise ValueError("关于咨询条目不存在")
    if title is not None:
        topic = title.strip()
        if not topic:
            raise ValueError("请填写主题")
        row.Title = topic
    if body is not None:
        text = body.strip()
        if not text:
            raise ValueError("请填写正文")
        row.Body = text
    if sort_order is not None:
        row.SortOrder = int(sort_order)
    if is_active is not None:
        row.IsActive = bool(is_active)
    row.UpdatedAt = datetime.utcnow()
    db.flush()
    return _guide_to_dict(row, include_body=True)


def delete_site_guide_item(db: Session, item_id: int) -> None:
    row = db.query(AppSiteGuideItem).filter(AppSiteGuideItem.Id == item_id).first()
    if not row:
        raise ValueError("关于咨询条目不存在")
    db.delete(row)
    db.flush()


def public_site_content(db: Session) -> Dict[str, Any]:
    ensure_default_site_content(db)
    db.commit()
    pages = {
        row.PageKey: _page_to_dict(row)
        for row in db.query(AppSitePage).filter(AppSitePage.PageKey.in_(SITE_PAGE_KEYS)).all()
    }
    guide_items = [
        _guide_to_dict(row)
        for row in (
            db.query(AppSiteGuideItem)
            .filter(AppSiteGuideItem.IsActive == True)
            .order_by(AppSiteGuideItem.SortOrder.asc(), AppSiteGuideItem.Id.asc())
            .all()
        )
    ]
    return {"pages": pages, "guideItems": guide_items}


def public_site_guide_item(db: Session, item_id: int) -> Optional[Dict[str, Any]]:
    row = (
        db.query(AppSiteGuideItem)
        .filter(AppSiteGuideItem.Id == item_id, AppSiteGuideItem.IsActive == True)
        .first()
    )
    if not row:
        return None
    return _guide_to_dict(row, include_body=True)
