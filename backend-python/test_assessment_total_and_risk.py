"""多维度总分与风险编辑：定义校验、计分、来访端剥离、组合量表同步和企业数据分级。"""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import assessment_enterprise_routes
import assessment_routes
from assessment_definition_service import (
    AssessmentDefinitionStore,
    AssessmentValidationError,
    _sync_composed_source_reports,
    validate_definition,
)
from assessment_report_routes import _attach_risk_summaries
from assessment_report_service import report_detail, submit_report
from assessment_risk_rules import upgrade_legacy_risk_dimension
from assessment_scoring_service import (
    assessment_result_summary,
    calculate_assessment_result,
)
from assessment_visibility import public_definition, public_report_snapshot, public_result
from config import settings
from database import Base
from enterprise_data_service import summarize_result
from models import AppAccount, AppAssessmentAuditLog, AppAssessmentReport, AppRoleBinding


BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent


def example_definition() -> dict:
    """示例维度量表：q1–q3 选项分值 0/1/2；情绪状态 = q1 + q2（0–1 需要关注，2–4 状态平稳），
    精力状态 = q3（0 需要休息，1–2 精力尚可）。"""
    path = REPOSITORY_DIR / "docs" / "assessment" / "examples" / "professional-dimension.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def total_score_block(**overrides) -> dict:
    block = {
        "title": "综合总分",
        "intro": "三道题相加",
        "questionIds": ["q1", "q2", "q3"],
        "reverseQuestionIds": [],
        "calculationMode": "simple",
        "aggregate": "sum",
        "scoreRanges": [
            {
                "min": 0,
                "max": 2,
                "level": "需要关注",
                "visitorDescription": "总体偏低",
                "analystDescription": "总体偏低，建议关注",
                "suggestions": ["规律作息"],
            },
            {
                "min": 3,
                "max": 6,
                "level": "整体平稳",
                "visitorDescription": "总体平稳",
                "analystDescription": "总体平稳",
                "suggestions": [],
            },
        ],
    }
    block.update(overrides)
    return block


def option_rule(rule_id: str, option_ids: list[str], **overrides) -> dict:
    rule = {"id": rule_id, "type": "options", "match": "any", "optionIds": option_ids}
    rule.update(overrides)
    return rule


def score_rule(rule_id: str, **overrides) -> dict:
    rule = {
        "id": rule_id,
        "type": "score",
        "title": "情绪风险分",
        "questionIds": ["q1", "q2"],
        "reverseQuestionIds": [],
        "calculationMode": "simple",
        "aggregate": "sum",
        "min": 0,
        "max": 1,
    }
    rule.update(overrides)
    return rule


def dimension_rule(rule_id: str, dimension_id: str, levels: list[str]) -> dict:
    return {"id": rule_id, "type": "dimension", "dimensionId": dimension_id, "levels": levels}


def risk_block(**overrides) -> dict:
    """高风险：q3 选「不符合」；中风险：情绪风险分 0–1；一般关注：情绪状态为「需要关注」。"""
    block = {
        "title": "风险",
        "intro": "精力最低档为高风险，情绪偏低为中风险",
        "levels": {
            "high": {
                "rules": [option_rule("energy-lowest", ["q3-a"])],
                "analystDescription": "精力最低档，需要立即联系",
                "suggestions": ["当天电话联系"],
            },
            "mid": {
                "rules": [score_rule("emotion-score")],
                "analystDescription": "情绪分偏低",
                "suggestions": ["一周内回访"],
            },
            "watch": {
                "rules": [dimension_rule("emotion-watch", "emotion", ["需要关注"])],
            },
        },
    }
    block.update(overrides)
    return block


def legacy_risk_block() -> dict:
    """升级前的旧版风险维度：一套计分区间 + 选项触发。"""
    return {
        "title": "风险",
        "intro": "旧版口径",
        "scoring": {
            "questionIds": ["q1", "q2"],
            "reverseQuestionIds": [],
            "calculationMode": "simple",
            "aggregate": "sum",
            "scoreRanges": [
                {
                    "min": 0,
                    "max": 1,
                    "level": "中风险",
                    "severity": "mid",
                    "analystDescription": "情绪分偏低",
                    "suggestions": ["一周内回访"],
                },
                {
                    "min": 2,
                    "max": 4,
                    "level": "低风险",
                    "severity": "ok",
                    "analystDescription": "",
                    "suggestions": [],
                },
            ],
        },
        "triggers": [
            {
                "id": "trigger-1",
                "level": "高风险",
                "severity": "high",
                "optionIds": ["q3-a"],
                "analystDescription": "精力最低档，需要立即联系",
                "suggestions": ["当天电话联系"],
            }
        ],
    }


