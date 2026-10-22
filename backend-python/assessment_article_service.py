"""EAP 心理图文：通用库对所有企业页生效，企业内的改删只作用于该企业。"""
from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from assessment_enterprise_service import (
    EnterpriseConfigError,
    get_enterprise_by_id,
    mutate_enterprises,
)
from assessment_enterprise_service import _data_path


_lock = threading.RLock()
_TAG_SPLIT = re.compile(r"[,，、\s]+")


def _articles_path() -> Path:
    return _data_path().with_name("articles.json")


def _seed_path() -> Path:
    return Path(__file__).resolve().parent / "assessment_articles_seed.json"


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _excerpt(body: str) -> str:
    text = re.sub(r"\s+", " ", body).strip()
    if len(text) <= 80:
        return text
    return f"{text[:80]}…"


def _read_articles() -> list[dict[str, Any]]:
    path = _articles_path()
    if not path.exists():
        seeded = json.loads(_seed_path().read_text(encoding="utf-8"))
        if not isinstance(seeded, list):
            raise EnterpriseConfigError("心理图文种子数据格式错误")
        _write_articles(seeded)
        return seeded
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise EnterpriseConfigError("心理图文配置文件格式错误")
    return value


def _write_articles(items: list[dict[str, Any]]) -> None:
    path = _articles_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def _tags(value: Any) -> list[str]:
    raw = _TAG_SPLIT.split(value) if isinstance(value, str) else value
    if not isinstance(raw, list):
        raw = []
    tags: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if not text or text in tags:
            continue
        tags.append(text[:20])
        if len(tags) >= 8:
            break
    return tags


def _normalize_article(value: dict[str, Any], *, existing: dict[str, Any] | None = None) -> dict[str, Any]:
    title = str(value.get("title") or "").strip()
    image_url = str(value.get("imageUrl") or "").strip()
    body = str(value.get("body") or "").strip()
    duration = str(value.get("duration") or "").strip()
    tags = _tags(value.get("tags"))
    if not title:
        raise EnterpriseConfigError("图文标题不能为空")
    if not image_url:
        raise EnterpriseConfigError("请上传图文图片")
    if not body:
        raise EnterpriseConfigError("图文正文不能为空")
    if not tags:
        raise EnterpriseConfigError("请至少填写一个标签")
    if not duration:
        raise EnterpriseConfigError("请填写阅读时长")
    previous = existing or {}
    article_id = str(previous.get("id") or value.get("id") or uuid.uuid4().hex[:12]).strip()
    return {
        "id": article_id[:80],
        "title": title[:80],
        "imageUrl": image_url[:500],
        "body": body[:20000],
        "tags": tags,
        "duration": duration[:40],
        "publishedAt": str(previous.get("publishedAt") or _today()),
        "author": str(previous.get("author") or "EAP 心理服务团队")[:40],
    }


def _public_article(article: dict[str, Any], source: str) -> dict[str, Any]:
    body = str(article.get("body") or "")
    return {
        "id": article["id"],
        "title": article["title"],
        "imageUrl": article["imageUrl"],
        "body": body,
        "tags": list(article.get("tags") or []),
        "duration": article["duration"],
        "excerpt": _excerpt(body),
        "publishedAt": article.get("publishedAt") or "",
        "author": article.get("author") or "EAP 心理服务团队",
        "source": source,
    }


def list_shared_articles() -> list[dict[str, Any]]:
    with _lock:
        return [_public_article(item, "shared") for item in _read_articles()]


def _clear_enterprise_article_state(article_id: str, *, drop_hidden: bool) -> None:
    def mutate(items: list[dict[str, Any]]) -> bool:
        changed = False
        for item in items:
            overrides = item.get("articleOverrides")
            if isinstance(overrides, dict) and article_id in overrides:
                overrides.pop(article_id, None)
                if overrides:
                    item["articleOverrides"] = overrides
                else:
                    item.pop("articleOverrides", None)
                changed = True
            if not drop_hidden:
                continue
            hidden = item.get("hiddenArticleIds")
            if isinstance(hidden, list) and article_id in hidden:
                item["hiddenArticleIds"] = [value for value in hidden if value != article_id]
                if not item["hiddenArticleIds"]:
                    item.pop("hiddenArticleIds", None)
                changed = True
        return changed

    mutate_enterprises(mutate)


def create_shared_article(payload: dict[str, Any]) -> dict[str, Any]:
    article = _normalize_article(payload)
    with _lock:
        items = _read_articles()
        article["id"] = uuid.uuid4().hex[:12]
        items.append(article)
        _write_articles(items)
    return _public_article(article, "shared")


