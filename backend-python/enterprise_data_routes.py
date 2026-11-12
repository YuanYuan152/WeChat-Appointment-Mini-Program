"""企业定制数据管理：管理后台接口（挂在 /api/mini/admin 下）。"""
from __future__ import annotations

from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from database import get_db
from enterprise_data_service import (
    EnterpriseDataError,
    build_enterprise_dataset,
    create_annotation,
    delete_annotation,
    delete_enterprise_report,
    export_enterprise_dataset_xlsx,
    list_enterprise_data_summaries,
    require_enterprise,
    respondent_detail,
    save_follow_up,
    save_tag_library,
)
from models import AppAccount
from role_active import get_account_role

BASE_PATH = "/assessment-enterprise-data"


class FollowUpPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str = Field(..., min_length=1, max_length=20)
    severityOverride: Optional[str] = Field(default=None, max_length=10)
    owner: str = Field(default="", max_length=50)
    note: str = Field(default="", max_length=2000)


class AnnotationPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    respondentName: str = Field(default="", max_length=100)
    tags: list[str] = Field(default_factory=list, max_length=40)
    note: str = Field(default="", max_length=2000)
    source: str = Field(default="", max_length=100)


class TagGroupPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1, max_length=20)
    color: str = Field(default="#4A5A78", max_length=7)
    tags: list[str] = Field(default_factory=list, max_length=60)


class TagLibraryPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    groups: list[TagGroupPayload] = Field(default_factory=list, max_length=20)


def _raise(exc: EnterpriseDataError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def _enterprise(enterprise_id: str) -> dict[str, Any]:
    try:
        return require_enterprise(enterprise_id)
    except EnterpriseDataError as exc:
        _raise(exc)
        raise  # pragma: no cover - _raise 总会抛出


def register_enterprise_data_admin_routes(
    router: APIRouter,
    *,
    require_assessment_editor: Callable[..., Any],
    require_admin: Callable[..., Any],
) -> None:
    @router.get(BASE_PATH, summary="企业定制数据管理：企业链接列表与填写概况")
    def list_enterprise_data(
        db: Session = Depends(get_db),
        _actor: Any = Depends(require_assessment_editor),
    ):
        return list_enterprise_data_summaries(db)

    @router.get(f"{BASE_PATH}/{{enterprise_id}}/dataset", summary="企业填写结果数据集")
    def get_enterprise_dataset(
        enterprise_id: str,
        db: Session = Depends(get_db),
        _actor: Any = Depends(require_assessment_editor),
    ):
        return build_enterprise_dataset(db, _enterprise(enterprise_id))

    @router.get(
        f"{BASE_PATH}/{{enterprise_id}}/respondents/{{respondent_key}}",
        summary="填写者档案：标注历史与知识库学习记录",
    )
    def get_enterprise_respondent(
        enterprise_id: str,
        respondent_key: str,
        account_ids: Optional[str] = Query(None, max_length=2000),
        db: Session = Depends(get_db),
        _actor: Any = Depends(require_assessment_editor),
    ):
        ids: list[int] = []
        for raw in (account_ids or "").split(","):
            raw = raw.strip()
            if raw.isdigit():
                ids.append(int(raw))
        try:
            return respondent_detail(
                db,
                enterprise=_enterprise(enterprise_id),
                respondent_key=respondent_key,
                account_ids=ids[:200],
            )
        except EnterpriseDataError as exc:
            _raise(exc)

    @router.post(
        f"{BASE_PATH}/{{enterprise_id}}/respondents/{{respondent_key}}/annotations",
        summary="为填写者添加标签与观察记录",
    )
    def create_enterprise_annotation(
        enterprise_id: str,
        respondent_key: str,
        body: AnnotationPayload,
        db: Session = Depends(get_db),
        actor: AppAccount = Depends(require_assessment_editor),
    ):
        try:
            return create_annotation(
                db,
                enterprise=_enterprise(enterprise_id),
                respondent_key=respondent_key,
                respondent_name=body.respondentName,
                tags=body.tags,
                note=body.note,
                source=body.source,
                actor=actor,
            )
        except EnterpriseDataError as exc:
            _raise(exc)

    @router.delete(
        f"{BASE_PATH}/{{enterprise_id}}/annotations/{{annotation_id}}",
        summary="删除标注记录（本人或管理员）",
    )
    def delete_enterprise_annotation(
        enterprise_id: str,
        annotation_id: int,
        db: Session = Depends(get_db),
        actor: AppAccount = Depends(require_assessment_editor),
    ):
        try:
            delete_annotation(
                db,
                enterprise=_enterprise(enterprise_id),
                annotation_id=annotation_id,
                actor=actor,
                is_admin=get_account_role(db, actor.Id) == "Admin",
            )
            return {"message": "标注记录已删除"}
        except EnterpriseDataError as exc:
            _raise(exc)

    @router.put(
        f"{BASE_PATH}/{{enterprise_id}}/reports/{{public_id}}/follow-up",
        summary="更新答卷风险跟进状态",
    )
    def update_enterprise_follow_up(
        enterprise_id: str,
        public_id: str,
        body: FollowUpPayload,
        db: Session = Depends(get_db),
        actor: AppAccount = Depends(require_assessment_editor),
    ):
        try:
            return save_follow_up(
                db,
                enterprise=_enterprise(enterprise_id),
                public_id=public_id,
                status=body.status,
                severity_override=body.severityOverride,
                owner=body.owner,
                note=body.note,
                actor=actor,
            )
        except EnterpriseDataError as exc:
            _raise(exc)

    @router.delete(
        f"{BASE_PATH}/{{enterprise_id}}/reports/{{public_id}}",
        summary="删除企业链接下的一份答卷（需管理员）",
    )
    def delete_enterprise_data_report(
        enterprise_id: str,
        public_id: str,
        request: Request,
        db: Session = Depends(get_db),
        actor: AppAccount = Depends(require_admin),
    ):
        try:
            delete_enterprise_report(
                db,
                enterprise=_enterprise(enterprise_id),
                public_id=public_id,
                actor=actor,
                request_id=request.headers.get("x-request-id"),
            )
            return {"message": "答卷已删除", "publicId": public_id}
        except EnterpriseDataError as exc:
            _raise(exc)

    @router.put(f"{BASE_PATH}/{{enterprise_id}}/tag-library", summary="保存企业标注标签库")
    def update_enterprise_tag_library(
        enterprise_id: str,
        body: TagLibraryPayload,
        _actor: Any = Depends(require_assessment_editor),
    ):
        _enterprise(enterprise_id)
        try:
            return save_tag_library(enterprise_id, [group.model_dump() for group in body.groups])
        except EnterpriseDataError as exc:
            _raise(exc)

    @router.get(f"{BASE_PATH}/{{enterprise_id}}/export", summary="导出企业填写结果 Excel")
    def export_enterprise_data(
        enterprise_id: str,
        db: Session = Depends(get_db),
        _actor: Any = Depends(require_assessment_editor),
    ):
        return export_enterprise_dataset_xlsx(db, _enterprise(enterprise_id))