def with_total_and_risk() -> dict:
    definition = example_definition()
    definition["totalScore"] = total_score_block()
    definition["riskDimension"] = risk_block()
    return definition


def with_risk(levels: dict, **extra) -> dict:
    definition = example_definition()
    definition["riskDimension"] = {"title": "风险", "intro": "", "levels": levels, **extra}
    return definition


class DefinitionValidationTests(unittest.TestCase):
    def assert_invalid(self, definition: dict, pattern: str) -> None:
        with self.assertRaisesRegex(AssessmentValidationError, pattern):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_total_and_risk_are_accepted(self) -> None:
        validate_definition(with_total_and_risk(), allow_fixed_scoring=False)

    def test_total_score_requires_dimension_scoring(self) -> None:
        definition = with_total_and_risk()
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v2"
        definition["scoreRanges"] = copy.deepcopy(definition["totalScore"]["scoreRanges"])
        definition.pop("dimensions")
        definition["riskDimension"]["levels"].pop("watch")
        self.assert_invalid(definition, "totalScore 仅适用于维度计分")
        # 组合量表草稿发布前才确定计分方式，草稿阶段允许暂存
        validate_definition(definition, allow_fixed_scoring=False, allow_incomplete=True)

    def test_total_score_ranges_must_cover_reachable_scores(self) -> None:
        definition = with_total_and_risk()
        definition["totalScore"]["scoreRanges"][1]["max"] = 5
        self.assert_invalid(definition, "totalScore.scoreRanges未覆盖可达分值：6")

    def test_every_level_is_optional(self) -> None:
        # 什么都不配置：风险编辑不生效，标题也可以留空
        validate_definition(
            with_risk({}, title=""),
            allow_fixed_scoring=False,
        )
        validate_definition(
            with_risk({"high": {"rules": []}, "ok": {"rules": []}}),
            allow_fixed_scoring=False,
        )
        # 只配置高风险
        validate_definition(
            with_risk({"high": {"rules": [option_rule("r1", ["q3-a"])]}}),
            allow_fixed_scoring=False,
        )
        # 有规则时必须有名称
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", ["q3-a"])]}}, title=" "),
            "riskDimension.title",
        )

    def test_level_structure(self) -> None:
        self.assert_invalid(with_risk({"critical": {"rules": []}}), "未知风险等级")
        self.assert_invalid(
            with_risk({"high": {"rules": [], "fallback": True}}),
            "不能设置为未命中规则时的默认等级",
        )
        validate_definition(
            with_risk({"ok": {"rules": [], "fallback": True}}),
            allow_fixed_scoring=False,
        )
        self.assert_invalid(
            with_risk({"high": {"rules": [{"id": "r1", "type": "magic"}]}}),
            "第 1 条规则的类型不合法",
        )
        self.assert_invalid(
            with_risk(
                {
                    "high": {"rules": [option_rule("same", ["q3-a"])]},
                    "mid": {"rules": [option_rule("same", ["q2-a"])]},
                }
            ),
            "重复的规则 ID：same",
        )
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", ["q3-a"], level="高")]}}),
            "包含未知字段",
        )
        self.assert_invalid(
            with_risk({"high": {"rules": [], "suggestions": ["", "x"]}}),
            "跟进建议 格式错误",
        )

    def test_option_rules(self) -> None:
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", ["missing-option"])]}}),
            "引用了不存在的选项",
        )
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", [])]}}),
            "不能为空",
        )
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", ["q3-a"], match="all")]}}),
            "match 不合法",
        )
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", ["q3-a"], minCount=2)]}}),
            "minCount 仅适用于多项同时被选",
        )
        multiple = {"match": "multiple"}
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", ["q3-a"], **multiple)]}}),
            "至少需要选择 2 个选项",
        )
        self.assert_invalid(
            with_risk(
                {"high": {"rules": [option_rule("r1", ["q1-a", "q2-a"], minCount=1, **multiple)]}}
            ),
            "minCount 必须是不小于 2 的整数",
        )
        self.assert_invalid(
            with_risk(
                {"high": {"rules": [option_rule("r1", ["q1-a", "q2-a"], minCount=3, **multiple)]}}
            ),
            "不能超过已选选项数",
        )
        # 同一道题的两个选项不可能同时被选
        self.assert_invalid(
            with_risk({"high": {"rules": [option_rule("r1", ["q1-a", "q1-b"], **multiple)]}}),
            "最多同时命中 1 项",
        )
        validate_definition(
            with_risk(
                {
                    "high": {
                        "rules": [
                            option_rule(
                                "r1",
                                ["q1-a", "q1-b", "q2-a", "q3-a"],
                                minCount=3,
                                **multiple,
                            )
                        ]
                    }
                }
            ),
            allow_fixed_scoring=False,
        )

    def test_dimension_rules(self) -> None:
        self.assert_invalid(
            with_risk({"watch": {"rules": [dimension_rule("r1", "missing", ["需要关注"])]}}),
            "引用了不存在的维度：missing",
        )
        self.assert_invalid(
            with_risk({"watch": {"rules": [dimension_rule("r1", "emotion", ["不存在"])]}}),
            "引用的区间已不存在",
        )
        self.assert_invalid(
            with_risk({"watch": {"rules": [dimension_rule("r1", "emotion", [])]}}),
            "至少需要选择一个区间",
        )
        self.assert_invalid(
            with_risk({"watch": {"rules": [dimension_rule("r1", "__total__", ["需要关注"])]}}),
            "引用了不存在的总分",
        )
        definition = with_risk(
            {"watch": {"rules": [dimension_rule("r1", "__total__", ["需要关注"])]}}
        )
        definition["totalScore"] = total_score_block()
        validate_definition(definition, allow_fixed_scoring=False)

    def test_dimension_rule_on_sum_scale_uses_total_ranges(self) -> None:
        definition = with_risk(
            {"watch": {"rules": [dimension_rule("r1", "__total__", ["需要关注"])]}}
        )
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v2"
        definition["scoreRanges"] = copy.deepcopy(total_score_block()["scoreRanges"])
        definition.pop("dimensions")
        validate_definition(definition, allow_fixed_scoring=False)

        definition["riskDimension"]["levels"]["watch"]["rules"][0]["dimensionId"] = "emotion"
        self.assert_invalid(definition, "引用了不存在的维度：emotion")

    def test_score_rules(self) -> None:
        self.assert_invalid(
            with_risk({"mid": {"rules": [score_rule("r1", min=None, max=None)]}}),
            "至少需要填写最低分或最高分",
        )
        self.assert_invalid(
            with_risk({"mid": {"rules": [score_rule("r1", min=3, max=1)]}}),
            "最低分不能大于最高分",
        )
        self.assert_invalid(
            with_risk({"mid": {"rules": [score_rule("r1", questionIds=["q9"])]}}),
            "包含不存在的题目",
        )
        self.assert_invalid(
            with_risk(
                {
                    "mid": {
                        "rules": [
                            score_rule(
                                "r1",
                                calculationMode="formula",
                                formula="q1 + q3",
                            )
                        ]
                    }
                }
            ),
            "formula 中的题目 ID 必须与 questionIds 完全一致",
        )
        # 只填一端表示另一端不限
        validate_definition(
            with_risk({"mid": {"rules": [score_rule("r1", min=3, max=None)]}}),
            allow_fixed_scoring=False,
        )

    def test_legacy_risk_dimension_is_upgraded_in_place(self) -> None:
        definition = example_definition()
        definition["riskDimension"] = legacy_risk_block()
        validate_definition(definition, allow_fixed_scoring=False)
        upgraded = definition["riskDimension"]
        self.assertEqual({"title", "intro", "levels"}, set(upgraded))
        self.assertEqual(["high", "mid", "ok"], list(upgraded["levels"]))
        self.assertEqual(
            [option_rule("trigger-1", ["q3-a"])],
            upgraded["levels"]["high"]["rules"],
        )
        self.assertEqual("精力最低档，需要立即联系", upgraded["levels"]["high"]["analystDescription"])
        self.assertEqual(["当天电话联系"], upgraded["levels"]["high"]["suggestions"])
        mid_rule = upgraded["levels"]["mid"]["rules"][0]
        self.assertEqual(
            {
                "type": "score",
                "questionIds": ["q1", "q2"],
                "aggregate": "sum",
                "min": 0,
                "max": 1,
            },
            {key: mid_rule[key] for key in ("type", "questionIds", "aggregate", "min", "max")},
        )
        self.assertEqual(["一周内回访"], upgraded["levels"]["mid"]["suggestions"])
        # 有计分区间时全部可达分值都有归属，不需要兜底
        self.assertNotIn("fallback", upgraded["levels"]["ok"])
        self.assertEqual(
            len({rule["id"] for level in upgraded["levels"].values() for rule in level["rules"]}),
            3,
        )

    def test_legacy_trigger_only_upgrade_keeps_untriggered_as_ok(self) -> None:
        legacy = legacy_risk_block()
        legacy.pop("scoring")
        upgraded = upgrade_legacy_risk_dimension(legacy)
        self.assertEqual({"rules": [], "fallback": True}, upgraded["levels"]["ok"])
        self.assertIn("triggers", legacy, "升级不能修改入参")
        # 新格式原样返回
        current = risk_block()
        self.assertIs(current, upgrade_legacy_risk_dimension(current))

    def test_legacy_unknown_fields_still_rejected(self) -> None:
        definition = example_definition()
        legacy = legacy_risk_block()
        legacy["triggers"][0]["visitorDescription"] = "x"
        definition["riskDimension"] = legacy
        # 旧触发规则的多余字段在升级时被丢弃，不会让升级后的规则带上未知字段
        validate_definition(definition, allow_fixed_scoring=False)
        definition = example_definition()
        legacy = legacy_risk_block()
        legacy["unknown"] = True
        definition["riskDimension"] = legacy
        self.assert_invalid(definition, "riskDimension 包含未知字段")


