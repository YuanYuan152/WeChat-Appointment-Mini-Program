"""受控量表图片与通用图片上传的安全处理。"""

from __future__ import annotations

import hashlib
import os
import re
import uuid
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import unquote, urlsplit

from PIL import Image, UnidentifiedImageError

from config import settings


ASSESSMENT_ASSET_MAX_BYTES = 5 * 1024 * 1024
GENERIC_IMAGE_MAX_BYTES = 10 * 1024 * 1024
MAX_IMAGE_EDGE = 6_000
MAX_IMAGE_PIXELS = 24_000_000
MAX_ASSET_REFERENCE_LENGTH = 500
ASSESSMENT_ASSET_PUBLIC_PREFIX = "/static/assessment-assets"

_BACKEND_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = (
    Path(settings.UPLOAD_DIR).expanduser()
    if settings.UPLOAD_DIR.strip()
    else _BACKEND_DIR / "static" / "uploads"
)
ASSESSMENT_ASSET_DIR = (
    Path(settings.ASSESSMENT_ASSET_DIR).expanduser()
    if settings.ASSESSMENT_ASSET_DIR.strip()
    else _BACKEND_DIR / "runtime" / "assessment-assets"
)

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_ASSESSMENT_UPLOAD_FORMATS = frozenset({"jpeg", "png", "webp"})
_GENERIC_UPLOAD_FORMATS = frozenset({"jpeg", "png", "webp", "gif"})
_IMAGE_FORMAT_DETAILS = {
    "jpeg": ("image/jpeg", ".jpg"),
    "png": ("image/png", ".png"),
    "webp": ("image/webp", ".webp"),
    "gif": ("image/gif", ".gif"),
}


