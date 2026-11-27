# -*- coding: utf-8 -*-
"""多选题与题内计分：定义校验、作答校验、计分、风险规则与匹配量表。"""

from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

from assessment_definition_service import (
    AssessmentDefinitionStore,
    AssessmentValidationError,
    validate_definition,
)
from assessment_scoring_service import (
    AssessmentAnswerError,
    calculate_assessment_result,
    validate_generated_scoring_examples,
    validate_submission_answers,
)


def rng(low, high, level):
    return {
        "min": low,
        "max": high,
        "level": level,
        "visitorDescription": f"{level}说明",
        "analystDescription": f"{level}分析",
        "suggestions": [],
    }


def base_definition(**overrides):
    """q1 单选（0/1）；q2 多选、选项相加（1/2/其他 1+追问 1）；q3 多选不计分、选答。"""
    definition = {
        "schemaVersion": 1,
        "id": "multi-demo",
        "version": 1,
        "status": "draft",
        "category": "professional",
        "title": "多选演示",
        "subtitle": "",
        "description": "demo",
        "instructions": "请根据实际情况作答",
        "reportIntro": "结果仅供参考",
        "cover": "/static/assessments/demo.jpg",
        "duration": 5,
        "scoringType": "sum",
        "scoringPreset": "generic-sum-v2",
        "questions": [
            {
                "id": "q1",
                "text": "最近是否感到压力",
                "required": True,
                "inputType": "choice",
                "options": [
                    {"id": "q1-a", "text": "否", "value": 0},
                    {"id": "q1-b", "text": "是", "value": 1},
                ],
            },
            {
                "id": "q2",
                "text": "最近出现过哪些情况",
                "required": True,
                "inputType": "choice",
                "multiple": True,
                "innerScoring": {"mode": "sum"},
                "options": [
                    {"id": "q2-a", "text": "失眠", "value": 1},
                    {"id": "q2-b", "text": "食欲下降", "value": 2},
                    {
                        "id": "q2-c",
                        "text": "其他",
                        "value": 1,
                        "followUp": {
                            "inputType": "text",
                            "label": "请说明",
                            "required": True,
                            "scoreMode": "filled",
                            "completedScore": 1,
                            "emptyScore": 0,
                        },
                    },
                ],
            },
            {
                "id": "q3",
                "text": "平时的爱好",
                "required": False,
                "inputType": "choice",
                "multiple": True,
                "options": [
                    {"id": "q3-a", "text": "运动", "value": 5},
                    {"id": "q3-b", "text": "阅读", "value": 5},
                ],
            },
        ],
        "reverseQuestionIds": [],
        # 可达总分：q1 0/1 + q2 1..5（必选至少一项）+ q3 不计分 => 1..6
        "scoreRanges": [rng(0, 3, "平稳"), rng(4, 6, "需关注")],
        "disclaimer": "仅供参考",
    }
    definition.update(overrides)
    return definition


def question(definition, question_id):
    return next(item for item in definition["questions"] if item["id"] == question_id)


def score(definition, answers):
    _, normalized = validate_submission_answers(definition, {}, answers)
    return calculate_assessment_result(definition, normalized), normalized


