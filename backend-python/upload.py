"""
1.4 统一文件上传 API
POST /api/upload/file  → 对接小程序 wx.uploadFile，返回可直接用于 <image> src 的绝对 URL
"""

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException

from assessment_asset_service import (
    ImageUploadError,
    UPLOAD_DIR,
    store_generic_image_upload,
)
from auth import get_current_account, AppAccount

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/file", summary="上传文件（对接 wx.uploadFile）")
async def upload_file(
    file: UploadFile = File(...),
    current_account: AppAccount = Depends(get_current_account),
):
    del current_account
    try:
        return await store_generic_image_upload(file)
    except ImageUploadError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
