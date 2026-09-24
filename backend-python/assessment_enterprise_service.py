"""企业专属量表链接的轻量持久化服务。"""
from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from config import settings


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MIN_SECURE_SLUG_LENGTH = 20
_lock = threading.RLock()
DEFAULT_BRANDING = {
    "siteName": "广厦心安",
    "companyName": "中建三局集团有限公司",
    "logoUrl": "/assets/guangsha-xinan-logo.jpg",
    "slogan": "建广厦万间，护心安一寸",
}


class EnterpriseConfigError(ValueError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _data_path() -> Path:
    configured = settings.ASSESSMENT_DATA_DIR.strip()
    root = Path(configured) if configured else Path(__file__).resolve().parent / "runtime" / "assessment-data"
    return root / "enterprises.json"


def _default_data_path() -> Path:
    return _data_path().with_name("enterprise-default.json")


def _branding(value: dict[str, Any] | None = None) -> dict[str, str]:
    source = value or {}
    return {
        key: str(source.get(key) or default).strip()
        for key, default in DEFAULT_BRANDING.items()
    }


def _normalized_enterprise(item: dict[str, Any]) -> dict[str, Any]:
    result = {**item, **_branding(item)}
    parsed = urlparse(str(result.get("url") or ""))
    slug = str(result.get("slug") or "")
    if parsed.scheme in {"http", "https"} and parsed.netloc and slug:
        result["url"] = f"{parsed.scheme}://{parsed.netloc}/{slug}"
    return result


def get_default_branding() -> dict[str, str]:
    path = _default_data_path()
    if not path.exists():
        return dict(DEFAULT_BRANDING)
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise EnterpriseConfigError("默认网站配置文件格式错误")
    return _branding(value)


def save_default_branding(branding: dict[str, Any]) -> dict[str, str]:
    result = _branding(branding)
    with _lock:
        path = _default_data_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temporary, path)
    return result


def _read() -> list[dict[str, Any]]:
    path = _data_path()
    if not path.exists():
        return []
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise EnterpriseConfigError("企业定制配置文件格式错误")
    return value


def _write(items: list[dict[str, Any]]) -> None:
    path = _data_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def slug_from_url(url: str) -> str:
    value = (url or "").strip()
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise EnterpriseConfigError("企业链接必须是完整的 http/https 地址")
    slug = parsed.path.rstrip("/").split("/")[-1].lower()
    if not SLUG_PATTERN.fullmatch(slug):
        raise EnterpriseConfigError("链接后缀只能使用小写字母、数字和连字符")
    if len(slug) < MIN_SECURE_SLUG_LENGTH:
        raise EnterpriseConfigError(
            f"为避免链接被猜测，链接后缀不能少于 {MIN_SECURE_SLUG_LENGTH} 位"
        )
    return slug


def list_enterprises() -> list[dict[str, Any]]:
    with _lock:
        return sorted(
            [_normalized_enterprise(item) for item in _read()],
            key=lambda item: (item.get("companyName", ""), item["id"]),
        )


def get_enterprise_by_slug(slug: str) -> dict[str, Any]:
    normalized = (slug or "").strip().lower()
    with _lock:
        item = next((entry for entry in _read() if entry.get("slug") == normalized), None)
    if not item:
        raise EnterpriseConfigError("企业专属链接不存在")
    return _normalized_enterprise(item)


def save_enterprise(
    *,
    enterprise_id: str | None,
    company_name: str,
    url: str,
    assessment_ids: list[str],
    site_name: str,
    logo_url: str,
    slogan: str,
) -> dict[str, Any]:
    name = (company_name or "").strip()
    if not name:
        raise EnterpriseConfigError("公司名不能为空")
    normalized_url = (url or "").strip()
    slug = slug_from_url(normalized_url)
    ids = list(dict.fromkeys(item.strip() for item in assessment_ids if item.strip()))
    if not ids:
        raise EnterpriseConfigError("请至少选择一个私有量表")
    branding = _branding({
        "siteName": site_name,
        "companyName": name,
        "logoUrl": logo_url,
        "slogan": slogan,
    })
    with _lock:
        items = _read()
        duplicate = next(
            (item for item in items if item.get("slug") == slug and item.get("id") != enterprise_id),
            None,
        )
        if duplicate:
            raise EnterpriseConfigError("该链接后缀已被其他公司使用")
        now = _now()
        current = next((item for item in items if item.get("id") == enterprise_id), None)
        if current:
            current.update(
                url=normalized_url,
                slug=slug,
                assessmentIds=ids,
                **branding,
                updatedAt=now,
            )
            result = current
        else:
            result = {
                "id": uuid.uuid4().hex,
                "url": normalized_url,
                "slug": slug,
                "assessmentIds": ids,
                **branding,
                "createdAt": now,
                "updatedAt": now,
            }
            items.append(result)
        _write(items)
        return dict(result)


def delete_enterprise(enterprise_id: str) -> None:
    with _lock:
        items = _read()
        next_items = [item for item in items if item.get("id") != enterprise_id]
        if len(next_items) == len(items):
            raise EnterpriseConfigError("企业配置不存在")
        _write(next_items)
