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
    "siteName": "心安 EAP",
    "companyName": "",
    "logoUrl": "/static/uploads/eap-default-logo.png",
    "slogan": "专业测评，贴心陪伴",
    "onboardingEntryLabel": "新员工入职测评",
}

DEFAULT_HERO_SLIDES = [
    {
        "imageUrl": "/assets/hero-site.jpg",
        "title": "心理测评",
        "desc": "专业量表，帮助你更好认识自己",
    },
    {
        "imageUrl": "/assets/hero-office.jpg",
        "title": "职场支持",
        "desc": "关注工作压力与情绪健康",
    },
    {
        "imageUrl": "/assets/hero-family.jpg",
        "title": "生活与家庭",
        "desc": "陪伴你与家人共同成长",
    },
]

# EAP 入职「基本信息」默认收集模板（未定制企业链接时展示全部）
DEFAULT_EMPLOYEE_INFO_FIELDS: list[dict[str, Any]] = [
    {"id": "empNo", "label": "工号", "group": "个人信息", "required": True},
    {"id": "name", "label": "姓名", "group": "个人信息", "required": True},
    {"id": "gender", "label": "性别", "group": "个人信息", "required": True},
    {"id": "age", "label": "年龄", "group": "个人信息", "required": True},
    {"id": "edu", "label": "学历", "group": "个人信息", "required": False},
    {"id": "joinDate", "label": "入职日期", "group": "个人信息", "required": False},
    {"id": "dept", "label": "所属部门", "group": "岗位信息", "required": True},
    {"id": "post", "label": "岗位", "group": "岗位信息", "required": True},
    {"id": "category", "label": "岗位类别", "group": "岗位信息", "required": True},
    {"id": "workLoc", "label": "工作地", "group": "岗位信息", "required": True},
    {"id": "livingStatus", "label": "居住状况", "group": "生活情况", "required": False},
    {"id": "hasFamily", "label": "是否与家人异地", "group": "生活情况", "required": False},
]


def list_employee_info_field_catalog() -> list[dict[str, Any]]:
    return [dict(item) for item in DEFAULT_EMPLOYEE_INFO_FIELDS]


def default_employee_info_field_ids() -> list[str]:
    return [str(item["id"]) for item in DEFAULT_EMPLOYEE_INFO_FIELDS]


def _normalize_custom_employee_info_fields(value: Any) -> list[dict[str, str]]:
    """仅保留本企业新增字段。id 必须是 custom- 前缀，避免和其他企业或默认字段冲突。"""
    if not isinstance(value, list):
        return []
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in value:
        if not isinstance(raw, dict):
            continue
        field_id = str(raw.get("id") or "").strip().lower()
        label = str(raw.get("label") or "").strip()
        if not re.fullmatch(r"custom-[a-f0-9]{12}", field_id):
            continue
        if not label or field_id in seen:
            continue
        result.append({"id": field_id, "label": label[:40]})
        seen.add(field_id)
        if len(result) >= 20:
            break
    return result


def _normalize_employee_info_fields(
    value: Any,
    custom_ids: list[str] | None = None,
) -> list[str] | None:
    """None 表示未定制（展示全部默认字段）；list 表示企业勾选结果。"""
    if value is None:
        return None
    if not isinstance(value, list):
        return None
    extras = [field_id for field_id in (custom_ids or []) if field_id]
    allowed = set(default_employee_info_field_ids()) | set(extras)
    selected: list[str] = []
    seen: set[str] = set()
    for raw in value:
        field_id = str(raw or "").strip()
        if not field_id or field_id not in allowed or field_id in seen:
            continue
        selected.append(field_id)
        seen.add(field_id)
    ordered = [field_id for field_id in default_employee_info_field_ids() if field_id in seen]
    ordered.extend(field_id for field_id in extras if field_id in seen)
    return ordered


def resolve_employee_info_fields(
    value: Any,
    custom_fields: Any = None,
) -> list[str]:
    """公开页使用：未定制时回退为默认模板全部字段，不自动带上自定义字段。"""
    custom_ids = [item["id"] for item in _normalize_custom_employee_info_fields(custom_fields)]
    normalized = _normalize_employee_info_fields(value, custom_ids)
    if normalized is None:
        return default_employee_info_field_ids()
    return normalized


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
    """规范化品牌字段。

    公司名允许为空（不回填默认值），其余字段为空时回退到 DEFAULT_BRANDING。
    """
    source = value or {}
    result: dict[str, str] = {}
    for key, default in DEFAULT_BRANDING.items():
        raw = source.get(key)
        if key == "companyName":
            result[key] = "" if raw is None else str(raw).strip()
            continue
        text = "" if raw is None else str(raw).strip()
        result[key] = text or str(default).strip()
    return result


