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

from datetime import datetime, time, date as date_type, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import ProgrammingError, OperationalError
from sqlalchemy.orm import Session

from auth import get_current_account, AppAccount
from database import get_db
from staff_roles import STAFF_WORKBENCH_ROLES, account_has_staff_workbench
from models import (
    AppBanner, AppActivity, AppArticle, AppOrder, AppRoleBinding,
    AppAccount as AccountModel, AppSchedule, AppCounselorProfile,
    AppConsultation, AppConsultationRoom,
)
from app_time import china_now
from room_slot_status import (
    SLOT_STATUSES,
    normalize_slot_start,
    resolve_slot_manual_status,
    slot_start_iso,
    slot_status_map_for_room,
    upsert_slot_statuses,
    is_slot_operational,
)
from schedule_meta import (
    center_display_name, room_display_name, get_consultation_rooms,
    get_all_consultation_rooms, CENTER_NAMES, parse_center_id, parse_room_id,
    display_room_id, assign_room_to_note, schedule_note,
)
from schedule_slots import (
    all_slot_bounds_for_date, rolling_window_end, ROLLING_WINDOW_DAYS,
    is_aligned_standard_slot, standard_slot_start_containing, standard_slot_start_for_status,
    active_schedules_at, SLOT_START_HOURS, paid_occupied_rooms_at_center,
)

router = APIRouter(prefix="/api/mini/ops", tags=["Ops"])


# ---------------------------------------------------------------------------
# 权限检查
# ---------------------------------------------------------------------------

