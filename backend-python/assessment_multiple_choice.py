"""多选题与题内计分。

- 选择题设置 ``"multiple": true`` 为多选题（缺省为单选），作答是所选选项的列表，
  每项是选项 ID，或带追问时的 ``{"optionId": ..., "followUp": ...}``；
- 只有多选题可以开启题内计分 ``innerScoring``，本题得分即题内计分结果，参与总分、维度、
  总分区间和风险计分等所有用到“该题得分”的地方：
  - ``{"mode": "sum"}``：所选选项的分值相加；
  - ``{"mode": "formula", "formula": "q5-a + q5-b * q5-c"}``：按公式计算，公式只能引用本题选项 ID，
    选中的选项取其分值（含追问得分），未选中按 0 计算；
- 没有开启题内计分的多选题只记录作答，本题得分为 0。

这里的函数不依赖定义校验或计分服务，两边共用，保证“可达分值”校验和实际计分口径一致。
"""

from __future__ import annotations

import math
from typing import Any, Iterable, Mapping

from assessment_formula import evaluate_dimension_formula, parse_dimension_formula

INNER_SCORING_MODES = ("sum", "formula")
INNER_SCORING_FIELDS = {"mode", "formula"}


class InnerScoringLimitError(ValueError):
    """题内计分的选项组合太多，无法精确枚举。"""


def question_input_type(question: Mapping[str, Any]) -> str:
    return str(question.get("inputType") or "choice")


def is_multiple_choice(question: Any) -> bool:
    return (
        isinstance(question, Mapping)
        and question_input_type(question) == "choice"
        and question.get("multiple") is True
    )


def inner_scoring_config(question: Any) -> dict[str, Any] | None:
    """多选题开启题内计分时返回配置，否则返回 None（单选题或未开启）。"""
    if not is_multiple_choice(question):
        return None
    config = question.get("innerScoring")
    return config if isinstance(config, dict) else None


def question_option_ids(question: Mapping[str, Any]) -> list[str]:
    """题内计分公式可引用的标识符：本题的非空选项 ID（空 ID 会让公式分词原地打转）。"""
    return [
        str(option["id"])
        for option in question.get("options") or []
        if isinstance(option, Mapping) and isinstance(option.get("id"), str) and option["id"]
    ]


def multiple_answer_entries(answer: Any) -> list[Any]:
    """多选作答的条目列表；兼容旧客户端只提交单个选项的情况。"""
    if answer is None:
        return []
    if isinstance(answer, list):
        return answer
    return [answer]


def round_score(value: float) -> float:
    """与前端 Math.round 一致的两位小数（.5 向上）。"""
    return math.floor(float(value) * 100 + 0.5) / 100


def inner_score(question: Mapping[str, Any], contributions: Mapping[str, float]) -> float:
    """按题内计分配置计算本题得分；contributions 只包含选中选项的分值。

    公式里的除零会抛出 AssessmentFormulaError，由调用方决定如何提示。
    """
    config = inner_scoring_config(question)
    if config is None:
        return 0.0
    if config.get("mode") == "formula":
        node = parse_dimension_formula(
            str(config.get("formula") or ""),
            question_option_ids(question),
        )
        return round_score(evaluate_dimension_formula(node, contributions))
    return round_score(sum(float(value) for value in contributions.values()))


def reachable_inner_scores(
    question: Mapping[str, Any],
    option_values: Mapping[str, Iterable[float]],
    *,
    max_states: int,
) -> set[float]:
    """题内计分可能得到的全部分值。

    option_values：每个选项被选中时可能贡献的分值（选项分值 + 追问得分的各种取值）。
    必答题至少选一项；选答题可以不答，此时本题得分为 0。
    """
    config = inner_scoring_config(question)
    if config is None:
        return {0.0}
    required = question.get("required", True) is not False
    option_ids = question_option_ids(question)
    values_by_option = {
        option_id: sorted({float(value) for value in option_values.get(option_id, [0.0])})
        for option_id in option_ids
    }

    if config.get("mode") == "formula":
        node = parse_dimension_formula(str(config.get("formula") or ""), option_ids)
        states: list[tuple[dict[str, float], bool]] = [({}, False)]
        for option_id in option_ids:
            next_states: list[tuple[dict[str, float], bool]] = []
            for assigned, selected in states:
                # 不选该项：变量按 0 计算（不写入即可）
                next_states.append((assigned, selected))
                for value in values_by_option[option_id]:
                    next_states.append(({**assigned, option_id: value}, True))
                if len(next_states) > max_states:
                    raise InnerScoringLimitError(
                        f"题内计分公式的选项组合超过 {max_states} 种，无法完成校验，"
                        "请减少选项或改用“选项分值相加”"
                    )
            states = next_states
        scores = {
            round_score(evaluate_dimension_formula(node, assigned))
            for assigned, selected in states
            if selected or not required
        }
    else:
        # 相加：只需要跟踪“和”与“是否已选”，不必枚举全部组合
        sums: set[tuple[float, bool]] = {(0.0, False)}
        for option_id in option_ids:
            next_sums = set(sums)
            for total, _selected in sums:
                for value in values_by_option[option_id]:
                    next_sums.add((round_score(total + value), True))
            if len(next_sums) > max_states:
                raise InnerScoringLimitError(
                    f"题内计分可达分值超过 {max_states} 个，无法完成校验，请简化选项分值"
                )
            sums = next_sums
        scores = {total for total, selected in sums if selected or not required}
    if not required:
        scores.add(0.0)
    return scores
