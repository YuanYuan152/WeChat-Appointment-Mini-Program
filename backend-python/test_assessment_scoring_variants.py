# -*- coding: utf-8 -*-
"""人口学计分方案：定义校验、方案匹配、按方案计分与风险判定、报告快照。"""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
import uuid
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from assessment_definition_service import (
    AssessmentDefinitionStore,
    AssessmentValidationError,
    validate_definition,
)
from assessment_report_service import report_detail, submit_report
from assessment_scoring_service import (
    calculate_assessment_result,
    validate_submission_answers,
)
from assessment_scoring_variants import (
    effective_definition,
    match_scoring_variant,
    resolve_scoring_definition,
)
from assessment_visibility import public_definition, public_report_snapshot
from config import settings
from database import Base
from models import (
    AppAccount,
    AppAssessmentAuditLog,
    AppAssessmentReport,
    AppPsychScaleResult,
    AppRoleBinding,
)

BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent


def rng(low, high, level):
    return {
        "min": low,
        "max": high,
        "level": level,
        "visitorDescription": f"{level}说明",
        "analystDescription": f"{level}分析",
        "suggestions": [],
    }


def option_risk(rule_id, option_ids, description):
    return {
        "rules": [{"id": rule_id, "type": "options", "match": "any", "optionIds": option_ids}],
        "analystDescription": description,
        "suggestions": [],
    }


def choice(qid, text):
    return {
        "id": qid,
        "text": text,
        "required": True,
        "inputType": "choice",
        "options": [
            {"id": f"{qid}-a", "text": "从不", "value": 0},
            {"id": f"{qid}-b", "text": "有时", "value": 1},
            {"id": f"{qid}-c", "text": "经常", "value": 2},
        ],
    }


def base_definition():
    """三道 0/1/2 分的单选题（总分 0–6）；性别（单选）、职业（多选）、备注（填空）三道人口学题。

    默认方案 0–3 正常、4–6 偏高，第 3 题选“经常”判高风险；
    “女性”方案改为 0–2 正常、3–6 偏高，第 2 题选“经常”判高风险；
    “教育医疗”方案只单独设置风险（第 1 题选“经常”判中风险），计分沿用默认方案。
    """
    return {
        "schemaVersion": 1,
        "id": "variant-demo",
        "version": 1,
        "status": "draft",
        "category": "professional",
        "title": "人口学计分方案演示",
        "subtitle": "",
        "description": "demo",
        "instructions": "请根据实际情况作答",
        "reportIntro": "结果仅供参考",
        "cover": "/static/assessments/demo.jpg",
        "duration": 5,
        "demographicQuestions": [
            {
                "id": "gender",
                "text": "您的性别？",
                "inputType": "single",
                "required": True,
                "options": [
                    {"id": "gender-male", "text": "男", "value": "male"},
                    {"id": "gender-female", "text": "女", "value": "female"},
                ],
            },
            {
                "id": "job",
                "text": "职业",
                "inputType": "multiple",
                "required": False,
                "options": [
                    {"id": "job-student", "text": "学生", "value": "student"},
                    {"id": "job-teacher", "text": "教师", "value": "teacher"},
                    {"id": "job-doctor", "text": "医生", "value": "doctor"},
                ],
            },
            {"id": "note", "text": "备注", "inputType": "text", "required": False},
        ],
        "scoringType": "sum",
        "scoringPreset": "generic-sum-v2",
        "questions": [choice("q1", "情绪低落"), choice("q2", "睡眠不好"), choice("q3", "难以放松")],
        "reverseQuestionIds": [],
        "scoreRanges": [rng(0, 3, "正常"), rng(4, 6, "偏高")],
        "riskDimension": {
            "title": "风险",
            "intro": "",
            "levels": {"high": option_risk("option-1", ["q3-c"], "默认：难以放松")},
        },
        "scoringVariants": [
            {
                "id": "female",
                "title": "女性",
                "conditions": [{"questionId": "gender", "optionIds": ["gender-female"]}],
                "scoring": {
                    "reverseQuestionIds": [],
                    "scoreRanges": [rng(0, 2, "正常"), rng(3, 6, "偏高")],
                },
                "riskDimension": {
                    "title": "风险",
                    "intro": "",
                    "levels": {"high": option_risk("option-1", ["q2-c"], "女性：睡眠不好")},
                },
            },
            {
                "id": "edu-med",
                "title": "教育医疗",
                "conditions": [{"questionId": "job", "optionIds": ["job-teacher", "job-doctor"]}],
                "riskDimension": {
                    "title": "风险",
                    "intro": "",
                    "levels": {"mid": option_risk("option-1", ["q1-c"], "教育医疗：情绪低落")},
                },
            },
        ],
        "disclaimer": "仅供参考",
    }


