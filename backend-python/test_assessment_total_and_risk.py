"""多维度总分与风险维度：定义校验、计分、来访端剥离、组合量表同步和企业数据分级。"""

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


def risk_block(**overrides) -> dict:
    block = {
        "title": "风险",
        "intro": "q1 选最低档或总分过低视为风险",
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
    block.update(overrides)
    return block


def with_total_and_risk() -> dict:
    definition = example_definition()
    definition["totalScore"] = total_score_block()
    definition["riskDimension"] = risk_block()
    return definition


class DefinitionValidationTests(unittest.TestCase):
    def test_total_and_risk_are_accepted(self) -> None:
        validate_definition(with_total_and_risk(), allow_fixed_scoring=False)

    def test_total_score_requires_dimension_scoring(self) -> None:
        definition = with_total_and_risk()
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v2"
        definition["scoreRanges"] = copy.deepcopy(definition["totalScore"]["scoreRanges"])
        definition.pop("dimensions")
        with self.assertRaisesRegex(AssessmentValidationError, "totalScore 仅适用于维度计分"):
            validate_definition(definition, allow_fixed_scoring=False)
        # 组合量表草稿发布前才确定计分方式，草稿阶段允许暂存
        validate_definition(definition, allow_fixed_scoring=False, allow_incomplete=True)

    def test_total_score_ranges_must_cover_reachable_scores(self) -> None:
        definition = with_total_and_risk()
        definition["totalScore"]["scoreRanges"][1]["max"] = 5
        with self.assertRaisesRegex(AssessmentValidationError, "totalScore.scoreRanges未覆盖可达分值：6"):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_risk_needs_scoring_or_triggers(self) -> None:
        definition = example_definition()
        definition["riskDimension"] = {"title": "风险", "intro": ""}
        with self.assertRaisesRegex(AssessmentValidationError, "至少需要配置计分判定或选项触发"):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_risk_trigger_option_must_exist(self) -> None:
        definition = with_total_and_risk()
        definition["riskDimension"]["triggers"][0]["optionIds"] = ["missing-option"]
        with self.assertRaisesRegex(AssessmentValidationError, "引用了不存在的选项"):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_risk_ranges_need_valid_severity_and_coverage(self) -> None:
        definition = with_total_and_risk()
        definition["riskDimension"]["scoring"]["scoreRanges"][0]["severity"] = "danger"
        with self.assertRaisesRegex(AssessmentValidationError, "severity 不合法"):
            validate_definition(definition, allow_fixed_scoring=False)

        definition = with_total_and_risk()
        definition["riskDimension"]["scoring"]["scoreRanges"][1]["max"] = 3
        with self.assertRaisesRegex(AssessmentValidationError, "未覆盖可达分值：4"):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_trigger_only_risk_and_unknown_fields(self) -> None:
        definition = example_definition()
        risk = risk_block()
        risk.pop("scoring")
        definition["riskDimension"] = risk
        validate_definition(definition, allow_fixed_scoring=False)

        definition["riskDimension"]["triggers"][0]["visitorDescription"] = "x"
        with self.assertRaisesRegex(AssessmentValidationError, "包含未知字段"):
            validate_definition(definition, allow_fixed_scoring=False)


class ScoringTests(unittest.TestCase):
    def test_total_score_and_score_based_risk(self) -> None:
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
        self.assertEqual("score", risk["source"])
        self.assertEqual("mid", risk["severity"])
        self.assertEqual("中风险", risk["level"])
        self.assertEqual(1.0, risk["score"])
        self.assertEqual("中风险", risk["scoreLevel"])
        self.assertEqual(["一周内回访"], risk["suggestions"])
        self.assertEqual([], risk["triggers"])

    def test_option_trigger_wins_with_higher_severity(self) -> None:
        result = calculate_assessment_result(
            with_total_and_risk(),
            {"q1": "q1-c", "q2": "q2-c", "q3": "q3-a"},
        )
        risk = result["risk"]
        self.assertEqual("trigger", risk["source"])
        self.assertEqual("high", risk["severity"])
        self.assertEqual("高风险", risk["level"])
        self.assertEqual("精力最低档，需要立即联系", risk["description"])
        self.assertEqual(["q3-a"], risk["triggers"][0]["optionIds"])
        # 计分判定结果仍保留，供后台对照
        self.assertEqual("低风险", risk["scoreLevel"])

    def test_trigger_only_risk_not_triggered(self) -> None:
        definition = example_definition()
        risk = risk_block()
        risk.pop("scoring")
        definition["riskDimension"] = risk
        result = calculate_assessment_result(
            definition,
            {"q1": "q1-b", "q2": "q2-b", "q3": "q3-b"},
        )
        self.assertEqual(
            {"level": "未触发", "severity": "ok", "source": "none"},
            {key: result["risk"][key] for key in ("level", "severity", "source")},
        )
        self.assertNotIn("score", result["risk"])
        self.assertNotIn("total", result)

    def test_summary_shows_total_but_never_risk(self) -> None:
        result = calculate_assessment_result(
            with_total_and_risk(),
            {"q1": "q1-a", "q2": "q2-a", "q3": "q3-a"},
        )
        summary = assessment_result_summary(result)
        self.assertTrue(summary.startswith("综合总分 需要关注（0 分） · "), summary)
        self.assertNotIn("风险", summary)

    def test_risk_also_works_for_sum_scales(self) -> None:
        definition = example_definition()
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v2"
        definition["scoreRanges"] = copy.deepcopy(total_score_block()["scoreRanges"])
        definition.pop("dimensions")
        definition["riskDimension"] = risk_block()
        validate_definition(definition, allow_fixed_scoring=False)
        result = calculate_assessment_result(
            definition,
            {"q1": "q1-c", "q2": "q2-c", "q3": "q3-c"},
        )
        self.assertEqual("sum", result["type"])
        self.assertEqual("ok", result["risk"]["severity"])
        self.assertNotIn("total", result)


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
        self.assertIn("riskDimension", staff["reportSnapshot"]["assessment"])

        # 管理端报告列表：只给当前页 EAP 报告补风险摘要
        items = [
            {"source": "eap", "reportId": row.PublicId},
            {"source": "mini-legacy", "reportId": "1"},
        ]
        _attach_risk_summaries(self.db, items)
        self.assertEqual(
            {"level": "高风险", "severity": "high", "source": "trigger"},
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


class ComposedSyncTests(unittest.TestCase):
    def test_sync_to_sum_drops_total_score_but_keeps_risk(self) -> None:
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
        definition["riskDimension"] = risk_block()
        _sync_composed_source_reports(definition)
        self.assertEqual("sum", definition["scoringType"])
        self.assertNotIn("totalScore", definition)
        self.assertIn("riskDimension", definition)
        validate_definition(definition, allow_fixed_scoring=False)


class EnterpriseSeverityTests(unittest.TestCase):
    def test_risk_dimension_drives_enterprise_severity(self) -> None:
        result = calculate_assessment_result(
            with_total_and_risk(),
            {"q1": "q1-c", "q2": "q2-c", "q3": "q3-a"},
        )
        summary = summarize_result(result)
        self.assertEqual("high", summary["autoSeverity"])
        self.assertEqual("风险", summary["triggers"][0]["title"])
        self.assertEqual("高风险", summary["risk"]["level"])
        self.assertEqual("trigger", summary["risk"]["source"])
        self.assertEqual(4, summary["score"], "维度量表有总分时用总分作为答卷得分")
        self.assertEqual("整体平稳", summary["level"])

    def test_untriggered_risk_dimension_marks_report_ok(self) -> None:
        definition = example_definition()
        risk = risk_block()
        risk.pop("scoring")
        definition["riskDimension"] = risk
        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-a", "q3": "q3-b"},
        )
        summary = summarize_result(result)
        # 维度等级里有“需要关注”，但配置了风险维度时以风险维度为准
        self.assertEqual("ok", summary["autoSeverity"])
        self.assertEqual("ok", summary["risk"]["severity"])


if __name__ == "__main__":
    unittest.main()
