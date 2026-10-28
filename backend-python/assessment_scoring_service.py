"""EAP 量表答案校验与服务端白名单计分。"""

from __future__ import annotations

import math
import re
from datetime import date
from typing import Any

from assessment_definition_service import ALLOWED_SCORING_PRESETS
from assessment_formula import (
    AssessmentFormulaError,
    evaluate_dimension_formula,
    parse_dimension_formula,
)


class AssessmentAnswerError(ValueError):
    pass


def _is_empty(value: Any) -> bool:
    return value is None or value == "" or value == []


def _same_scalar(left: Any, right: Any) -> bool:
    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool) and left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return float(left) == float(right)
    return type(left) is type(right) and left == right


def _question_input_type(question: dict[str, Any]) -> str:
    return str(question.get("inputType") or "choice")


def _is_filled_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _is_filled_number(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return math.isfinite(float(value))


def _parse_choice_answer(answer: Any) -> tuple[str | None, Any]:
    """返回 (optionId, followUp)。旧数据直接用选项 ID 字符串。"""
    if isinstance(answer, str):
        return answer, None
    if isinstance(answer, dict):
        option_id = answer.get("optionId")
        if not isinstance(option_id, str):
            return None, None
        return option_id, answer.get("followUp")
    return None, None


def _validate_follow_up_value(
    follow_up: dict[str, Any],
    value: Any,
    *,
    question_id: str,
) -> Any:
    input_type = follow_up.get("inputType")
    required = bool(follow_up.get("required"))
    if input_type == "text":
        if value is None or value == "":
            if required:
                raise AssessmentAnswerError(f"题目 {question_id} 需要填写追问内容")
            return None
        if not isinstance(value, str):
            raise AssessmentAnswerError(f"题目 {question_id} 的追问必须是文本")
        validation = follow_up.get("validation") or {}
        if "minLength" in validation and len(value) < int(validation["minLength"]):
            raise AssessmentAnswerError(f"题目 {question_id} 的追问内容过短")
        if "maxLength" in validation and len(value) > int(validation["maxLength"]):
            raise AssessmentAnswerError(f"题目 {question_id} 的追问内容过长")
        return value
    if input_type == "number":
        if value is None or value == "":
            if required:
                raise AssessmentAnswerError(f"题目 {question_id} 需要填写追问数字")
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise AssessmentAnswerError(f"题目 {question_id} 的追问必须是数字")
        if not math.isfinite(float(value)):
            raise AssessmentAnswerError(f"题目 {question_id} 的追问数字不合法")
        number = float(value) if isinstance(value, float) else value
        validation = follow_up.get("validation") or {}
        if "min" in validation and float(number) < float(validation["min"]):
            raise AssessmentAnswerError(f"题目 {question_id} 的追问小于最小值")
        if "max" in validation and float(number) > float(validation["max"]):
            raise AssessmentAnswerError(f"题目 {question_id} 的追问大于最大值")
        return number
    raise AssessmentAnswerError(f"题目 {question_id} 的追问类型不受支持")


def _normalize_question_answer(
    question: dict[str, Any],
    answer: Any,
    *,
    question_id: str,
) -> Any:
    input_type = _question_input_type(question)
    if input_type == "text":
        if not isinstance(answer, dict) or "text" not in answer:
            raise AssessmentAnswerError(f"题目 {question_id} 的答案格式错误")
        text = answer.get("text")
        if not isinstance(text, str):
            raise AssessmentAnswerError(f"题目 {question_id} 必须是文本")
        if not text.strip():
            raise AssessmentAnswerError(f"题目 {question_id} 不能为空")
        validation = question.get("validation") or {}
        if "minLength" in validation and len(text) < int(validation["minLength"]):
            raise AssessmentAnswerError(f"题目 {question_id} 内容过短")
        if "maxLength" in validation and len(text) > int(validation["maxLength"]):
            raise AssessmentAnswerError(f"题目 {question_id} 内容过长")
        return {"text": text}
    if input_type == "number":
        if not isinstance(answer, dict) or "number" not in answer:
            raise AssessmentAnswerError(f"题目 {question_id} 的答案格式错误")
        number = answer.get("number")
        if isinstance(number, bool) or not isinstance(number, (int, float)):
            raise AssessmentAnswerError(f"题目 {question_id} 必须是数字")
        if not math.isfinite(float(number)):
            raise AssessmentAnswerError(f"题目 {question_id} 数值不合法")
        validation = question.get("validation") or {}
        if "min" in validation and float(number) < float(validation["min"]):
            raise AssessmentAnswerError(f"题目 {question_id} 小于最小值")
        if "max" in validation and float(number) > float(validation["max"]):
            raise AssessmentAnswerError(f"题目 {question_id} 大于最大值")
        return {"number": float(number) if isinstance(number, float) else number}

    option_id, follow_up_value = _parse_choice_answer(answer)
    if not option_id:
        raise AssessmentAnswerError(f"题目 {question_id} 的答案格式错误")
    options = {str(option["id"]): option for option in question.get("options", [])}
    option = options.get(option_id)
    if not option:
        raise AssessmentAnswerError(f"题目 {question_id} 的选项不存在")
    follow_up = option.get("followUp")
    if not isinstance(follow_up, dict):
        if isinstance(answer, str):
            return answer
        return option_id
    normalized_follow_up = _validate_follow_up_value(
        follow_up,
        follow_up_value,
        question_id=question_id,
    )
    payload: dict[str, Any] = {"optionId": option_id}
    if normalized_follow_up is not None:
        payload["followUp"] = normalized_follow_up
    return payload


def validate_submission_answers(
    definition: dict[str, Any],
    demographic_answers: dict[str, Any],
    answers: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """校验并返回可安全序列化的答案，不接受未知题目或选项。"""
    if not isinstance(demographic_answers, dict):
        raise AssessmentAnswerError("人口学答案必须是对象")
    if not isinstance(answers, dict):
        raise AssessmentAnswerError("量表答案必须是对象")

    questions = {str(item["id"]): item for item in definition.get("questions", [])}
    unknown_questions = sorted(set(str(key) for key in answers) - set(questions))
    if unknown_questions:
        raise AssessmentAnswerError(f"包含未知题目：{unknown_questions}")

    normalized_answers: dict[str, Any] = {}
    for question_id, question in questions.items():
        answer = answers.get(question_id)
        if answer is None:
            if question.get("required", True):
                raise AssessmentAnswerError(f"请完成题目：{question.get('text', question_id)}")
            continue
        normalized_answers[question_id] = _normalize_question_answer(
            question,
            answer,
            question_id=question_id,
        )

    demographic_questions = {
        str(item["id"]): item for item in definition.get("demographicQuestions", [])
    }
    # 以下划线开头的键保留为企业来源等元数据，不参与人口学题目校验
    meta_demographics = {
        str(key): value
        for key, value in demographic_answers.items()
        if str(key).startswith("_")
    }
    form_demographics = {
        str(key): value
        for key, value in demographic_answers.items()
        if not str(key).startswith("_")
    }
    unknown_demographics = sorted(set(form_demographics) - set(demographic_questions))
    if unknown_demographics:
        raise AssessmentAnswerError(f"包含未知人口学题目：{unknown_demographics}")

    # 企业定制 EAP 入职流程用员工信息表替代量表内人口学题
    skip_required_demographics = "_enterpriseSlug" in meta_demographics
    normalized_demographics: dict[str, Any] = dict(meta_demographics)
    for question_id, question in demographic_questions.items():
        value = form_demographics.get(question_id)
        if _is_empty(value):
            if question.get("required") and not skip_required_demographics:
                raise AssessmentAnswerError(
                    f"请填写人口学信息：{question.get('text', question_id)}"
                )
            continue
        input_type = question.get("inputType")
        options = question.get("options", [])
        option_values = [option.get("value") for option in options]

        if input_type == "single":
            if not any(_same_scalar(value, allowed) for allowed in option_values):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 的选项不存在")
        elif input_type == "multiple":
            if not isinstance(value, list) or not value:
                raise AssessmentAnswerError(f"人口学题目 {question_id} 必须选择至少一项")
            if any(
                not any(_same_scalar(item, allowed) for allowed in option_values)
                for item in value
            ):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 包含无效选项")
            if len({repr(item) for item in value}) != len(value):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 包含重复选项")
        elif input_type == "text":
            if not isinstance(value, str):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 必须是文本")
        elif input_type == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 必须是数字")
            if not math.isfinite(float(value)):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 数值不合法")
        elif input_type == "date":
            if not isinstance(value, str):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 必须是日期")
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise AssessmentAnswerError(
                    f"人口学题目 {question_id} 日期格式应为 YYYY-MM-DD"
                ) from exc
        else:
            raise AssessmentAnswerError(f"人口学题目 {question_id} 类型不受支持")

        validation = question.get("validation") or {}
        if "min" in validation:
            if input_type != "number":
                raise AssessmentAnswerError(f"人口学题目 {question_id} 的最小值规则不适用")
            if float(value) < float(validation["min"]):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 小于最小值")
        if "max" in validation:
            if input_type != "number":
                raise AssessmentAnswerError(f"人口学题目 {question_id} 的最大值规则不适用")
            if float(value) > float(validation["max"]):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 大于最大值")
        if "minLength" in validation:
            if not isinstance(value, (str, list)):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 的长度规则不适用")
            if len(value) < int(validation["minLength"]):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 内容过短")
        if "maxLength" in validation:
            if not isinstance(value, (str, list)):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 的长度规则不适用")
            if len(value) > int(validation["maxLength"]):
                raise AssessmentAnswerError(f"人口学题目 {question_id} 内容过长")
        pattern = validation.get("pattern")
        if pattern and isinstance(value, str):
            try:
                matched = re.fullmatch(pattern, value) is not None
            except re.error as exc:
                raise AssessmentAnswerError(
                    f"人口学题目 {question_id} 的校验规则无效"
                ) from exc
            if not matched:
                raise AssessmentAnswerError(f"人口学题目 {question_id} 格式不正确")
        normalized_demographics[question_id] = value

    return normalized_demographics, normalized_answers


def _follow_up_score(follow_up: dict[str, Any], value: Any) -> float:
    score_mode = str(follow_up.get("scoreMode") or "filled")
    completed_score = float(follow_up.get("completedScore") or 0)
    empty_score = float(follow_up.get("emptyScore") or 0)
    input_type = follow_up.get("inputType")
    filled = (
        _is_filled_text(value)
        if input_type == "text"
        else _is_filled_number(value)
    )
    if score_mode == "value":
        return float(value) if filled else empty_score
    return completed_score if filled else empty_score


def _option_value(
    definition: dict[str, Any],
    answers: dict[str, Any],
    question_id: str,
    reverse_ids: set[str] | None = None,
) -> float | int:
    """计算单题得分；兼容旧函数名，供各计分模板调用。"""
    question = next(
        (item for item in definition.get("questions", []) if item.get("id") == question_id),
        None,
    )
    if not question:
        return 0
    answer = answers.get(question_id)
    if answer is None:
        return 0

    input_type = _question_input_type(question)
    if input_type in {"text", "number"}:
        score_mode = str(question.get("scoreMode") or "filled")
        completed_score = float(question.get("completedScore") or 0)
        empty_score = float(question.get("emptyScore") or 0)
        if input_type == "text":
            filled = isinstance(answer, dict) and _is_filled_text(answer.get("text"))
            return completed_score if filled else empty_score
        number = answer.get("number") if isinstance(answer, dict) else None
        filled = _is_filled_number(number)
        if score_mode == "value":
            return float(number) if filled else empty_score
        return completed_score if filled else empty_score

    option_id, follow_up_value = _parse_choice_answer(answer)
    option = next(
        (
            item
            for item in question.get("options", [])
            if item.get("id") == option_id
        ),
        None,
    )
    if not option:
        return 0
    value = float(option.get("value", 0))
    if reverse_ids and question_id in reverse_ids:
        values = [float(item.get("value", 0)) for item in question.get("options", [])]
        value = max(values) + min(values) - value
    follow_up = option.get("followUp")
    if isinstance(follow_up, dict):
        value += _follow_up_score(follow_up, follow_up_value)
    if value == int(value):
        return int(value)
    return value


def _selected_option_id(answer: Any) -> str | None:
    option_id, _ = _parse_choice_answer(answer)
    return option_id


def _find_range(score: float | int, ranges: list[dict[str, Any]] | None):
    return next(
        (
            item
            for item in ranges or []
            if float(item["min"]) <= float(score) <= float(item["max"])
        ),
        None,
    )


def _range_text(range_item: dict[str, Any] | None, key: str, fallback: str = "暂无解读") -> str:
    if not range_item:
        return fallback
    current = range_item.get(key)
    if isinstance(current, str) and current.strip():
        return current
    legacy = range_item.get("description")
    if isinstance(legacy, str) and legacy.strip():
        return legacy
    return fallback


def _range_result_text(range_item: dict[str, Any] | None) -> tuple[str, str]:
    visitor = _range_text(range_item, "visitorDescription")
    analyst = _range_text(range_item, "analystDescription", fallback="")
    return visitor, analyst


_TEMPLATE_PATTERN = re.compile(r"\{\{([A-Za-z][A-Za-z0-9]*)\}\}")


def _render_template(template: str, variables: dict[str, Any]) -> str:
    return _TEMPLATE_PATTERN.sub(
        lambda match: str(variables.get(match.group(1), match.group(0))),
        template,
    )


def _report_profile(
    definition: dict[str, Any],
    profile_id: str,
    variables: dict[str, Any] | None = None,
):
    profile = next(
        (
            item
            for item in definition.get("reportProfiles", [])
            if item.get("id") == profile_id
        ),
        None,
    )
    if not profile:
        return None
    values = variables or {}
    result = dict(profile)
    for field in ("title", "description"):
        result[field] = _render_template(str(profile.get(field, "")), values)
    result["suggestions"] = [
        _render_template(str(item), values) for item in profile.get("suggestions", [])
    ]
    return result


def _sum_result(definition: dict[str, Any], answers: dict[str, Any]):
    is_v2 = definition.get("scoringPreset") == "generic-sum-v2"
    reverse_ids = (
        set(definition.get("reverseQuestionIds", []))
        if is_v2
        else set()
    )
    total = sum(
        _option_value(
            definition,
            answers,
            str(question["id"]),
            reverse_ids,
        )
        for question in definition.get("questions", [])
    )
    if is_v2:
        total = _js_round_2(float(total))
    range_item = _find_range(total, definition.get("scoreRanges"))
    visitor_description, analyst_description = _range_result_text(range_item)
    return {
        "type": "sum",
        "totalScore": total,
        "level": range_item.get("level", "未知") if range_item else "未知",
        "description": visitor_description,
        "visitorDescription": visitor_description,
        "analystDescription": analyst_description,
        "suggestions": list(range_item.get("suggestions", [])) if range_item else [],
    }


def _js_round_2(value: float) -> float:
    return math.floor(value * 100 + 0.5) / 100


def _dimension_result(definition: dict[str, Any], answers: dict[str, Any]):
    dimensions = []
    for dimension in definition.get("dimensions", []):
        reverse_ids = set(dimension.get("reverseQuestionIds", []))
        question_ids = dimension.get("questionIds", [])
        value_map = {
            question_id: _option_value(
                definition,
                answers,
                question_id,
                reverse_ids,
            )
            for question_id in question_ids
        }
        values = list(value_map.values())
        if dimension.get("calculationMode", "simple") == "formula":
            try:
                node = parse_dimension_formula(
                    str(dimension.get("formula", "")),
                    [str(question["id"]) for question in definition.get("questions", [])],
                )
                score = evaluate_dimension_formula(node, value_map)
            except AssessmentFormulaError as exc:
                raise AssessmentAnswerError(f"维度计算公式无效：{exc}") from exc
        elif dimension.get("aggregate") == "product":
            score = math.prod(values)
        else:
            score = sum(values)
            if dimension.get("aggregate") == "average":
                score = score / len(values)
        score = _js_round_2(float(score))
        range_item = _find_range(score, dimension.get("scoreRanges"))
        dimensions.append(
            {
                "id": dimension["id"],
                "title": dimension["title"],
                "score": score,
                "level": range_item.get("level", "未知") if range_item else "未知",
                "description": _range_result_text(range_item)[0],
                "visitorDescription": _range_result_text(range_item)[0],
                "analystDescription": _range_result_text(range_item)[1],
                "suggestions": (
                    list(range_item.get("suggestions", [])) if range_item else []
                ),
            }
        )
    return {"type": "dimension", "dimensions": dimensions}


def _match_result(definition: dict[str, Any], answers: dict[str, Any]):
    tag_scores: dict[str, float] = {}
    for question in definition.get("questions", []):
        selected_id = _selected_option_id(answers.get(str(question.get("id"))))
        option = next(
            (
                item
                for item in question.get("options", [])
                if item.get("id") == selected_id
            ),
            None,
        )
        for tag, weight in (option or {}).get("matchTags", {}).items():
            tag_scores[tag] = tag_scores.get(tag, 0) + float(weight)
    result_id = max(tag_scores, key=tag_scores.get) if tag_scores else ""
    match_results = definition.get("matchResults", [])
    if not result_id and match_results:
        result_id = str(match_results[0]["id"])
    result = next((item for item in match_results if item.get("id") == result_id), None)
    return {
        "type": "match",
        "resultId": result_id,
        "title": result.get("title", "未知结果") if result else "未知结果",
        "description": result.get("description", "") if result else "",
        "image": result.get("image", "") if result else "",
        "shareText": result.get("shareText", "") if result else "",
    }


def _aas_result(definition: dict[str, Any], answers: dict[str, Any]):
    reverse = set(definition.get("reverseQuestionIds", []))

    def average(ids: list[str]) -> float:
        return sum(_option_value(definition, answers, item, reverse) for item in ids) / len(ids)

    proximity = average(["q1", "q6", "q8", "q12", "q13", "q17"])
    dependency = average(["q2", "q5", "q7", "q14", "q16", "q18"])
    anxiety = average(["q3", "q4", "q9", "q10", "q11", "q15"])
    closeness = (proximity + dependency) / 2
    result_id = "fearful"
    if closeness > 3 and anxiety < 3:
        result_id = "secure"
    elif closeness > 3 and anxiety >= 3:
        result_id = "preoccupied"
    elif closeness <= 3 and anxiety < 3:
        result_id = "dismissive"
    result = next(
        (item for item in definition.get("matchResults", []) if item.get("id") == result_id),
        None,
    )
    return {
        "type": "match",
        "resultId": result_id,
        "title": result.get("title", "未知结果") if result else "未知结果",
        "description": result.get("description", "") if result else "",
        "image": result.get("image", "") if result else "",
        "shareText": result.get("shareText", "") if result else "",
    }


def _psqi_result(definition: dict[str, Any], answers: dict[str, Any]):
    value = lambda item: _option_value(definition, answers, item)
    latency = value("q2") + value("q5a")
    component_2 = 0 if latency == 0 else 1 if latency <= 2 else 2 if latency <= 4 else 3
    disturbance = sum(value(f"q5{suffix}") for suffix in "bcdefghij")
    component_5 = (
        0 if disturbance == 0 else 1 if disturbance <= 9 else 2 if disturbance <= 18 else 3
    )
    dysfunction = value("q8") + value("q9")
    component_7 = (
        0 if dysfunction == 0 else 1 if dysfunction <= 2 else 2 if dysfunction <= 4 else 3
    )
    total = value("q6") + component_2 + value("q4") + component_5 + value("q7") + component_7
    range_item = _find_range(total, definition.get("scoreRanges"))
    visitor_description, analyst_description = _range_result_text(range_item)
    return {
        "type": "sum",
        "totalScore": total,
        "level": range_item.get("level", "未知") if range_item else "未知",
        "description": visitor_description,
        "visitorDescription": visitor_description,
        "analystDescription": analyst_description,
        "suggestions": list(range_item.get("suggestions", [])) if range_item else [],
    }


def _sum_questions(
    definition: dict[str, Any],
    answers: dict[str, Any],
    ids: list[str],
    reverse_ids: list[str] | None = None,
):
    reverse = set(reverse_ids or [])
    return sum(_option_value(definition, answers, item, reverse) for item in ids)


_PBI_STYLE_PROFILE = {
    "权威型": "pbi-style-authoritative",
    "专制型": "pbi-style-authoritarian",
    "民主型": "pbi-style-democratic",
    "放任型": "pbi-style-permissive",
}


def _pbi_style(care: float, control: float, is_mother: bool) -> str:
    care_high = care > (29.62 if is_mother else 27.17)
    care_low = care < (19.12 if is_mother else 15.71)
    control_high = control > (8.64 if is_mother else 7.62)
    control_low = control < (1.98 if is_mother else 1.38)
    if care_high and control_high:
        return "权威型"
    if care_low and control_high:
        return "专制型"
    if care_high and control_low:
        return "民主型"
    return "放任型"


def _pbi_result(definition: dict[str, Any], answers: dict[str, Any]):
    mother_care = _sum_questions(
        definition,
        answers,
        ["m1", "m2", "m4", "m5", "m6", "m11", "m12", "m14", "m15", "m16", "m22"],
        ["m2", "m4", "m14", "m16", "m22"],
    )
    mother_autonomy = _sum_questions(
        definition, answers, ["m3", "m7", "m13", "m19", "m20", "m23"]
    )
    mother_control = _sum_questions(
        definition,
        answers,
        ["m8", "m9", "m10", "m17", "m18", "m21"],
        ["m18"],
    )
    father_care = _sum_questions(
        definition,
        answers,
        ["f1", "f2", "f4", "f5", "f6", "f11", "f12", "f13", "f15", "f16", "f22"],
        ["f2", "f4", "f22"],
    )
    father_autonomy = _sum_questions(
        definition, answers, ["f3", "f7", "f14", "f19", "f20", "f23"]
    )
    father_control = _sum_questions(
        definition,
        answers,
        ["f8", "f9", "f10", "f17", "f18", "f21"],
        ["f18"],
    )
    mother_style = _pbi_style(mother_care, mother_control, True)
    father_style = _pbi_style(father_care, father_control, False)

    def profile(profile_id: str, variables: dict[str, Any] | None = None):
        return _report_profile(definition, profile_id, variables) or {
            "description": "暂无解读",
            "suggestions": [],
        }

    mother_style_profile = profile(_PBI_STYLE_PROFILE[mother_style])
    father_style_profile = profile(_PBI_STYLE_PROFILE[father_style])
    mother_autonomy_profile = profile(
        "pbi-autonomy-high" if mother_autonomy >= 12 else "pbi-autonomy-normal",
        {"parent": "母亲"},
    )
    mother_control_profile = profile(
        "pbi-control-high" if mother_control > 8.64 else "pbi-control-normal",
        {"parent": "母亲"},
    )
    father_autonomy_profile = profile(
        "pbi-autonomy-high" if father_autonomy >= 12 else "pbi-autonomy-normal",
        {"parent": "父亲"},
    )
    father_control_profile = profile(
        "pbi-control-high" if father_control > 7.62 else "pbi-control-normal",
        {"parent": "父亲"},
    )
    summary = profile("pbi-summary", {"motherStyle": mother_style, "fatherStyle": father_style})
    return {
        "type": "dimension",
        "summary": summary["description"],
        "dimensions": [
            {
                "id": "mother-care",
                "title": "母亲关爱",
                "score": mother_care,
                "level": mother_style,
                "description": mother_style_profile["description"],
                "suggestions": mother_style_profile["suggestions"],
            },
            {
                "id": "mother-autonomy",
                "title": "母亲鼓励自主",
                "score": mother_autonomy,
                "level": "较高" if mother_autonomy >= 12 else "一般",
                "description": mother_autonomy_profile["description"],
                "suggestions": mother_autonomy_profile["suggestions"],
            },
            {
                "id": "mother-control",
                "title": "母亲控制",
                "score": mother_control,
                "level": "较高" if mother_control > 8.64 else "一般",
                "description": mother_control_profile["description"],
                "suggestions": mother_control_profile["suggestions"],
            },
            {
                "id": "father-care",
                "title": "父亲关爱",
                "score": father_care,
                "level": father_style,
                "description": father_style_profile["description"],
                "suggestions": father_style_profile["suggestions"],
            },
            {
                "id": "father-autonomy",
                "title": "父亲鼓励自主",
                "score": father_autonomy,
                "level": "较高" if father_autonomy >= 12 else "一般",
                "description": father_autonomy_profile["description"],
                "suggestions": father_autonomy_profile["suggestions"],
            },
            {
                "id": "father-control",
                "title": "父亲控制",
                "score": father_control,
                "level": "较高" if father_control > 7.62 else "一般",
                "description": father_control_profile["description"],
                "suggestions": father_control_profile["suggestions"],
            },
        ],
    }


_CBCL_DIMENSIONS = [
    ("withdrawn", "退缩", [42, 65, 69, 75, 80, 88, 102, 103, 111], 6),
    ("somatic", "躯体主诉", [51, 54, 56, 57, 58, 59, 60, 61, 62, 63], 6),
    ("anxious-depressed", "焦虑/抑郁", [12, 14, 31, 32, 33, 34, 35, 45, 50, 52, 71, 89, 103, 112], 7),
    ("social", "社交问题", [1, 11, 25, 38, 48, 55, 62, 64], 5),
    ("thought", "思维问题", [9, 40, 66, 70, 80, 84, 85], 2),
    ("attention", "注意问题", [1, 8, 10, 13, 17, 41, 45, 46, 61, 62, 80], 10),
    ("rule-breaking", "违纪问题", [26, 39, 43, 63, 67, 72, 81, 82, 90, 96, 101, 105, 106], 7),
    ("aggressive", "攻击性行为", [3, 7, 16, 19, 20, 21, 22, 23, 27, 37, 59, 68, 74, 86, 87, 93, 94, 95, 97, 104], 14),
]


def _cbcl_result(definition: dict[str, Any], answers: dict[str, Any]):
    dimensions = []
    for dimension_id, title, items, cutoff in _CBCL_DIMENSIONS:
        score = sum(_option_value(definition, answers, f"q{item}") for item in items)
        above = score > cutoff
        profile = _report_profile(
            definition, "cbcl-concern" if above else "cbcl-normal"
        ) or {"description": "暂无解读", "suggestions": []}
        dimensions.append(
            {
                "id": dimension_id,
                "title": title,
                "score": score,
                "level": "需关注" if above else "正常",
                "description": profile["description"],
                "suggestions": profile["suggestions"],
            }
        )
    total = sum(
        _option_value(definition, answers, str(question["id"]))
        for question in definition.get("questions", [])
    )
    total_above = total > 37
    total_profile = _report_profile(
        definition, "cbcl-total-concern" if total_above else "cbcl-total-normal"
    ) or {"description": "暂无解读", "suggestions": []}
    summary = _report_profile(definition, "cbcl-summary", {"total": total})
    dimensions.append(
        {
            "id": "behavior-total",
            "title": "行为问题总分",
            "score": total,
            "level": "需关注" if total_above else "正常",
            "description": total_profile["description"],
            "suggestions": total_profile["suggestions"],
        }
    )
    return {
        "type": "dimension",
        "summary": (
            summary["description"] if summary else f"行为问题总分：{total}（参考界值 37）"
        ),
        "dimensions": dimensions,
    }


_DARK_GROUPS = [
    ("machiavellianism", "维度一：马基雅维利主义倾向", ["d1", "d2", "d3", "d4"]),
    ("psychopathy", "维度二：精神病态倾向", ["d5", "d6", "d7", "d8"]),
    ("narcissism", "维度三：自恋倾向", ["d9", "d10", "d11", "d12"]),
]


def _dark_level(score: float, low_max: float, middle_max: float) -> str:
    if score <= low_max:
        return "低"
    if score <= middle_max:
        return "中"
    return "高"


def _dark_result(definition: dict[str, Any], answers: dict[str, Any]):
    dimensions = []
    for dimension_id, title, items in _DARK_GROUPS:
        score = sum(_option_value(definition, answers, item) for item in items)
        level = _dark_level(score, 12, 20)
        profile_level = {"低": "low", "中": "middle", "高": "high"}[level]
        profile = _report_profile(
            definition,
            f"dark-{dimension_id}-{profile_level}",
            {"score": score},
        ) or {"description": "暂无解读", "suggestions": []}
        dimensions.append(
            {
                "id": dimension_id,
                "title": title,
                "score": score,
                "level": level,
                "description": profile["description"],
                "suggestions": profile["suggestions"],
            }
        )
    total = sum(item["score"] for item in dimensions)
    total_level = _dark_level(total, 36, 60)
    profile_level = {"低": "low", "中": "middle", "高": "high"}[total_level]
    total_profile = _report_profile(
        definition, f"dark-total-{profile_level}", {"total": total}
    ) or {"description": "暂无解读", "suggestions": []}
    summary = _report_profile(definition, "dark-summary", {"total": total})
    dimensions.append(
        {
            "id": "dark-total",
            "title": "综合暗黑等级判断",
            "score": total,
            "level": total_level,
            "description": total_profile["description"],
            "suggestions": total_profile["suggestions"],
        }
    )
    return {
        "type": "dimension",
        "summary": summary["description"] if summary else f"三个维度的总分是 {total} 分。",
        "dimensions": dimensions,
    }


def calculate_assessment_result(
    definition: dict[str, Any], answers: dict[str, Any]
) -> dict[str, Any]:
    scoring_type = str(definition.get("scoringType"))
    if definition.get("scoringPreset") not in ALLOWED_SCORING_PRESETS.get(
        scoring_type, set()
    ):
        raise AssessmentAnswerError("量表计分模板不在服务端白名单中")
    calculators = {
        "sum": _sum_result,
        "dimension": _dimension_result,
        "match": _match_result,
        "aas": _aas_result,
        "psqi": _psqi_result,
        "pbi": _pbi_result,
        "cbcl": _cbcl_result,
        "dark-light": _dark_result,
    }
    calculator = calculators.get(scoring_type)
    if not calculator:
        raise AssessmentAnswerError("量表计分类型不受支持")
    return calculator(definition, answers)


def validate_generated_scoring_examples(definition: dict[str, Any]) -> None:
    """Run deterministic first/last-option smoke examples through the real scorer.

    The examples are generated at validation time and are deliberately not part
    of the public assessment JSON or report snapshot.
    """

    questions = definition.get("questions", [])
    samples: list[tuple[str, dict[str, Any]]] = []

    def _sample_answer(question: dict[str, Any], option_index: int) -> Any:
        input_type = str(question.get("inputType") or "choice")
        if input_type == "text":
            return {"text": "样例"}
        if input_type == "number":
            validation = question.get("validation") or {}
            if "min" in validation:
                return {"number": validation["min"]}
            if "max" in validation:
                return {"number": validation["max"]}
            return {"number": 0}
        options = question.get("options") or []
        option = options[option_index]
        follow_up = option.get("followUp")
        if not isinstance(follow_up, dict):
            return str(option["id"])
        payload: dict[str, Any] = {"optionId": str(option["id"])}
        if follow_up.get("inputType") == "number":
            validation = follow_up.get("validation") or {}
            if "min" in validation:
                payload["followUp"] = validation["min"]
            elif follow_up.get("required"):
                payload["followUp"] = 0
        elif follow_up.get("required") or follow_up.get("scoreMode") == "filled":
            payload["followUp"] = "样例"
        return payload

    for label, option_index in (("首选项", 0), ("末选项", -1)):
        answers = {
            str(question["id"]): _sample_answer(question, option_index)
            for question in questions
        }
        if not samples or answers != samples[-1][1]:
            samples.append((label, answers))

    for label, answers in samples:
        result = calculate_assessment_result(definition, answers)
        result_type = result.get("type")
        if result_type == "sum":
            score = result.get("totalScore")
            if (
                isinstance(score, bool)
                or not isinstance(score, (int, float))
                or not math.isfinite(float(score))
                or result.get("level") == "未知"
            ):
                raise AssessmentAnswerError(f"{label}总分样例没有命中有效报告结果")
            continue
        if result_type == "dimension":
            dimensions = result.get("dimensions")
            if not isinstance(dimensions, list) or not dimensions:
                raise AssessmentAnswerError(f"{label}维度样例没有生成维度结果")
            for dimension in dimensions:
                score = dimension.get("score")
                if (
                    isinstance(score, bool)
                    or not isinstance(score, (int, float))
                    or not math.isfinite(float(score))
                    or dimension.get("level") == "未知"
                ):
                    raise AssessmentAnswerError(
                        f"{label}维度样例没有命中有效报告结果"
                    )
            continue
        if result_type == "match":
            result_id = str(result.get("resultId") or "")
            expected_ids = {
                str(item.get("id"))
                for item in definition.get("matchResults", [])
            }
            if not result_id or result_id not in expected_ids:
                raise AssessmentAnswerError(f"{label}匹配样例没有命中有效报告结果")
            continue
        raise AssessmentAnswerError(f"{label}样例返回了不支持的结果类型")


def assessment_result_summary(result: dict[str, Any]) -> str:
    result_type = result.get("type")
    if result_type == "sum":
        return f"{result.get('level', '未知')}（{result.get('totalScore', 0)} 分）"
    if result_type == "match":
        return str(result.get("title") or "未知结果")
    if result_type == "dimension":
        if result.get("summary"):
            return str(result["summary"])
        dimensions = result.get("dimensions") or []
        if len(dimensions) == 1:
            item = dimensions[0]
            return f"{item.get('title', '')}：{item.get('level', '')}"
        return " · ".join(
            f"{item.get('title', '')} {item.get('level', '')}" for item in dimensions
        )
    raise AssessmentAnswerError("服务端计分结果类型不合法")
