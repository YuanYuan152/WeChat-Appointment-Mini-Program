"""企业定制量表的公开解析与管理接口。"""
from __future__ import annotations

from io import BytesIO
from typing import Any, Callable

import qrcode
import qrcode.image.svg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from assessment_definition_service import AssessmentDefinitionError
from assessment_enterprise_service import (
    EnterpriseConfigError,
    delete_enterprise,
    get_default_branding,
    get_enterprise_by_slug,
    list_employee_info_field_catalog,
    list_enterprises,
    resolve_employee_info_fields,
    save_enterprise,
    save_default_branding,
)
from assessment_routes import get_assessment_store


public_router = APIRouter(
    prefix="/api/web/assessment-enterprises",
    tags=["Web Assessment Enterprises"],
)


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
    employeeInfoFields: list[str] | None = None


class HeroSlidePayload(BaseModel):
    imageUrl: str = Field(..., min_length=1, max_length=500)
    title: str = Field(..., min_length=1, max_length=40)
    desc: str = Field(..., min_length=1, max_length=120)


class BrandingPayload(BaseModel):
    companyName: str = Field(default="", max_length=120)
    siteName: str = Field(..., min_length=1, max_length=120)
    logoUrl: str = Field(..., min_length=1, max_length=500)
    slogan: str = Field(..., min_length=1, max_length=200)
    onboardingEntryLabel: str = Field(default="新员工入职测评", min_length=1, max_length=40)
    heroSlides: list[HeroSlidePayload] = Field(..., min_length=3, max_length=3)


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
    return get_default_branding()


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
            "heroSlides": default_branding.get("heroSlides", []),
            "slug": enterprise["slug"],
            "employeeInfoFields": resolve_employee_info_fields(
                enterprise.get("employeeInfoFields"),
            ),
            "assessments": definitions,
        }
    except EnterpriseConfigError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def register_assessment_enterprise_admin_routes(
    router: APIRouter,
    *,
    require_staff_workbench: Callable[..., Any],
) -> None:
    @router.get("/assessment-enterprises", summary="企业定制量表配置")
    def list_admin_enterprises(_actor: Any = Depends(require_staff_workbench)):
        return list_enterprises()

    @router.get("/assessment-enterprises/default", summary="默认网站品牌配置")
    def get_admin_default_branding(_actor: Any = Depends(require_staff_workbench)):
        return get_default_branding()

    @router.put("/assessment-enterprises/default", summary="保存默认网站品牌配置")
    def update_admin_default_branding(
        body: BrandingPayload,
        _actor: Any = Depends(require_staff_workbench),
    ):
        return save_default_branding(body.model_dump())

    @router.get("/assessment-enterprises/private-assessments", summary="可分配的已发布量表（含私有与公有）")
    def list_assignable_assessments(_actor: Any = Depends(require_staff_workbench)):
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
    def list_employee_info_fields(_actor: Any = Depends(require_staff_workbench)):
        return list_employee_info_field_catalog()

    @router.post("/assessment-enterprises", summary="新增企业定制链接")
    def create_admin_enterprise(
        body: EnterprisePayload,
        _actor: Any = Depends(require_staff_workbench),
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
            )
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.put("/assessment-enterprises/{enterprise_id}", summary="编辑企业定制链接")
    def update_admin_enterprise(
        enterprise_id: str,
        body: EnterprisePayload,
        _actor: Any = Depends(require_staff_workbench),
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
            )
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.delete("/assessment-enterprises/{enterprise_id}", summary="删除企业定制链接")
    def delete_admin_enterprise(
        enterprise_id: str,
        _actor: Any = Depends(require_staff_workbench),
    ):
        try:
            delete_enterprise(enterprise_id)
            return {"message": "企业配置已删除"}
        except EnterpriseConfigError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/assessment-enterprises/{enterprise_id}/qrcode", summary="生成企业链接二维码")
    def enterprise_qrcode(
        enterprise_id: str,
        _actor: Any = Depends(require_staff_workbench),
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
