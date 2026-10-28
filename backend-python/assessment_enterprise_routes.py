"""企业定制量表的公开解析与管理接口。"""
from __future__ import annotations

import hashlib
import re
import uuid
from io import BytesIO
from typing import Any, Callable, List, Optional
from uuid import UUID

import qrcode
import qrcode.image.svg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from assessment_article_service import (
    create_enterprise_article,
    create_shared_article,
    delete_enterprise_article,
    delete_shared_article,
    list_enterprise_articles,
    list_shared_articles,
    resolve_enterprise_articles,
    update_enterprise_article,
    update_shared_article,
)
from assessment_enterprise_service import (
    EnterpriseConfigError,
    delete_enterprise,
    get_default_branding,
    get_enterprise_by_slug,
    resolve_enterprise_hero_slides,
    list_employee_info_field_catalog,
    list_enterprises,
    resolve_employee_info_fields,
    save_enterprise,
    save_default_branding,
)
from assessment_report_service import (
    AssessmentReportError,
    submit_report,
)
from assessment_routes import get_assessment_store
from config import settings
from database import get_db
from models import AppAccount
from patient_registration import ensure_default_patient_registration

_ENTERPRISE_VISITOR_OPENID_RE = re.compile(r"^eap-ent-[a-z0-9-]{8,80}-[a-f0-9]{16}$")


public_router = APIRouter(
    prefix="/api/web/assessment-enterprises",
    tags=["Web Assessment Enterprises"],
)


class HeroSlidePayload(BaseModel):
    imageUrl: str = Field(..., min_length=1, max_length=500)
    title: str = Field(..., min_length=1, max_length=40)
    desc: str = Field(..., min_length=1, max_length=120)


class CustomEmployeeInfoFieldPayload(BaseModel):
    id: str = Field(..., min_length=1, max_length=40)
    label: str = Field(..., min_length=1, max_length=40)


class EnterprisePayload(BaseModel):
    companyName: str = Field(..., min_length=1, max_length=120)
    siteName: str = Field(..., min_length=1, max_length=120)
    logoUrl: str = Field(..., min_length=1, max_length=500)
    slogan: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=8, max_length=500)
    assessmentIds: list[str] = Field(..., min_length=1)
    # 仅覆盖当前企业链接展示名，不修改原量表定义
    assessmentTitles: dict[str, str] = Field(default_factory=dict)
    # null/省略 = 未定制（EAP 展示默认模板全部字段）；list = 仅勾选字段
    employeeInfoFields: Optional[List[str]] = None
    # 仅当前企业新增的员工信息字段，不影响其他企业
    customEmployeeInfoFields: Optional[List[CustomEmployeeInfoFieldPayload]] = None
    # null/省略 = 沿用通用首页轮播；3 张 = 仅本企业展示，不回写通用配置
    heroSlides: Optional[list[HeroSlidePayload]] = None
    # 仅隐藏当前企业页面上的预约心理咨询，不影响其他企业
    hideConsultation: bool = False


class BrandingPayload(BaseModel):
    companyName: str = Field(default="", max_length=120)
    siteName: str = Field(..., min_length=1, max_length=120)
    logoUrl: str = Field(..., min_length=1, max_length=500)
    slogan: str = Field(..., min_length=1, max_length=200)
    onboardingEntryLabel: str = Field(default="新员工入职测评", min_length=1, max_length=40)
    heroSlides: list[HeroSlidePayload] = Field(..., min_length=3, max_length=3)


class EnterpriseReportItemPayload(BaseModel):
    clientSubmissionId: UUID
    assessmentId: str = Field(..., min_length=1, max_length=80)
    assessmentVersion: int = Field(..., ge=1)
    answers: dict[str, str]


class ArticlePayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)
    imageUrl: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1, max_length=20000)
    tags: list[str] = Field(..., min_length=1, max_length=8)
    duration: str = Field(..., min_length=1, max_length=40)


class EnterpriseReportsSubmitPayload(BaseModel):
    visitorKey: str = Field(..., min_length=8, max_length=64)
    employeeInfo: dict[str, Any] = Field(default_factory=dict)
    reports: list[EnterpriseReportItemPayload] = Field(..., min_length=1, max_length=20)


def _enterprise_source_label(enterprise: dict[str, Any]) -> str:
    """返回「网站名.公司名」，供 admin 展示为 EAP量表.网站名.公司名。"""
    site_name = str(enterprise.get("siteName") or "").strip().replace(".", "·")
    company_name = str(enterprise.get("companyName") or "").strip().replace(".", "·")
    if site_name and company_name:
        return f"{site_name}.{company_name}"
    return site_name or company_name or "企业定制EAP"