class ScoringTests(unittest.TestCase):
    def test_total_score_and_rule_based_risk(self) -> None:
        definition = with_total_and_risk()
        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-b", "q3": "q3-c"},
        )
        self.assertEqual("dimension", result["type"])
        self.assertEqual(
            {
                "title": "综合总分",
                "score": 3.0,
                "level": "整体平稳",
                "description": "总体平稳",
                "visitorDescription": "总体平稳",
                "analystDescription": "总体平稳",
                "suggestions": [],
            },
            result["total"],
        )
        risk = result["risk"]
        self.assertEqual("rule", risk["source"])
        self.assertEqual("mid", risk["severity"])
        self.assertEqual("中风险", risk["level"])
        self.assertEqual("情绪分偏低", risk["description"])
        self.assertEqual(["一周内回访"], risk["suggestions"])
        self.assertEqual(
            [
                {
                    "id": "emotion-score",
                    "type": "score",
                    "title": "情绪风险分",
                    "score": 1.0,
                    "min": 0,
                    "max": 1,
                    "severity": "mid",
                },
                {
                    "id": "emotion-watch",
                    "type": "dimension",
                    "dimensionId": "emotion",
                    "title": "情绪状态",
                    "score": 1.0,
                    "level": "需要关注",
                    "severity": "watch",
                },
            ],
            risk["matchedRules"],
        )

    def test_highest_matched_level_wins(self) -> None:
        result = calculate_assessment_result(
            with_total_and_risk(),
            {"q1": "q1-a", "q2": "q2-a", "q3": "q3-a"},
        )
        risk = result["risk"]
        self.assertEqual("high", risk["severity"])
        self.assertEqual("高风险", risk["level"])
        self.assertEqual("精力最低档，需要立即联系", risk["description"])
        self.assertEqual(
            ["high", "mid", "watch"],
            [rule["severity"] for rule in risk["matchedRules"]],
        )
        self.assertEqual(
            {"id": "energy-lowest", "type": "options", "match": "any", "optionIds": ["q3-a"], "requiredCount": 1, "severity": "high"},
            risk["matchedRules"][0],
        )

    def test_multiple_option_rule_needs_enough_selected_options(self) -> None:
        rule = option_rule("combo", ["q1-a", "q2-a", "q3-a"], match="multiple", minCount=2)
        definition = with_risk({"high": {"rules": [rule]}})
        two = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-a", "q3": "q3-c"})
        self.assertEqual("high", two["risk"]["severity"])
        self.assertEqual(["q1-a", "q2-a"], two["risk"]["matchedRules"][0]["optionIds"])
        self.assertEqual(2, two["risk"]["matchedRules"][0]["requiredCount"])
        one = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-c", "q3": "q3-c"})
        self.assertEqual("ok", one["risk"]["severity"])

        # 不设置 minCount 时需要全部同时被选
        rule.pop("minCount")
        two = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-a", "q3": "q3-c"})
        self.assertEqual("ok", two["risk"]["severity"])
        three = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-a", "q3": "q3-a"})
        self.assertEqual("high", three["risk"]["severity"])
        self.assertEqual(3, three["risk"]["matchedRules"][0]["requiredCount"])

    def test_unmatched_rules_are_automatically_no_risk(self) -> None:
        definition = with_risk({"high": {"rules": [option_rule("r1", ["q3-a"])]}})
        result = calculate_assessment_result(definition, {"q1": "q1-b", "q2": "q2-b", "q3": "q3-b"})
        self.assertEqual(
            {
                "title": "风险",
                "level": "无风险",
                "severity": "ok",
                "source": "fallback",
                "description": "",
                "suggestions": [],
                "matchedRules": [],
            },
            result["risk"],
        )

    def test_unmatched_with_fallback_is_ok(self) -> None:
        definition = with_risk(
            {
                "high": {"rules": [option_rule("r1", ["q3-a"])]},
                "ok": {"rules": [], "fallback": True, "analystDescription": "无需跟进"},
            }
        )
        result = calculate_assessment_result(definition, {"q1": "q1-b", "q2": "q2-b", "q3": "q3-b"})
        risk = result["risk"]
        self.assertEqual(("ok", "fallback", "无风险"), (risk["severity"], risk["source"], risk["level"]))
        self.assertEqual("无需跟进", risk["description"])
        triggered = calculate_assessment_result(definition, {"q1": "q1-b", "q2": "q2-b", "q3": "q3-a"})
        self.assertEqual("high", triggered["risk"]["severity"])

    def test_legacy_ok_level_rules_are_replaced_by_default(self) -> None:
        definition = with_risk(
            {
                "watch": {"rules": [dimension_rule("r1", "emotion", ["需要关注"])]},
                "ok": {"rules": [dimension_rule("r2", "energy", ["精力尚可"])]},
            }
        )
        calm = calculate_assessment_result(definition, {"q1": "q1-c", "q2": "q2-c", "q3": "q3-c"})
        self.assertEqual(("ok", "fallback"), (calm["risk"]["severity"], calm["risk"]["source"]))
        both = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-a", "q3": "q3-c"})
        self.assertEqual("watch", both["risk"]["severity"])
        self.assertEqual(["r1"], [rule["id"] for rule in both["risk"]["matchedRules"]])
        neither = calculate_assessment_result(definition, {"q1": "q1-c", "q2": "q2-c", "q3": "q3-a"})
        self.assertEqual("ok", neither["risk"]["severity"])

    def test_total_source_for_dimension_and_sum_scales(self) -> None:
        definition = with_risk({"watch": {"rules": [dimension_rule("r1", "__total__", ["需要关注"])]}})
        definition["totalScore"] = total_score_block()
        result = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-b", "q3": "q3-b"})
        self.assertEqual("watch", result["risk"]["severity"])
        self.assertEqual(
            {"dimensionId": "__total__", "title": "综合总分", "score": 2.0, "level": "需要关注"},
            {
                key: result["risk"]["matchedRules"][0][key]
                for key in ("dimensionId", "title", "score", "level")
            },
        )

        definition.pop("totalScore")
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v2"
        definition["scoreRanges"] = copy.deepcopy(total_score_block()["scoreRanges"])
        definition.pop("dimensions")
        validate_definition(definition, allow_fixed_scoring=False)
        result = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-a", "q3": "q3-b"})
        self.assertEqual("sum", result["type"])
        self.assertEqual("watch", result["risk"]["severity"])
        self.assertEqual("总分", result["risk"]["matchedRules"][0]["title"])
        calm = calculate_assessment_result(definition, {"q1": "q1-c", "q2": "q2-c", "q3": "q3-c"})
        self.assertEqual("ok", calm["risk"]["severity"])

    def test_score_rule_open_bounds_and_formula(self) -> None:
        definition = with_risk(
            {
                "high": {"rules": [score_rule("at-least", min=4, max=None)]},
                "watch": {
                    "rules": [
                        score_rule(
                            "formula",
                            title="差值",
                            questionIds=["q1", "q3"],
                            calculationMode="formula",
                            formula="q1 - q3",
                            min=None,
                            max=-1,
                        )
                    ]
                },
            }
        )
        validate_definition(definition, allow_fixed_scoring=False)
        high = calculate_assessment_result(definition, {"q1": "q1-c", "q2": "q2-c", "q3": "q3-c"})
        self.assertEqual("high", high["risk"]["severity"])
        self.assertEqual(4.0, high["risk"]["matchedRules"][0]["score"])
        watch = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-b", "q3": "q3-c"})
        self.assertEqual("watch", watch["risk"]["severity"])
        self.assertEqual(
            {"title": "差值", "score": -2.0, "min": None, "max": -1},
            {key: watch["risk"]["matchedRules"][0][key] for key in ("title", "score", "min", "max")},
        )

    def test_inactive_risk_config_adds_no_result(self) -> None:
        definition = with_risk({"high": {"rules": []}})
        result = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-a", "q3": "q3-a"})
        self.assertNotIn("risk", result)

    def test_legacy_definition_is_scored_with_new_rules(self) -> None:
        # 已发布的旧版定义文件不会被改写，计分时就地升级
        definition = example_definition()
        definition["riskDimension"] = legacy_risk_block()
        result = calculate_assessment_result(definition, {"q1": "q1-c", "q2": "q2-c", "q3": "q3-a"})
        risk = result["risk"]
        self.assertEqual(("high", "高风险", "rule"), (risk["severity"], risk["level"], risk["source"]))
        self.assertEqual(["trigger-1"], [rule["id"] for rule in risk["matchedRules"] if rule["severity"] == "high"])
        self.assertIn("scoring", definition["riskDimension"], "计分不修改入参")

        legacy = legacy_risk_block()
        legacy.pop("scoring")
        definition["riskDimension"] = legacy
        quiet = calculate_assessment_result(definition, {"q1": "q1-b", "q2": "q2-b", "q3": "q3-b"})
        self.assertEqual(("ok", "fallback"), (quiet["risk"]["severity"], quiet["risk"]["source"]))

    def test_summary_shows_total_but_never_risk(self) -> None:
        result = calculate_assessment_result(
            with_total_and_risk(),
            {"q1": "q1-a", "q2": "q2-a", "q3": "q3-a"},
        )
        summary = assessment_result_summary(result)
        self.assertTrue(summary.startswith("综合总分 需要关注（0 分） · "), summary)
        self.assertNotIn("风险", summary)

    def test_risk_also_works_for_match_scales(self) -> None:
        definition = example_definition()
        definition["scoringType"] = "match"
        definition["scoringPreset"] = "generic-match-v1"
        definition.pop("dimensions")
        for question in definition["questions"]:
            for option in question["options"]:
                option["matchTags"] = {"calm": 1}
        definition["matchResults"] = [
            {
                "id": "calm",
                "title": "平稳型",
                "description": "整体平稳",
                "image": "",
                "shareText": "",
            }
        ]
        definition["riskDimension"] = {
            "title": "风险",
            "levels": {
                "high": {"rules": [option_rule("r1", ["q3-a"])]},
                "mid": {"rules": [score_rule("r2", min=0, max=1)]},
            },
        }
        validate_definition(definition, allow_fixed_scoring=False)
        result = calculate_assessment_result(definition, {"q1": "q1-a", "q2": "q2-b", "q3": "q3-c"})
        self.assertEqual("match", result["type"])
        self.assertEqual("mid", result["risk"]["severity"])

        # 匹配量表没有可引用的维度区间
        definition["riskDimension"]["levels"]["watch"] = {
            "rules": [dimension_rule("r3", "__total__", ["需要关注"])]
        }
        with self.assertRaisesRegex(AssessmentValidationError, "引用了不存在的总分"):
            validate_definition(definition, allow_fixed_scoring=False)