def update_shared_article(article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        items = _read_articles()
        current = next((item for item in items if item.get("id") == article_id), None)
        if not current:
            raise EnterpriseConfigError("图文不存在")
        updated = _normalize_article(payload, existing=current)
        current.clear()
        current.update(updated)
        _write_articles(items)
        result = _public_article(current, "shared")
    # 通用内容更新后，清掉各企业的单独改稿，让所有仍展示该图文的页面使用新内容。
    _clear_enterprise_article_state(article_id, drop_hidden=False)
    return result


def delete_shared_article(article_id: str) -> None:
    with _lock:
        items = _read_articles()
        next_items = [item for item in items if item.get("id") != article_id]
        if len(next_items) == len(items):
            raise EnterpriseConfigError("图文不存在")
        _write_articles(next_items)
    _clear_enterprise_article_state(article_id, drop_hidden=True)


def resolve_enterprise_articles(enterprise: dict[str, Any] | None) -> list[dict[str, Any]]:
    shared = list_shared_articles()
    if not enterprise:
        return shared
    hidden = {str(item) for item in (enterprise.get("hiddenArticleIds") or [])}
    overrides = enterprise.get("articleOverrides") if isinstance(enterprise.get("articleOverrides"), dict) else {}
    resolved: list[dict[str, Any]] = []
    for article in shared:
        if article["id"] in hidden:
            continue
        override = overrides.get(article["id"]) if isinstance(overrides, dict) else None
        if isinstance(override, dict):
            merged = _public_article(_normalize_article(override, existing=article), "override")
            merged["id"] = article["id"]
            resolved.append(merged)
        else:
            resolved.append(article)
    local_articles = enterprise.get("localArticles") if isinstance(enterprise.get("localArticles"), list) else []
    for item in local_articles:
        if isinstance(item, dict) and item.get("id"):
            resolved.append(_public_article(item, "local"))
    return resolved


def list_enterprise_articles(enterprise_id: str) -> list[dict[str, Any]]:
    return resolve_enterprise_articles(get_enterprise_by_id(enterprise_id))


def _require_enterprise(items: list[dict[str, Any]], enterprise_id: str) -> dict[str, Any]:
    current = next((item for item in items if item.get("id") == enterprise_id), None)
    if not current:
        raise EnterpriseConfigError("企业配置不存在")
    return current


def create_enterprise_article(enterprise_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    article = _normalize_article(payload)
    article["id"] = f"local-{uuid.uuid4().hex[:12]}"
    saved: dict[str, Any] | None = None

    def mutate(items: list[dict[str, Any]]) -> bool:
        nonlocal saved
        current = _require_enterprise(items, enterprise_id)
        local_articles = list(current.get("localArticles") or [])
        local_articles.append(article)
        current["localArticles"] = local_articles
        saved = _public_article(article, "local")
        return True

    mutate_enterprises(mutate)
    if not saved:
        raise EnterpriseConfigError("企业配置不存在")
    return saved


def update_enterprise_article(enterprise_id: str, article_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    enterprise = get_enterprise_by_id(enterprise_id)
    local_articles = enterprise.get("localArticles") if isinstance(enterprise.get("localArticles"), list) else []
    local = next((item for item in local_articles if isinstance(item, dict) and item.get("id") == article_id), None)
    if local:
        updated = _normalize_article(payload, existing=local)
        saved = _public_article(updated, "local")

        def mutate_local(items: list[dict[str, Any]]) -> bool:
            current = _require_enterprise(items, enterprise_id)
            current["localArticles"] = [
                updated if isinstance(item, dict) and item.get("id") == article_id else item
                for item in (current.get("localArticles") or [])
            ]
            return True

        mutate_enterprises(mutate_local)
        return saved

    shared = next((item for item in list_shared_articles() if item["id"] == article_id), None)
    if not shared:
        raise EnterpriseConfigError("图文不存在")
    updated = _normalize_article(payload, existing={**shared, "body": shared.get("body")})
    updated["id"] = article_id
    saved = _public_article(updated, "override")

    def mutate_override(items: list[dict[str, Any]]) -> bool:
        current = _require_enterprise(items, enterprise_id)
        overrides = dict(current.get("articleOverrides") or {})
        overrides[article_id] = updated
        current["articleOverrides"] = overrides
        hidden = [value for value in (current.get("hiddenArticleIds") or []) if value != article_id]
        if hidden:
            current["hiddenArticleIds"] = hidden
        else:
            current.pop("hiddenArticleIds", None)
        return True

    mutate_enterprises(mutate_override)
    return saved


def delete_enterprise_article(enterprise_id: str, article_id: str) -> None:
    enterprise = get_enterprise_by_id(enterprise_id)
    local_articles = enterprise.get("localArticles") if isinstance(enterprise.get("localArticles"), list) else []
    is_local = any(isinstance(item, dict) and item.get("id") == article_id for item in local_articles)
    shared_ids = {item["id"] for item in list_shared_articles()}
    if not is_local and article_id not in shared_ids:
        raise EnterpriseConfigError("图文不存在")

    def mutate(items: list[dict[str, Any]]) -> bool:
        current = _require_enterprise(items, enterprise_id)
        if is_local:
            current["localArticles"] = [
                item for item in (current.get("localArticles") or [])
                if not (isinstance(item, dict) and item.get("id") == article_id)
            ]
            if not current["localArticles"]:
                current.pop("localArticles", None)
            return True
        hidden = [str(value) for value in (current.get("hiddenArticleIds") or [])]
        if article_id not in hidden:
            hidden.append(article_id)
        current["hiddenArticleIds"] = hidden
        overrides = dict(current.get("articleOverrides") or {})
        overrides.pop(article_id, None)
        if overrides:
            current["articleOverrides"] = overrides
        else:
            current.pop("articleOverrides", None)
        return True

    mutate_enterprises(mutate)
