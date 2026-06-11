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

from datetime import datetime, time, date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_account, AppAccount
from database import get_db
from models import (
    AppBanner, AppActivity, AppArticle, AppOrder, AppRoleBinding,
    AppAccount as AccountModel, AppSchedule, AppCounselorProfile,
    AppConsultation, AppConsultationRoom,
)
from app_time import china_now
from schedule_meta import (
    center_display_name, room_display_name, get_consultation_rooms,
    get_all_consultation_rooms, CENTER_NAMES, parse_center_id, parse_room_id,
)

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


@router.get("/banners/manage", response_model=List[BannerOut], summary="Banner 管理列表（含停用）")
def list_banners_manage(
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    return (
        db.query(AppBanner)
        .order_by(AppBanner.SortOrder.asc(), AppBanner.CreatedAt.desc())
        .all()
    )


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


# ---------------------------------------------------------------------------
# 挂课总览 / 咨询室管理
# ---------------------------------------------------------------------------

def _counselor_name(db: Session, counselor_id: int) -> str:
    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if profile and profile.Name:
        return profile.Name
    acc = db.query(AccountModel).filter(AccountModel.Id == counselor_id).first()
    return acc.Nickname if acc and acc.Nickname else f"咨询师#{counselor_id}"


def _schedule_patient_name(db: Session, schedule_id: int) -> Optional[str]:
    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule_id,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if not consultation:
        return None
    patient = db.query(AccountModel).filter(AccountModel.Id == consultation.PatientId).first()
    return patient.Nickname if patient else None


def _room_occupancy_at(
    db: Session,
    center_id: str,
    room_code: str,
    at_time: datetime,
    manual_status: str,
) -> dict:
    if manual_status == "DISABLED":
        return {"occupancy": "DISABLED", "label": "已停用"}
    if manual_status == "MAINTENANCE":
        return {"occupancy": "MAINTENANCE", "label": "维护中"}

    rows = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.StartTime <= at_time,
            AppSchedule.EndTime > at_time,
            AppSchedule.Status != "CANCELLED",
        )
        .all()
    )
    for s in rows:
        if parse_center_id(s.Note) != center_id or parse_room_id(s.Note) != room_code:
            continue
        patient_name = _schedule_patient_name(db, s.Id)
        counselor_name = _counselor_name(db, s.CounselorId)
        if s.Status == "BOOKED" or patient_name:
            return {
                "occupancy": "IN_SESSION",
                "label": "咨询中",
                "scheduleId": s.Id,
                "counselorId": s.CounselorId,
                "counselorName": counselor_name,
                "patientName": patient_name,
                "startTime": s.StartTime,
                "endTime": s.EndTime,
                "scheduleStatus": s.Status,
            }
        return {
            "occupancy": "RESERVED",
            "label": "已挂课",
            "scheduleId": s.Id,
            "counselorId": s.CounselorId,
            "counselorName": counselor_name,
            "patientName": patient_name,
            "startTime": s.StartTime,
            "endTime": s.EndTime,
            "scheduleStatus": s.Status,
        }
    return {"occupancy": "IDLE", "label": "空闲"}


@router.get("/schedules/overview", summary="各咨询师挂课总览")
def ops_schedules_overview(
    date: Optional[str] = Query(None, description="YYYY-MM-DD，默认今天"),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    if date:
        try:
            day = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
    else:
        day = china_now().date()

    day_start = datetime.combine(day, time.min)
    day_end = datetime.combine(day, time.max)

    schedules = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.StartTime >= day_start,
            AppSchedule.StartTime <= day_end,
            AppSchedule.Status != "CANCELLED",
        )
        .order_by(AppSchedule.StartTime)
        .all()
    )

    counselors = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.IsActive == True)
        .order_by(AppCounselorProfile.Name)
        .all()
    )
    if not counselors:
        counselor_ids = sorted({s.CounselorId for s in schedules})
        counselors = [
            type("CP", (), {"AccountId": cid, "Name": None})()
            for cid in counselor_ids
        ]

    result = []
    for cp in counselors:
        cid = cp.AccountId
        items = []
        for s in schedules:
            if s.CounselorId != cid:
                continue
            center_id = parse_center_id(s.Note)
            room_id = parse_room_id(s.Note)
            items.append({
                "scheduleId": s.Id,
                "startTime": s.StartTime,
                "endTime": s.EndTime,
                "status": s.Status,
                "centerId": center_id,
                "centerName": center_display_name(center_id),
                "roomId": room_id,
                "roomName": room_display_name(center_id, room_id, db),
                "patientName": _schedule_patient_name(db, s.Id),
            })
        result.append({
            "counselorId": cid,
            "counselorName": cp.Name or _counselor_name(db, cid),
            "scheduleCount": len(items),
            "schedules": items,
        })
    return {"date": day.isoformat(), "counselors": result}


class RoomCreate(BaseModel):
    center_id: str
    name: str
    room_code: Optional[str] = None
    status: Optional[str] = "AVAILABLE"
    sort_order: Optional[int] = 0


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    sort_order: Optional[int] = None


