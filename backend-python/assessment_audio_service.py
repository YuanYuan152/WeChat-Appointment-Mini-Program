"""EAP 心理音画：通用库对所有企业页默认生效；企业内的改删只作用于该企业。

通用音画修改时默认保留各企业的单独改稿；仅在显式确认覆盖后，
才把最新通用内容同步到各企业对该条的改稿（或清掉改稿以继承通用）。
"""
from __future__ import annotations

import json
import os
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


def _audios_path() -> Path:
    return _data_path().with_name("audios.json")


def _seed_path() -> Path:
    return Path(__file__).resolve().parent / "assessment_audios_seed.json"


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _read_audios() -> list[dict[str, Any]]:
    path = _audios_path()
    if not path.exists():
        seeded = json.loads(_seed_path().read_text(encoding="utf-8"))
        if not isinstance(seeded, list):
            raise EnterpriseConfigError("心理音画种子数据格式错误")
        _write_audios(seeded)
        return seeded
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise EnterpriseConfigError("心理音画配置文件格式错误")
    return value


def _write_audios(items: list[dict[str, Any]]) -> None:
    path = _audios_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def _normalize_audio(value: dict[str, Any], *, existing: dict[str, Any] | None = None) -> dict[str, Any]:
    title = str(value.get("title") or "").strip()
    audio_url = str(value.get("audioUrl") or "").strip()
    description = str(value.get("description") or "").strip()
    series = str(value.get("series") or "").strip()
    duration = str(value.get("duration") or "").strip()
    if not title:
        raise EnterpriseConfigError("音画标题不能为空")
    if not audio_url:
        raise EnterpriseConfigError("请填写音频地址")
    if not description:
        raise EnterpriseConfigError("请填写音画简介")
    if not duration:
        raise EnterpriseConfigError("请填写播放时长")
    previous = existing or {}
    audio_id = str(previous.get("id") or value.get("id") or uuid.uuid4().hex[:12]).strip()
    return {
        "id": audio_id[:80],
        "title": title[:80],
        "audioUrl": audio_url[:800],
        "description": description[:2000],
        "series": series[:40],
        "duration": duration[:40],
        "publishedAt": str(previous.get("publishedAt") or _today()),
    }


def _public_audio(audio: dict[str, Any], source: str) -> dict[str, Any]:
    return {
        "id": audio["id"],
        "title": audio["title"],
        "audioUrl": audio["audioUrl"],
        "description": audio.get("description") or "",
        "series": audio.get("series") or "",
        "duration": audio["duration"],
        "publishedAt": audio.get("publishedAt") or "",
        "source": source,
    }


def list_shared_audios() -> list[dict[str, Any]]:
    with _lock:
        return [_public_audio(item, "shared") for item in _read_audios()]


def enterprises_with_audio_override(audio_id: str) -> list[dict[str, str]]:
    """返回对该通用音画有单独改稿的企业（不含仅隐藏、不含专属新增）。"""
    from assessment_enterprise_service import list_enterprises

    affected: list[dict[str, str]] = []
    for item in list_enterprises():
        overrides = item.get("audioOverrides")
        if isinstance(overrides, dict) and audio_id in overrides:
            affected.append(
                {
                    "id": str(item.get("id") or ""),
                    "companyName": str(item.get("companyName") or item.get("siteName") or item.get("id") or ""),
                }
            )
    return [row for row in affected if row["id"]]


def _sync_enterprise_audio_overrides(audio_id: str, shared_audio: dict[str, Any]) -> int:
    """把最新通用内容写入各企业对该条的改稿，实现「覆盖定制」。"""
    synced = 0

    def mutate(items: list[dict[str, Any]]) -> bool:
        nonlocal synced
        changed = False
        for item in items:
            overrides = item.get("audioOverrides")
            if not isinstance(overrides, dict) or audio_id not in overrides:
                continue
            overrides[audio_id] = {
                key: shared_audio[key]
                for key in (
                    "id",
                    "title",
                    "audioUrl",
                    "description",
                    "series",
                    "duration",
                    "publishedAt",
                )
            }
            item["audioOverrides"] = overrides
            synced += 1
            changed = True
        return changed

    mutate_enterprises(mutate)
    return synced