def require_ops(
    current_account: AppAccount = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AppAccount:
    if not account_has_staff_workbench(
        db, current_account.Id, getattr(current_account, "ActiveRole", None)
    ):
        raise HTTPException(status_code=403, detail="无管理工作台权限")
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
    if type and type.upper() != "ALL":
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
    db.flush()
    from patient_message_service import notify_patients_new_activity

    notify_patients_new_activity(db, activity)
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
    user_count = db.query(func.count(AccountModel.Id)).scalar() or 0
    order_count = db.query(func.count(AppOrder.Id)).scalar() or 0
    paid_orders = db.query(func.count(AppOrder.Id)).filter(AppOrder.Status == "PAID").scalar() or 0
    total_fee = sum((o.TotalFee or 0) for o in db.query(AppOrder).filter(AppOrder.Status == "PAID").all())
    article_count = db.query(func.count(AppArticle.Id)).scalar() or 0
    activity_count = db.query(func.count(AppActivity.Id)).scalar() or 0
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
    total = q.with_entities(func.count(AccountModel.Id)).scalar() or 0
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
# 排期总览 / 咨询室管理
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
    if acc:
        return acc.Nickname or acc.RealName or acc.Mobile or "未留姓名咨询师"
    return "未留姓名咨询师"


def _account_mobile(db: Session, account_id: int) -> Optional[str]:
    acc = db.query(AccountModel).filter(AccountModel.Id == account_id).first()
    return acc.Mobile if acc and acc.Mobile else None


def _schedule_patient_info(db: Session, schedule_id: int) -> tuple[Optional[str], Optional[str], Optional[str]]:
    from patient_contract_service import patient_contract_extras

    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule_id,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if not consultation:
        return None, None, None
    patient = db.query(AccountModel).filter(AccountModel.Id == consultation.PatientId).first()
    if not patient:
        return None, None, None
    name = patient.RealName or patient.Nickname
    contract = patient_contract_extras(db, patient)
    return name, patient.Mobile, contract.get("contractTag")


def _schedule_patient_name(db: Session, schedule_id: int) -> Optional[str]:
    name, _, _ = _schedule_patient_info(db, schedule_id)
    return name


def _room_occupancy_at(
    db: Session,
    center_id: str,
    room_code: str,
    at_time: datetime,
    room_default_status: str,
    *,
    room_db_id: Optional[int] = None,
) -> dict:
    status_slot_start = standard_slot_start_for_status(at_time)
    # 单时段配置优先；未配置时沿用咨询室全局状态，避免停用房间仍显示可用。
    manual_status = resolve_slot_manual_status(
        db, room_db_id, status_slot_start, room_default_status or "AVAILABLE",
    )
    if manual_status == "DISABLED":
        return {
            "occupancy": "DISABLED", "label": "停用", "manualStatus": manual_status,
            "slotStartTime": status_slot_start,
        }

    for s in active_schedules_at(db, status_slot_start):
        if parse_center_id(s.Note) != center_id or parse_room_id(s.Note) != room_code:
            continue
        if s.Status != "BOOKED" or not parse_room_id(s.Note):
            continue
        patient_name, patient_mobile, patient_contract_tag = _schedule_patient_info(db, s.Id)
        counselor_name = _counselor_name(db, s.CounselorId)
        counselor_mobile = _account_mobile(db, s.CounselorId)
        assigned_room = parse_room_id(s.Note)
        return {
            "occupancy": "IN_SESSION",
            "label": "已预约",
            "manualStatus": manual_status,
            "slotStartTime": status_slot_start,
            "scheduleId": s.Id,
            "counselorId": s.CounselorId,
            "counselorName": counselor_name,
            "counselorMobile": counselor_mobile,
            "patientName": patient_name,
            "patientMobile": patient_mobile,
            "patientContractTag": patient_contract_tag,
            "roomCode": assigned_room,
            "roomName": room_display_name(center_id, assigned_room, db),
            "startTime": s.StartTime,
            "endTime": s.EndTime,
            "scheduleStatus": s.Status,
        }
    idle_label = {"AVAILABLE": "可用", "DISABLED": "停用"}.get(
        manual_status, "可用",
    )
    return {
        "occupancy": "IDLE", "label": idle_label, "manualStatus": manual_status,
        "slotStartTime": status_slot_start,
    }


@router.get("/schedules/overview", summary="各咨询师排期总览")
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
            room_id = display_room_id(s.Note, s.Status)
            patient_name, _, patient_contract_tag = _schedule_patient_info(db, s.Id)
            items.append({
                "scheduleId": s.Id,
                "startTime": s.StartTime,
                "endTime": s.EndTime,
                "status": s.Status,
                "centerId": center_id,
                "centerName": center_display_name(center_id),
                "roomId": room_id,
                "roomName": room_display_name(center_id, room_id, db),
                "patientName": patient_name,
                "patientContractTag": patient_contract_tag,
            })
        result.append({
            "counselorId": cid,
            "counselorName": cp.Name or _counselor_name(db, cid),
            "scheduleCount": len(items),
            "schedules": items,
        })
    return {"date": day.isoformat(), "counselors": result}


@router.get(
    "/schedules/counselors/{counselor_id}/calendar",
    summary="某咨询师排期日历（管理端查看，与咨询师工作台一致）",
)
def ops_counselor_schedule_calendar(
    counselor_id: int,
    start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD"),
    days: int = Query(ROLLING_WINDOW_DAYS, ge=1, le=ROLLING_WINDOW_DAYS * 2),
    past_days: int = Query(
        0,
        ge=0,
        le=ROLLING_WINDOW_DAYS,
        description="向前追溯天数（普通模式含历史已完成）",
    ),
    month: Optional[str] = Query(None, description="按月查看 YYYY-MM（日历模式）"),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    from counselor import ScheduleCalendarOut, build_schedule_calendar_for_counselor

    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    account = db.query(AccountModel).filter(AccountModel.Id == counselor_id).first()
    if not profile and not account:
        raise HTTPException(status_code=404, detail="咨询师不存在")
    return build_schedule_calendar_for_counselor(
        db,
        counselor_id,
        start=start,
        days=days,
        past_days=past_days,
        month=month,
    )


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


class RoomSlotStatusItem(BaseModel):
    start_time: datetime
    status: str


class RoomSlotStatusBatch(BaseModel):
    slots: List[RoomSlotStatusItem]


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
    is_current_slot = False
    if date:
        try:
            day = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
    else:
        day = now.date()

    if time_slot:
        try:
            hh, mm = time_slot.split(":")
            at_time = datetime.combine(day, time(int(hh), int(mm)))
        except ValueError:
            raise HTTPException(status_code=400, detail="time_slot 格式应为 HH:MM")
    else:
        if day == now.date():
            at_time = standard_slot_start_for_status(now)
        else:
            at_time = datetime.combine(day, time(SLOT_START_HOURS[0], 0))

    slot_start = standard_slot_start_for_status(at_time)
    is_current_slot = day == now.date() and slot_start == standard_slot_start_for_status(now)

    rooms = get_all_consultation_rooms(db)
    snapshot = []
    for room in rooms:
        occ = _room_occupancy_at(
            db,
            room["centerId"],
            room["id"],
            slot_start,
            room.get("status", "AVAILABLE"),
            room_db_id=room.get("dbId"),
        )
        snapshot.append({
            "id": room.get("dbId"),
            "centerId": room["centerId"],
            "centerName": center_display_name(room["centerId"]),
            "roomCode": room["id"],
            "name": room["name"],
            "manualStatus": occ.get("manualStatus", room.get("status", "AVAILABLE")),
            "atTime": slot_start,
            **occ,
        })
    return {
        "date": day.isoformat(),
        "timeSlot": slot_start.strftime("%H:%M"),
        "isCurrentSlot": is_current_slot,
        "rooms": snapshot,
    }


@router.get("/rooms/{room_id}", summary="咨询室详情与未来一周各时段状态")
def get_room_detail(
    room_id: int,
    start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD，默认今天"),
    days: int = Query(7, ge=1, le=7),
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    row = db.query(AppConsultationRoom).filter(AppConsultationRoom.Id == room_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="咨询室不存在")

    today = china_now().date()
    window_end = rolling_window_end(today)
    start_date = today
    if start:
        try:
            requested = date_type.fromisoformat(start)
        except ValueError:
            raise HTTPException(status_code=400, detail="start 格式应为 YYYY-MM-DD")
        if requested < today or requested > window_end:
            raise HTTPException(
                status_code=400,
                detail=f"仅可查看今天起 {ROLLING_WINDOW_DAYS} 天内（{today.isoformat()} ~ {window_end.isoformat()}）",
            )
        start_date = requested

    end_date = min(start_date + timedelta(days=days - 1), window_end)
    now = china_now()

    all_bounds: List[tuple] = []
    cursor = start_date
    while cursor <= end_date:
        for start_dt, end_dt in all_slot_bounds_for_date(cursor):
            all_bounds.append((cursor.isoformat(), start_dt, end_dt))
        cursor += timedelta(days=1)

    status_by_start = slot_status_map_for_room(
        db,
        row.Id,
        [st for _, st, _ in all_bounds],
        row.Status or "AVAILABLE",
    )

    by_date: dict[str, list] = {}
    for day_str, start_dt, end_dt in all_bounds:
        occ = _room_occupancy_at(
            db, row.CenterId, row.RoomCode, start_dt, row.Status, room_db_id=row.Id,
        )
        manual_status = status_by_start.get(start_dt, row.Status or "AVAILABLE")
        occupancy = occ.get("occupancy")
        past = start_dt <= now
        editable = (not past) and occupancy != "IN_SESSION"
        by_date.setdefault(day_str, []).append({
            "key": start_dt.strftime("%H:%M"),
            "startTime": slot_start_iso(start_dt),
            "endTime": end_dt,
            "timeLabel": f"{start_dt.strftime('%H:%M')} – {end_dt.strftime('%H:%M')}",
            "past": past,
            "occupancy": occupancy,
            "statusLabel": occ.get("label"),
            "manualStatus": manual_status,
            "editable": editable,
            "scheduleId": occ.get("scheduleId"),
            "counselorId": occ.get("counselorId"),
            "counselorName": occ.get("counselorName"),
            "counselorMobile": occ.get("counselorMobile"),
            "patientName": occ.get("patientName"),
            "patientContractTag": occ.get("patientContractTag"),
            "patientMobile": occ.get("patientMobile"),
            "roomCode": occ.get("roomCode"),
            "roomName": occ.get("roomName"),
            "scheduleStatus": occ.get("scheduleStatus"),
        })

    calendar_days = [
        {"date": day_str, "slots": by_date[day_str]}
        for day_str in sorted(by_date.keys())
    ]

    current = _room_occupancy_at(
        db, row.CenterId, row.RoomCode, now, row.Status, room_db_id=row.Id,
    )

    return {
        "id": row.Id,
        "centerId": row.CenterId,
        "centerName": center_display_name(row.CenterId),
        "roomCode": row.RoomCode,
        "name": row.Name,
        "status": row.Status,
        "current": current,
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "days": calendar_days,
    }


@router.put("/rooms/{room_id}/slot-statuses", summary="批量保存咨询室时段状态")
def save_room_slot_statuses(
    room_id: int,
    body: RoomSlotStatusBatch,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    row = db.query(AppConsultationRoom).filter(AppConsultationRoom.Id == room_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="咨询室不存在")
    if not body.slots:
        raise HTTPException(status_code=400, detail="请至少提交一个时段状态")

    now = china_now()
    today = now.date()
    window_end = rolling_window_end(today)
    to_save: List[dict] = []

    for item in body.slots:
        if item.status not in SLOT_STATUSES:
            raise HTTPException(status_code=400, detail=f"无效状态：{item.status}")
        start_norm = normalize_slot_start(item.start_time)
        slot_date = start_norm.date()
        if slot_date < today or slot_date > window_end:
            raise HTTPException(status_code=400, detail="仅可设置未来一周内的时段状态")
        if start_norm <= now:
            raise HTTPException(status_code=400, detail="已开始或已过的时段不可修改状态")
        end_time = start_norm + timedelta(minutes=50)
        if not is_aligned_standard_slot(start_norm, end_time):
            raise HTTPException(status_code=400, detail="非标准时间槽，无法设置状态")

        occ = _room_occupancy_at(
            db, row.CenterId, row.RoomCode, start_norm, row.Status, room_db_id=row.Id,
        )
        if occ.get("occupancy") == "IN_SESSION":
            raise HTTPException(
                status_code=400,
                detail=f"{start_norm.strftime('%m-%d %H:%M')} 已有预约，不可修改状态",
            )
        to_save.append({"start_time": start_norm, "status": item.status})

    try:
        upsert_slot_statuses(db, row.Id, to_save)
        row.UpdatedAt = datetime.utcnow()
        db.commit()
    except (ProgrammingError, OperationalError) as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"保存失败，请确认已创建 AppConsultationRoomSlot 表：{e}")
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    return {"code": 0, "msg": "时段状态已保存", "savedCount": len(to_save)}


def _available_rooms_for_schedule(
    db: Session,
    schedule: AppSchedule,
    *,
    exclude_current: bool = False,
) -> List[dict]:
    """返回该排期时段同中心可更换的咨询室列表。"""
    center_id = parse_center_id(schedule.Note)
    if not center_id:
        return []
    current_room = parse_room_id(schedule.Note)
    occupied = paid_occupied_rooms_at_center(
        db, center_id, schedule.StartTime, exclude_id=schedule.Id,
    )
    options: List[dict] = []
    for room in get_consultation_rooms(db, center_id):
        room_code = room["id"]
        if exclude_current and room_code == current_room:
            continue
        slot_status = resolve_slot_manual_status(
            db,
            room.get("dbId"),
            schedule.StartTime,
            room.get("status", "AVAILABLE"),
        )
        if not is_slot_operational(slot_status):
            continue
        if room_code in occupied:
            continue
        options.append({
            "roomCode": room_code,
            "roomDbId": room.get("dbId"),
            "name": room["name"],
            "isCurrent": room_code == current_room,
        })
    return options


class ChangeScheduleRoomRequest(BaseModel):
    room_code: str


@router.get("/schedules/{schedule_id}/room-options", summary="已预约时段可更换的咨询室")
def schedule_room_options(
    schedule_id: int,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="排期不存在")
    if schedule.Status != "BOOKED" or not parse_room_id(schedule.Note):
        raise HTTPException(status_code=400, detail="该时段未预约或尚未分配咨询室")

    center_id = parse_center_id(schedule.Note)
    current_room = parse_room_id(schedule.Note)
    options = _available_rooms_for_schedule(db, schedule)
    return {
        "scheduleId": schedule_id,
        "centerId": center_id,
        "centerName": center_display_name(center_id),
        "currentRoomCode": current_room,
        "currentRoomName": room_display_name(center_id, current_room, db),
        "startTime": schedule.StartTime,
        "endTime": schedule.EndTime,
        "options": options,
    }


@router.put("/schedules/{schedule_id}/room", summary="更换已预约时段的咨询室")
def change_schedule_room(
    schedule_id: int,
    body: ChangeScheduleRoomRequest,
    _ops: AppAccount = Depends(require_ops),
    db: Session = Depends(get_db),
):
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="排期不存在")
    if schedule.Status != "BOOKED" or not parse_room_id(schedule.Note):
        raise HTTPException(status_code=400, detail="该时段未预约或尚未分配咨询室")

    center_id = parse_center_id(schedule.Note)
    if not center_id:
        raise HTTPException(status_code=400, detail="排期未指定预约中心")

    current_room = parse_room_id(schedule.Note)
    new_room = body.room_code.strip()
    if not new_room:
        raise HTTPException(status_code=400, detail="请选择咨询室")
    if new_room == current_room:
        return {"code": 0, "msg": "咨询室未变更", "roomCode": new_room}

    allowed = {opt["roomCode"] for opt in _available_rooms_for_schedule(db, schedule)}
    if new_room not in allowed:
        raise HTTPException(status_code=400, detail="该咨询室当前时段不可用")

    schedule.Note = assign_room_to_note(schedule.Note, new_room)
    schedule.UpdatedAt = datetime.utcnow()

    consultation = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.ScheduleId == schedule.Id,
            AppConsultation.Status.in_(["PENDING", "CONFIRMED", "ONGOING"]),
        )
        .first()
    )
    if consultation:
        consultation.Note = schedule_note(center_id, new_room)
        consultation.UpdatedAt = datetime.utcnow()

    db.commit()
    return {
        "code": 0,
        "msg": "咨询室已更换",
        "roomCode": new_room,
        "roomName": room_display_name(center_id, new_room, db),
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
    if status not in ("AVAILABLE", "DISABLED"):
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
        if body.status not in ("AVAILABLE", "DISABLED"):
            raise HTTPException(status_code=400, detail="无效的状态")
        now = china_now()
        occ = _room_occupancy_at(
            db, row.CenterId, row.RoomCode, now, row.Status, room_db_id=row.Id,
        )
        if occ["occupancy"] not in ("IDLE", "DISABLED") and body.status != row.Status:
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