def answers(q1="q1-a", q2="q2-a", q3="q3-a"):
    return {"q1": q1, "q2": q2, "q3": q3}


class DefinitionTests(unittest.TestCase):
    def assert_invalid(self, definition, message):
        with self.assertRaises(AssessmentValidationError) as context:
            validate_definition(definition, allow_fixed_scoring=False)
        self.assertIn(message, str(context.exception))

    def test_variants_are_accepted(self):
        validate_definition(base_definition(), allow_fixed_scoring=False)

    def test_conditions_must_reference_choice_demographics(self):
        definition = base_definition()
        definition["scoringVariants"][0]["conditions"] = []
        self.assert_invalid(definition, "计分方案「女性」至少需要一个适用条件")

        definition = base_definition()
        definition["scoringVariants"][0]["conditions"][0]["questionId"] = "note"
        self.assert_invalid(definition, "只能引用单选或多选人口学题：note")

        definition = base_definition()
        definition["scoringVariants"][0]["conditions"][0]["questionId"] = "missing"
        self.assert_invalid(definition, "只能引用单选或多选人口学题：missing")

        definition = base_definition()
        definition["scoringVariants"][0]["conditions"][0]["optionIds"] = []
        self.assert_invalid(definition, "至少需要选择一个选项")

        definition = base_definition()
        definition["scoringVariants"][0]["conditions"][0]["optionIds"] = ["job-teacher"]
        self.assert_invalid(definition, "不存在的人口学选项：['job-teacher']")

        definition = base_definition()
        definition["scoringVariants"][0]["conditions"].append(
            {"questionId": "gender", "optionIds": ["gender-male"]}
        )
        self.assert_invalid(definition, "同一道人口学题只能设置一个条件")

        definition = base_definition()
        definition["scoringVariants"][0]["conditions"][0]["extra"] = True
        self.assert_invalid(definition, "条件字段不完整")

    def test_duplicate_conditions_and_unknown_fields(self):
        definition = base_definition()
        duplicate = copy.deepcopy(definition["scoringVariants"][0])
        duplicate["id"] = "female-2"
        duplicate["title"] = "女性二"
        definition["scoringVariants"].append(duplicate)
        self.assert_invalid(definition, "计分方案「女性二」与计分方案「女性」的适用条件完全相同")

        definition = base_definition()
        definition["scoringVariants"][0]["scoring"]["questions"] = []
        self.assert_invalid(definition, "scoringVariants[0].scoring 包含未知字段")

        definition = base_definition()
        definition["scoringVariants"][0]["color"] = "red"
        self.assert_invalid(definition, "scoringVariants[0]包含未知字段")

        definition = base_definition()
        definition["scoringVariants"][1]["id"] = "female"
        self.assert_invalid(definition, "scoringVariants包含重复 ID：female")

    def test_variant_scoring_is_validated_like_the_default(self):
        definition = base_definition()
        definition["scoringVariants"][0]["scoring"]["scoreRanges"] = [rng(0, 2, "正常")]
        with self.assertRaises(AssessmentValidationError) as context:
            validate_definition(definition, allow_fixed_scoring=False)
        self.assertTrue(str(context.exception).startswith("计分方案「女性」："))

        definition = base_definition()
        definition["scoringVariants"][0]["riskDimension"]["levels"]["high"]["rules"][0][
            "optionIds"
        ] = ["q9-c"]
        with self.assertRaises(AssessmentValidationError) as context:
            validate_definition(definition, allow_fixed_scoring=False)
        self.assertTrue(str(context.exception).startswith("计分方案「女性」："))

    def test_fixed_scoring_variants_may_only_override_risk(self):
        with tempfile.TemporaryDirectory() as directory:
            store = AssessmentDefinitionStore(
                Path(directory) / "assessment-data",
                seed_data_dir=REPOSITORY_DIR / "EAP_front_site" / "src" / "data",
                guidance_file=(
                    REPOSITORY_DIR / "EAP_front_site" / "src" / "lib" / "assessment" / "scale-guidance.ts"
                ),
                report_profiles_file=BACKEND_DIR / "assessment_seed_report_profiles.json",
            )
            store.ensure_seeded()
            psqi = copy.deepcopy(store.get_admin("psqi")["definition"])
        psqi["demographicQuestions"] = copy.deepcopy(base_definition()["demographicQuestions"][:1])
        risk_only = {
            "id": "female",
            "title": "女性",
            "conditions": [{"questionId": "gender", "optionIds": ["gender-female"]}],
            "riskDimension": {
                "title": "风险",
                "intro": "",
                "levels": {"high": option_risk("option-1", ["q6-d"], "主观睡眠很差")},
            },
        }
        psqi["scoringVariants"] = [risk_only]
        validate_definition(psqi, allow_fixed_scoring=True)

        psqi["scoringVariants"] = [
            {**risk_only, "scoring": {"scoreRanges": copy.deepcopy(psqi["scoreRanges"])}}
        ]
        with self.assertRaises(AssessmentValidationError) as context:
            validate_definition(psqi, allow_fixed_scoring=True)
        self.assertIn("固定计分量表的计分规则固定", str(context.exception))

    def test_store_round_trip_keeps_variants(self):
        with tempfile.TemporaryDirectory() as directory:
            store = AssessmentDefinitionStore(Path(directory) / "assessment-data")
            created = store.create_draft(copy.deepcopy(base_definition()))
            store.publish("variant-demo", expected_revision=created["revision"])
            published = store.get_published("variant-demo")["definition"]
        self.assertEqual(
            [variant["id"] for variant in published["scoringVariants"]],
            ["female", "edu-med"],
        )
        self.assertNotIn("scoringVariants", public_definition(published))
        self.assertNotIn("riskDimension", public_definition(published))