def _clear_enterprise_audio_state(audio_id: str, *, drop_hidden: bool) -> None:
    def mutate(items: list[dict[str, Any]]) -> bool:
        changed = False
        for item in items:
            overrides = item.get("audioOverrides")
            if isinstance(overrides, dict) and audio_id in overrides:
                overrides.pop(audio_id, None)
                if overrides:
                    item["audioOverrides"] = overrides
                else:
                    item.pop("audioOverrides", None)
                changed = True
            if not drop_hidden:
                continue
            hidden = item.get("hiddenAudioIds")
            if isinstance(hidden, list) and audio_id in hidden:
                item["hiddenAudioIds"] = [value for value in hidden if value != audio_id]
                if not item["hiddenAudioIds"]:
                    item.pop("hiddenAudioIds", None)
                changed = True
        return changed

    mutate_enterprises(mutate)


def create_shared_audio(payload: dict[str, Any]) -> dict[str, Any]:
    audio = _normalize_audio(payload)
    with _lock:
        items = _read_audios()
        audio["id"] = uuid.uuid4().hex[:12]
        items.append(audio)
        _write_audios(items)
    return _public_audio(audio, "shared")


def update_shared_audio(
    audio_id: str,
    payload: dict[str, Any],
    *,
    overwrite_enterprise_overrides: bool = False,
) -> dict[str, Any]:
    updated: dict[str, Any]
    with _lock:
        items = _read_audios()
        current = next((item for item in items if item.get("id") == audio_id), None)
        if not current:
            raise EnterpriseConfigError("音画不存在")
        updated = _normalize_audio(payload, existing=current)
        current.clear()
        current.update(updated)
        _write_audios(items)
        result = _public_audio(current, "shared")

    affected = enterprises_with_audio_override(audio_id)
    if affected and overwrite_enterprise_overrides:
        _sync_enterprise_audio_overrides(audio_id, updated)
        affected = []

    result["needsOverwriteConfirm"] = bool(affected) and not overwrite_enterprise_overrides
    result["affectedEnterprises"] = affected if result["needsOverwriteConfirm"] else []
    result["affectedEnterpriseCount"] = len(result["affectedEnterprises"])
    return result


def delete_shared_audio(audio_id: str) -> None:
    with _lock:
        items = _read_audios()
        next_items = [item for item in items if item.get("id") != audio_id]
        if len(next_items) == len(items):
            raise EnterpriseConfigError("音画不存在")
        _write_audios(next_items)
    _clear_enterprise_audio_state(audio_id, drop_hidden=True)


def resolve_enterprise_audios(enterprise: dict[str, Any] | None) -> list[dict[str, Any]]:
    shared = list_shared_audios()
    if not enterprise:
        return shared
    hidden = {str(item) for item in (enterprise.get("hiddenAudioIds") or [])}
    overrides = enterprise.get("audioOverrides") if isinstance(enterprise.get("audioOverrides"), dict) else {}
    resolved: list[dict[str, Any]] = []
    for audio in shared:
        if audio["id"] in hidden:
            continue
        override = overrides.get(audio["id"]) if isinstance(overrides, dict) else None
        if isinstance(override, dict):
            merged = _public_audio(_normalize_audio(override, existing=audio), "override")
            merged["id"] = audio["id"]
            resolved.append(merged)
        else:
            resolved.append(audio)
    local_audios = enterprise.get("localAudios") if isinstance(enterprise.get("localAudios"), list) else []
    for item in local_audios:
        if isinstance(item, dict) and item.get("id"):
            resolved.append(_public_audio(item, "local"))
    return resolved


def list_enterprise_audios(enterprise_id: str) -> list[dict[str, Any]]:
    return resolve_enterprise_audios(get_enterprise_by_id(enterprise_id))