class VisibilityTests(unittest.TestCase):
    def test_public_helpers_strip_only_staff_fields(self) -> None:
        definition = with_total_and_risk()
        cleaned = public_definition(definition)
        self.assertNotIn("riskDimension", cleaned)
        self.assertIn("totalScore", cleaned)
        self.assertIn("riskDimension", definition, "入参不能被修改")

        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-a", "q3": "q3-a"},
        )
        self.assertNotIn("risk", public_result(result))
        self.assertIn("total", public_result(result))
        snapshot = public_report_snapshot({"assessment": definition, "result": result})
        self.assertNotIn("riskDimension", snapshot["assessment"])
        self.assertNotIn("risk", snapshot["result"])


class ReportAndRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.store = AssessmentDefinitionStore(Path(self.temporary.name) / "assessment-data")
        created = self.store.create_draft(with_total_and_risk())
        self.store.publish("wellbeing-demo", expected_revision=created["revision"])

        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppAssessmentReport.__table__,
                AppAssessmentAuditLog.__table__,
            ],
        )
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.patient = AppAccount(
            Id=801,
            Mobile="13800000801",
            RealName="风险测试来访者",
            ActiveRole="Patient",
            IsActive=True,
        )
        self.db.add(self.patient)
        self.db.add(AppRoleBinding(AccountId=801, RoleType="Patient"))
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temporary.cleanup()

    def test_visitor_payloads_hide_risk_but_staff_view_keeps_it(self) -> None:
        submitted = submit_report(
            self.db,
            account=self.patient,
            store=self.store,
            client_submission_id=str(uuid.uuid4()),
            assessment_id="wellbeing-demo",
            assessment_version=1,
            demographic_answers={"gender": "female", "age": 30},
            answers={"q1": "q1-a", "q2": "q2-a", "q3": "q3-a"},
            entry_source="web",
            share_code=None,
            consent_version=settings.ASSESSMENT_CONSENT_VERSION,
        )
        self.assertNotIn("risk", submitted["result"])
        self.assertNotIn("risk", submitted["reportSnapshot"]["result"])
        self.assertNotIn("riskDimension", submitted["reportSnapshot"]["assessment"])
        self.assertIn("total", submitted["result"])
        self.assertNotIn("风险", submitted["resultSummary"])

        row = self.db.query(AppAssessmentReport).one()
        stored = json.loads(row.ResultJson)
        self.assertEqual("high", stored["risk"]["severity"], "库里保存完整结果")

        visitor = report_detail(row, include_raw_answers=True)
        self.assertNotIn("risk", visitor["result"])
        staff = report_detail(row, include_raw_answers=True, staff_view=True)
        self.assertEqual("high", staff["result"]["risk"]["severity"])
        self.assertIn("levels", staff["reportSnapshot"]["assessment"]["riskDimension"])

        # 管理端报告列表：只给当前页 EAP 报告补风险摘要
        items = [
            {"source": "eap", "reportId": row.PublicId},
            {"source": "mini-legacy", "reportId": "1"},
        ]
        _attach_risk_summaries(self.db, items)
        self.assertEqual(
            {"level": "高风险", "severity": "high", "source": "rule"},
            items[0]["risk"],
        )
        self.assertNotIn("risk", items[1])

    def test_public_definition_endpoints_hide_risk_config(self) -> None:
        with patch.object(assessment_routes, "get_assessment_store", return_value=self.store), patch(
            "assessment_routes.public_share_info",
            return_value={"shareCode": None, "shareUrl": None},
        ):
            payload = assessment_routes.get_published_assessment("wellbeing-demo")
        self.assertNotIn("riskDimension", payload["definition"])
        self.assertIn("totalScore", payload["definition"])

        with patch.object(
            assessment_enterprise_routes, "get_assessment_store", return_value=self.store
        ):
            definitions = assessment_enterprise_routes._published_assessments(
                ["wellbeing-demo"], {"wellbeing-demo": "入职测评"}
            )
        self.assertEqual("入职测评", definitions[0]["title"])
        self.assertNotIn("riskDimension", definitions[0])
        self.assertIn("riskDimension", self.store.get_published("wellbeing-demo")["definition"])

    def test_legacy_draft_is_saved_in_new_format(self) -> None:
        definition = example_definition()
        definition["id"] = "legacy-risk-demo"
        definition["riskDimension"] = legacy_risk_block()
        created = self.store.create_draft(definition)
        stored = created["definition"]["riskDimension"]
        self.assertIn("levels", stored)
        self.assertNotIn("triggers", stored)
        # 重新读取草稿文件也是新格式
        reloaded = self.store.get_admin("legacy-risk-demo")["definition"]["riskDimension"]
        self.assertEqual(stored, reloaded)