class MatchingTests(unittest.TestCase):
    def test_first_matching_variant_wins(self):
        definition = base_definition()
        self.assertIsNone(match_scoring_variant(definition, {}))
        self.assertIsNone(match_scoring_variant(definition, {"gender": "male"}))
        self.assertEqual(match_scoring_variant(definition, {"gender": "female"})["id"], "female")
        self.assertEqual(match_scoring_variant(definition, {"job": ["doctor"]})["id"], "edu-med")
        self.assertEqual(
            match_scoring_variant(definition, {"gender": "female", "job": ["teacher"]})["id"],
            "female",
        )
        self.assertIsNone(match_scoring_variant(definition, {"job": ["student"]}))
        # 多个条件需要同时满足
        definition["scoringVariants"][0]["conditions"].append(
            {"questionId": "job", "optionIds": ["job-student"]}
        )
        self.assertIsNone(match_scoring_variant(definition, {"gender": "female"}))
        self.assertEqual(
            match_scoring_variant(definition, {"gender": "female", "job": ["student", "doctor"]})[
                "id"
            ],
            "female",
        )

    def test_values_are_compared_strictly(self):
        definition = base_definition()
        definition["demographicQuestions"][0]["options"][1]["value"] = 2
        self.assertEqual(match_scoring_variant(definition, {"gender": 2.0})["id"], "female")
        self.assertIsNone(match_scoring_variant(definition, {"gender": "2"}))
        definition["demographicQuestions"][0]["options"][1]["value"] = True
        self.assertIsNone(match_scoring_variant(definition, {"gender": 1}))
        self.assertEqual(match_scoring_variant(definition, {"gender": True})["id"], "female")

    def test_effective_definition_replaces_owned_parts_only(self):
        definition = base_definition()
        female = effective_definition(definition, definition["scoringVariants"][0])
        self.assertNotIn("scoringVariants", female)
        self.assertEqual(female["scoreRanges"][0]["max"], 2)
        self.assertEqual(
            female["riskDimension"]["levels"]["high"]["rules"][0]["optionIds"], ["q2-c"]
        )
        edu = effective_definition(definition, definition["scoringVariants"][1])
        self.assertEqual(edu["scoreRanges"], definition["scoreRanges"])
        self.assertEqual(list(edu["riskDimension"]["levels"]), ["mid"])
        # 深拷贝：修改结果不影响原定义
        female["scoreRanges"][0]["max"] = 99
        self.assertEqual(definition["scoringVariants"][0]["scoring"]["scoreRanges"][0]["max"], 2)