@router.get("/rooms", summary="咨询室列表")
def list_rooms(
    center_id: Optional[str] = Query(None),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    rooms = get_all_consultation_rooms(db)
    if center_id:
        rooms = [r for r in rooms if r["centerId"] == center_id]
    return [
        {
            "id": r.get("dbId"),
            "centerId": r["centerId"],
            "centerName": center_display_name(r["centerId"]),
            "roomCode": r["id"],
            "name": r["name"],
            "status": r.get("status", "AVAILABLE"),
        }
        for r in rooms
    ]


@router.get("/rooms/status", summary="咨询室占用快照")
def rooms_status(
    date: Optional[str] = Query(None, description="YYYY-MM-DD，默认今天"),
    time_slot: Optional[str] = Query(None, description="HH:MM，默认当前时段"),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    now = china_now()
    if date:
        try:
            day = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
    else:
        day = now.date()

    at_time = now
    if time_slot:
        try:
            hh, mm = time_slot.split(":")
            at_time = datetime.combine(day, time(int(hh), int(mm)))
        except ValueError:
            raise HTTPException(status_code=400, detail="time_slot 格式应为 HH:MM")
    elif date:
        at_time = datetime.combine(day, now.time())

    rooms = get_all_consultation_rooms(db)
    snapshot = []
    for room in rooms:
        occ = _room_occupancy_at(
            db, room["centerId"], room["id"], at_time, room.get("status", "AVAILABLE")
        )
        snapshot.append({
            "id": room.get("dbId"),
            "centerId": room["centerId"],
            "centerName": center_display_name(room["centerId"]),
            "roomCode": room["id"],
            "name": room["name"],
            "manualStatus": room.get("status", "AVAILABLE"),
            "atTime": at_time,
            **occ,
        })
    return {"date": day.isoformat(), "timeSlot": at_time.strftime("%H:%M"), "rooms": snapshot}


@router.get("/rooms/{room_id}", summary="咨询室详情")
def get_room_detail(
    room_id: int,
    date: Optional[str] = Query(None),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    row = db.query(AppConsultationRoom).filter(AppConsultationRoom.Id == room_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="咨询室不存在")

    if date:
        try:
            day = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
    else:
        day = china_now().date()

    day_start = datetime.combine(day, time.min)
    day_end = datetime.combine(day, time.max)
    schedules = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.StartTime >= day_start,
            AppSchedule.StartTime <= day_end,
            AppSchedule.Status != "CANCELLED",
        )
        .order_by(AppSchedule.StartTime)
        .all()
    )
    day_schedules = []
    for s in schedules:
        if parse_center_id(s.Note) != row.CenterId or parse_room_id(s.Note) != row.RoomCode:
            continue
        day_schedules.append({
            "scheduleId": s.Id,
            "startTime": s.StartTime,
            "endTime": s.EndTime,
            "status": s.Status,
            "counselorName": _counselor_name(db, s.CounselorId),
            "patientName": _schedule_patient_name(db, s.Id),
        })

    now = china_now()
    current = _room_occupancy_at(db, row.CenterId, row.RoomCode, now, row.Status)

    return {
        "id": row.Id,
        "centerId": row.CenterId,
        "centerName": center_display_name(row.CenterId),
        "roomCode": row.RoomCode,
        "name": row.Name,
        "status": row.Status,
        "current": current,
        "daySchedules": day_schedules,
    }


@router.post("/rooms", summary="新增咨询室")
def create_room(
    body: RoomCreate,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    if body.center_id not in CENTER_NAMES:
        raise HTTPException(status_code=400, detail="无效的预约中心")

    room_code = body.room_code
    if not room_code:
        existing = get_consultation_rooms(db, body.center_id)
        room_code = f"{body.center_id}-r{len(existing) + 1}"

    dup = (
        db.query(AppConsultationRoom)
        .filter(
            AppConsultationRoom.CenterId == body.center_id,
            AppConsultationRoom.RoomCode == room_code,
        )
        .first()
    )
    if dup:
        raise HTTPException(status_code=400, detail="该咨询室编号已存在")

    status = body.status or "AVAILABLE"
    if status not in ("AVAILABLE", "MAINTENANCE", "DISABLED"):
        raise HTTPException(status_code=400, detail="无效的状态")

    row = AppConsultationRoom(
        CenterId=body.center_id,
        RoomCode=room_code,
        Name=body.name,
        Status=status,
        SortOrder=body.sort_order or 0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.Id,
        "centerId": row.CenterId,
        "roomCode": row.RoomCode,
        "name": row.Name,
        "status": row.Status,
    }


@router.put("/rooms/{room_id}", summary="更新咨询室")
def update_room(
    room_id: int,
    body: RoomUpdate,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    row = db.query(AppConsultationRoom).filter(AppConsultationRoom.Id == room_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="咨询室不存在")

    if body.status is not None:
        if body.status not in ("AVAILABLE", "MAINTENANCE", "DISABLED"):
            raise HTTPException(status_code=400, detail="无效的状态")
        now = china_now()
        occ = _room_occupancy_at(db, row.CenterId, row.RoomCode, now, "AVAILABLE")
        if occ["occupancy"] not in ("IDLE", "MAINTENANCE", "DISABLED") and body.status != row.Status:
            raise HTTPException(status_code=400, detail="咨询室使用中，无法修改状态")
        row.Status = body.status

    if body.name is not None:
        row.Name = body.name
    if body.sort_order is not None:
        row.SortOrder = body.sort_order

    row.UpdatedAt = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {
        "id": row.Id,
        "centerId": row.CenterId,
        "roomCode": row.RoomCode,
        "name": row.Name,
        "status": row.Status,
    }
