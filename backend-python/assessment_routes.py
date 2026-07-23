"""EAP 量表定义的公开与管理接口。"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from assessment_audit_service import begin_assessment_audit, finish_assessment_audit
from assessment_asset_service import ImageUploadError, store_assessment_image_upload
from assessment_definition_service import (
    AssessmentConflict,
    AssessmentDefinitionError,
    AssessmentDefinitionStore,
    AssessmentNotFound,
    AssessmentValidationError,
)
from assessment_share_service import (
    AssessmentShareCodeError,
    AssessmentShareConfigurationError,
    assessment_admin_list_stats,
    public_share_info,
)
from config import settings
from database import get_db


public_router = APIRouter(prefix="/api/web/assessments", tags=["Web Assessments"])


class AssessmentDefinitionPayload(BaseModel):
    definition: dict[str, Any]


class AssessmentDraftPayload(AssessmentDefinitionPayload):
    expectedRevision: str = Field(..., min_length=8, max_length=100)


class AssessmentPublishPayload(BaseModel):
    expectedRevision: str = Field(..., min_length=8, max_length=100)


@lru_cache(maxsize=1)
def get_assessment_store() -> AssessmentDefinitionStore:
    backend_dir = Path(__file__).resolve().parent
    repository_dir = backend_dir.parent
    configured_data_dir = settings.ASSESSMENT_DATA_DIR.strip()
    configured_seed_dir = settings.ASSESSMENT_SEED_DATA_DIR.strip()
    return AssessmentDefinitionStore(
        Path(configured_data_dir)
        if configured_data_dir
        else backend_dir / "runtime" / "assessment-data",
        seed_data_dir=(
            Path(configured_seed_dir)
            if configured_seed_dir
            else repository_dir / "EAP_front_site" / "src" / "data"
        ),
        guidance_file=(
            repository_dir
            / "EAP_front_site"
            / "src"
            / "lib"
            / "assessment"
            / "scale-guidance.ts"
        ),
        report_profiles_file=backend_dir / "assessment_seed_report_profiles.json",
    )


def ensure_assessment_definitions() -> None:
    get_assessment_store().ensure_seeded()


def _raise_http_error(exc: AssessmentDefinitionError) -> None:
    if isinstance(exc, AssessmentNotFound):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, AssessmentConflict):
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if isinstance(exc, AssessmentValidationError):
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail="量表定义存储异常") from exc


def _run_audited_definition_mutation(
    db: Session,
    *,
    actor: Any,
    request: Request,
    action: str,
    assessment_id: Optional[str],
    assessment_version: Optional[int],
    metadata: Optional[dict[str, Any]],
    operation: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    """先持久化 PENDING，再执行文件写入并记录最终结果。"""
    audit = begin_assessment_audit(
        db,
        actor=actor,
        action=action,
        target_type="ASSESSMENT",
        request_id=request.headers.get("x-request-id"),
        assessment_id=assessment_id,
        assessment_version=assessment_version,
        metadata=metadata,
        outcome="PENDING",
    )
    db.commit()
    try:
        result = operation()
    except Exception as exc:
        finish_assessment_audit(
            audit,
            outcome="FAILED",
            metadata={
                **(metadata or {}),
                "errorType": type(exc).__name__,
            },
        )
        db.commit()
        raise

    definition = result.get("definition") if isinstance(result, dict) else None
    finish_assessment_audit(
        audit,
        outcome="SUCCEEDED",
        metadata={
            **(metadata or {}),
            **(
                {
                    "resultVersion": definition.get("version"),
                    "resultStatus": definition.get("status"),
                }
                if isinstance(definition, dict)
                else {}
            ),
        },
    )
    db.commit()
    return result


@public_router.get("", summary="已发布 EAP 量表列表")
def list_published_assessments(
    category: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
):
    try:
        return get_assessment_store().list_published(category=category, keyword=keyword)
    except AssessmentDefinitionError as exc:
        _raise_http_error(exc)


@public_router.get("/{assessment_id}", summary="已发布 EAP 量表详情")
def get_published_assessment(assessment_id: str):
    try:
        result = get_assessment_store().get_published(assessment_id)
        try:
            result.update(public_share_info(assessment_id))
        except (AssessmentShareCodeError, AssessmentShareConfigurationError):
            # 量表浏览不能被分享配置阻断；未配置环境明确返回不可分享。
            result.update({"shareCode": None, "shareUrl": None})
        return result
    except AssessmentDefinitionError as exc:
        _raise_http_error(exc)


def register_assessment_admin_routes(
    router: APIRouter,
    *,
    require_assessment_editor: Callable[..., Any],
) -> None:
    """Register admin routes without importing admin.py from this module."""

    @router.post("/assessments/assets", summary="上传 EAP 量表受控图片")
    async def upload_admin_assessment_asset(
        file: UploadFile = File(...),
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            return await store_assessment_image_upload(file)
        except ImageUploadError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail=str(exc),
            ) from exc

    @router.get("/assessments", summary="EAP 量表管理列表")
    def list_admin_assessments(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        category: Optional[str] = Query(None),
        status: Optional[str] = Query(None),
        keyword: Optional[str] = Query(None),
        _actor: Any = Depends(require_assessment_editor),
        db: Session = Depends(get_db),
    ):
        try:
            result = get_assessment_store().list_admin(
                page=page,
                page_size=page_size,
                category=category,
                status=status,
                keyword=keyword,
            )
            stats = assessment_admin_list_stats(
                db,
                [item["id"] for item in result["items"]],
            )
            for item in result["items"]:
                item.update(
                    stats.get(
                        item["id"],
                        {"completedCount": 0, "scanCount": 0},
                    )
                )
            return result
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)

    @router.get("/assessments/{assessment_id}", summary="EAP 量表管理详情")
    def get_admin_assessment(
        assessment_id: str,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            return get_assessment_store().get_admin(assessment_id)
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)

    @router.post("/assessments", summary="新建 EAP 量表草稿")
    def create_admin_assessment(
        body: AssessmentDefinitionPayload,
        request: Request,
        actor: Any = Depends(require_assessment_editor),
        db: Session = Depends(get_db),
    ):
        try:
            assessment_id = body.definition.get("id")
            return _run_audited_definition_mutation(
                db,
                actor=actor,
                request=request,
                action="DEFINITION_CREATE",
                assessment_id=assessment_id if isinstance(assessment_id, str) else None,
                assessment_version=None,
                metadata=None,
                operation=lambda: get_assessment_store().create_draft(body.definition),
            )
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)

    @router.put("/assessments/{assessment_id}/draft", summary="保存 EAP 量表草稿")
    def update_admin_assessment_draft(
        assessment_id: str,
        body: AssessmentDraftPayload,
        request: Request,
        actor: Any = Depends(require_assessment_editor),
        db: Session = Depends(get_db),
    ):
        try:
            return _run_audited_definition_mutation(
                db,
                actor=actor,
                request=request,
                action="DEFINITION_UPDATE",
                assessment_id=assessment_id,
                assessment_version=None,
                metadata=None,
                operation=lambda: get_assessment_store().update_draft(
                    assessment_id,
                    body.definition,
                    expected_revision=body.expectedRevision,
                ),
            )
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)

    @router.post("/assessments/{assessment_id}/publish", summary="发布 EAP 量表")
    def publish_admin_assessment(
        assessment_id: str,
        body: AssessmentPublishPayload,
        request: Request,
        actor: Any = Depends(require_assessment_editor),
        db: Session = Depends(get_db),
    ):
        try:
            return _run_audited_definition_mutation(
                db,
                actor=actor,
                request=request,
                action="DEFINITION_PUBLISH",
                assessment_id=assessment_id,
                assessment_version=None,
                metadata=None,
                operation=lambda: get_assessment_store().publish(
                    assessment_id,
                    expected_revision=body.expectedRevision,
                ),
            )
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)

    @router.post("/assessments/{assessment_id}/archive", summary="归档 EAP 量表")
    def archive_admin_assessment(
        assessment_id: str,
        request: Request,
        actor: Any = Depends(require_assessment_editor),
        db: Session = Depends(get_db),
    ):
        try:
            return _run_audited_definition_mutation(
                db,
                actor=actor,
                request=request,
                action="DEFINITION_ARCHIVE",
                assessment_id=assessment_id,
                assessment_version=None,
                metadata=None,
                operation=lambda: get_assessment_store().archive(assessment_id),
            )
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)

    @router.get("/assessments/{assessment_id}/versions", summary="EAP 量表历史版本")
    def list_admin_assessment_versions(
        assessment_id: str,
        _actor: Any = Depends(require_assessment_editor),
    ):
        try:
            store = get_assessment_store()
            store.get_admin(assessment_id)
            return store.list_versions(assessment_id)
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)

    @router.post(
        "/assessments/{assessment_id}/versions/{version}/restore",
        summary="把 EAP 量表历史版本恢复为草稿",
    )
    def restore_admin_assessment_version(
        assessment_id: str,
        version: int,
        request: Request,
        actor: Any = Depends(require_assessment_editor),
        db: Session = Depends(get_db),
    ):
        try:
            return _run_audited_definition_mutation(
                db,
                actor=actor,
                request=request,
                action="DEFINITION_RESTORE",
                assessment_id=assessment_id,
                assessment_version=version,
                metadata={"restoredVersion": version},
                operation=lambda: get_assessment_store().restore_version(
                    assessment_id, version
                ),
            )
        except AssessmentDefinitionError as exc:
            _raise_http_error(exc)