def _ensure_enterprise_visitor(
    db: Session,
    *,
    slug: str,
    visitor_key: str,
    employee_info: dict[str, Any],
) -> AppAccount:
    key = re.sub(r"[^a-zA-Z0-9_-]", "", (visitor_key or "").strip())[:64]
    if len(key) < 8:
        raise HTTPException(status_code=422, detail="访客标识无效")
    digest = hashlib.sha256(f"{slug}:{key}".encode("utf-8")).hexdigest()[:16]
    slug_part = re.sub(r"[^a-z0-9-]", "", slug.lower())[:40] or "enterprise"
    openid = f"eap-ent-{slug_part}-{digest}"
    if not _ENTERPRISE_VISITOR_OPENID_RE.fullmatch(openid):
        openid = f"eap-ent-{digest}{digest[:8]}"

    account = db.query(AppAccount).filter(AppAccount.OpenId == openid).first()
    display_name = str(
        employee_info.get("name")
        or employee_info.get("empNo")
        or "企业来访"
    ).strip()[:50] or "企业来访"
    if not account:
        account = AppAccount(
            OpenId=openid,
            ActiveRole="Patient",
            RealName=display_name,
            Nickname=display_name,
            PatientSource="ENTERPRISE_EAP",
            PatientSourceDetail=slug[:200],
        )
        db.add(account)
        db.commit()
        db.refresh(account)
    else:
        changed = False
        if display_name and account.RealName != display_name:
            account.RealName = display_name
            account.Nickname = display_name
            changed = True
        if ensure_default_patient_registration(db, account):
            changed = True
        if changed:
            db.commit()
            db.refresh(account)

    if ensure_default_patient_registration(db, account):
        db.commit()
        db.refresh(account)
    return account