class ImageUploadError(ValueError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class AssessmentAssetReferenceError(ValueError):
    pass


@dataclass(frozen=True)
class ImageInfo:
    format: str
    content_type: str
    extension: str
    width: int
    height: int


def _dimensions_are_safe(width: int, height: int) -> bool:
    return (
        width > 0
        and height > 0
        and width <= MAX_IMAGE_EDGE
        and height <= MAX_IMAGE_EDGE
        and width * height <= MAX_IMAGE_PIXELS
    )


def inspect_image(
    content: bytes,
    *,
    allowed_formats: Iterable[str] = _GENERIC_UPLOAD_FORMATS,
    enforce_dimension_limits: bool = True,
    load_pixels: bool = True,
) -> ImageInfo:
    allowed = frozenset(allowed_formats)
    image_format = ""
    dimensions = (0, 0)
    try:
        with Image.open(BytesIO(content)) as image:
            image_format = (image.format or "").lower()
            dimensions = image.size
            if image_format not in allowed:
                raise UnidentifiedImageError
            if enforce_dimension_limits and not _dimensions_are_safe(*dimensions):
                raise ImageUploadError(
                    f"图片尺寸不能超过 {MAX_IMAGE_EDGE}×{MAX_IMAGE_EDGE}，"
                    f"且总像素不能超过 {MAX_IMAGE_PIXELS}",
                    status_code=413,
                )
            image.verify()

        if load_pixels:
            with Image.open(BytesIO(content)) as image:
                image.load()
    except ImageUploadError:
        raise
    except Image.DecompressionBombError as exc:
        raise ImageUploadError("图片像素数量超过安全限制", status_code=413) from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        supported = "、".join(item.upper() for item in sorted(allowed))
        raise ImageUploadError(
            f"文件不是有效的 {supported} 图片",
            status_code=415,
        ) from exc

    if (
        (image_format == "png" and not content.endswith(b"\x00\x00\x00\x00IEND\xaeB`\x82"))
        or (image_format == "jpeg" and not content.endswith(b"\xff\xd9"))
        or (
            image_format == "webp"
            and (
                len(content) < 12
                or int.from_bytes(content[4:8], "little") + 8 != len(content)
            )
        )
    ):
        supported = "、".join(item.upper() for item in sorted(allowed))
        raise ImageUploadError(
            f"文件不是完整的 {supported} 图片",
            status_code=415,
        )

    content_type, extension = _IMAGE_FORMAT_DETAILS[image_format]
    return ImageInfo(
        format=image_format,
        content_type=content_type,
        extension=extension,
        width=dimensions[0],
        height=dimensions[1],
    )


async def read_image_upload(
    upload: Any,
    *,
    max_bytes: int,
    allowed_formats: Iterable[str],
    enforce_dimension_limits: bool = True,
    load_pixels: bool = True,
) -> tuple[bytes, ImageInfo]:
    chunks: list[bytes] = []
    total = 0
    try:
        while True:
            remaining = max_bytes + 1 - total
            if remaining <= 0:
                raise ImageUploadError(
                    f"图片大小不能超过 {max_bytes // (1024 * 1024)}MB",
                    status_code=413,
                )
            chunk = await upload.read(min(1024 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
            if total > max_bytes:
                raise ImageUploadError(
                    f"图片大小不能超过 {max_bytes // (1024 * 1024)}MB",
                    status_code=413,
                )
    finally:
        close = getattr(upload, "close", None)
        if close is not None:
            result = close()
            if hasattr(result, "__await__"):
                await result

    if total == 0:
        raise ImageUploadError("图片文件不能为空")
    content = b"".join(chunks)
    return content, inspect_image(
        content,
        allowed_formats=allowed_formats,
        enforce_dimension_limits=enforce_dimension_limits,
        load_pixels=load_pixels,
    )


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("xb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def save_generic_uploaded_image(content: bytes, info: ImageInfo) -> dict[str, Any]:
    filename = f"{uuid.uuid4().hex}{info.extension}"
    _atomic_write(UPLOAD_DIR / filename, content)
    return {
        "url": f"{settings.BASE_URL.rstrip('/')}/static/uploads/{filename}",
        "filename": filename,
        "contentType": info.content_type,
        "size": len(content),
        "width": info.width,
        "height": info.height,
    }


def save_assessment_uploaded_image(
    content: bytes,
    info: ImageInfo,
) -> dict[str, Any]:
    digest = hashlib.sha256(content).hexdigest()
    filename = f"{digest}{info.extension}"
    destination = ASSESSMENT_ASSET_DIR / filename
    if not destination.exists():
        _atomic_write(destination, content)
    path = f"{ASSESSMENT_ASSET_PUBLIC_PREFIX}/{filename}"
    return {
        "path": path,
        "url": f"{settings.BASE_URL.rstrip('/')}{path}",
        "filename": filename,
        "contentType": info.content_type,
        "size": len(content),
        "width": info.width,
        "height": info.height,
    }


async def store_generic_image_upload(upload: Any) -> dict[str, Any]:
    content, info = await read_image_upload(
        upload,
        max_bytes=GENERIC_IMAGE_MAX_BYTES,
        allowed_formats=_GENERIC_UPLOAD_FORMATS,
        enforce_dimension_limits=False,
        load_pixels=False,
    )
    return save_generic_uploaded_image(content, info)


async def store_assessment_image_upload(upload: Any) -> dict[str, Any]:
    content, info = await read_image_upload(
        upload,
        max_bytes=ASSESSMENT_ASSET_MAX_BYTES,
        allowed_formats=_ASSESSMENT_UPLOAD_FORMATS,
    )
    return save_assessment_uploaded_image(content, info)


def _safe_legacy_asset_path(path: str) -> bool:
    decoded = unquote(path)
    if (
        "\\" in decoded
        or "//" in decoded
        or not re.fullmatch(r"/[A-Za-z0-9._/-]+", decoded)
        or any(character.isspace() or ord(character) < 32 for character in decoded)
    ):
        return False
    segments = decoded.split("/")
    if any(segment in {".", ".."} for segment in segments):
        return False
    suffix = Path(decoded).suffix.lower()
    if suffix not in _IMAGE_EXTENSIONS:
        return False
    return decoded.startswith("/images/") or decoded.startswith(
        "/static/assessments/"
    )


def is_safe_assessment_asset_reference(value: str) -> bool:
    if (
        not isinstance(value, str)
        or not value
        or value != value.strip()
        or len(value) > MAX_ASSET_REFERENCE_LENGTH
        or any(ord(character) < 32 for character in value)
        or "%" in value
    ):
        return False
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
        return False
    if _safe_legacy_asset_path(parsed.path):
        return True
    return bool(
        parsed.path
        and re.fullmatch(
            r"/static/assessment-assets/[0-9a-f]{64}\.(?:jpg|png|webp)",
            parsed.path,
        )
    )


def validate_assessment_asset_reference(
    value: Any,
    label: str,
    *,
    allow_empty: bool,
) -> None:
    if not isinstance(value, str):
        raise AssessmentAssetReferenceError(f"{label}必须是字符串")
    if allow_empty and not value:
        return
    if not value:
        raise AssessmentAssetReferenceError(f"{label}不能为空")
    if not is_safe_assessment_asset_reference(value):
        raise AssessmentAssetReferenceError(
            f"{label}仅支持 /images/、/static/assessments/ 或"
            " /static/assessment-assets/ 下的受控图片，且不能包含查询参数或路径穿越"
        )