def _normalize_hero_slides(value: Any) -> list[dict[str, str]]:
    """首页右侧三张轮播：固定 3 张，缺省回填默认图与文案。"""
    raw_list = value if isinstance(value, list) else []
    result: list[dict[str, str]] = []
    for index, default in enumerate(DEFAULT_HERO_SLIDES):
        raw = raw_list[index] if index < len(raw_list) and isinstance(raw_list[index], dict) else {}
        image_url = str(raw.get("imageUrl") or "").strip() or default["imageUrl"]
        title = str(raw.get("title") or "").strip() or default["title"]
        desc = str(raw.get("desc") or "").strip() or default["desc"]
        result.append({
            "imageUrl": image_url[:500],
            "title": title[:40],
            "desc": desc[:120],
        })
    return result


def _default_branding_payload(value: dict[str, Any] | None = None) -> dict[str, Any]:
    source = value or {}
    result: dict[str, Any] = dict(_branding(source))
    result["heroSlides"] = _normalize_hero_slides(source.get("heroSlides"))
    return result


def _normalize_assessment_titles(
    assessment_ids: list[str],
    titles: Any,
) -> dict[str, str]:
    """仅保留当前授权量表的展示名覆盖；空字符串表示使用原量表名。"""
    allowed = set(assessment_ids)
    source = titles if isinstance(titles, dict) else {}
    result: dict[str, str] = {}
    for raw_id, raw_title in source.items():
        assessment_id = str(raw_id or "").strip()
        if not assessment_id or assessment_id not in allowed:
            continue
        title = "" if raw_title is None else str(raw_title).strip()
        if not title:
            continue
        result[assessment_id] = title[:120]
    return result


def _normalized_enterprise(item: dict[str, Any]) -> dict[str, Any]:
    result = {**item, **_branding(item)}
    assessment_ids = [
        str(value).strip()
        for value in (result.get("assessmentIds") or [])
        if str(value).strip()
    ]
    result["assessmentIds"] = assessment_ids
    result["assessmentTitles"] = _normalize_assessment_titles(
        assessment_ids,
        result.get("assessmentTitles"),
    )
    custom_fields = _normalize_custom_employee_info_fields(item.get("customEmployeeInfoFields"))
    result["customEmployeeInfoFields"] = custom_fields
    custom_ids = [field["id"] for field in custom_fields]
    # 未写入该键 / 值为 null → 未定制；写入 list → 企业定制勾选
    if "employeeInfoFields" in item:
        result["employeeInfoFields"] = _normalize_employee_info_fields(
            item.get("employeeInfoFields"),
            custom_ids,
        )
    else:
        result["employeeInfoFields"] = None
    # 未写入或为 null：沿用通用首页轮播；写入 3 张则只属于该企业
    stored_slides = item.get("heroSlides") if "heroSlides" in item else None
    result["heroSlides"] = (
        _normalize_hero_slides(stored_slides) if isinstance(stored_slides, list) else None
    )
    result["hideConsultation"] = bool(item.get("hideConsultation"))
    parsed = urlparse(str(result.get("url") or ""))
    slug = str(result.get("slug") or "")
    if parsed.scheme in {"http", "https"} and parsed.netloc and slug:
        result["url"] = f"{parsed.scheme}://{parsed.netloc}/{slug}"
    return result


def get_default_branding() -> dict[str, Any]:
    path = _default_data_path()
    if not path.exists():
        return _default_branding_payload()
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise EnterpriseConfigError("默认网站配置文件格式错误")
    return _default_branding_payload(value)


def save_default_branding(branding: dict[str, Any]) -> dict[str, Any]:
    result = _default_branding_payload(branding)
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


def detach_assessment_from_enterprises(assessment_id: str) -> list[dict[str, str]]:
    """从企业定制勾选中移除量表。返回解除前绑定的企业。"""
    bound: list[dict[str, str]] = []
    with _lock:
        items = _read()
        changed = False
        for item in items:
            current_ids = [value for value in (item.get("assessmentIds") or []) if isinstance(value, str)]
            if assessment_id not in current_ids:
                continue
            bound.append(
                {
                    "id": str(item.get("id") or ""),
                    "companyName": str(item.get("companyName") or item.get("siteName") or item.get("id") or ""),
                }
            )
            item["assessmentIds"] = [value for value in current_ids if value != assessment_id]
            titles = item.get("assessmentTitles")
            if isinstance(titles, dict):
                titles.pop(assessment_id, None)
                item["assessmentTitles"] = titles
            changed = True
        if changed:
            _write(items)
    return bound


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


