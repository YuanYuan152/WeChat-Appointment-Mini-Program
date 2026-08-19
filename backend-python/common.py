"""
/api/mini/common/* 公共内容域（小程序公开读取，无需登录）
- banners      首页 Banner（与 ops 公开读一致，但归类到 common）
- articles     文章/知识/公告（双源：AppArticle + 旧 T_Content 兜底）
- counselors   咨询师公开列表与详情（双源：AppCounselorProfile + T_Doctor 兜底）
- search       统一搜索（咨询师 / 文章 / 活动 三类聚合返回）
"""

from datetime import datetime, time, timedelta
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import or_, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError

from database import get_db
from config import settings
from auth import get_optional_account
from models import AppAccount, AppBanner, AppActivity, AppArticle, AppCounselorProfile
from counselor_avatar import resolve_counselor_public_avatar_url
from booking_availability import counselor_booking_time_slots
from pricing_service import (
    get_counselor_profile,
    resolve_default_display_price_cents,
    resolve_display_price_cents,
    resolve_price_label,
    resolve_price_negotiation_required,
)
from user_role_meta import counselor_visible_to_viewer
from model_compat import optional_model_value
from counselor_identity_service import (
    legacy_doctor_ids_covered_by_new_system,
    reconcile_existing_counselor_legacy_links,
    _normalize_counselor_name,
)

router = APIRouter(prefix="/api/mini/common", tags=["Common"])


# ---------------------------------------------------------------------------
# 双源工具：尝试读旧表，失败时安静返回空列表（lxxlBuild 没有旧表也不报错）
# ---------------------------------------------------------------------------

def _safe_legacy_query(db: Session, sql: str, **params) -> List[Dict[str, Any]]:
    try:
        rs = db.execute(text(sql), params)
        cols = rs.keys()
        return [dict(zip(cols, row)) for row in rs.fetchall()]
    except (OperationalError, ProgrammingError):
        # 旧表不存在 / 列名不一致：直接返回空，不影响新数据展示
        return []
    except Exception:
        return []


# ===========================================================================
# Banner
# ===========================================================================

@router.get("/banners", summary="首页 Banner")
def common_banners(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    rows = (
        db.query(AppBanner)
        .filter(AppBanner.IsActive == True)
        .order_by(AppBanner.SortOrder.asc(), AppBanner.CreatedAt.desc())
        .all()
    )
    visible = [
        r for r in rows
        if (r.StartAt is None or r.StartAt <= now) and (r.EndAt is None or r.EndAt >= now)
    ]
    return [
        {
            "id": r.Id,
            "title": r.Title,
            "imageUrl": r.ImageUrl,
            "linkType": r.LinkType,
            "linkValue": r.LinkValue,
            "sortOrder": r.SortOrder,
        }
        for r in visible
    ]


# ===========================================================================
# Article
# ===========================================================================

def _article_to_dict(a: AppArticle) -> Dict[str, Any]:
    return {
        "id": a.Id,
        "title": a.Title,
        "category": a.Category,
        "summary": a.Summary,
        "coverUrl": a.CoverUrl,
        "author": a.Author,
        "source": a.Source,
        "isTop": a.IsTop,
        "views": a.Views,
        "publishedAt": a.PublishedAt or a.CreatedAt,
        "_source": "AppArticle",
    }


def _legacy_content_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": int(row.get("ID") or 0),
        "title": row.get("Title") or "",
        "category": "文章",
        "summary": row.get("Profile"),
        "coverUrl": row.get("url"),
        "author": None,
        "source": row.get("Source"),
        "isTop": bool(row.get("IsTop")),
        "views": int(row.get("Views") or 0),
        "publishedAt": row.get("CreateTime"),
        "_source": "T_Content",
    }


