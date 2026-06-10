"""
/api/mini/common/* 公共内容域（小程序公开读取，无需登录）
- banners      首页 Banner（与 ops 公开读一致，但归类到 common）
- articles     文章/知识/公告（双源：AppArticle + 旧 T_Content 兜底）
- counselors   咨询师公开列表与详情（双源：AppCounselorProfile + T_Doctor 兜底）
- search       统一搜索（咨询师 / 文章 / 活动 三类聚合返回）
"""

from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import or_, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError

from database import get_db
from models import AppBanner, AppActivity, AppArticle, AppSchedule

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
        "_source": "T_Doctor",
    }


@router.get("/counselors", summary="咨询师公开列表（双源：AppCounselorProfile + T_Doctor）")
def common_counselors(
    keyword: Optional[str] = Query(None, description="搜索姓名/擅长"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # 旧表 T_Doctor 兜底（lxxlBuild 没有时返回空）
    where = "isDelete = 0 AND IsShow = 1"
    params = {}
    if keyword:
        where += " AND (name LIKE :kw OR Specialty LIKE :kw OR Field LIKE :kw)"
        params["kw"] = f"%{keyword}%"

    legacy_rows = _safe_legacy_query(
        db,
        f"SELECT TOP 200 ID, name, nickName, topUrl, url, position, Specialty, Field, "
        f"introduce, Billing, FaceBilling, ConsultHours, WorkYears "
        f"FROM T_Doctor WHERE {where} ORDER BY IsTop DESC, number ASC",
        **params,
    )
    legacy_items = [_legacy_doctor_to_dict(r) for r in legacy_rows]

    # AppCounselorProfile 表会在 Batch D 创建。这里先尝试合并，失败兜空。
    new_items = _safe_legacy_query(
        db,
        "SELECT Id, AccountId, Name, AvatarUrl, Title, Specialty, Field, Introduce, "
        "Billing, ConsultHours, WorkYears FROM AppCounselorProfile WHERE IsActive = 1",
    )
    new_dicts = [
        {
            "id": int(r.get("AccountId") or r.get("Id") or 0),
            "name": r.get("Name"),
            "avatarUrl": r.get("AvatarUrl"),
            "title": r.get("Title"),
            "specialty": r.get("Specialty"),
            "field": r.get("Field"),
            "introduce": r.get("Introduce"),
            "billing": float(r.get("Billing") or 0),
            "consultHours": int(r.get("ConsultHours") or 0),
            "workYears": int(r.get("WorkYears") or 0),
            "province": "线下/线上",
            "_source": "AppCounselorProfile",
        }
        for r in new_items
    ]

    merged = new_dicts + legacy_items
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
        return common_counselor_detail(cid=cid, source="T_Doctor", db=db)
    schedules = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == cid,
            AppSchedule.Status.in_(["AVAILABLE", "BOOKED"]),
            AppSchedule.StartTime >= datetime.utcnow(),
        )
        .order_by(AppSchedule.StartTime.asc())
        .limit(20)
        .all()
    )
    def _schedule_center_id(note: Optional[str]) -> Optional[str]:
        """Note 约定 center:yangpu / center:pudong，供咨询师端排班写入。"""
        if not note:
            return None
        text = str(note).strip()
        if text.lower().startswith("center:"):
            return text.split(":", 1)[1].strip()
        return None

    time_slots = []
    center_ids = set()
    for s in schedules:
        center_id = _schedule_center_id(s.Note)
        if center_id:
            center_ids.add(center_id)
        is_bookable = s.Status == "AVAILABLE"
        time_slots.append({
            "ID": s.Id,
            "centerId": center_id,
            "startDate": s.StartTime.strftime("%Y-%m-%d"),
            "startHH": s.StartTime.strftime("%H:%M"),
            "endHH": s.EndTime.strftime("%H:%M"),
            "week": f"周{'一二三四五六日'[s.StartTime.weekday()]}",
            "Price": float(new_rows[0].get("Billing") or 0) / 100,
            "maxSign": 1,
            "numSign": 0 if is_bookable else 1,
            "status": s.Status,
            "isBookable": is_bookable,
        })
    return {
        "id": cid,
        "name": new_rows[0].get("Name"),
        "avatarUrl": new_rows[0].get("AvatarUrl"),
        "title": new_rows[0].get("Title"),
        "specialty": new_rows[0].get("Specialty"),
        "field": new_rows[0].get("Field"),
        "introduce": new_rows[0].get("Introduce"),
        "billing": float(new_rows[0].get("Billing") or 0),
        "consultHours": int(new_rows[0].get("ConsultHours") or 0),
        "workYears": int(new_rows[0].get("WorkYears") or 0),
        "career": new_rows[0].get("Career"),
        "qualification": new_rows[0].get("Qualification"),
        "timeSlots": time_slots,
        "availableCenterIds": sorted(center_ids),
        "hasAvailableTime": any(t.get("isBookable") for t in time_slots),
        "province": "线下/线上",
        "_source": "AppCounselorProfile",
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
        result["counselors"] = common_counselors(keyword=q, page=1, page_size=10, db=db)["items"]

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