class DefinitionTests(unittest.TestCase):
    def assert_invalid(self, definition, pattern, **kwargs):
        with self.assertRaisesRegex(AssessmentValidationError, pattern):
            validate_definition(definition, allow_fixed_scoring=False, **kwargs)

    def test_multiple_choice_definition_is_accepted(self):
        validate_definition(base_definition(), allow_fixed_scoring=False)
        validate_generated_scoring_examples(base_definition())

    def test_multiple_only_on_choice_and_inner_scoring_only_on_multiple(self):
        definition = base_definition()
        question(definition, "q1")["innerScoring"] = {"mode": "sum"}
        self.assert_invalid(definition, "只有多选题可以开启题内计分")

        definition = base_definition()
        text = {
            "id": "q4",
            "text": "补充说明",
            "required": False,
            "inputType": "text",
            "multiple": True,
            "options": [],
        }
        definition["questions"].append(text)
        self.assert_invalid(definition, "只有选择题可以设置多选")

        definition = base_definition()
        question(definition, "q2")["multiple"] = "yes"
        self.assert_invalid(definition, "multiple 必须是布尔值")

    def test_inner_scoring_shape_and_formula(self):
        definition = base_definition()
        question(definition, "q2")["innerScoring"] = {"mode": "max"}
        self.assert_invalid(definition, "题内计分方式不合法")

        definition = base_definition()
        question(definition, "q2")["innerScoring"] = {"mode": "sum", "weight": 2}
        self.assert_invalid(definition, "innerScoring 包含未知字段")

        definition = base_definition()
        # 公式只能引用本题选项
        question(definition, "q2")["innerScoring"] = {"mode": "formula", "formula": "q2-a + q1-b"}
        self.assert_invalid(definition, "题内计分公式不合法")

        definition = base_definition()
        # 未选中的选项按 0 计算，做分母会出现除以零
        question(definition, "q2")["innerScoring"] = {"mode": "formula", "formula": "q2-a / q2-b"}
        self.assert_invalid(definition, "除以零")

        # 组合量表草稿可以先保存不完整的公式
        definition = base_definition(composedFrom=[{"id": "parent", "title": "母量表"}])
        for item in definition["questions"]:
            item["sourceAssessmentId"] = "parent"
            item["sourceAssessmentTitle"] = "母量表"
            item["sourceQuestionId"] = item["id"]
        question(definition, "q2")["innerScoring"] = {"mode": "formula", "formula": "q2-a +"}
        validate_definition(definition, allow_fixed_scoring=False, allow_incomplete=True)

    def test_reachable_scores_follow_inner_scoring(self):
        definition = base_definition()
        definition["scoreRanges"] = [rng(0, 3, "平稳"), rng(4, 5, "需关注")]
        self.assert_invalid(definition, "scoreRanges未覆盖可达分值：6")

        # 公式：失眠 + 食欲下降 × 其他（其他选中时贡献 2）=> 可达 {0,1,2,3,4,5}
        definition = base_definition()
        question(definition, "q2")["innerScoring"] = {
            "mode": "formula",
            "formula": "q2-a + q2-b * q2-c",
        }
        definition["scoreRanges"] = [rng(0, 3, "平稳"), rng(4, 6, "需关注")]
        validate_definition(definition, allow_fixed_scoring=False)
        definition["scoreRanges"] = [rng(1, 3, "平稳"), rng(4, 6, "需关注")]
        # 只选“食欲下降”时公式得 0，总分可为 0
        self.assert_invalid(definition, "未覆盖可达分值：0")

        # 不开启题内计分：多选题不计分
        definition = base_definition()
        question(definition, "q2").pop("innerScoring")
        definition["scoreRanges"] = [rng(0, 1, "平稳")]
        validate_definition(definition, allow_fixed_scoring=False)

    def test_multiple_choice_cannot_be_reverse_scored(self):
        definition = base_definition(reverseQuestionIds=["q2"])
        self.assert_invalid(definition, "不能包含多选题")

        definition = base_definition(
            scoringType="dimension",
            scoringPreset="generic-dimension-v1",
            dimensions=[
                {
                    "id": "stress",
                    "title": "压力",
                    "questionIds": ["q1", "q2"],
                    "reverseQuestionIds": ["q2"],
                    "calculationMode": "simple",
                    "aggregate": "sum",
                    "scoreRanges": [rng(0, 6, "全部")],
                }
            ],
        )
        definition.pop("scoreRanges")
        definition.pop("reverseQuestionIds")
        self.assert_invalid(definition, "dimensions\\[0\\].reverseQuestionIds 不能包含多选题")


class AnswerTests(unittest.TestCase):
    def test_answers_are_normalized_in_option_order(self):
        _, normalized = validate_submission_answers(
            base_definition(),
            {},
            {
                "q1": "q1-b",
                "q2": [{"optionId": "q2-c", "followUp": "头痛"}, "q2-a"],
                "q3": ["q3-b"],
            },
        )
        self.assertEqual(
            {
                "q1": "q1-b",
                "q2": ["q2-a", {"optionId": "q2-c", "followUp": "头痛"}],
                "q3": ["q3-b"],
            },
            normalized,
        )

    def test_invalid_multiple_answers(self):
        definition = base_definition()
        cases = [
            ({"q1": "q1-a", "q2": ["q2-a", "q2-a"]}, "重复选项"),
            ({"q1": "q1-a", "q2": ["q2-x"]}, "选项不存在"),
            ({"q1": "q1-a", "q2": []}, "请完成题目"),
            ({"q1": "q1-a", "q2": ["q2-c"]}, "需要填写追问内容"),
            ({"q1": "q1-a", "q2": [{"optionId": "q2-a"}, 3]}, "答案格式错误"),
        ]
        for answers, pattern in cases:
            with self.subTest(answers=answers):
                with self.assertRaisesRegex(AssessmentAnswerError, pattern):
                    validate_submission_answers(definition, {}, answers)

    def test_optional_empty_and_legacy_single_values(self):
        _, normalized = validate_submission_answers(
            base_definition(),
            {},
            # 选答多选题不选等同于未作答；旧客户端只提交单个选项时按一项处理
            {"q1": "q1-a", "q2": "q2-b", "q3": []},
        )
        self.assertEqual({"q1": "q1-a", "q2": ["q2-b"]}, normalized)


