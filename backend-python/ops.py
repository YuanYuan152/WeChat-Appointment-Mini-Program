"""
4.1 运营轻后台接口
公开读取（小程序端）
  GET  /api/mini/ops/banners       有效 Banner 列表（按排序）
  GET  /api/mini/ops/activities    有效活动/公告列表

运营管理（需要 Ops 角色）
  POST /api/mini/ops/banners             新增 Banner
  PUT  /api/mini/ops/banners/{id}        更新 Banner
  DELETE /api/mini/ops/banners/{id}      删除 Banner
  POST /api/mini/ops/activities          新增活动/公告
  PUT  /api/mini/ops/activities/{id}     更新活动/公告
  DELETE /api/mini/ops/activities/{id}   删除活动/公告
  GET  /api/mini/ops/users               用户列表（分页搜索）
  GET  /api/mini/ops/users/{id}          用户详情
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_account, AppAccount
from database import get_db
from models import AppBanner, AppActivity, AppArticle, AppOrder, AppRoleBinding
from models import AppAccount as AccountModel

router = APIRouter(prefix="/api/mini/ops", tags=["Ops"])


# ---------------------------------------------------------------------------
# 权限检查
# ---------------------------------------------------------------------------

def require_ops(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    binding = db.query(AppRoleBinding).filter(
        AppRoleBinding.AccountId == current_account.Id,
        AppRoleBinding.RoleType.in_(["Ops", "Admin"]),
    ).first()
    if not binding:
        raise HTTPException(status_code=403, detail="无运营权限")
    return current_account


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BannerCreate(BaseModel):
    title: str
    image_url: str
    link_type: Optional[str] = "PAGE"
    link_value: Optional[str] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class BannerUpdate(BaseModel):
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_type: Optional[str] = None
    link_value: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class BannerOut(BaseModel):
    Id: int
    Title: str
    ImageUrl: str
    LinkType: str
    LinkValue: Optional[str] = None
    SortOrder: int
    IsActive: bool
    StartAt: Optional[datetime] = None
    EndAt: Optional[datetime] = None
    CreatedAt: datetime

    class Config:
        from_attributes = True


class ActivityCreate(BaseModel):
    type: Optional[str] = "NOTICE"
    title: str
    content: Optional[str] = None
    cover_url: Optional[str] = None
    is_active: Optional[bool] = True
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    sort_order: Optional[int] = 0


class ActivityUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    cover_url: Optional[str] = None
    is_active: Optional[bool] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    sort_order: Optional[int] = None


class ActivityOut(BaseModel):
    Id: int
    Type: str
    Title: str
    Content: Optional[str] = None
    CoverUrl: Optional[str] = None
    IsActive: bool
    StartAt: Optional[datetime] = None
    EndAt: Optional[datetime] = None
    SortOrder: int
    CreatedAt: datetime

    class Config:
        from_attributes = True


class ArticlePayload(BaseModel):
    title: str
    category: Optional[str] = "文章"
    summary: Optional[str] = None
    content: Optional[str] = None
    cover_url: Optional[str] = None
    author: Optional[str] = None
    source: Optional[str] = None
    is_top: Optional[bool] = False
    is_active: Optional[bool] = True
    sort_order: Optional[int] = 0
    published_at: Optional[datetime] = None


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    cover_url: Optional[str] = None
    author: Optional[str] = None
    source: Optional[str] = None
    is_top: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    published_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Banner — 公开读取
# ---------------------------------------------------------------------------

@router.get("/banners", response_model=List[BannerOut], summary="获取有效 Banner 列表")
def list_banners_public(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    q = db.query(AppBanner).filter(AppBanner.IsActive == True)
    # 可选时间过滤
    rows = q.order_by(AppBanner.SortOrder.asc(), AppBanner.CreatedAt.desc()).all()
    return [
        r for r in rows
        if (r.StartAt is None or r.StartAt <= now) and (r.EndAt is None or r.EndAt >= now)
    ]


# ---------------------------------------------------------------------------
# Banner — 运营管理
# ---------------------------------------------------------------------------

@router.post("/banners", response_model=BannerOut, summary="新增 Banner（运营）")
def create_banner(
    body: BannerCreate,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    banner = AppBanner(
        Title=body.title,
        ImageUrl=body.image_url,
        LinkType=body.link_type or "PAGE",
        LinkValue=body.link_value,
        SortOrder=body.sort_order or 0,
        IsActive=body.is_active if body.is_active is not None else True,
        StartAt=body.start_at,
        EndAt=body.end_at,
    )
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


@router.put("/banners/{banner_id}", response_model=BannerOut, summary="更新 Banner（运营）")
def update_banner(
    banner_id: int,
    body: BannerUpdate,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    banner = db.query(AppBanner).filter(AppBanner.Id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner 不存在")
    mapping = {
        "title": "Title", "image_url": "ImageUrl", "link_type": "LinkType",
        "link_value": "LinkValue", "sort_order": "SortOrder", "is_active": "IsActive",
        "start_at": "StartAt", "end_at": "EndAt",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(banner, dst, val)
    banner.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(banner)
    return banner


@router.delete("/banners/{banner_id}", summary="删除 Banner（运营）")
def delete_banner(
    banner_id: int,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    banner = db.query(AppBanner).filter(AppBanner.Id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner 不存在")
    db.delete(banner)
    db.commit()
    return {"msg": "已删除"}


# ---------------------------------------------------------------------------
# 活动/公告 — 公开读取
# ---------------------------------------------------------------------------

@router.get("/activities", response_model=List[ActivityOut], summary="获取活动/公告列表")
def list_activities_public(
    type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    q = db.query(AppActivity).filter(AppActivity.IsActive == True)
    if type:
        q = q.filter(AppActivity.Type == type)
    rows = q.order_by(AppActivity.SortOrder.asc(), AppActivity.CreatedAt.desc()).all()
    return [
        r for r in rows
        if (r.StartAt is None or r.StartAt <= now) and (r.EndAt is None or r.EndAt >= now)
    ]


# ---------------------------------------------------------------------------
# 活动/公告 — 运营管理
# ---------------------------------------------------------------------------

@router.post("/activities", response_model=ActivityOut, summary="新增活动/公告（运营）")
def create_activity(
    body: ActivityCreate,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    activity = AppActivity(
        Type=body.type or "NOTICE",
        Title=body.title,
        Content=body.content,
        CoverUrl=body.cover_url,
        IsActive=body.is_active if body.is_active is not None else True,
        StartAt=body.start_at,
        EndAt=body.end_at,
        SortOrder=body.sort_order or 0,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.put("/activities/{activity_id}", response_model=ActivityOut, summary="更新活动/公告（运营）")
def update_activity(
    activity_id: int,
    body: ActivityUpdate,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    activity = db.query(AppActivity).filter(AppActivity.Id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")
    mapping = {
        "type": "Type", "title": "Title", "content": "Content", "cover_url": "CoverUrl",
        "is_active": "IsActive", "start_at": "StartAt", "end_at": "EndAt", "sort_order": "SortOrder",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(activity, dst, val)
    activity.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/activities/{activity_id}", summary="删除活动/公告（运营）")
def delete_activity(
    activity_id: int,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    activity = db.query(AppActivity).filter(AppActivity.Id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")
    db.delete(activity)
    db.commit()
    return {"msg": "已删除"}


# ---------------------------------------------------------------------------
# 文章管理（AppArticle，新内容源）
# ---------------------------------------------------------------------------

def _article_dict(a: AppArticle):
    return {
        "id": a.Id,
        "title": a.Title,
        "category": a.Category,
        "summary": a.Summary,
        "content": a.Content,
        "coverUrl": a.CoverUrl,
        "author": a.Author,
        "source": a.Source,
        "isTop": a.IsTop,
        "isActive": a.IsActive,
        "views": a.Views,
        "sortOrder": a.SortOrder,
        "publishedAt": a.PublishedAt,
        "createdAt": a.CreatedAt,
    }


@router.get("/articles", summary="运营文章列表")
def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    q = db.query(AppArticle)
    total = q.count()
    items = (
        q.order_by(AppArticle.CreatedAt.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "pageSize": page_size, "items": [_article_dict(a) for a in items]}


@router.post("/articles", summary="新增文章")
def create_article(
    body: ArticlePayload,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    article = AppArticle(
        Title=body.title,
        Category=body.category,
        Summary=body.summary,
        Content=body.content,
        CoverUrl=body.cover_url,
        Author=body.author,
        Source=body.source,
        IsTop=body.is_top or False,
        IsActive=body.is_active if body.is_active is not None else True,
        SortOrder=body.sort_order or 0,
        PublishedAt=body.published_at or datetime.utcnow(),
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return _article_dict(article)


@router.put("/articles/{article_id}", summary="更新文章")
def update_article(
    article_id: int,
    body: ArticleUpdate,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    article = db.query(AppArticle).filter(AppArticle.Id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
    mapping = {
        "title": "Title", "category": "Category", "summary": "Summary", "content": "Content",
        "cover_url": "CoverUrl", "author": "Author", "source": "Source", "is_top": "IsTop",
        "is_active": "IsActive", "sort_order": "SortOrder", "published_at": "PublishedAt",
    }
    for src, dst in mapping.items():
        val = getattr(body, src, None)
        if val is not None:
            setattr(article, dst, val)
    article.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(article)
    return _article_dict(article)


@router.delete("/articles/{article_id}", summary="删除文章")
def delete_article(
    article_id: int,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    article = db.query(AppArticle).filter(AppArticle.Id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
    db.delete(article)
    db.commit()
    return {"msg": "已删除"}


@router.get("/dashboard", summary="运营数据看板")
def ops_dashboard(
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    user_count = db.query(AccountModel).count()
    order_count = db.query(AppOrder).count()
    paid_orders = db.query(AppOrder).filter(AppOrder.Status == "PAID").count()
    total_fee = sum((o.TotalFee or 0) for o in db.query(AppOrder).filter(AppOrder.Status == "PAID").all())
    article_count = db.query(AppArticle).count()
    activity_count = db.query(AppActivity).count()
    return {
        "userCount": user_count,
        "orderCount": order_count,
        "paidOrderCount": paid_orders,
        "paidAmount": total_fee,
        "articleCount": article_count,
        "activityCount": activity_count,
    }


# ---------------------------------------------------------------------------
# 用户管理（运营查阅）
# ---------------------------------------------------------------------------

@router.get("/users", summary="用户列表（运营）")
def list_users(
    keyword: Optional[str] = Query(None, description="手机号或昵称关键词"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    q = db.query(AccountModel)
    if keyword:
        q = q.filter(
            AccountModel.Mobile.contains(keyword) |
            AccountModel.Nickname.contains(keyword)
        )
    total = q.count()
    items = q.order_by(AccountModel.Id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "items": [
            {
                "id": u.Id,
                "openId": u.OpenId,
                "mobile": u.Mobile,
                "nickname": u.Nickname,
                "avatarUrl": u.AvatarUrl,
                "createdAt": u.CreatedAt,
            }
            for u in items
        ],
    }


@router.get("/users/{user_id}", summary="用户详情（运营）")
def get_user(
    user_id: int,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    user = db.query(AccountModel).filter(AccountModel.Id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    bindings = db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == user_id).all()
    return {
        "id": user.Id,
        "openId": user.OpenId,
        "mobile": user.Mobile,
        "nickname": user.Nickname,
        "avatarUrl": user.AvatarUrl,
        "createdAt": user.CreatedAt,
        "roles": [b.RoleType for b in bindings],
    }