def _require_enterprise(items: list[dict[str, Any]], enterprise_id: str) -> dict[str, Any]:
    current = next((item for item in items if item.get("id") == enterprise_id), None)
    if not current:
        raise EnterpriseConfigError("企业配置不存在")
    return current


def create_enterprise_audio(enterprise_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    audio = _normalize_audio(payload)
    audio["id"] = f"local-audio-{uuid.uuid4().hex[:12]}"
    saved: dict[str, Any] | None = None

    def mutate(items: list[dict[str, Any]]) -> bool:
        nonlocal saved
        current = _require_enterprise(items, enterprise_id)
        local_audios = list(current.get("localAudios") or [])
        local_audios.append(audio)
        current["localAudios"] = local_audios
        saved = _public_audio(audio, "local")
        return True

    mutate_enterprises(mutate)
    if not saved:
        raise EnterpriseConfigError("企业配置不存在")
    return saved


def update_enterprise_audio(enterprise_id: str, audio_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """只改当前企业：本地专属直接改；通用条目写入 audioOverrides，不改通用库。"""
    enterprise = get_enterprise_by_id(enterprise_id)
    local_audios = enterprise.get("localAudios") if isinstance(enterprise.get("localAudios"), list) else []
    local = next((item for item in local_audios if isinstance(item, dict) and item.get("id") == audio_id), None)
    if local:
        updated = _normalize_audio(payload, existing=local)
        saved = _public_audio(updated, "local")

        def mutate_local(items: list[dict[str, Any]]) -> bool:
            current = _require_enterprise(items, enterprise_id)
            current["localAudios"] = [
                updated if isinstance(item, dict) and item.get("id") == audio_id else item
                for item in (current.get("localAudios") or [])
            ]
            return True

        mutate_enterprises(mutate_local)
        return saved

    shared = next((item for item in list_shared_audios() if item["id"] == audio_id), None)
    if not shared:
        raise EnterpriseConfigError("音画不存在")
    updated = _normalize_audio(payload, existing={**shared, "description": shared.get("description")})
    updated["id"] = audio_id
    saved = _public_audio(updated, "override")

    def mutate_override(items: list[dict[str, Any]]) -> bool:
        current = _require_enterprise(items, enterprise_id)
        overrides = dict(current.get("audioOverrides") or {})
        overrides[audio_id] = updated
        current["audioOverrides"] = overrides
        hidden = [value for value in (current.get("hiddenAudioIds") or []) if value != audio_id]
        if hidden:
            current["hiddenAudioIds"] = hidden
        else:
            current.pop("hiddenAudioIds", None)
        return True

    mutate_enterprises(mutate_override)
    return saved


def delete_enterprise_audio(enterprise_id: str, audio_id: str) -> None:
    enterprise = get_enterprise_by_id(enterprise_id)
    local_audios = enterprise.get("localAudios") if isinstance(enterprise.get("localAudios"), list) else []
    is_local = any(isinstance(item, dict) and item.get("id") == audio_id for item in local_audios)
    shared_ids = {item["id"] for item in list_shared_audios()}
    if not is_local and audio_id not in shared_ids:
        raise EnterpriseConfigError("音画不存在")

    def mutate(items: list[dict[str, Any]]) -> bool:
        current = _require_enterprise(items, enterprise_id)
        if is_local:
            current["localAudios"] = [
                item
                for item in (current.get("localAudios") or [])
                if not (isinstance(item, dict) and item.get("id") == audio_id)
            ]
            if not current["localAudios"]:
                current.pop("localAudios", None)
            return True
        hidden = [str(value) for value in (current.get("hiddenAudioIds") or [])]
        if audio_id not in hidden:
            hidden.append(audio_id)
        current["hiddenAudioIds"] = hidden
        overrides = dict(current.get("audioOverrides") or {})
        overrides.pop(audio_id, None)
        if overrides:
            current["audioOverrides"] = overrides
        else:
            current.pop("audioOverrides", None)
        return True

    mutate_enterprises(mutate)
