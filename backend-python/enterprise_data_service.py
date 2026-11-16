"""企业定制数据管理：按企业链接汇总员工填写结果、风险跟进、人工标注与知识库学习记录。

数据来源：
- 企业站答卷：AppAssessmentReport，人口学元数据里带 _enterpriseId / _enterpriseSlug /
  _employeeInfo / _personnel（站点登录人员）。
- 风险跟进：EnterpriseRiskFollowUp（每份答卷一条，可人工调整风险等级）。
- 人工标注：EnterpriseRespondentAnnotation（只追加，最新一条为当前标签）。
- 知识库学习：EnterpriseLearningEvent（企业站回传的图文阅读、音频播放）。
- 标签库：随企业配置保存在 enterprises.json 的 dataTagGroups。
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Any, Iterable, Optional
from urllib.parse import quote

from fastapi import Response
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, load_only

from app_time import format_china_system_time
from assessment_audit_service import begin_assessment_audit
from assessment_enterprise_service import (
    DEFAULT_EMPLOYEE_INFO_FIELDS,
    EnterpriseConfigError,
    list_enterprises,
    mutate_enterprises,
    resolve_employee_info_fields,
)
from enterprise_site_personnel_service import (
    ROLE_EMPLOYEE,
    login_required,
    personnel_summary,
)
from models import (
    AppAccount,
    AppAssessmentReport,
    EnterpriseLearningEvent,
    EnterpriseRespondentAnnotation,
    EnterpriseRiskFollowUp,
    EnterpriseSitePersonnel,
)


class EnterpriseDataError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


# ---------------------------------------------------------------------------
# 风险分级
# ---------------------------------------------------------------------------

SEVERITY_ORDER = {"ok": 0, "watch": 1, "mid": 2, "high": 3}
RISK_SEVERITIES = ("watch", "mid", "high")

# 量表区间只有自由文本 level，没有统一的风险字段，这里按关键词归档。
# 顺序即优先级：明确“无风险”的说法放最前，避免“低风险”“无异常”被“风险”“异常”误判；
# 具体程度词（重度/中度/轻度）先于泛化词（风险/差）。
_SEVERITY_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("低风险", "ok"),
    ("无风险", "ok"),
    ("未见异常", "ok"),
    ("无异常", "ok"),
    ("无明显", "ok"),
    ("正常", "ok"),
    ("极高风险", "high"),
    ("高风险", "high"),
    ("高危", "high"),
    ("危机", "high"),
    ("重度", "high"),
    ("严重", "high"),
    ("极重", "high"),
    ("极差", "high"),
    ("很差", "high"),
    ("非常差", "high"),
    ("中度", "mid"),
    ("中风险", "mid"),
    ("中等风险", "mid"),
    ("较高风险", "mid"),
    ("偏重", "mid"),
    ("较差", "mid"),
    ("偏差", "watch"),
    ("差", "mid"),
    ("轻度", "watch"),
    ("轻微", "watch"),
    ("需要关注", "watch"),
    ("需关注", "watch"),
    ("关注", "watch"),
    ("偏高", "watch"),
    ("偏低", "watch"),
    ("一般", "watch"),
    ("临界", "watch"),
    ("可疑", "watch"),
    ("倾向", "watch"),
    ("异常", "watch"),
    ("风险", "watch"),
    ("良好", "ok"),
    ("很好", "ok"),
    ("较好", "ok"),
    ("健康", "ok"),
    ("稳定", "ok"),
    ("优秀", "ok"),
    ("满意", "ok"),
)


def classify_level(level: Any) -> Optional[str]:
    """把量表结果等级文本归为 ok / watch / mid / high；无法判断返回 None。"""
    text = re.sub(r"\s+", "", str(level or ""))
    if not text or text == "未知":
        return None
    for keyword, severity in _SEVERITY_KEYWORDS:
        if keyword in text:
            return severity
    return None


def max_severity(values: Iterable[Optional[str]]) -> Optional[str]:
    best: Optional[str] = None
    for value in values:
        if value not in SEVERITY_ORDER:
            continue
        if best is None or SEVERITY_ORDER[value] > SEVERITY_ORDER[best]:
            best = value
    return best


def _number(value: Any) -> Optional[float | int]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(float(value)):
        return None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _severity_source_text(report: dict[str, Any], follow: dict[str, Any]) -> str:
    """导出用：风险等级是人工调整、风险维度判定还是按等级文案推断。"""
    if follow.get("severityOverride"):
        return "人工调整"
    if not report.get("severity"):
        return ""
    risk = report.get("risk") or {}
    if risk.get("severity"):
        level = risk.get("level") or ""
        return f"风险维度：{level}" if level else "风险维度"
    return "自动识别"


def _risk_payload(result: dict[str, Any]) -> Optional[dict[str, Any]]:
    risk = result.get("risk")
    if not isinstance(risk, dict):
        return None
    severity = risk.get("severity")
    triggers = []
    for raw in risk.get("triggers") or []:
        if not isinstance(raw, dict):
            continue
        triggers.append(
            {
                "id": str(raw.get("id") or ""),
                "level": str(raw.get("level") or ""),
                "severity": raw.get("severity") if raw.get("severity") in SEVERITY_ORDER else None,
                "optionIds": [str(item) for item in raw.get("optionIds") or []],
            }
        )
    return {
        "title": str(risk.get("title") or "风险"),
        "level": str(risk.get("level") or ""),
        "severity": severity if severity in SEVERITY_ORDER else None,
        "source": str(risk.get("source") or "none"),
        "score": _number(risk.get("score")),
        "triggers": triggers,
    }


def summarize_result(result: Any) -> dict[str, Any]:
    """从计分结果里提取总分、等级、维度与触发风险的条目（不含解读长文）。

    量表配置了风险维度时以风险维度的分级为准（管理员明确定义的风险口径），
    没有时才按结果等级文案的关键词推断。
    """
    summary = _summarize_scores(result)
    summary["risk"] = None
    if not isinstance(result, dict):
        return summary
    total = result.get("total")
    if summary["resultType"] == "dimension" and isinstance(total, dict):
        level = str(total.get("level") or "")
        score = _number(total.get("score"))
        summary["score"] = score
        summary["level"] = level
        severity = classify_level(level)
        if severity in RISK_SEVERITIES:
            summary["triggers"].insert(
                0,
                {
                    "title": str(total.get("title") or "总分"),
                    "level": level,
                    "score": score,
                    "severity": severity,
                },
            )
        summary["autoSeverity"] = max_severity([summary["autoSeverity"], severity])
    risk = _risk_payload(result)
    if risk is not None:
        summary["risk"] = risk
        if risk["severity"] is not None:
            summary["autoSeverity"] = risk["severity"]
            if risk["severity"] in RISK_SEVERITIES:
                summary["triggers"].insert(
                    0,
                    {
                        "title": risk["title"],
                        "level": risk["level"],
                        "score": risk["score"],
                        "severity": risk["severity"],
                    },
                )
    return summary


def _summarize_scores(result: Any) -> dict[str, Any]:
    empty = {
        "resultType": None,
        "score": None,
        "level": "",
        "dimensions": [],
        "autoSeverity": None,
        "triggers": [],
    }
    if not isinstance(result, dict):
        return empty
    result_type = str(result.get("type") or "")
    triggers: list[dict[str, Any]] = []
    if result_type == "sum":
        score = _number(result.get("totalScore"))
        level = str(result.get("level") or "")
        severity = classify_level(level)
        if severity in RISK_SEVERITIES:
            triggers.append({"title": "总分", "level": level, "score": score, "severity": severity})
        return {
            "resultType": "sum",
            "score": score,
            "level": level,
            "dimensions": [],
            "autoSeverity": severity,
            "triggers": triggers,
        }
    if result_type == "dimension":
        dimensions: list[dict[str, Any]] = []
        for raw in result.get("dimensions") or []:
            if not isinstance(raw, dict):
                continue
            level = str(raw.get("level") or "")
            severity = classify_level(level)
            item = {
                "id": str(raw.get("id") or ""),
                "title": str(raw.get("title") or ""),
                "score": _number(raw.get("score")),
                "level": level,
                "severity": severity,
            }
            dimensions.append(item)
            if severity in RISK_SEVERITIES:
                triggers.append(
                    {
                        "title": item["title"],
                        "level": level,
                        "score": item["score"],
                        "severity": severity,
                    }
                )
        triggers.sort(key=lambda entry: -SEVERITY_ORDER.get(entry["severity"], 0))
        return {
            "resultType": "dimension",
            "score": None,
            "level": "",
            "dimensions": dimensions,
            "autoSeverity": max_severity(item["severity"] for item in dimensions),
            "triggers": triggers,
        }
    if result_type == "match":
        return {
            **empty,
            "resultType": "match",
            "level": str(result.get("title") or ""),
        }
    return empty


# ---------------------------------------------------------------------------
# 通用工具
# ---------------------------------------------------------------------------

_SAFE_LIKE_VALUE = re.compile(r"[^a-zA-Z0-9-]")
_VISITOR_KEY_CLEAN = re.compile(r"[^a-zA-Z0-9_-]")
_ENTERPRISE_VISITOR_OPENID_RE = re.compile(r"^eap-ent-[a-z0-9-]{8,80}-[a-f0-9]{16}$")
_RESPONDENT_KEY_RE = re.compile(r"^[ap][0-9]{1,10}$")


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _load_json(raw: Optional[str]) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def _load_dict(raw: Optional[str]) -> dict[str, Any]:
    value = _load_json(raw)
    return value if isinstance(value, dict) else {}


def _load_str_list(raw: Optional[str]) -> list[str]:
    value = _load_json(raw)
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if isinstance(item, str) and item.strip()]


def _actor_name(actor: Optional[AppAccount]) -> str:
    if not actor:
        return ""
    return (
        (actor.RealName or "").strip()
        or (actor.Nickname or "").strip()
        or (actor.Mobile or "").strip()
        or f"账号 {actor.Id}"
    )[:100]


def normalize_respondent_key(value: str) -> str:
    key = (value or "").strip().lower()
    if not _RESPONDENT_KEY_RE.fullmatch(key):
        raise EnterpriseDataError("填写者标识无效", status_code=404)
    return key


def normalize_visitor_key(visitor_key: str) -> str:
    """与企业站答卷提交一致：只保留字母数字下划线连字符，最长 64 位，至少 8 位。"""
    key = _VISITOR_KEY_CLEAN.sub("", (visitor_key or "").strip())[:64]
    return key if len(key) >= 8 else ""


def enterprise_visitor_openid(slug: str, visitor_key: str) -> str:
    """企业站访客在 AppAccount 中的 OpenId；答卷提交与学习记录共用同一算法。"""
    digest = hashlib.sha256(f"{slug}:{visitor_key}".encode("utf-8")).hexdigest()[:16]
    slug_part = re.sub(r"[^a-z0-9-]", "", slug.lower())[:40] or "enterprise"
    openid = f"eap-ent-{slug_part}-{digest}"
    if not _ENTERPRISE_VISITOR_OPENID_RE.fullmatch(openid):
        openid = f"eap-ent-{digest}{digest[:8]}"
    return openid


# ---------------------------------------------------------------------------
# 答卷归属
# ---------------------------------------------------------------------------

_REPORT_COLUMNS = (
    AppAssessmentReport.Id,
    AppAssessmentReport.PublicId,
    AppAssessmentReport.AccountId,
    AppAssessmentReport.AssessmentId,
    AppAssessmentReport.AssessmentVersion,
    AppAssessmentReport.AssessmentTitle,
    AppAssessmentReport.ScoringType,
    AppAssessmentReport.ResultSummary,
    AppAssessmentReport.ResultJson,
    AppAssessmentReport.DemographicAnswers,
    AppAssessmentReport.CompletedAt,
)


def report_matches_enterprise(meta: dict[str, Any], enterprise: dict[str, Any]) -> bool:
    """新答卷按 _enterpriseId 归属（改链接后缀也不丢）；旧答卷按提交时的 slug 归属。"""
    enterprise_id = str(meta.get("_enterpriseId") or "").strip()
    if enterprise_id:
        return enterprise_id == str(enterprise.get("id") or "")
    slug = str(meta.get("_enterpriseSlug") or "").strip()
    return bool(slug) and slug == str(enterprise.get("slug") or "")


def _enterprise_report_query(db: Session, enterprise: Optional[dict[str, Any]]):
    query = (
        db.query(AppAssessmentReport)
        .options(load_only(*_REPORT_COLUMNS))
        .filter(AppAssessmentReport.DeletedAt.is_(None))
    )
    # 人口学答案按规范 JSON（sort_keys、无空格）落库，可用子串预筛，再在 Python 里精确校验。
    if enterprise is None:
        query = query.filter(AppAssessmentReport.DemographicAnswers.like('%"_enterpriseSlug":%'))
    else:
        patterns: list[str] = []
        slug = _SAFE_LIKE_VALUE.sub("", str(enterprise.get("slug") or ""))
        enterprise_id = _SAFE_LIKE_VALUE.sub("", str(enterprise.get("id") or ""))
        if slug:
            patterns.append(f'%"_enterpriseSlug":"{slug}"%')
        if enterprise_id:
            patterns.append(f'%"_enterpriseId":"{enterprise_id}"%')
        if not patterns:
            return None
        query = query.filter(
            or_(*[AppAssessmentReport.DemographicAnswers.like(pattern) for pattern in patterns])
        )
    return query.order_by(AppAssessmentReport.CompletedAt.asc(), AppAssessmentReport.Id.asc())


def enterprise_report_rows(
    db: Session,
    enterprise: dict[str, Any],
) -> list[tuple[AppAssessmentReport, dict[str, Any]]]:
    query = _enterprise_report_query(db, enterprise)
    if query is None:
        return []
    rows: list[tuple[AppAssessmentReport, dict[str, Any]]] = []
    for row in query.all():
        meta = _load_dict(row.DemographicAnswers)
        if report_matches_enterprise(meta, enterprise):
            rows.append((row, meta))
    return rows


def respondent_key_for(meta: dict[str, Any], account_id: int) -> str:
    """登录站点按人员表账号归档（换设备也是同一人），未登录站点按访客账号归档。"""
    personnel = meta.get("_personnel")
    if isinstance(personnel, dict):
        try:
            personnel_id = int(personnel.get("id") or 0)
        except (TypeError, ValueError):
            personnel_id = 0
        if personnel_id > 0:
            return f"p{personnel_id}"
    return f"a{int(account_id)}"


def _personnel_meta(meta: dict[str, Any]) -> Optional[dict[str, Any]]:
    personnel = meta.get("_personnel")
    if not isinstance(personnel, dict):
        return None
    try:
        personnel_id = int(personnel.get("id") or 0)
    except (TypeError, ValueError):
        return None
    if personnel_id <= 0:
        return None
    return {
        "id": personnel_id,
        "username": str(personnel.get("username") or "")[:80],
        "empNo": str(personnel.get("empNo") or "")[:40],
        "realName": str(personnel.get("realName") or "")[:50],
    }


def _employee_info(meta: dict[str, Any]) -> dict[str, str]:
    raw = meta.get("_employeeInfo")
    if not isinstance(raw, dict):
        return {}
    result: dict[str, str] = {}
    for key, value in raw.items():
        field_id = str(key or "").strip()[:60]
        if not field_id or value is None:
            continue
        if isinstance(value, (list, tuple)):
            text = "、".join(str(item).strip() for item in value if str(item).strip())
        elif isinstance(value, dict):
            continue
        else:
            text = str(value).strip()
        if text:
            result[field_id] = text[:200]
    return result


def enterprise_info_fields(
    enterprise: dict[str, Any],
    seen_keys: set[str] | None = None,
) -> list[dict[str, Any]]:
    """当前启用的员工信息字段 + 历史答卷里出现过的模板字段，带中文标签。"""
    seen = seen_keys or set()
    custom_fields = [
        item
        for item in (enterprise.get("customEmployeeInfoFields") or [])
        if isinstance(item, dict) and item.get("id")
    ]
    enabled = set(
        resolve_employee_info_fields(
            enterprise.get("employeeInfoFields"),
            custom_fields,
        )
    )
    fields: list[dict[str, Any]] = []
    for item in DEFAULT_EMPLOYEE_INFO_FIELDS:
        field_id = str(item["id"])
        if field_id in enabled or field_id in seen:
            fields.append(
                {
                    "id": field_id,
                    "label": str(item["label"]),
                    "group": str(item.get("group") or ""),
                    "enabled": field_id in enabled,
                }
            )
    for item in custom_fields:
        field_id = str(item.get("id"))
        if field_id in enabled or field_id in seen:
            fields.append(
                {
                    "id": field_id,
                    "label": str(item.get("label") or field_id),
                    "group": "自定义字段",
                    "enabled": field_id in enabled,
                }
            )
    return fields


def _display_name(
    info: dict[str, str],
    personnel: Optional[dict[str, Any]],
    account_id: Optional[int],
) -> str:
    name = info.get("name") or ""
    if name:
        return name
    if personnel and personnel.get("realName"):
        return str(personnel["realName"])
    if info.get("empNo"):
        return f"工号 {info['empNo']}"
    if personnel and personnel.get("username"):
        return str(personnel["username"])
    return f"填写者 #{account_id}" if account_id else "匿名填写者"


# ---------------------------------------------------------------------------
# 风险跟进
# ---------------------------------------------------------------------------

FOLLOW_UP_STATUSES = {
    "pending": "待联系",
    "engaged": "已介入",
    "following": "跟进中",
    "resolved": "已缓解",
    "dismissed": "无需跟进",
}
CLOSED_FOLLOW_UP_STATUSES = frozenset({"resolved", "dismissed"})
MAX_FOLLOW_UP_HISTORY = 30


def _follow_up_payload(row: EnterpriseRiskFollowUp) -> dict[str, Any]:
    history = _load_json(row.HistoryJson)
    return {
        "status": row.Status,
        "severityOverride": row.SeverityOverride if row.SeverityOverride in SEVERITY_ORDER else None,
        "owner": row.Owner or "",
        "note": row.Note or "",
        "updatedAt": _iso(row.UpdatedAt or row.CreatedAt),
        "updatedBy": row.UpdatedByName or "",
        "history": history if isinstance(history, list) else [],
    }


def _follow_up_map(db: Session, enterprise_id: str) -> dict[str, EnterpriseRiskFollowUp]:
    rows = (
        db.query(EnterpriseRiskFollowUp)
        .filter(EnterpriseRiskFollowUp.EnterpriseId == enterprise_id)
        .all()
    )
    return {row.ReportPublicId: row for row in rows}


def _find_enterprise_report(
    db: Session,
    enterprise: dict[str, Any],
    public_id: str,
) -> AppAssessmentReport:
    normalized = (public_id or "").strip()
    row = (
        db.query(AppAssessmentReport)
        .filter(
            AppAssessmentReport.PublicId == normalized,
            AppAssessmentReport.DeletedAt.is_(None),
        )
        .first()
    )
    if not row or not report_matches_enterprise(_load_dict(row.DemographicAnswers), enterprise):
        raise EnterpriseDataError("答卷不存在或不属于该企业", status_code=404)
    return row


def save_follow_up(
    db: Session,
    *,
    enterprise: dict[str, Any],
    public_id: str,
    status: str,
    severity_override: Optional[str],
    owner: str,
    note: str,
    actor: Optional[AppAccount],
) -> dict[str, Any]:
    status_value = (status or "").strip()
    if status_value not in FOLLOW_UP_STATUSES:
        raise EnterpriseDataError("跟进状态无效")
    override = (severity_override or "").strip() or None
    if override is not None and override not in SEVERITY_ORDER:
        raise EnterpriseDataError("风险等级无效")
    owner_value = (owner or "").strip()[:50]
    note_value = (note or "").strip()[:2000]
    report = _find_enterprise_report(db, enterprise, public_id)
    enterprise_id = str(enterprise["id"])
    row = (
        db.query(EnterpriseRiskFollowUp)
        .filter(
            EnterpriseRiskFollowUp.EnterpriseId == enterprise_id,
            EnterpriseRiskFollowUp.ReportPublicId == report.PublicId,
        )
        .first()
    )
    now = utc_now_naive()
    operator = _actor_name(actor)
    if row is None:
        row = EnterpriseRiskFollowUp(
            EnterpriseId=enterprise_id,
            ReportPublicId=report.PublicId,
            Status=status_value,
            CreatedAt=now,
        )
        db.add(row)
        history: list[Any] = []
    else:
        loaded = _load_json(row.HistoryJson)
        history = loaded if isinstance(loaded, list) else []
    row.Status = status_value
    row.SeverityOverride = override
    row.Owner = owner_value or None
    row.Note = note_value or None
    row.UpdatedAt = now
    row.UpdatedByAccountId = actor.Id if actor else None
    row.UpdatedByName = operator or None
    history.append(
        {
            "at": _iso(now),
            "by": operator,
            "status": status_value,
            "severityOverride": override,
            "owner": owner_value,
            "note": note_value,
        }
    )
    row.HistoryJson = json.dumps(history[-MAX_FOLLOW_UP_HISTORY:], ensure_ascii=False)
    db.commit()
    db.refresh(row)
    return _follow_up_payload(row)


# ---------------------------------------------------------------------------
# 人工标注与标签库
# ---------------------------------------------------------------------------

MAX_TAGS_PER_ANNOTATION = 20
MAX_TAG_LENGTH = 20
MAX_TAG_GROUPS = 12
MAX_TAGS_PER_GROUP = 30
_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

DEFAULT_TAG_GROUPS: list[dict[str, Any]] = [
    {
        "name": "状态观察",
        "color": "#C26A0A",
        "tags": ["近期情绪波动", "需要持续关注", "状态明显好转", "睡眠问题较突出"],
    },
    {
        "name": "参与情况",
        "color": "#1E4C9A",
        "tags": ["已参加线下团辅", "已接受个体咨询", "团辅积极分子", "已完成复测"],
    },
    {
        "name": "能力特质",
        "color": "#1F8F68",
        "tags": ["情绪觉察力强", "同伴支持者", "沟通主动性高", "可培养为心理委员"],
    },
    {
        "name": "生活场景",
        "color": "#7A4FA3",
        "tags": ["异地驻场", "跨市通勤", "家庭异地", "新婚", "新手父母", "独居"],
    },
]


def normalize_tags(value: Any, *, limit: int = MAX_TAGS_PER_ANNOTATION) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for raw in value:
        tag = re.sub(r"\s+", " ", str(raw or "")).strip()[:MAX_TAG_LENGTH]
        if not tag or tag in seen:
            continue
        seen.add(tag)
        result.append(tag)
        if len(result) >= limit:
            break
    return result


def normalize_tag_groups(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    groups: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    for raw in value:
        if not isinstance(raw, dict):
            continue
        name = re.sub(r"\s+", " ", str(raw.get("name") or "")).strip()[:20]
        if not name or name in seen_names:
            continue
        color = str(raw.get("color") or "").strip()
        if not _COLOR_RE.fullmatch(color):
            color = "#4A5A78"
        tags = normalize_tags(raw.get("tags"), limit=MAX_TAGS_PER_GROUP)
        seen_names.add(name)
        groups.append({"name": name, "color": color.upper(), "tags": tags})
        if len(groups) >= MAX_TAG_GROUPS:
            break
    return groups


def get_tag_library(enterprise: dict[str, Any]) -> list[dict[str, Any]]:
    if "dataTagGroups" in enterprise and isinstance(enterprise.get("dataTagGroups"), list):
        return normalize_tag_groups(enterprise.get("dataTagGroups"))
    return [dict(group, tags=list(group["tags"])) for group in DEFAULT_TAG_GROUPS]


def save_tag_library(enterprise_id: str, groups: Any) -> list[dict[str, Any]]:
    normalized = normalize_tag_groups(groups)
    found = {"value": False}

    def mutate(items: list[dict[str, Any]]) -> bool:
        for item in items:
            if item.get("id") == enterprise_id:
                item["dataTagGroups"] = normalized
                found["value"] = True
                return True
        return False

    mutate_enterprises(mutate)
    if not found["value"]:
        raise EnterpriseDataError("企业配置不存在", status_code=404)
    return normalized


def _annotation_payload(row: EnterpriseRespondentAnnotation) -> dict[str, Any]:
    return {
        "id": row.Id,
        "respondentKey": row.RespondentKey,
        "respondentName": row.RespondentName or "",
        "tags": _load_str_list(row.Tags),
        "note": row.Note or "",
        "source": row.Source or "",
        "operatorName": row.OperatorName or "",
        "operatorAccountId": row.OperatorAccountId,
        "createdAt": _iso(row.CreatedAt),
    }


def create_annotation(
    db: Session,
    *,
    enterprise: dict[str, Any],
    respondent_key: str,
    respondent_name: str,
    tags: Any,
    note: str,
    source: str,
    actor: Optional[AppAccount],
) -> dict[str, Any]:
    key = normalize_respondent_key(respondent_key)
    normalized_tags = normalize_tags(tags)
    note_value = (note or "").strip()[:2000]
    if not normalized_tags and not note_value:
        previous = _latest_annotation(db, str(enterprise["id"]), key)
        if previous is None or not _load_str_list(previous.Tags):
            raise EnterpriseDataError("请至少选择一个标签或填写观察记录")
    row = EnterpriseRespondentAnnotation(
        EnterpriseId=str(enterprise["id"]),
        RespondentKey=key,
        RespondentName=(respondent_name or "").strip()[:100] or None,
        Tags=json.dumps(normalized_tags, ensure_ascii=False),
        Note=note_value or None,
        Source=(source or "").strip()[:100] or None,
        OperatorAccountId=actor.Id if actor else None,
        OperatorName=_actor_name(actor) or None,
        CreatedAt=utc_now_naive(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _annotation_payload(row)


def _latest_annotation(
    db: Session,
    enterprise_id: str,
    respondent_key: str,
) -> Optional[EnterpriseRespondentAnnotation]:
    return (
        db.query(EnterpriseRespondentAnnotation)
        .filter(
            EnterpriseRespondentAnnotation.EnterpriseId == enterprise_id,
            EnterpriseRespondentAnnotation.RespondentKey == respondent_key,
            EnterpriseRespondentAnnotation.DeletedAt.is_(None),
        )
        .order_by(
            EnterpriseRespondentAnnotation.CreatedAt.desc(),
            EnterpriseRespondentAnnotation.Id.desc(),
        )
        .first()
    )


def delete_annotation(
    db: Session,
    *,
    enterprise: dict[str, Any],
    annotation_id: int,
    actor: Optional[AppAccount],
    is_admin: bool,
) -> None:
    row = (
        db.query(EnterpriseRespondentAnnotation)
        .filter(
            EnterpriseRespondentAnnotation.Id == annotation_id,
            EnterpriseRespondentAnnotation.EnterpriseId == str(enterprise["id"]),
            EnterpriseRespondentAnnotation.DeletedAt.is_(None),
        )
        .first()
    )
    if not row:
        raise EnterpriseDataError("标注记录不存在", status_code=404)
    if not is_admin and (actor is None or row.OperatorAccountId != actor.Id):
        raise EnterpriseDataError("只能删除自己添加的标注记录", status_code=403)
    row.DeletedAt = utc_now_naive()
    db.commit()


def _annotation_state(db: Session, enterprise_id: str) -> dict[str, Any]:
    rows = (
        db.query(EnterpriseRespondentAnnotation)
        .filter(
            EnterpriseRespondentAnnotation.EnterpriseId == enterprise_id,
            EnterpriseRespondentAnnotation.DeletedAt.is_(None),
        )
        .order_by(
            EnterpriseRespondentAnnotation.CreatedAt.asc(),
            EnterpriseRespondentAnnotation.Id.asc(),
        )
        .all()
    )
    latest: dict[str, EnterpriseRespondentAnnotation] = {}
    latest_note: dict[str, EnterpriseRespondentAnnotation] = {}
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        latest[row.RespondentKey] = row
        counts[row.RespondentKey] += 1
        if row.Note:
            latest_note[row.RespondentKey] = row
    recent = [_annotation_payload(row) for row in reversed(rows[-40:])]
    return {"latest": latest, "latestNote": latest_note, "counts": counts, "recent": recent}


# ---------------------------------------------------------------------------
# 知识库学习记录
# ---------------------------------------------------------------------------

LEARNING_CONTENT_TYPES = frozenset({"article", "audio"})
LEARNING_ACTIONS = frozenset({"view", "read", "play", "complete"})
LEARNING_DEDUPE_ACTIONS = frozenset({"view", "play", "complete"})
LEARNING_DEDUPE_WINDOW = timedelta(minutes=30)
LEARNING_MIN_READ_SECONDS = 5
LEARNING_MAX_DURATION_SECONDS = 4 * 3600
_CONTENT_ID_CLEAN = re.compile(r"[^A-Za-z0-9_.:\-]")


def record_learning_event(
    db: Session,
    *,
    enterprise: dict[str, Any],
    visitor_key: str,
    personnel_id: Optional[int],
    content_type: str,
    content_id: str,
    content_title: str,
    action: str,
    duration_sec: Optional[int],
    now: Optional[datetime] = None,
) -> bool:
    key = normalize_visitor_key(visitor_key)
    if not key:
        raise EnterpriseDataError("访客标识无效")
    kind = (content_type or "").strip()
    if kind not in LEARNING_CONTENT_TYPES:
        raise EnterpriseDataError("内容类型无效")
    act = (action or "").strip()
    if act not in LEARNING_ACTIONS:
        raise EnterpriseDataError("行为类型无效")
    item_id = _CONTENT_ID_CLEAN.sub("", (content_id or "").strip())[:120]
    if not item_id:
        raise EnterpriseDataError("内容标识无效")
    title = re.sub(r"\s+", " ", str(content_title or "")).strip()[:200]
    duration: Optional[int] = None
    if duration_sec is not None:
        try:
            duration = max(0, min(int(duration_sec), LEARNING_MAX_DURATION_SECONDS))
        except (TypeError, ValueError):
            duration = None
    if act == "read" and (duration is None or duration < LEARNING_MIN_READ_SECONDS):
        return False

    current = now or utc_now_naive()
    enterprise_id = str(enterprise["id"])
    openid = enterprise_visitor_openid(str(enterprise["slug"]), key)
    if act in LEARNING_DEDUPE_ACTIONS:
        duplicate = (
            db.query(EnterpriseLearningEvent.Id)
            .filter(
                EnterpriseLearningEvent.EnterpriseId == enterprise_id,
                EnterpriseLearningEvent.VisitorOpenId == openid,
                EnterpriseLearningEvent.ContentType == kind,
                EnterpriseLearningEvent.ContentId == item_id,
                EnterpriseLearningEvent.Action == act,
                EnterpriseLearningEvent.CreatedAt >= current - LEARNING_DEDUPE_WINDOW,
                EnterpriseLearningEvent.CreatedAt <= current + LEARNING_DEDUPE_WINDOW,
            )
            .first()
        )
        if duplicate:
            return False
    db.add(
        EnterpriseLearningEvent(
            EnterpriseId=enterprise_id,
            EnterpriseSlug=str(enterprise["slug"])[:80],
            VisitorOpenId=openid,
            PersonnelId=personnel_id if personnel_id and personnel_id > 0 else None,
            ContentType=kind,
            ContentId=item_id,
            ContentTitle=title or None,
            Action=act,
            DurationSec=duration if act in {"read", "complete"} else None,
            CreatedAt=current,
        )
    )
    db.commit()
    return True


def _account_openids(db: Session, account_ids: Iterable[int]) -> dict[int, str]:
    ids = sorted({int(item) for item in account_ids if item})
    result: dict[int, str] = {}
    # SQL Server 单条语句参数上限约 2100，分批查询。
    for start in range(0, len(ids), 900):
        chunk = ids[start : start + 900]
        for account_id, openid in (
            db.query(AppAccount.Id, AppAccount.OpenId)
            .filter(AppAccount.Id.in_(chunk))
            .all()
        ):
            if openid:
                result[int(account_id)] = str(openid)
    return result


_VIEW_ACTIONS = ("view", "play")


def _learning_summary(
    db: Session,
    enterprise_id: str,
    openid_to_key: dict[str, str],
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    view_count = func.sum(case((EnterpriseLearningEvent.Action.in_(_VIEW_ACTIONS), 1), else_=0))
    complete_count = func.sum(case((EnterpriseLearningEvent.Action == "complete", 1), else_=0))
    duration_sum = func.sum(func.coalesce(EnterpriseLearningEvent.DurationSec, 0))

    per_visitor = (
        db.query(
            EnterpriseLearningEvent.VisitorOpenId,
            EnterpriseLearningEvent.PersonnelId,
            view_count,
            complete_count,
            duration_sum,
            func.max(EnterpriseLearningEvent.CreatedAt),
        )
        .filter(EnterpriseLearningEvent.EnterpriseId == enterprise_id)
        .group_by(EnterpriseLearningEvent.VisitorOpenId, EnterpriseLearningEvent.PersonnelId)
        .all()
    )
    learners: set[str] = set()
    per_respondent: dict[str, dict[str, Any]] = {}
    total_views = 0
    total_seconds = 0
    linked: set[str] = set()
    for openid, personnel_id, views, completes, seconds, last_at in per_visitor:
        learner = f"p{personnel_id}" if personnel_id else f"v{openid}"
        learners.add(learner)
        views = int(views or 0)
        seconds = int(seconds or 0)
        total_views += views
        total_seconds += seconds
        key = f"p{personnel_id}" if personnel_id else openid_to_key.get(str(openid))
        if not key:
            continue
        linked.add(learner)
        bucket = per_respondent.setdefault(
            key,
            {"views": 0, "completes": 0, "minutes": 0, "seconds": 0, "lastAt": None},
        )
        bucket["views"] += views
        bucket["completes"] += int(completes or 0)
        bucket["seconds"] += seconds
        last_iso = _iso(last_at)
        if last_iso and (bucket["lastAt"] is None or last_iso > bucket["lastAt"]):
            bucket["lastAt"] = last_iso
    for bucket in per_respondent.values():
        bucket["minutes"] = round(bucket.pop("seconds") / 60)

    per_content = (
        db.query(
            EnterpriseLearningEvent.ContentType,
            EnterpriseLearningEvent.ContentId,
            func.max(EnterpriseLearningEvent.ContentTitle),
            view_count,
            complete_count,
            func.count(func.distinct(EnterpriseLearningEvent.VisitorOpenId)),
            duration_sum,
        )
        .filter(EnterpriseLearningEvent.EnterpriseId == enterprise_id)
        .group_by(EnterpriseLearningEvent.ContentType, EnterpriseLearningEvent.ContentId)
        .all()
    )
    contents = [
        {
            "contentType": content_type,
            "contentId": content_id,
            "title": title or content_id,
            "views": int(views or 0),
            "completes": int(completes or 0),
            "learners": int(learner_count or 0),
            "minutes": round(int(seconds or 0) / 60),
        }
        for content_type, content_id, title, views, completes, learner_count, seconds in per_content
    ]
    contents.sort(key=lambda item: (-item["views"], -item["learners"], item["title"]))
    summary = {
        "totalViews": total_views,
        "learnerCount": len(learners),
        "linkedLearnerCount": len(linked),
        "totalMinutes": round(total_seconds / 60),
        "articleViews": sum(item["views"] for item in contents if item["contentType"] == "article"),
        "audioPlays": sum(item["views"] for item in contents if item["contentType"] == "audio"),
        "topContents": contents[:12],
    }
    return summary, per_respondent


def respondent_learning_events(
    db: Session,
    *,
    enterprise_id: str,
    respondent_key: str,
    account_ids: Iterable[int],
    limit: int = 100,
) -> list[dict[str, Any]]:
    filters = []
    if respondent_key.startswith("p"):
        filters.append(EnterpriseLearningEvent.PersonnelId == int(respondent_key[1:]))
    openids = list(_account_openids(db, account_ids).values())
    if openids:
        filters.append(EnterpriseLearningEvent.VisitorOpenId.in_(openids[:900]))
    if not filters:
        return []
    rows = (
        db.query(EnterpriseLearningEvent)
        .filter(EnterpriseLearningEvent.EnterpriseId == enterprise_id, or_(*filters))
        .order_by(EnterpriseLearningEvent.CreatedAt.desc(), EnterpriseLearningEvent.Id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "contentType": row.ContentType,
            "contentId": row.ContentId,
            "title": row.ContentTitle or row.ContentId,
            "action": row.Action,
            "durationSec": row.DurationSec,
            "at": _iso(row.CreatedAt),
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# 量表元信息
# ---------------------------------------------------------------------------

_RESULT_TYPE_BY_SCORING = {
    "sum": "sum",
    "psqi": "sum",
    "dimension": "dimension",
    "pbi": "dimension",
    "cbcl": "dimension",
    "dark-light": "dimension",
    "match": "match",
    "aas": "match",
}


def _definition(assessment_id: str) -> Optional[dict[str, Any]]:
    try:
        from assessment_routes import get_assessment_store

        result = get_assessment_store().get_published(assessment_id)
    except Exception:  # noqa: BLE001 - 量表可能已归档或删除，退回答卷快照信息
        return None
    definition = result.get("definition") if isinstance(result, dict) else None
    return definition if isinstance(definition, dict) else None


def _range_levels(ranges: Any) -> list[str]:
    if not isinstance(ranges, list):
        return []
    ordered = sorted(
        (item for item in ranges if isinstance(item, dict)),
        key=lambda item: float(item.get("min") or 0),
    )
    levels: list[str] = []
    for item in ordered:
        level = str(item.get("level") or "").strip()
        if level and level not in levels:
            levels.append(level)
    return levels


def _assessment_meta(
    enterprise: dict[str, Any],
    reports: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    authorized = [str(item) for item in (enterprise.get("assessmentIds") or []) if str(item).strip()]
    titles = enterprise.get("assessmentTitles") or {}
    from_reports: dict[str, dict[str, Any]] = {}
    for report in reports:
        entry = from_reports.setdefault(
            report["assessmentId"],
            {"title": report["assessmentTitle"], "resultType": report["resultType"], "dimensions": []},
        )
        entry["title"] = report["assessmentTitle"] or entry["title"]
        if report["resultType"]:
            entry["resultType"] = report["resultType"]
        known = {item["id"] for item in entry["dimensions"]}
        for dimension in report["dimensions"]:
            if dimension["id"] and dimension["id"] not in known:
                entry["dimensions"].append({"id": dimension["id"], "title": dimension["title"], "levels": []})
                known.add(dimension["id"])

    ordered_ids = list(authorized) + [item for item in from_reports if item not in authorized]
    result: list[dict[str, Any]] = []
    for assessment_id in ordered_ids:
        definition = _definition(assessment_id)
        seen = from_reports.get(assessment_id) or {}
        override = str(titles.get(assessment_id) or "").strip()
        scoring_type = str((definition or {}).get("scoringType") or "")
        result_type = seen.get("resultType") or _RESULT_TYPE_BY_SCORING.get(scoring_type)
        dimensions = [dict(item) for item in seen.get("dimensions") or []]
        if definition and isinstance(definition.get("dimensions"), list):
            by_id = {item["id"]: item for item in dimensions}
            for raw in definition["dimensions"]:
                if not isinstance(raw, dict) or not raw.get("id"):
                    continue
                dimension_id = str(raw["id"])
                levels = _range_levels(raw.get("scoreRanges"))
                if dimension_id in by_id:
                    by_id[dimension_id]["levels"] = levels
                else:
                    item = {"id": dimension_id, "title": str(raw.get("title") or dimension_id), "levels": levels}
                    dimensions.append(item)
                    by_id[dimension_id] = item
        result.append(
            {
                "id": assessment_id,
                "title": override or (definition or {}).get("title") or seen.get("title") or assessment_id,
                "authorized": assessment_id in authorized,
                "resultType": result_type,
                "levels": _range_levels((definition or {}).get("scoreRanges")),
                "dimensions": dimensions,
            }
        )
    return result


# ---------------------------------------------------------------------------
# 数据集
# ---------------------------------------------------------------------------


def _enterprise_meta(db: Session, enterprise: dict[str, Any]) -> dict[str, Any]:
    enterprise_id = str(enterprise.get("id") or "")
    summary = personnel_summary(db, enterprise_id) if enterprise_id else {
        "employeeCount": 0,
        "adminCount": 0,
        "totalCount": 0,
    }
    return {
        "id": enterprise_id,
        "companyName": str(enterprise.get("companyName") or ""),
        "siteName": str(enterprise.get("siteName") or ""),
        "slug": str(enterprise.get("slug") or ""),
        "url": str(enterprise.get("url") or ""),
        "logoUrl": str(enterprise.get("logoUrl") or ""),
        "assessmentIds": [str(item) for item in (enterprise.get("assessmentIds") or [])],
        "loginRequired": login_required(db, str(enterprise.get("slug") or "")),
        "personnelEmployeeCount": summary["employeeCount"],
        "personnelAdminCount": summary["adminCount"],
        "hideLibrary": bool(enterprise.get("hideLibrary")),
    }


def _build_reports(
    report_rows: list[tuple[AppAssessmentReport, dict[str, Any]]],
    follow_ups: dict[str, EnterpriseRiskFollowUp],
    titles: dict[str, str],
) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for row, meta in report_rows:
        key = respondent_key_for(meta, row.AccountId)
        summary = summarize_result(_load_json(row.ResultJson))
        follow = follow_ups.get(row.PublicId)
        override = (
            follow.SeverityOverride
            if follow is not None and follow.SeverityOverride in SEVERITY_ORDER
            else None
        )
        item = {
            "publicId": row.PublicId,
            "respondentKey": key,
            "accountId": int(row.AccountId),
            "assessmentId": row.AssessmentId,
            "assessmentVersion": int(row.AssessmentVersion),
            "assessmentTitle": str(titles.get(row.AssessmentId) or "").strip() or row.AssessmentTitle,
            "scoringType": row.ScoringType,
            "completedAt": _iso(row.CompletedAt),
            "summary": row.ResultSummary or "",
            "resultType": summary["resultType"],
            "score": summary["score"],
            "level": summary["level"],
            "dimensions": summary["dimensions"],
            "autoSeverity": summary["autoSeverity"],
            "severity": override or summary["autoSeverity"],
            "triggers": summary["triggers"],
            "risk": summary["risk"],
            "isLatest": False,
            "followUp": _follow_up_payload(follow) if follow is not None else None,
            "_info": _employee_info(meta),
            "_personnel": _personnel_meta(meta),
        }
        reports.append(item)
        latest[(key, row.AssessmentId)] = item
    for item in latest.values():
        item["isLatest"] = True
    return reports


def build_enterprise_dataset(db: Session, enterprise: dict[str, Any]) -> dict[str, Any]:
    enterprise_id = str(enterprise.get("id") or "")
    authorized = [str(item) for item in (enterprise.get("assessmentIds") or []) if str(item).strip()]
    titles = enterprise.get("assessmentTitles") or {}
    report_rows = enterprise_report_rows(db, enterprise)
    reports = _build_reports(report_rows, _follow_up_map(db, enterprise_id), titles)
    annotations = _annotation_state(db, enterprise_id)

    respondents: dict[str, dict[str, Any]] = {}
    seen_info_keys: set[str] = set()
    for report in reports:
        key = report["respondentKey"]
        info = report.pop("_info")
        personnel = report.pop("_personnel")
        seen_info_keys.update(info)
        respondent = respondents.get(key)
        if respondent is None:
            respondent = {
                "key": key,
                "accountIds": [],
                "personnel": None,
                "info": {},
                "firstAt": report["completedAt"],
                "lastAt": report["completedAt"],
                "reportCount": 0,
            }
            respondents[key] = respondent
        if report["accountId"] not in respondent["accountIds"]:
            respondent["accountIds"].append(report["accountId"])
        if personnel:
            respondent["personnel"] = personnel
        respondent["info"].update(info)
        respondent["lastAt"] = report["completedAt"]
        respondent["reportCount"] += 1

    latest_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for report in reports:
        if report["isLatest"]:
            latest_by_key[report["respondentKey"]].append(report)

    account_openids = _account_openids(
        db,
        (account_id for respondent in respondents.values() for account_id in respondent["accountIds"]),
    )
    openid_to_key: dict[str, str] = {}
    for respondent in respondents.values():
        for account_id in respondent["accountIds"]:
            openid = account_openids.get(account_id)
            if openid:
                openid_to_key[openid] = respondent["key"]
    learning_summary, learning_by_key = _learning_summary(db, enterprise_id, openid_to_key)

    authorized_set = set(authorized)
    respondent_items: list[dict[str, Any]] = []
    for key, respondent in respondents.items():
        latest_reports = latest_by_key.get(key, [])
        completed_ids = sorted({item["assessmentId"] for item in latest_reports})
        latest_annotation = annotations["latest"].get(key)
        latest_note = annotations["latestNote"].get(key)
        info = respondent["info"]
        personnel = respondent["personnel"]
        first_account = respondent["accountIds"][0] if respondent["accountIds"] else None
        completed_authorized = len(authorized_set.intersection(completed_ids))
        respondent_items.append(
            {
                "key": key,
                "accountIds": respondent["accountIds"],
                "personnel": personnel,
                "name": info.get("name") or (personnel or {}).get("realName") or "",
                "empNo": info.get("empNo") or (personnel or {}).get("empNo") or "",
                "displayName": _display_name(info, personnel, first_account),
                "info": info,
                "firstAt": respondent["firstAt"],
                "lastAt": respondent["lastAt"],
                "reportCount": respondent["reportCount"],
                "completedAssessmentIds": completed_ids,
                "completedCount": completed_authorized,
                "status": (
                    "done"
                    if authorized_set and completed_authorized >= len(authorized_set)
                    else "doing"
                ),
                "severity": max_severity(item["severity"] for item in latest_reports),
                "tags": _load_str_list(latest_annotation.Tags) if latest_annotation else [],
                "annotationCount": annotations["counts"].get(key, 0),
                "lastAnnotatedAt": _iso(latest_annotation.CreatedAt) if latest_annotation else None,
                "lastNote": (latest_note.Note or "") if latest_note else "",
                "lastNoteBy": (latest_note.OperatorName or "") if latest_note else "",
                "lastNoteAt": _iso(latest_note.CreatedAt) if latest_note else None,
                "learning": learning_by_key.get(key),
            }
        )
    respondent_items.sort(key=lambda item: item["lastAt"] or "", reverse=True)

    roster_rows = (
        db.query(EnterpriseSitePersonnel)
        .filter(
            EnterpriseSitePersonnel.EnterpriseId == enterprise_id,
            EnterpriseSitePersonnel.Role == ROLE_EMPLOYEE,
        )
        .order_by(EnterpriseSitePersonnel.Id.asc())
        .all()
    )
    roster = [
        {
            "personnelId": row.Id,
            "username": row.Username,
            "empNo": row.EmpNo or "",
            "realName": row.RealName or "",
            "respondentKey": f"p{row.Id}" if f"p{row.Id}" in respondents else None,
        }
        for row in roster_rows
    ]

    return {
        "enterprise": _enterprise_meta(db, enterprise),
        "generatedAt": _iso(utc_now_naive()),
        "fields": enterprise_info_fields(enterprise, seen_info_keys),
        "assessments": _assessment_meta(enterprise, reports),
        "respondents": respondent_items,
        "reports": reports,
        "roster": roster,
        "learning": learning_summary,
        "tagLibrary": get_tag_library(enterprise),
        "recentAnnotations": annotations["recent"],
        "followUpStatuses": [{"value": value, "label": label} for value, label in FOLLOW_UP_STATUSES.items()],
    }


def respondent_detail(
    db: Session,
    *,
    enterprise: dict[str, Any],
    respondent_key: str,
    account_ids: Iterable[int] = (),
) -> dict[str, Any]:
    key = normalize_respondent_key(respondent_key)
    enterprise_id = str(enterprise["id"])
    annotations = (
        db.query(EnterpriseRespondentAnnotation)
        .filter(
            EnterpriseRespondentAnnotation.EnterpriseId == enterprise_id,
            EnterpriseRespondentAnnotation.RespondentKey == key,
            EnterpriseRespondentAnnotation.DeletedAt.is_(None),
        )
        .order_by(
            EnterpriseRespondentAnnotation.CreatedAt.desc(),
            EnterpriseRespondentAnnotation.Id.desc(),
        )
        .all()
    )
    accounts = set(int(item) for item in account_ids if item)
    if key.startswith("a"):
        accounts.add(int(key[1:]))
    return {
        "key": key,
        "annotations": [_annotation_payload(row) for row in annotations],
        "learningEvents": respondent_learning_events(
            db,
            enterprise_id=enterprise_id,
            respondent_key=key,
            account_ids=accounts,
        ),
    }


# ---------------------------------------------------------------------------
# 企业列表概况
# ---------------------------------------------------------------------------


def list_enterprise_data_summaries(db: Session) -> list[dict[str, Any]]:
    enterprises = list_enterprises()
    by_id = {str(item.get("id")): item for item in enterprises if item.get("id")}
    by_slug = {str(item.get("slug")): item for item in enterprises if item.get("slug")}
    stats: dict[str, dict[str, Any]] = {
        key: {
            "respondents": set(),
            "reportCount": 0,
            "latestAt": None,
            "latest": {},
        }
        for key in by_id
    }
    follow_rows = db.query(EnterpriseRiskFollowUp).all()
    follow_ups = {(row.EnterpriseId, row.ReportPublicId): row for row in follow_rows}

    query = _enterprise_report_query(db, None)
    for row in query.all() if query is not None else []:
        meta = _load_dict(row.DemographicAnswers)
        enterprise_id = str(meta.get("_enterpriseId") or "").strip()
        enterprise = by_id.get(enterprise_id) if enterprise_id else by_slug.get(
            str(meta.get("_enterpriseSlug") or "").strip()
        )
        if not enterprise:
            continue
        bucket = stats[str(enterprise["id"])]
        key = respondent_key_for(meta, row.AccountId)
        bucket["respondents"].add(key)
        bucket["reportCount"] += 1
        completed = _iso(row.CompletedAt)
        if completed and (bucket["latestAt"] is None or completed > bucket["latestAt"]):
            bucket["latestAt"] = completed
        bucket["latest"][(key, row.AssessmentId)] = row

    personnel_rows = (
        db.query(EnterpriseSitePersonnel.EnterpriseId, EnterpriseSitePersonnel.Role)
        .all()
    )
    personnel_counts: dict[str, int] = defaultdict(int)
    for enterprise_id, role in personnel_rows:
        if role == ROLE_EMPLOYEE:
            personnel_counts[enterprise_id] += 1

    result: list[dict[str, Any]] = []
    for enterprise in enterprises:
        enterprise_id = str(enterprise.get("id") or "")
        bucket = stats.get(enterprise_id) or {"respondents": set(), "reportCount": 0, "latestAt": None, "latest": {}}
        risk_respondents: set[str] = set()
        high_respondents: set[str] = set()
        pending_alerts = 0
        for (key, _assessment_id), row in bucket["latest"].items():
            summary = summarize_result(_load_json(row.ResultJson))
            follow = follow_ups.get((enterprise_id, row.PublicId))
            override = (
                follow.SeverityOverride
                if follow is not None and follow.SeverityOverride in SEVERITY_ORDER
                else None
            )
            severity = override or summary["autoSeverity"]
            if severity in ("mid", "high"):
                risk_respondents.add(key)
                if severity == "high":
                    high_respondents.add(key)
                if follow is None or follow.Status not in CLOSED_FOLLOW_UP_STATUSES:
                    pending_alerts += 1
        result.append(
            {
                "id": enterprise_id,
                "companyName": str(enterprise.get("companyName") or ""),
                "siteName": str(enterprise.get("siteName") or ""),
                "slug": str(enterprise.get("slug") or ""),
                "url": str(enterprise.get("url") or ""),
                "logoUrl": str(enterprise.get("logoUrl") or ""),
                "assessmentCount": len(enterprise.get("assessmentIds") or []),
                "personnelEmployeeCount": personnel_counts.get(enterprise_id, 0),
                "respondentCount": len(bucket["respondents"]),
                "reportCount": bucket["reportCount"],
                "riskRespondentCount": len(risk_respondents),
                "highRiskRespondentCount": len(high_respondents),
                "pendingAlertCount": pending_alerts,
                "latestAt": bucket["latestAt"],
            }
        )
    return result


# ---------------------------------------------------------------------------
# 删除答卷（管理员）
# ---------------------------------------------------------------------------


def delete_enterprise_report(
    db: Session,
    *,
    enterprise: dict[str, Any],
    public_id: str,
    actor: AppAccount,
    request_id: Optional[str] = None,
) -> None:
    row = _find_enterprise_report(db, enterprise, public_id)
    deleted_at = utc_now_naive()
    row.DemographicAnswers = None
    row.Answers = None
    row.ResultJson = None
    row.ResultSummary = None
    row.ReportSnapshot = None
    row.SnapshotSha256 = None
    row.DeletedAt = deleted_at
    db.query(EnterpriseRiskFollowUp).filter(
        EnterpriseRiskFollowUp.EnterpriseId == str(enterprise["id"]),
        EnterpriseRiskFollowUp.ReportPublicId == row.PublicId,
    ).delete(synchronize_session=False)
    begin_assessment_audit(
        db,
        actor=actor,
        action="REPORT_DELETE",
        target_type="REPORT",
        request_id=request_id,
        target_public_id=row.PublicId,
        assessment_id=row.AssessmentId,
        assessment_version=row.AssessmentVersion,
        metadata={"source": "enterprise-data", "enterpriseId": str(enterprise["id"])},
        outcome="SUCCEEDED",
    )
    db.commit()


# ---------------------------------------------------------------------------
# Excel 导出
# ---------------------------------------------------------------------------

SEVERITY_LABELS = {"high": "高风险", "mid": "中度风险", "watch": "一般关注", "ok": "状态良好"}
STATUS_LABELS = {"done": "已完成", "doing": "进行中", "todo": "未开始"}


def _china_text(iso_value: Optional[str]) -> str:
    if not iso_value:
        return ""
    try:
        value = datetime.fromisoformat(iso_value.replace("Z", "+00:00"))
    except ValueError:
        return iso_value
    return format_china_system_time(value.astimezone(timezone.utc).replace(tzinfo=None))


def _style_sheet(sheet, headers: list[str], widths: dict[int, int] | None = None) -> None:
    header_fill = PatternFill("solid", fgColor="3D5A4E")
    header_font = Font(color="FFFFFF", bold=True)
    for index, title in enumerate(headers, start=1):
        cell = sheet.cell(1, index, title)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        sheet.column_dimensions[cell.column_letter].width = (widths or {}).get(index, 16)
    sheet.freeze_panes = "A2"


def _dimension_text(report: dict[str, Any]) -> str:
    return "；".join(
        f"{item['title']} {item['score'] if item['score'] is not None else '-'}（{item['level'] or '-'}）"
        for item in report.get("dimensions") or []
    )


def export_enterprise_dataset_xlsx(db: Session, enterprise: dict[str, Any]) -> Response:
    dataset = build_enterprise_dataset(db, enterprise)
    # 姓名、工号作为固定列（已合并站点人员表信息），其余员工信息字段逐列展开
    fields = [field for field in dataset["fields"] if field["id"] not in {"name", "empNo"}]
    respondents = {item["key"]: item for item in dataset["respondents"]}
    workbook = Workbook()

    sheet = workbook.active
    sheet.title = "答卷明细"
    fixed = 3
    headers = ["姓名", "工号", "站点账号", *[field["label"] for field in fields], "量表", "完成时间（北京时间）",
               "结果摘要", "总分", "等级/结果", "维度结果", "风险等级", "风险来源", "跟进状态", "跟进人", "跟进备注", "人工标签"]
    _style_sheet(
        sheet,
        headers,
        {
            1: 14,
            len(fields) + fixed + 1: 24,
            len(fields) + fixed + 2: 20,
            len(fields) + fixed + 3: 36,
            len(fields) + fixed + 6: 48,
        },
    )
    row_index = 2
    for report in sorted(dataset["reports"], key=lambda item: item["completedAt"] or "", reverse=True):
        respondent = respondents.get(report["respondentKey"]) or {}
        follow = report.get("followUp") or {}
        values = [
            respondent.get("name") or respondent.get("displayName", ""),
            respondent.get("empNo", ""),
            (respondent.get("personnel") or {}).get("username", ""),
            *[(respondent.get("info") or {}).get(field["id"], "") for field in fields],
            report["assessmentTitle"],
            _china_text(report["completedAt"]),
            report["summary"],
            report["score"] if report["score"] is not None else "",
            report["level"],
            _dimension_text(report),
            SEVERITY_LABELS.get(report["severity"] or "", "未分级"),
            _severity_source_text(report, follow),
            FOLLOW_UP_STATUSES.get(follow.get("status") or "", "") if follow else "",
            follow.get("owner", "") if follow else "",
            follow.get("note", "") if follow else "",
            "、".join(respondent.get("tags") or []),
        ]
        for column, value in enumerate(values, start=1):
            sheet.cell(row_index, column, value)
        row_index += 1

    summary_sheet = workbook.create_sheet("员工汇总")
    summary_headers = ["姓名", "工号", "站点账号", *[field["label"] for field in fields], "完成量表数",
                       "答卷数", "首次填写", "最近填写", "最高风险等级", "人工标签", "最新观察记录", "知识库学习次数", "学习时长（分钟）"]
    _style_sheet(summary_sheet, summary_headers)
    for offset, respondent in enumerate(dataset["respondents"], start=2):
        learning = respondent.get("learning") or {}
        values = [
            respondent["name"] or respondent["displayName"],
            respondent["empNo"],
            (respondent.get("personnel") or {}).get("username", ""),
            *[respondent["info"].get(field["id"], "") for field in fields],
            respondent["completedCount"],
            respondent["reportCount"],
            _china_text(respondent["firstAt"]),
            _china_text(respondent["lastAt"]),
            SEVERITY_LABELS.get(respondent["severity"] or "", "未分级"),
            "、".join(respondent["tags"]),
            respondent["lastNote"],
            learning.get("views", 0),
            learning.get("minutes", 0),
        ]
        for column, value in enumerate(values, start=1):
            summary_sheet.cell(offset, column, value)

    if dataset["roster"]:
        roster_sheet = workbook.create_sheet("人员表完成情况")
        _style_sheet(roster_sheet, ["站点账号", "工号", "姓名", "完成状态", "完成量表数"])
        authorized = len(dataset["enterprise"]["assessmentIds"])
        for offset, person in enumerate(dataset["roster"], start=2):
            respondent = respondents.get(person["respondentKey"] or "")
            if respondent is None:
                status = STATUS_LABELS["todo"]
                completed = 0
            else:
                status = STATUS_LABELS.get(respondent["status"], "")
                completed = respondent["completedCount"]
            values = [
                person["username"],
                person["empNo"],
                person["realName"] or (respondent or {}).get("name", ""),
                status,
                f"{completed}/{authorized}" if authorized else completed,
            ]
            for column, value in enumerate(values, start=1):
                roster_sheet.cell(offset, column, value)

    output = BytesIO()
    workbook.save(output)
    company = re.sub(r'[\\/:*?"<>|]+', "", str(enterprise.get("companyName") or "企业"))[:40] or "企业"
    filename = f"{company}-企业定制数据.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="enterprise-data.xlsx"; filename*=UTF-8\'\'{quote(filename)}'
            )
        },
    )


def require_enterprise(enterprise_id: str) -> dict[str, Any]:
    from assessment_enterprise_service import get_enterprise_by_id

    try:
        return get_enterprise_by_id(enterprise_id)
    except EnterpriseConfigError as exc:
        raise EnterpriseDataError(str(exc), status_code=404) from exc