def _hero_slides_match(left: Any, right: Any) -> bool:
    return _normalize_hero_slides(left) == _normalize_hero_slides(right)


def resolve_enterprise_hero_slides(enterprise: dict[str, Any]) -> list[dict[str, str]]:
    """企业未单独保存轮播时，读取当前通用首页轮播，不回写企业配置。"""
    custom = enterprise.get("heroSlides")
    if isinstance(custom, list) and custom:
        return _normalize_hero_slides(custom)
    return list(get_default_branding().get("heroSlides") or _normalize_hero_slides(None))


def _persistable_hero_slides(hero_slides: list[dict[str, str]] | None) -> list[dict[str, str]] | None:
    """与当前通用轮播一致时不落库，避免把通用配置复制进企业，也避免改写通用配置。"""
    if hero_slides is None:
        return None
    normalized = _normalize_hero_slides(hero_slides)
    if _hero_slides_match(normalized, get_default_branding().get("heroSlides")):
        return None
    return normalized


def save_enterprise(
    *,
    enterprise_id: str | None,
    company_name: str,
    url: str,
    assessment_ids: list[str],
    site_name: str,
    logo_url: str,
    slogan: str,
    assessment_titles: dict[str, str] | None = None,
    employee_info_fields: list[str] | None = None,
    hero_slides: list[dict[str, str]] | None = None,
    custom_employee_info_fields: list[dict[str, Any]] | None = None,
    hide_consultation: bool | None = None,
) -> dict[str, Any]:
    name = (company_name or "").strip()
    if not name:
        raise EnterpriseConfigError("公司名不能为空")
    normalized_url = (url or "").strip()
    slug = slug_from_url(normalized_url)
    ids = list(dict.fromkeys(item.strip() for item in assessment_ids if item.strip()))
    if not ids:
        raise EnterpriseConfigError("请至少选择一个私有量表")
    titles = _normalize_assessment_titles(ids, assessment_titles)
    persisted_slides = _persistable_hero_slides(hero_slides)
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
        existing_custom = _normalize_custom_employee_info_fields(
            current.get("customEmployeeInfoFields") if current else None,
        )
        custom_fields = (
            existing_custom
            if custom_employee_info_fields is None
            else _normalize_custom_employee_info_fields(custom_employee_info_fields)
        )
        normalized_info_fields = _normalize_employee_info_fields(
            employee_info_fields,
            [field["id"] for field in custom_fields],
        )
        hide_consultation_value = (
            bool(current.get("hideConsultation"))
            if hide_consultation is None and current
            else bool(hide_consultation)
        )
        if current:
            current.update(
                url=normalized_url,
                slug=slug,
                assessmentIds=ids,
                assessmentTitles=titles,
                **branding,
                updatedAt=now,
            )
            if normalized_info_fields is None:
                current.pop("employeeInfoFields", None)
            else:
                current["employeeInfoFields"] = normalized_info_fields
            if custom_fields:
                current["customEmployeeInfoFields"] = custom_fields
            else:
                current.pop("customEmployeeInfoFields", None)
            if persisted_slides is None:
                current.pop("heroSlides", None)
            else:
                current["heroSlides"] = persisted_slides
            current["hideConsultation"] = hide_consultation_value
            result = current
        else:
            result = {
                "id": uuid.uuid4().hex,
                "url": normalized_url,
                "slug": slug,
                "assessmentIds": ids,
                "assessmentTitles": titles,
                **branding,
                "createdAt": now,
                "updatedAt": now,
            }
            if normalized_info_fields is not None:
                result["employeeInfoFields"] = normalized_info_fields
            if custom_fields:
                result["customEmployeeInfoFields"] = custom_fields
            if persisted_slides is not None:
                result["heroSlides"] = persisted_slides
            result["hideConsultation"] = hide_consultation_value
            items.append(result)
        _write(items)
        return _normalized_enterprise(result)


def mutate_enterprises(mutator) -> None:
    """mutator 返回 True 时写回企业配置。供图文覆盖、隐藏与删除同步使用。"""
    with _lock:
        items = _read()
        if mutator(items):
            _write(items)


def get_enterprise_by_id(enterprise_id: str) -> dict[str, Any]:
    with _lock:
        item = next((entry for entry in _read() if entry.get("id") == enterprise_id), None)
    if not item:
        raise EnterpriseConfigError("企业配置不存在")
    return _normalized_enterprise(item)


def delete_enterprise(enterprise_id: str) -> None:
    with _lock:
        items = _read()
        next_items = [item for item in items if item.get("id") != enterprise_id]
        if len(next_items) == len(items):
            raise EnterpriseConfigError("企业配置不存在")
        _write(next_items)
