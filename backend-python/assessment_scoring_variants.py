"""人口学计分方案：按来访者填写的人口学信息（如性别）切换计分与风险规则。

量表在 ``scoringVariants`` 里配置若干方案。每个方案有适用条件（引用单选 / 多选人口学题的选项），
以及两部分可选的覆盖内容：

- ``scoring``：报告结果相关字段（区间、维度、总分、反向题、匹配结果、组合来源）的完整副本，
  设置后整体替换默认方案的这些字段；
- ``riskDimension``：风险规则副本，设置后替换默认方案的风险编辑。

没有设置的部分沿用默认方案。作答时按列表顺序取第一个全部条件都满足的方案；
都不满足（或没有填写相应的人口学题）时使用默认方案。
"""

from __future__ import annotations

import copy
from typing import Any, Mapping, Optional

SCORING_VARIANTS_FIELD = "scoringVariants"
# 方案“计分”部分包含的顶层字段：设置后整体替换默认方案的这些字段
VARIANT_SCORING_FIELDS = (
    "scoreRanges",
    "reverseQuestionIds",
    "dimensions",
    "totalScore",
    "matchResults",
    "sourceReports",
)
VARIANT_FIELDS = {"id", "title", "conditions", "scoring", "riskDimension"}
CONDITION_FIELDS = {"questionId", "optionIds"}
CHOICE_DEMOGRAPHIC_TYPES = ("single", "multiple")


def same_scalar(left: Any, right: Any) -> bool:
    """人口学答案与选项值比较：布尔只和布尔相等，数字按数值相等，其它要求类型一致。"""
    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool) and left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return float(left) == float(right)
    return type(left) is type(right) and left == right


def choice_demographic_questions(definition: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    """可作为方案条件的人口学题：单选 / 多选题。"""
    questions: dict[str, Mapping[str, Any]] = {}
    for question in definition.get("demographicQuestions") or []:
        if (
            isinstance(question, Mapping)
            and isinstance(question.get("id"), str)
            and question.get("inputType") in CHOICE_DEMOGRAPHIC_TYPES
        ):
            questions[question["id"]] = question
    return questions


def scoring_variants(definition: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    raw = definition.get(SCORING_VARIANTS_FIELD)
    if not isinstance(raw, list):
        return []
    return [variant for variant in raw if isinstance(variant, Mapping)]


def effective_definition(
    definition: Mapping[str, Any],
    variant: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """实际用于计分的定义：去掉方案列表，再套用方案自己设置的计分 / 风险部分（深拷贝）。"""
    result = {
        key: copy.deepcopy(value)
        for key, value in definition.items()
        if key != SCORING_VARIANTS_FIELD
    }
    if not variant:
        return result
    scoring = variant.get("scoring")
    if isinstance(scoring, Mapping):
        for field in VARIANT_SCORING_FIELDS:
            result.pop(field, None)
        for field in VARIANT_SCORING_FIELDS:
            if field in scoring:
                result[field] = copy.deepcopy(scoring[field])
    if "riskDimension" in variant:
        risk = variant.get("riskDimension")
        if risk is None:
            result.pop("riskDimension", None)
        else:
            result["riskDimension"] = copy.deepcopy(risk)
    return result


def selected_demographic_option_ids(question: Mapping[str, Any], value: Any) -> set[str]:
    """人口学答案（单选为选项值，多选为选项值数组）对应的选项 ID。"""
    values = value if isinstance(value, list) else [value]
    selected: set[str] = set()
    for option in question.get("options") or []:
        if not isinstance(option, Mapping):
            continue
        if any(item is not None and same_scalar(item, option.get("value")) for item in values):
            selected.add(str(option.get("id")))
    return selected


def variant_matches(
    definition: Mapping[str, Any],
    variant: Mapping[str, Any],
    demographics: Optional[Mapping[str, Any]],
) -> bool:
    conditions = variant.get("conditions")
    if not isinstance(conditions, list) or not conditions:
        return False
    questions = choice_demographic_questions(definition)
    answers = demographics or {}
    for condition in conditions:
        if not isinstance(condition, Mapping):
            return False
        question_id = str(condition.get("questionId") or "")
        question = questions.get(question_id)
        value = answers.get(question_id)
        if question is None or value is None or value == "" or value == []:
            return False
        wanted = {str(item) for item in condition.get("optionIds") or []}
        if not selected_demographic_option_ids(question, value) & wanted:
            return False
    return True


def match_scoring_variant(
    definition: Mapping[str, Any],
    demographics: Optional[Mapping[str, Any]],
) -> Optional[Mapping[str, Any]]:
    """按列表顺序返回第一个全部条件都满足的方案；没有时返回 None（使用默认方案）。"""
    for variant in scoring_variants(definition):
        if variant_matches(definition, variant, demographics):
            return variant
    return None


def _question_label(question: Mapping[str, Any]) -> str:
    text = str(question.get("text") or question.get("id") or "").strip()
    return text.rstrip("？?：:") or str(question.get("id") or "")


def describe_scoring_variant(
    definition: Mapping[str, Any],
    variant: Mapping[str, Any],
) -> dict[str, str]:
    """报告里展示的方案说明，例如 {"title": "女性", "description": "性别：女"}。"""
    questions = choice_demographic_questions(definition)
    parts: list[str] = []
    for condition in variant.get("conditions") or []:
        if not isinstance(condition, Mapping):
            continue
        question = questions.get(str(condition.get("questionId") or ""))
        if question is None:
            continue
        labels = {
            str(option.get("id")): str(option.get("text") or option.get("id"))
            for option in question.get("options") or []
            if isinstance(option, Mapping)
        }
        option_texts = [labels.get(str(item), str(item)) for item in condition.get("optionIds") or []]
        parts.append(f"{_question_label(question)}：{'、'.join(option_texts)}")
    return {
        "id": str(variant.get("id") or ""),
        "title": str(variant.get("title") or variant.get("id") or ""),
        "description": "；".join(parts),
    }


def resolve_scoring_definition(
    definition: Mapping[str, Any],
    demographics: Optional[Mapping[str, Any]],
) -> tuple[dict[str, Any], Optional[dict[str, str]]]:
    """返回（实际用于计分的定义，命中的方案说明或 None）。"""
    variant = match_scoring_variant(definition, demographics)
    effective = effective_definition(definition, variant)
    return effective, (describe_scoring_variant(definition, variant) if variant else None)