class ScoringTests(unittest.TestCase):
    def test_sum_inner_scoring_counts_follow_up(self):
        result, _ = score(
            base_definition(),
            {"q1": "q1-b", "q2": ["q2-a", {"optionId": "q2-c", "followUp": "头痛"}], "q3": ["q3-a", "q3-b"]},
        )
        # q1 1 + q2（1 + 其他 1 + 追问 1）= 4；q3 未开启题内计分不计分
        self.assertEqual(4, result["totalScore"])
        self.assertEqual("需关注", result["level"])

    def test_formula_inner_scoring(self):
        definition = base_definition()
        question(definition, "q2")["innerScoring"] = {
            "mode": "formula",
            "formula": "q2-a + q2-b * q2-c",
        }
        definition["scoreRanges"] = [rng(0, 3, "平稳"), rng(4, 6, "需关注")]
        result, _ = score(
            definition,
            {"q1": "q1-a", "q2": ["q2-b", {"optionId": "q2-c", "followUp": "说明"}]},
        )
        # 0 + (0 + 2 × 2) = 4
        self.assertEqual(4, result["totalScore"])
        result, _ = score(definition, {"q1": "q1-a", "q2": ["q2-b"]})
        # 只选食欲下降：q2-a 与 q2-c 未选按 0 计算
        self.assertEqual(0, result["totalScore"])

    def test_dimension_uses_inner_score(self):
        definition = base_definition(
            scoringType="dimension",
            scoringPreset="generic-dimension-v1",
            dimensions=[
                {
                    "id": "symptom",
                    "title": "症状",
                    "questionIds": ["q2"],
                    "reverseQuestionIds": [],
                    "calculationMode": "simple",
                    "aggregate": "sum",
                    "scoreRanges": [rng(1, 2, "轻"), rng(3, 5, "重")],
                },
                {
                    "id": "hobby",
                    "title": "爱好",
                    "questionIds": ["q3"],
                    "reverseQuestionIds": [],
                    "calculationMode": "simple",
                    "aggregate": "sum",
                    "scoreRanges": [rng(0, 0, "不计分")],
                },
            ],
        )
        definition.pop("scoreRanges")
        definition.pop("reverseQuestionIds")
        validate_definition(definition, allow_fixed_scoring=False)
        result, _ = score(definition, {"q1": "q1-a", "q2": ["q2-a", "q2-b"], "q3": ["q3-a"]})
        dimensions = {item["id"]: (item["score"], item["level"]) for item in result["dimensions"]}
        self.assertEqual({"symptom": (3, "重"), "hobby": (0, "不计分")}, dimensions)

    def test_risk_option_rules_count_multiple_selections(self):
        definition = base_definition()
        definition["riskDimension"] = {
            "title": "风险",
            "levels": {
                "high": {
                    "rules": [
                        {
                            "id": "both",
                            "type": "options",
                            "match": "multiple",
                            "optionIds": ["q2-a", "q2-b"],
                        }
                    ]
                }
            },
        }
        # 同一道多选题的两个选项可以同时被选，校验不应拦截
        validate_definition(definition, allow_fixed_scoring=False)
        result, _ = score(definition, {"q1": "q1-a", "q2": ["q2-a", "q2-b"]})
        self.assertEqual("high", result["risk"]["severity"])
        self.assertEqual(["q2-a", "q2-b"], result["risk"]["matchedRules"][0]["optionIds"])
        result, _ = score(definition, {"q1": "q1-a", "q2": ["q2-a"]})
        # 只选一项不满足“同时被选”，未命中任何规则时判为无风险
        self.assertEqual("ok", result["risk"]["severity"])

        # 单选题同一题的两个选项仍然不能要求同时命中
        definition["riskDimension"]["levels"]["high"]["rules"][0]["optionIds"] = ["q1-a", "q1-b"]
        with self.assertRaisesRegex(AssessmentValidationError, "单选题同一题只能选中一个选项"):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_match_scale_accumulates_tags_of_all_selected_options(self):
        definition = base_definition(
            scoringType="match",
            scoringPreset="generic-match-v1",
            matchResults=[
                {"id": "calm", "title": "平稳型", "description": "平稳", "image": "", "shareText": ""},
                {"id": "busy", "title": "忙碌型", "description": "忙碌", "image": "", "shareText": ""},
            ],
        )
        definition.pop("scoreRanges")
        definition.pop("reverseQuestionIds")
        for item in definition["questions"]:
            for option in item["options"]:
                option["matchTags"] = {"calm": 1}
        question(definition, "q2")["options"][0]["matchTags"] = {"busy": 1}
        question(definition, "q2")["options"][1]["matchTags"] = {"busy": 1}
        validate_definition(definition, allow_fixed_scoring=False)
        result, _ = score(definition, {"q1": "q1-a", "q2": ["q2-a", "q2-b"]})
        # busy 来自 q2 两个选项共 2 分，calm 只有 q1 的 1 分
        self.assertEqual("busy", result["resultId"])


class StoreRoundTripTests(unittest.TestCase):
    def test_draft_publish_and_score(self):
        with tempfile.TemporaryDirectory() as directory:
            store = AssessmentDefinitionStore(Path(directory) / "assessment-data")
            created = store.create_draft(copy.deepcopy(base_definition()))
            store.publish("multi-demo", expected_revision=created["revision"])
            published = store.get_published("multi-demo")["definition"]
            self.assertTrue(question(published, "q2")["multiple"])
            self.assertEqual({"mode": "sum"}, question(published, "q2")["innerScoring"])
            result, _ = score(published, {"q1": "q1-a", "q2": ["q2-b"]})
            self.assertEqual(2, result["totalScore"])


if __name__ == "__main__":
    unittest.main()