def _published_assessments(
    assessment_ids: list[str],
    assessment_titles: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    titles = assessment_titles or {}
    definitions: list[dict[str, Any]] = []
    try:
        for assessment_id in assessment_ids:
            result = get_assessment_store().get_published(assessment_id)
            definition = dict(result["definition"])
            override = str(titles.get(assessment_id) or "").strip()
            if override:
                definition["title"] = override
            definitions.append(definition)
    except AssessmentDefinitionError as exc:
        raise EnterpriseConfigError(str(exc)) from exc
    return definitions


@public_router.get("/default", summary="读取无后缀网站的默认品牌配置")
def get_public_default_branding():
    payload = get_default_branding()
    payload["articles"] = list_shared_articles()
    return payload


@public_router.get("/{slug}", summary="按企业链接后缀读取企业网站配置及已授权量表")
def get_public_enterprise_assessments(slug: str):
    try:
        enterprise = get_enterprise_by_slug(slug)
        definitions = _published_assessments(
            enterprise.get("assessmentIds", []),
            enterprise.get("assessmentTitles") or {},
        )
        default_branding = get_default_branding()
        return {
            "companyName": enterprise["companyName"],
            "siteName": enterprise["siteName"],
            "logoUrl": enterprise["logoUrl"],
            "slogan": enterprise["slogan"],
            "onboardingEntryLabel": default_branding.get(
                "onboardingEntryLabel",
                "新员工入职测评",
            ),
            "heroSlides": resolve_enterprise_hero_slides(enterprise),
            "slug": enterprise["slug"],
            "employeeInfoFields": resolve_employee_info_fields(
                enterprise.get("employeeInfoFields"),
                enterprise.get("customEmployeeInfoFields"),
            ),
            "customEmployeeInfoFields": enterprise.get("customEmployeeInfoFields") or [],
            "hideConsultation": bool(enterprise.get("hideConsultation")),
            "assessments": definitions,
            "articles": resolve_enterprise_articles(enterprise),
        }
    except EnterpriseConfigError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@public_router.post("/{slug}/reports", summary="企业专属链接提交入职量表结果")
def submit_enterprise_assessment_reports(
    slug: str,
    body: EnterpriseReportsSubmitPayload,
    db: Session = Depends(get_db),
):
    try:
        enterprise = get_enterprise_by_slug(slug)
    except EnterpriseConfigError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    allowed_ids = {
        str(item).strip()
        for item in (enterprise.get("assessmentIds") or [])
        if str(item).strip()
    }
    if not allowed_ids:
        raise HTTPException(status_code=422, detail="该企业链接未授权任何量表")

    for item in body.reports:
        if item.assessmentId not in allowed_ids:
            raise HTTPException(
                status_code=422,
                detail=f"量表未授权给该企业链接：{item.assessmentId}",
            )

    account = _ensure_enterprise_visitor(
        db,
        slug=enterprise["slug"],
        visitor_key=body.visitorKey,
        employee_info=body.employeeInfo or {},
    )
    source_label = _enterprise_source_label(enterprise)
    consent_version = settings.ASSESSMENT_CONSENT_VERSION.strip() or "enterprise-onboarding"
    demographic_meta = {
        "_enterpriseSlug": enterprise["slug"],
        "_enterpriseSiteName": str(enterprise.get("siteName") or "").strip(),
        "_enterpriseCompanyName": str(enterprise.get("companyName") or "").strip(),
        "_enterpriseSourceLabel": source_label,
        "_employeeInfo": body.employeeInfo or {},
    }

    saved: list[dict[str, Any]] = []
    store = get_assessment_store()
    try:
        for item in body.reports:
            detail = submit_report(
                db,
                account=account,
                store=store,
                client_submission_id=str(item.clientSubmissionId),
                assessment_id=item.assessmentId,
                assessment_version=item.assessmentVersion,
                demographic_answers=demographic_meta,
                answers=item.answers,
                entry_source="web",
                share_code=None,
                consent_version=consent_version,
            )
            saved.append(
                {
                    "assessmentId": item.assessmentId,
                    "publicId": detail.get("publicId") or detail.get("reportId"),
                    "assessmentTitle": detail.get("assessmentTitle"),
                    "assessmentSubtitle": detail.get("assessmentSubtitle"),
                    "scoringType": detail.get("scoringType"),
                    "resultSummary": detail.get("resultSummary"),
                    # 企业站单量表提交后需立即展示结果（无需再鉴权拉报告）
                    "result": detail.get("result"),
                }
            )
    except (AssessmentReportError, AssessmentDefinitionError) as exc:
        status = getattr(exc, "status_code", 500)
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    return {
        "accountId": account.Id,
        "sourceLabel": source_label,
        "savedCount": len(saved),
        "reports": saved,
    }


def register_assessment_enterprise_admin_routes(
    router: APIRouter,
    *,
    require_assessment_editor: Callable[..., Any],
) -> None:
    @router.get("/assessment-enterprises", summary="企业定制量表配置")
    def list_admin_enterprises(_actor: Any = Depends(require_assessment_editor)):
        return list_enterprises()

    @router.get("/assessment-enterprises/default", summary="默认网站品牌配置")
    def get_admin_default_branding(_actor: Any = Depends(require_assessment_editor)):
        return get_default_branding()

    @router.put("/assessment-enterprises/default", summary="保存默认网站品牌配置")
    def update_admin_default_branding(
        body: BrandingPayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        return save_default_branding(body.model_dump())

    @router.get("/assessment-enterprises/private-assessments", summary="可分配的已发布量表（含私有与公有）")
    def list_assignable_assessments(_actor: Any = Depends(require_assessment_editor)):
        result = get_assessment_store().list_admin(page=1, page_size=500)
        return [
            {
                "id": item["id"],
                "title": item["title"],
                "status": item["status"],
                "visibility": item.get("visibility", "public"),
            }
            for item in result["items"]
            if item.get("visibility", "public") in {"private", "public"}
            and item.get("publishedVersion")
            and not item.get("archivedAt")
        ]

    @router.get(
        "/assessment-enterprises/employee-info-fields",
        summary="默认员工信息填写模板字段目录",
    )
    def list_employee_info_fields(_actor: Any = Depends(require_assessment_editor)):
        return list_employee_info_field_catalog()

    @router.get("/assessment-enterprises/articles", summary="通用心理图文")
    def list_admin_articles(_actor: Any = Depends(require_assessment_editor)):
        return list_shared_articles()

    @router.post("/assessment-enterprises/articles", summary="新增通用心理图文")
    def create_admin_article(
        body: ArticlePayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            return create_shared_article(body.model_dump())
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.put("/assessment-enterprises/articles/{article_id}", summary="修改通用心理图文")
    def update_admin_article(
        article_id: str,
        body: ArticlePayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            return update_shared_article(article_id, body.model_dump())
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.delete("/assessment-enterprises/articles/{article_id}", summary="删除通用心理图文")
    def delete_admin_article(
        article_id: str,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            delete_shared_article(article_id)
            return {"message": "图文已删除"}
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/assessment-enterprises/{enterprise_id}/articles", summary="企业可见心理图文")
    def list_admin_enterprise_articles(
        enterprise_id: str,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            return list_enterprise_articles(enterprise_id)
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/assessment-enterprises/{enterprise_id}/articles", summary="为企业新增专属图文")
    def create_admin_enterprise_article(
        enterprise_id: str,
        body: ArticlePayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            return create_enterprise_article(enterprise_id, body.model_dump())
        except EnterpriseConfigError as exc:
            status = 404 if "不存在" in str(exc) else 422
            raise HTTPException(status_code=status, detail=str(exc)) from exc

    @router.put(
        "/assessment-enterprises/{enterprise_id}/articles/{article_id}",
        summary="修改企业图文",
    )
    def update_admin_enterprise_article(
        enterprise_id: str,
        article_id: str,
        body: ArticlePayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            return update_enterprise_article(enterprise_id, article_id, body.model_dump())
        except EnterpriseConfigError as exc:
            status = 404 if "不存在" in str(exc) else 422
            raise HTTPException(status_code=status, detail=str(exc)) from exc

    @router.delete(
        "/assessment-enterprises/{enterprise_id}/articles/{article_id}",
        summary="从企业页面移除图文",
    )
    def delete_admin_enterprise_article(
        enterprise_id: str,
        article_id: str,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            delete_enterprise_article(enterprise_id, article_id)
            return {"message": "已从该企业页面移除"}
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/assessment-enterprises", summary="新增企业定制链接")
    def create_admin_enterprise(
        body: EnterprisePayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            _published_assessments(body.assessmentIds, body.assessmentTitles)
            return save_enterprise(
                enterprise_id=None,
                company_name=body.companyName,
                url=body.url,
                assessment_ids=body.assessmentIds,
                site_name=body.siteName,
                logo_url=body.logoUrl,
                slogan=body.slogan,
                assessment_titles=body.assessmentTitles,
                employee_info_fields=body.employeeInfoFields,
                custom_employee_info_fields=(
                    [field.model_dump() for field in body.customEmployeeInfoFields]
                    if body.customEmployeeInfoFields is not None
                    else None
                ),
                hero_slides=(
                    [slide.model_dump() for slide in body.heroSlides]
                    if body.heroSlides is not None
                    else None
                ),
                hide_consultation=body.hideConsultation,
            )
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.put("/assessment-enterprises/{enterprise_id}", summary="编辑企业定制链接")
    def update_admin_enterprise(
        enterprise_id: str,
        body: EnterprisePayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            _published_assessments(body.assessmentIds, body.assessmentTitles)
            return save_enterprise(
                enterprise_id=enterprise_id,
                company_name=body.companyName,
                url=body.url,
                assessment_ids=body.assessmentIds,
                site_name=body.siteName,
                logo_url=body.logoUrl,
                slogan=body.slogan,
                assessment_titles=body.assessmentTitles,
                employee_info_fields=body.employeeInfoFields,
                custom_employee_info_fields=(
                    [field.model_dump() for field in body.customEmployeeInfoFields]
                    if body.customEmployeeInfoFields is not None
                    else None
                ),
                hero_slides=(
                    [slide.model_dump() for slide in body.heroSlides]
                    if body.heroSlides is not None
                    else None
                ),
                hide_consultation=body.hideConsultation,
            )
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.delete("/assessment-enterprises/{enterprise_id}", summary="删除企业定制链接")
    def delete_admin_enterprise(
        enterprise_id: str,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            delete_enterprise(enterprise_id)
            return {"message": "企业配置已删除"}
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/assessment-enterprises/{enterprise_id}/qrcode", summary="生成企业链接二维码")
    def enterprise_qrcode(
        enterprise_id: str,
        _actor: Any = Depends(require_assessment_editor),
    ):
        enterprise = next(
            (item for item in list_enterprises() if item.get("id") == enterprise_id),
            None,
        )
        if not enterprise:
            raise HTTPException(status_code=404, detail="企业配置不存在")
        image = qrcode.make(
            enterprise["url"],
            image_factory=qrcode.image.svg.SvgPathImage,
            box_size=8,
            border=3,
        )
        stream = BytesIO()
        image.save(stream)
        return Response(content=stream.getvalue(), media_type="image/svg+xml")
