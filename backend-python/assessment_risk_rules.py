"""风险编辑（定义里的 ``riskDimension``）的规则结构与旧格式升级。

风险只给管理端看（见 assessment_visibility.py）。结构按风险等级组织，四个等级都可以不配置：

    {
      "title": "风险",
      "intro": "判定口径说明（仅后台）",
      "levels": {
        "high":  {"rules": [...], "analystDescription": "...", "suggestions": [...]},
        "mid":   {...},
        "watch": {...},
        "ok":    {"rules": [...], "fallback": true}
      }
    }

同一等级内任意一条规则命中即命中该等级；多个等级同时命中时取风险最高的等级。
没有任何规则命中时：``ok.fallback`` 为 true 判为无风险，否则不判定（severity 为 null，
企业数据按结果等级文字自动识别）。

规则类型：
- ``dimension``：已编辑维度（或总分，ID 为 ``__total__``）的结果落在所选区间，按区间的等级名称匹配；
- ``score``：单独设置一套「选题 + 计算方式」，得分落在 [min, max]，任一端为 null 表示不限；
- ``options``：选项触发。``any`` 为选中任意一个即触发；``multiple`` 为至少同时选中
  ``minCount`` 个（缺省为全部选中）。
"""

from __future__ import annotations

import copy
import re
from typing import Any, Iterator

RISK_SEVERITIES = ("high", "mid", "watch", "ok")
RISK_SEVERITY_RANK = {"ok": 0, "watch": 1, "mid": 2, "high": 3}
RISK_SEVERITY_LABELS = {
    "high": "高风险",
    "mid": "中风险",
    "watch": "一般关注",
    "ok": "无风险",
}
RISK_UNMATCHED_LABEL = "未命中规则"
# 规则 A 引用总分时使用的保留 ID：维度量表的 totalScore，或求和量表本身的总分区间。
RISK_TOTAL_SOURCE_ID = "__total__"
RISK_RULE_TYPES = ("dimension", "score", "options")
RISK_OPTION_MATCH_MODES = ("any", "multiple")
RISK_SCORE_RULE_DEFAULT_TITLE = "风险计分"
SCORE_CALCULATION_KEYS = (
    "questionIds",
    "reverseQuestionIds",
    "calculationMode",
    "aggregate",
    "formula",
)
LEGACY_RISK_FIELDS = {"scoring", "triggers"}

_STABLE_ID_PATTERN = re.compile(r"^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$")


def is_legacy_risk_dimension(value: Any) -> bool:
    """旧版风险维度：一套计分区间（scoring）+ 选项触发（triggers），没有 levels。"""
    return (
        isinstance(value, dict)
        and "levels" not in value
        and bool(value.keys() & LEGACY_RISK_FIELDS)
    )


def upgrade_legacy_risk_dimension(value: Any) -> Any:
    """把旧版风险维度转换为按等级配置的规则；新格式或非对象原样返回，不修改入参。

    - 旧计分的每个区间 → 对应等级里的一条 score 规则（沿用同一套计算方式）；
    - 旧触发规则 → 对应等级里的一条「任意一项被选」选项规则；
    - 区间 / 触发的分析说明与跟进建议合并到所属等级；
    - 旧版只配置选项触发时，未触发判为无风险，转换后用 ok.fallback 保持这一口径。
    """
    if not is_legacy_risk_dimension(value):
        return value
    used: set[str] = set()
    trigger_ids: list[str | None] = []
    triggers = value.get("triggers")
    trigger_items = [item for item in triggers if isinstance(item, dict)] if isinstance(triggers, list) else []
    for trigger in trigger_items:
        preferred = trigger.get("id")
        if (
            isinstance(preferred, str)
            and _STABLE_ID_PATTERN.fullmatch(preferred)
            and preferred not in used
        ):
            used.add(preferred)
            trigger_ids.append(preferred)
        else:
            trigger_ids.append(None)

    def allocate() -> str:
        index = 1
        while f"rule-{index}" in used:
            index += 1
        rule_id = f"rule-{index}"
        used.add(rule_id)
        return rule_id

    levels: dict[str, dict[str, Any]] = {}

    def add(severity: Any, rule: dict[str, Any], description: Any, suggestions: Any) -> None:
        if severity not in RISK_SEVERITIES:
            return
        level = levels.setdefault(str(severity), {"rules": []})
        level["rules"].append(rule)
        text = description.strip() if isinstance(description, str) else ""
        if text:
            current = str(level.get("analystDescription") or "")
            if text not in current.split("\n"):
                level["analystDescription"] = f"{current}\n{text}" if current else text
        if isinstance(suggestions, list):
            for item in suggestions:
                if isinstance(item, str) and item.strip():
                    bucket = level.setdefault("suggestions", [])
                    if item not in bucket:
                        bucket.append(item)

    scoring = value.get("scoring")
    if isinstance(scoring, dict):
        calculation = {
            key: copy.deepcopy(scoring[key]) for key in SCORE_CALCULATION_KEYS if key in scoring
        }
        ranges = scoring.get("scoreRanges")
        for item in ranges if isinstance(ranges, list) else []:
            if not isinstance(item, dict):
                continue
            add(
                item.get("severity"),
                {
                    "id": allocate(),
                    "type": "score",
                    "title": RISK_SCORE_RULE_DEFAULT_TITLE,
                    **copy.deepcopy(calculation),
                    "min": item.get("min"),
                    "max": item.get("max"),
                },
                item.get("analystDescription"),
                item.get("suggestions"),
            )
    for trigger, trigger_id in zip(trigger_items, trigger_ids):
        option_ids = trigger.get("optionIds")
        add(
            trigger.get("severity"),
            {
                "id": trigger_id or allocate(),
                "type": "options",
                "match": "any",
                "optionIds": list(option_ids) if isinstance(option_ids, list) else [],
            },
            trigger.get("analystDescription"),
            trigger.get("suggestions"),
        )
    if not isinstance(scoring, dict) and trigger_items:
        levels.setdefault("ok", {"rules": []})["fallback"] = True

    upgraded: dict[str, Any] = {"title": value.get("title", "风险")}
    if "intro" in value:
        upgraded["intro"] = value["intro"]
    upgraded["levels"] = {
        severity: levels[severity] for severity in RISK_SEVERITIES if severity in levels
    }
    # 其余未知字段原样保留，交给定义校验报错，而不是静默丢弃
    for key, item in value.items():
        if key not in {"title", "intro"} | LEGACY_RISK_FIELDS:
            upgraded[key] = copy.deepcopy(item)
    return upgraded


def iter_risk_levels(block: Any) -> Iterator[tuple[str, dict[str, Any]]]:
    """按风险从高到低遍历已配置的等级。"""
    if not isinstance(block, dict):
        return
    levels = block.get("levels")
    if not isinstance(levels, dict):
        return
    for severity in RISK_SEVERITIES:
        level = levels.get(severity)
        if isinstance(level, dict):
            yield severity, level


def risk_level_rules(level: dict[str, Any]) -> list[dict[str, Any]]:
    rules = level.get("rules")
    if not isinstance(rules, list):
        return []
    return [rule for rule in rules if isinstance(rule, dict)]


def risk_dimension_is_active(block: Any) -> bool:
    """至少有一条规则或开启了「未命中判为无风险」才会产生风险结果。"""
    return any(
        risk_level_rules(level) or level.get("fallback") is True
        for _, level in iter_risk_levels(block)
    )