class ComposedSyncTests(unittest.TestCase):
    def composed_definition(self) -> dict:
        definition = example_definition()
        for question in definition["questions"]:
            question["sourceAssessmentId"] = "parent-a"
            question["sourceAssessmentTitle"] = "母量表 A"
            question["sourceQuestionId"] = question["id"]
        definition["composedFrom"] = [{"id": "parent-a", "title": "母量表 A"}]
        only = copy.deepcopy(total_score_block())
        only.update({"id": "parent-a-total", "title": "总分"})
        only.pop("intro")
        definition["sourceReports"] = [
            {
                "sourceId": "parent-a",
                "sourceTitle": "母量表 A",
                "scoringType": "sum",
                "scoringPreset": "generic-sum-v2",
                "questionIds": ["q1", "q2", "q3"],
                "dimensions": [only],
            }
        ]
        definition["totalScore"] = total_score_block()
        return definition

    def test_sync_to_sum_drops_total_score_but_keeps_risk(self) -> None:
        definition = self.composed_definition()
        definition["riskDimension"] = {
            "title": "风险",
            "levels": {
                "high": {"rules": [option_rule("r1", ["q3-a"])]},
                "watch": {"rules": [dimension_rule("r2", "__total__", ["需要关注"])]},
            },
        }
        _sync_composed_source_reports(definition)
        self.assertEqual("sum", definition["scoringType"])
        self.assertNotIn("totalScore", definition)
        self.assertIn("riskDimension", definition)
        validate_definition(definition, allow_fixed_scoring=False)

    def test_composed_draft_defers_dimension_references_until_publish(self) -> None:
        definition = self.composed_definition()
        definition["riskDimension"] = {
            "title": "风险",
            "levels": {"watch": {"rules": [dimension_rule("r1", "parent-a-total", ["需要关注"])]}},
        }
        validate_definition(definition, allow_fixed_scoring=False, allow_incomplete=True)
        _sync_composed_source_reports(definition)
        # 只剩一个覆盖全部题目的结果时同步成求和量表，原维度不再存在
        with self.assertRaisesRegex(AssessmentValidationError, "引用了不存在的维度：parent-a-total"):
            validate_definition(definition, allow_fixed_scoring=False)