@router.get("/articles", summary="文章列表（双源合并：AppArticle + 旧 T_Content）")
def common_articles(
    category: Optional[str] = Query(None, description="分类：文章 / 知识 / 公告"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # 主源：AppArticle
    q = db.query(AppArticle).filter(AppArticle.IsActive == True)
    if category:
        q = q.filter(AppArticle.Category == category)
    new_items = (
        q.order_by(AppArticle.IsTop.desc(), AppArticle.SortOrder.asc(),
                   AppArticle.PublishedAt.desc(),
                   AppArticle.CreatedAt.desc())
        .all()
    )
    new_dicts = [_article_to_dict(a) for a in new_items]

    # 兜底源：T_Content（无视分类参数，因为旧表无对应字段）
    legacy_rows = _safe_legacy_query(
        db,
        "SELECT TOP 50 ID, Title, Source, Profile, url, IsTop, Views, CreateTime "
        "FROM T_Content WHERE IsShow = 1 AND IsDelete = 0 ORDER BY IsTop DESC, CreateTime DESC"
    )
    legacy_dicts = [_legacy_content_to_dict(r) for r in legacy_rows]

    merged = new_dicts + legacy_dicts
    # 简单分页
    total = len(merged)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "items": merged[start:end],
    }


@router.get("/articles/{article_id}", summary="文章详情（按 source 决定查哪一边）")
def common_article_detail(
    article_id: int,
    source: str = Query("AppArticle", description="AppArticle 或 T_Content"),
    db: Session = Depends(get_db),
):
    if source == "T_Content":
        rows = _safe_legacy_query(
            db,
            "SELECT ID, Title, Source, Profile, ContentMain, url, IsTop, Views, CreateTime "
            "FROM T_Content WHERE ID = :id AND IsDelete = 0",
            id=article_id,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="文章不存在")
        r = rows[0]
        return {
            "id": int(r.get("ID") or 0),
            "title": r.get("Title"),
            "category": "文章",
            "summary": r.get("Profile"),
            "content": r.get("ContentMain"),
            "coverUrl": r.get("url"),
            "source": r.get("Source"),
            "publishedAt": r.get("CreateTime"),
            "_source": "T_Content",
        }

    article = db.query(AppArticle).filter(
        AppArticle.Id == article_id,
        AppArticle.IsActive == True,
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    article.Views = (article.Views or 0) + 1
    db.commit()
    return {
        "id": article.Id,
        "title": article.Title,
        "category": article.Category,
        "summary": article.Summary,
        "content": article.Content,
        "coverUrl": article.CoverUrl,
        "author": article.Author,
        "source": article.Source,
        "views": article.Views,
        "publishedAt": article.PublishedAt or article.CreatedAt,
        "_source": "AppArticle",
    }


# ===========================================================================
# Counselor
# ===========================================================================

def _legacy_doctor_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": int(row.get("ID") or 0),
        "name": row.get("name"),
        "nickname": row.get("nickName"),
        "avatarUrl": row.get("topUrl") or row.get("url"),
        "title": row.get("position"),
        "specialty": row.get("Specialty"),
        "field": row.get("Field"),
        "introduce": row.get("introduce"),
        "billing": float(row.get("Billing") or 0),
        "faceBilling": float(row.get("FaceBilling") or 0),
        "consultHours": int(row.get("ConsultHours") or 0),
        "workYears": int(row.get("WorkYears") or 0),
        "mode": row.get("Mode"),
        "_source": "T_Doctor",
    }


def _counselor_profile_dict(
    r: AppCounselorProfile,
    billing_cents: Optional[int] = None,
    *,
    needs_negotiation: bool = False,
    price_label: Optional[str] = None,
    price_negotiation: bool = False,
) -> Dict[str, Any]:
    billing = float(billing_cents if billing_cents is not None else (r.Billing or 0))
    item: Dict[str, Any] = {
        "id": int(r.AccountId or r.Id or 0),
        "name": r.Name,
        "avatarUrl": resolve_counselor_public_avatar_url(r.AvatarUrl),
        "title": r.Title,
        "specialty": r.Specialty,
        "field": r.Field,
        "introduce": r.Introduce,
        "trainingExperience": optional_model_value(r, "TrainingExperience"),
        "career": r.Career,
        "mode": r.Mode,
        "billing": billing,
        "needsNegotiation": needs_negotiation,
        "priceLabel": price_label,
        "consultHours": int(r.ConsultHours or 0),
        "workYears": int(r.WorkYears or 0),
        "province": "线下/线上",
        "_source": "AppCounselorProfile",
    }
    if price_negotiation:
        item["priceNegotiation"] = True
        item["billingLabel"] = "议价"
        item["charityBookingBlocked"] = True
    return item


def _normalize_gender_value(value: Optional[str]) -> Optional[str]:
    """统一账号性别为 男/女，兼容 male/female/M/F 等历史写法。"""
    raw = (value or "").strip()
    if not raw:
        return None
    lowered = raw.lower()
    if raw in ("男", "女"):
        return raw
    if lowered in ("male", "m", "man", "1"):
        return "男"
    if lowered in ("female", "f", "woman", "2"):
        return "女"
    return None


COUNSELOR_MODE_VIDEO = "视频咨询"
COUNSELOR_MODE_FACE = "面询"
COUNSELOR_MODE_BOTH = "视频咨询/面询"
COUNSELOR_MODE_OPTIONS = (COUNSELOR_MODE_VIDEO, COUNSELOR_MODE_FACE, COUNSELOR_MODE_BOTH)


def normalize_counselor_mode(value: Optional[str]) -> Optional[str]:
    """统一咨询方式为 视频咨询 / 面询 / 视频咨询/面询，兼容线上线下等旧写法。"""
    raw = (value or "").strip()
    if not raw:
        return None
    if raw in COUNSELOR_MODE_OPTIONS:
        return raw
    normalized = raw.lower().replace(" ", "")
    has_online = any(
        token in normalized for token in ("线上", "在线", "视频", "video", "online")
    )
    has_offline = any(
        token in normalized for token in ("线下", "面询", "面对面", "offline")
    )
    if has_online and has_offline:
        return COUNSELOR_MODE_BOTH
    if has_online:
        return COUNSELOR_MODE_VIDEO
    if has_offline:
        return COUNSELOR_MODE_FACE
    return raw


def _mode_supports(mode: Optional[str], requested: Optional[str]) -> bool:
    """兼容线上/线下、视频/面询及历史组合写法。

    Mode 为空时按默认「线上/线下」处理，避免未填写方式的咨询师被筛空。
    """
    if not requested:
        return True
    normalized = (mode or "").strip().lower().replace(" ", "")
    if not normalized:
        return True
    if requested == "online":
        return any(token in normalized for token in ("线上", "在线", "视频", "video", "online"))
    if requested == "offline":
        return any(token in normalized for token in ("线下", "面询", "面对面", "offline"))
    return False


def _resolve_counselor_billing_cents(
    db: Session,
    counselor_id: int,
    patient_account: Optional[AppAccount],
) -> int:
    if patient_account:
        return resolve_display_price_cents(db, patient_account.Id, counselor_id)
    return resolve_default_display_price_cents(db, counselor_id)


def _resolve_counselor_pricing_context(
    db: Session,
    counselor_id: int,
    patient_account: Optional[AppAccount],
) -> Dict[str, Any]:
    patient_id = patient_account.Id if patient_account else None
    billing_cents = _resolve_counselor_billing_cents(db, counselor_id, patient_account)
    needs_negotiation = resolve_price_negotiation_required(db, patient_id, counselor_id)
    return {
        "billingCents": billing_cents,
        "needsNegotiation": needs_negotiation,
        "priceLabel": resolve_price_label(db, patient_id, counselor_id),
    }


def _patient_source_for_visibility(patient_account: Optional[AppAccount]) -> Optional[str]:
    if not patient_account:
        return None
    return getattr(patient_account, "PatientSource", None)


def _viewer_role(db: Session, account: Optional[AppAccount]) -> Optional[str]:
    if not account:
        return None
    from role_active import get_account_role

    return get_account_role(db, account.Id)


def _counselor_visible_to_viewer(
    counselor_type: Optional[str],
    viewer_account: Optional[AppAccount],
    db: Session,
) -> bool:
    return counselor_visible_to_viewer(
        counselor_type,
        _patient_source_for_visibility(viewer_account),
        _viewer_role(db, viewer_account),
    )


def _query_counselor_profiles(
    db: Session,
    keyword: Optional[str] = None,
    patient_account: Optional[AppAccount] = None,
    gender: Optional[str] = None,
    consult_method: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """AppCounselorProfile 列表，支持姓名/擅长/领域/简介关键词搜索。"""
    try:
        q = db.query(AppCounselorProfile).filter(AppCounselorProfile.IsActive == True)
        if keyword:
            kw = f"%{keyword.strip()}%"
            q = q.filter(
                or_(
                    AppCounselorProfile.Name.like(kw),
                    AppCounselorProfile.Specialty.like(kw),
                    AppCounselorProfile.Field.like(kw),
                    AppCounselorProfile.Introduce.like(kw),
                    AppCounselorProfile.Title.like(kw),
                )
            )
        rows = q.order_by(AppCounselorProfile.WorkYears.desc(), AppCounselorProfile.Id.desc()).all()
        account_ids = [int(row.AccountId or 0) for row in rows if row.AccountId]
        genders = {
            int(account_id): _normalize_gender_value(account_gender)
            for account_id, account_gender in db.query(AppAccount.Id, AppAccount.Gender)
            .filter(AppAccount.Id.in_(account_ids))
            .all()
        } if account_ids else {}
        result = []
        seen_accounts: set[int] = set()
        for r in rows:
            cid = int(r.AccountId or r.Id or 0)
            if not cid or cid in seen_accounts:
                continue
            if gender and genders.get(cid) != gender:
                continue
            if not _mode_supports(r.Mode, consult_method):
                continue
            profile = get_counselor_profile(db, cid)
            if not profile:
                continue
            if not _counselor_visible_to_viewer(profile.CounselorType, patient_account, db):
                continue
            seen_accounts.add(cid)
            billing_cents = _resolve_counselor_billing_cents(db, cid, patient_account)
            item = _counselor_profile_dict(profile, billing_cents, price_negotiation=False)
            item["gender"] = genders.get(cid)
            result.append(item)
        return result
    except Exception:
        return []


@router.get("/counselors", summary="咨询师公开列表（双源：AppCounselorProfile + T_Doctor）")
def common_counselors(
    keyword: Optional[str] = Query(None, description="搜索姓名/擅长"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query(None, description="price_asc|price_desc"),
    gender: Optional[str] = Query(None, description="男|女"),
    consult_method: Optional[str] = Query(None, description="online|offline"),
    current_account: Optional[AppAccount] = Depends(get_optional_account),
    db: Session = Depends(get_db),
):
    if keyword is not None:
        keyword = keyword.strip()
        if not keyword or keyword.lower() == "undefined":
            keyword = None

    normalized_gender = _normalize_gender_value(gender)
    normalized_method = consult_method if consult_method in ("online", "offline") else None
    normalized_sort = sort if sort in ("price_asc", "price_desc") else None
    new_dicts = _query_counselor_profiles(
        db,
        keyword,
        current_account,
        normalized_gender,
        normalized_method,
    )

    if page == 1:
        try:
            reconcile_existing_counselor_legacy_links(db)
            db.commit()
        except Exception:
            db.rollback()

    legacy_items: List[Dict[str, Any]] = []
    if not settings.SKIP_LEGACY_QUERIES:
        where = "isDelete = 0 AND IsShow = 1"
        params: Dict[str, Any] = {}
        if keyword:
            where += " AND (name LIKE :kw OR Specialty LIKE :kw OR Field LIKE :kw OR introduce LIKE :kw)"
            params["kw"] = f"%{keyword.strip()}%"

        legacy_rows = _safe_legacy_query(
            db,
            f"SELECT TOP 200 ID, name, nickName, topUrl, url, position, Specialty, Field, "
            f"introduce, Billing, FaceBilling, ConsultHours, WorkYears, Mode "
            f"FROM T_Doctor WHERE {where} ORDER BY IsTop DESC, number ASC",
            **params,
        )
        legacy_items = [_legacy_doctor_to_dict(r) for r in legacy_rows]
        covered_legacy_ids = legacy_doctor_ids_covered_by_new_system(db)
        new_names = {_normalize_counselor_name(d.get("name")) for d in new_dicts if d.get("name")}
        legacy_items = [
            item
            for item in legacy_items
            if item["id"] not in covered_legacy_ids
            and _normalize_counselor_name(item.get("name")) not in new_names
        ]
        if normalized_gender:
            # 旧 T_Doctor 无可靠的 AppAccount 性别关联，筛选时不混入无法验证的数据。
            legacy_items = []
        elif normalized_method:
            legacy_items = [
                item for item in legacy_items
                if _mode_supports(item.get("mode"), normalized_method)
            ]

    merged = new_dicts + legacy_items
    if normalized_sort:
        merged.sort(
            key=lambda item: float(item.get("billing") or 0),
            reverse=normalized_sort == "price_desc",
        )
    total = len(merged)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "items": merged[start:end],
    }


@router.get("/counselors/{cid}", summary="咨询师详情")
def common_counselor_detail(
    cid: int,
    source: str = Query("AppCounselorProfile"),
    current_account: Optional[AppAccount] = Depends(get_optional_account),
    db: Session = Depends(get_db),
):
    if source == "T_Doctor":
        rows = _safe_legacy_query(
            db,
            "SELECT ID, name, nickName, topUrl, url, position, Specialty, Field, introduce, "
            "Billing, FaceBilling, ConsultHours, WorkYears, Careerexperience, Joinerexperience, "
            "Qualification, TargetGroup, Mode "
            "FROM T_Doctor WHERE ID = :id AND isDelete = 0",
            id=cid,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="咨询师不存在")
        r = rows[0]
        d = _legacy_doctor_to_dict(r)
        d.update({
            "career": r.get("Careerexperience"),
            "joiner": r.get("Joinerexperience"),
            "trainingExperience": None,
            "qualification": r.get("Qualification"),
            "targetGroup": r.get("TargetGroup"),
            "mode": r.get("Mode"),
        })
        return d

    new_rows = _safe_legacy_query(
        db,
        "SELECT * FROM AppCounselorProfile WHERE AccountId = :id AND IsActive = 1",
        id=cid,
    )
    if not new_rows:
        return common_counselor_detail(cid=cid, source="T_Doctor", db=db, current_account=current_account)

    profile = get_counselor_profile(db, cid)
    if not profile or not _counselor_visible_to_viewer(profile.CounselorType, current_account, db):
        raise HTTPException(status_code=404, detail="咨询师不存在")

    billing_cents = _resolve_counselor_billing_cents(db, cid, current_account)
    from patient_contract_service import patient_can_self_book_counselor

    can_self_book = patient_can_self_book_counselor(db, current_account, cid)
    time_slots, center_ids = counselor_booking_time_slots(
        db,
        cid,
        billing_cents=billing_cents,
        price_negotiation=False,
    )
    return {
        "id": cid,
        "name": profile.Name or new_rows[0].get("Name"),
        "avatarUrl": resolve_counselor_public_avatar_url(
            profile.AvatarUrl or new_rows[0].get("AvatarUrl")
        ),
        "title": profile.Title or new_rows[0].get("Title"),
        "specialty": profile.Specialty or new_rows[0].get("Specialty"),
        "field": profile.Field or new_rows[0].get("Field"),
        "introduce": profile.Introduce or new_rows[0].get("Introduce"),
        "trainingExperience": optional_model_value(profile, "TrainingExperience"),
        "billing": float(billing_cents),
        "needsNegotiation": False,
        "priceLabel": None,
        "priceNegotiation": False,
        "billingLabel": None,
        "charityBookingBlocked": False,
        "canSelfBook": can_self_book,
        "faceBilling": float(int(new_rows[0].get("FaceBilling") or 30000)),
        "consultHours": int(new_rows[0].get("ConsultHours") or 0),
        "workYears": int(new_rows[0].get("WorkYears") or 0),
        "career": new_rows[0].get("Career"),
        "qualification": new_rows[0].get("Qualification"),
        "targetGroup": new_rows[0].get("TargetGroup"),
        "mode": new_rows[0].get("Mode"),
        "infoAuthenticityCommitted": bool(new_rows[0].get("InfoAuthenticityCommittedAt")),
        "infoAuthenticityCommittedAt": new_rows[0].get("InfoAuthenticityCommittedAt"),
        "infoAuthenticitySignerName": new_rows[0].get("InfoAuthenticitySignerName"),
        "timeSlots": time_slots,
        "availableCenterIds": sorted(center_ids),
        "hasAvailableTime": any(t.get("isBookable") for t in time_slots),
        "province": "线下/线上",
        "_source": "AppCounselorProfile",
    }


@router.get("/counselors/{cid}/time-slots", summary="咨询师可预约时段（与排期同步）")
def common_counselor_time_slots(
    cid: int,
    current_account: Optional[AppAccount] = Depends(get_optional_account),
    db: Session = Depends(get_db),
):
    """轻量接口：仅返回预约时段，供预约页刷新。"""
    profile = get_counselor_profile(db, cid)
    if not profile or not _counselor_visible_to_viewer(profile.CounselorType, current_account, db):
        raise HTTPException(status_code=404, detail="咨询师不存在或未开通排班")
    billing_cents = _resolve_counselor_billing_cents(db, cid, current_account)
    from patient_contract_service import patient_can_self_book_counselor

    can_self_book = patient_can_self_book_counselor(db, current_account, cid)
    time_slots, center_ids = counselor_booking_time_slots(
        db,
        cid,
        billing_cents=billing_cents,
        price_negotiation=False,
    )
    return {
        "counselorId": cid,
        "canSelfBook": can_self_book,
        "needsNegotiation": False,
        "priceLabel": None,
        "priceNegotiation": False,
        "billingLabel": None,
        "charityBookingBlocked": False,
        "timeSlots": time_slots,
        "availableCenterIds": sorted(center_ids),
        "hasAvailableTime": any(t.get("isBookable") for t in time_slots),
    }


# ===========================================================================
# Search
# ===========================================================================

@router.get("/search", summary="统一搜索（咨询师 / 文章 / 活动）")
def common_search(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    type: Optional[str] = Query(None, description="counselor / article / activity，留空返回全部"),
    db: Session = Depends(get_db),
):
    kw = f"%{q}%"
    result: Dict[str, Any] = {"keyword": q, "counselors": [], "articles": [], "activities": []}

    if type in (None, "counselor"):
        result["counselors"] = common_counselors(
            keyword=q.strip(), page=1, page_size=20, db=db, current_account=None
        )["items"]

    if type in (None, "article"):
        rows = (
            db.query(AppArticle)
            .filter(
                AppArticle.IsActive == True,
                or_(AppArticle.Title.like(kw), AppArticle.Summary.like(kw)),
            )
            .order_by(AppArticle.PublishedAt.desc())
            .limit(10)
            .all()
        )
        result["articles"] = [_article_to_dict(a) for a in rows]

    if type in (None, "activity"):
        rows = (
            db.query(AppActivity)
            .filter(
                AppActivity.IsActive == True,
                or_(AppActivity.Title.like(kw), AppActivity.Content.like(kw)),
            )
            .order_by(AppActivity.SortOrder.asc(), AppActivity.CreatedAt.desc())
            .limit(10)
            .all()
        )
        result["activities"] = [
            {
                "id": a.Id,
                "type": a.Type,
                "title": a.Title,
                "coverUrl": a.CoverUrl,
                "summary": (a.Content or "")[:120],
            }
            for a in rows
        ]

    return result


@router.get("/system-settings", summary="公开系统设置（待支付时限等）")
def common_system_settings(db: Session = Depends(get_db)):
    from system_setting_service import (
        MAX_PROXY_ORDER_TTL_MINUTES,
        MIN_PROXY_ORDER_TTL_MINUTES,
        PROXY_ORDER_TTL_STEP_MINUTES,
        format_proxy_order_ttl_duration,
        get_proxy_order_ttl_minutes,
    )

    minutes = get_proxy_order_ttl_minutes(db)
    return {
        "proxyOrderTtlMinutes": minutes,
        "proxyOrderTtlLabel": format_proxy_order_ttl_duration(minutes),
        "proxyOrderTtlMinMinutes": MIN_PROXY_ORDER_TTL_MINUTES,
        "proxyOrderTtlMaxMinutes": MAX_PROXY_ORDER_TTL_MINUTES,
        "proxyOrderTtlStepMinutes": PROXY_ORDER_TTL_STEP_MINUTES,
    }
