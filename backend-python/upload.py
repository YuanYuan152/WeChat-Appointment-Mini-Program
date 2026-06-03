"""
1.4 统一文件上传 API
POST /api/upload/file  → 对接小程序 wx.uploadFile，返回可直接用于 <image> src 的绝对 URL
"""

import os
import uuid
import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles

from auth import get_current_account, AppAccount
from config import settings

router = APIRouter(prefix="/api/upload", tags=["Upload"])

# 本地静态文件目录（生产环境可替换为 OSS/COS 等对象存储）
UPLOAD_DIR = Path(__file__).parent / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/file", summary="上传文件（对接 wx.uploadFile）")
async def upload_file(
    file: UploadFile = File(...),
    current_account: AppAccount = Depends(get_current_account),
):
    # 检查文件类型
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"不支持的文件类型: {content_type}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="文件大小超过限制（10MB）")

    # 生成唯一文件名，保留原始扩展名
    ext = Path(file.filename or "file.jpg").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename

    with open(dest, "wb") as f:
        f.write(content)

    # 返回可访问的绝对 URL（开发环境用本机地址）
    url = f"{settings.BASE_URL}/static/uploads/{filename}"
    return {"url": url, "filename": filename}