class EnterpriseSeverityTests(unittest.TestCase):
    def test_risk_rules_drive_enterprise_severity(self) -> None:
        result = calculate_assessment_result(
            with_total_and_risk(),
            {"q1": "q1-c", "q2": "q2-c", "q3": "q3-a"},
        )
        summary = summarize_result(result)
        self.assertEqual("high", summary["autoSeverity"])
        self.assertEqual("风险", summary["triggers"][0]["title"])
        self.assertEqual("高风险", summary["risk"]["level"])
        self.assertEqual("rule", summary["risk"]["source"])
        self.assertEqual(
            [{"id": "energy-lowest", "type": "options", "severity": "high", "score": None}],
            summary["risk"]["rules"],
        )
        self.assertIsNone(summary["risk"]["score"])
        self.assertEqual(4, summary["score"], "维度量表有总分时用总分作为答卷得分")
        self.assertEqual("整体平稳", summary["level"])

    def test_score_of_decisive_rule_is_reported(self) -> None:
        result = calculate_assessment_result(
            with_total_and_risk(),
            {"q1": "q1-a", "q2": "q2-b", "q3": "q3-c"},
        )
        summary = summarize_result(result)
        self.assertEqual("mid", summary["autoSeverity"])
        self.assertEqual(1, summary["risk"]["score"])

    def test_unmatched_rules_mark_report_ok_in_enterprise_data(self) -> None:
        definition = with_total_and_risk()
        definition["riskDimension"]["levels"] = {
            "high": {"rules": [option_rule("r1", ["q3-a"])]},
        }
        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-a", "q3": "q3-b"},
        )
        summary = summarize_result(result)
        self.assertEqual("ok", summary["risk"]["severity"])
        self.assertEqual("ok", summary["autoSeverity"])

    def test_untriggered_legacy_trigger_only_risk_marks_report_ok(self) -> None:
        definition = example_definition()
        legacy = legacy_risk_block()
        legacy.pop("scoring")
        definition["riskDimension"] = legacy
        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-a", "q3": "q3-b"},
        )
        summary = summarize_result(result)
        # 维度等级里有“需要关注”，但旧版只配触发规则时未触发即无风险，升级后保持这一口径
        self.assertEqual("ok", summary["autoSeverity"])
        self.assertEqual("ok", summary["risk"]["severity"])

    def test_legacy_stored_results_are_still_summarized(self) -> None:
        stored = {
            "type": "sum",
            "totalScore": 1,
            "level": "需要关注",
            "risk": {
                "title": "风险",
                "level": "高风险",
                "severity": "high",
                "source": "trigger",
                "description": "",
                "suggestions": [],
                "triggers": [
                    {
                        "id": "trigger-1",
                        "level": "高风险",
                        "severity": "high",
                        "optionIds": ["q3-a"],
                        "description": "",
                    }
                ],
                "score": 1,
                "scoreLevel": "中风险",
                "scoreSeverity": "mid",
            },
        }
        summary = summarize_result(stored)
        self.assertEqual("high", summary["autoSeverity"])
        self.assertEqual("trigger", summary["risk"]["source"])
        self.assertEqual(1, summary["risk"]["score"])
        self.assertEqual(
            [{"id": "trigger-1", "type": "options", "severity": "high", "score": None}],
            summary["risk"]["rules"],
        )


if __name__ == "__main__":
    unittest.main()