class ScoringTests(unittest.TestCase):
    def test_score_ranges_and_risk_follow_the_matched_variant(self):
        definition = base_definition()
        total_three = answers(q1="q1-b", q2="q2-c", q3="q3-a")

        default = calculate_assessment_result(definition, total_three, {"gender": "male"})
        self.assertEqual((default["totalScore"], default["level"]), (3, "正常"))
        self.assertEqual(default["risk"]["severity"], "ok")
        self.assertNotIn("scoringVariant", default)

        female = calculate_assessment_result(definition, total_three, {"gender": "female"})
        self.assertEqual((female["totalScore"], female["level"]), (3, "偏高"))
        self.assertEqual(female["risk"]["severity"], "high")
        self.assertEqual(female["risk"]["description"], "女性：睡眠不好")
        self.assertEqual(
            female["scoringVariant"],
            {"id": "female", "title": "女性", "description": "您的性别：女"},
        )

    def test_unset_parts_are_inherited_from_the_default(self):
        definition = base_definition()
        result = calculate_assessment_result(
            definition,
            answers(q1="q1-c", q3="q3-c"),
            {"gender": "male", "job": ["teacher"]},
        )
        # 计分沿用默认区间（4 分为偏高），风险使用方案自己的规则（默认的第 3 题规则不再生效）
        self.assertEqual((result["totalScore"], result["level"]), (4, "偏高"))
        self.assertEqual(result["risk"]["severity"], "mid")
        self.assertEqual(result["scoringVariant"]["description"], "职业：教师、医生")

    def test_missing_demographics_use_the_default(self):
        definition = base_definition()
        normalized_demographics, normalized_answers = validate_submission_answers(
            definition,
            {"gender": "male"},
            answers(q3="q3-c"),
        )
        result = calculate_assessment_result(definition, normalized_answers, normalized_demographics)
        self.assertEqual(result["risk"]["description"], "默认：难以放松")
        self.assertEqual(calculate_assessment_result(definition, answers()), calculate_assessment_result(definition, answers(), {}))


class SubmitReportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.store = AssessmentDefinitionStore(Path(self.temporary.name) / "assessment-data")
        created = self.store.create_draft(copy.deepcopy(base_definition()))
        self.store.publish("variant-demo", expected_revision=created["revision"])
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppPsychScaleResult.__table__,
                AppAssessmentReport.__table__,
                AppAssessmentAuditLog.__table__,
            ],
        )
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.account = AppAccount(
            Id=801, Mobile="13800000801", RealName="来访者", ActiveRole="Patient", IsActive=True
        )
        self.db.add(self.account)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temporary.cleanup()

    def submit(self, demographics):
        return submit_report(
            self.db,
            account=self.account,
            store=self.store,
            client_submission_id=str(uuid.uuid4()),
            assessment_id="variant-demo",
            assessment_version=1,
            demographic_answers=demographics,
            answers=answers(q1="q1-b", q2="q2-c"),
            entry_source="web",
            share_code=None,
            consent_version=settings.ASSESSMENT_CONSENT_VERSION,
        )

    def test_snapshot_keeps_the_definition_actually_used(self):
        saved = self.submit({"gender": "female"})
        self.assertEqual(saved["result"]["level"], "偏高")
        self.assertEqual(saved["result"]["scoringVariant"]["title"], "女性")
        self.assertNotIn("risk", saved["result"])  # 提交接口按来访端口径输出

        row = self.db.query(AppAssessmentReport).filter_by(PublicId=saved["publicId"]).one()
        staff = report_detail(row, include_raw_answers=True, staff_view=True)
        snapshot_assessment = staff["reportSnapshot"]["assessment"]
        self.assertNotIn("scoringVariants", snapshot_assessment)
        self.assertEqual(snapshot_assessment["scoreRanges"][0]["max"], 2)
        self.assertEqual(
            snapshot_assessment["riskDimension"]["levels"]["high"]["rules"][0]["optionIds"],
            ["q2-c"],
        )
        self.assertEqual(staff["result"]["risk"]["severity"], "high")
        self.assertEqual(staff["demographicAnswers"], {"gender": "female"})

        public_snapshot = public_report_snapshot(json.loads(row.ReportSnapshot))
        self.assertNotIn("riskDimension", public_snapshot["assessment"])

    def test_default_snapshot_drops_variant_list(self):
        saved = self.submit({"gender": "male"})
        self.assertEqual(saved["result"]["level"], "正常")
        self.assertNotIn("scoringVariant", saved["result"])
        row = self.db.query(AppAssessmentReport).filter_by(PublicId=saved["publicId"]).one()
        snapshot = json.loads(row.ReportSnapshot)
        self.assertNotIn("scoringVariants", snapshot["assessment"])
        self.assertEqual(snapshot["assessment"]["scoreRanges"][0]["max"], 3)

    def test_resolve_matches_calculation(self):
        definition = self.store.get_published("variant-demo")["definition"]
        effective, variant = resolve_scoring_definition(definition, {"job": ["doctor"]})
        self.assertEqual(variant["id"], "edu-med")
        self.assertEqual(effective["scoreRanges"], definition["scoreRanges"])


if __name__ == "__main__":
    unittest.main()
