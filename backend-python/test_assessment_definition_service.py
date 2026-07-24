from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from assessment_definition_service import (
    AssessmentConflict,
    AssessmentDefinitionStore,
    AssessmentNotFound,
    AssessmentValidationError,
    validate_definition,
)


BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent


class AssessmentDefinitionStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temporary.name) / "assessment-data"
        self.store = AssessmentDefinitionStore(
            self.data_dir,
            seed_data_dir=REPOSITORY_DIR / "EAP_front_site" / "src" / "data",
            guidance_file=(
                REPOSITORY_DIR
                / "EAP_front_site"
                / "src"
                / "lib"
                / "assessment"
                / "scale-guidance.ts"
            ),
            report_profiles_file=BACKEND_DIR / "assessment_seed_report_profiles.json",
        )
        self.store.ensure_seeded()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    @staticmethod
    def example_definition(name: str = "professional-dimension.json") -> dict:
        path = REPOSITORY_DIR / "docs" / "assessment" / "examples" / name
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def test_legacy_eap_json_is_seeded_as_six_runtime_definitions(self) -> None:
        items = self.store.list_published()
        self.assertEqual(6, len(items))
        self.assertEqual(5, len(self.store.list_published(category="professional")))
        self.assertEqual(1, len(self.store.list_published(category="fun")))
        self.assertTrue((self.data_dir / "index.json").exists())
        for item in items:
            seeded = self.store.get_published(item["id"])["definition"]
            self.assertTrue(seeded.get("instructions"), item["id"])

        self.assertTrue(self.store.get_published("pbi")["definition"]["reportProfiles"])
        self.assertTrue(self.store.get_published("cbcl")["definition"]["reportProfiles"])

        dark = self.store.get_published("dark-light-personality")
        definition = dark["definition"]
        self.assertEqual(12, dark["questionCount"])
        self.assertEqual(12, len(definition["questions"]))
        self.assertNotIn("questionCount", definition)
        self.assertEqual("dark-light-v1", definition["scoringPreset"])
        self.assertIn("黑暗三联征", definition["instructions"])
        self.assertGreaterEqual(len(definition["reportProfiles"]), 13)
        self.assertTrue(all(question["required"] for question in definition["questions"]))

    def test_draft_revision_publish_archive_and_restore_workflow(self) -> None:
        created = self.store.create_draft(self.example_definition())
        first_revision = created["revision"]
        self.assertEqual(1, created["draftVersion"])

        changed = copy.deepcopy(created["definition"])
        changed["title"] = "幸福感演示量表 v1"
        updated = self.store.update_draft(
            "wellbeing-demo",
            changed,
            expected_revision=first_revision,
        )
        self.assertNotEqual(first_revision, updated["revision"])
        self.assertTrue(any((self.data_dir / "backups" / "wellbeing-demo").iterdir()))

        with self.assertRaises(AssessmentConflict):
            self.store.update_draft(
                "wellbeing-demo",
                changed,
                expected_revision=first_revision,
            )

        published_v1 = self.store.publish(
            "wellbeing-demo",
            expected_revision=updated["revision"],
        )
        self.assertEqual(1, published_v1["publishedVersion"])
        self.assertIsNone(published_v1["draftVersion"])
        self.assertEqual(
            "幸福感演示量表 v1",
            self.store.get_published("wellbeing-demo")["definition"]["title"],
        )

        editable = self.store.get_admin("wellbeing-demo")
        changed_v2 = copy.deepcopy(editable["definition"])
        changed_v2["title"] = "幸福感演示量表 v2"
        draft_v2 = self.store.update_draft(
            "wellbeing-demo",
            changed_v2,
            expected_revision=editable["revision"],
        )
        self.assertEqual(2, draft_v2["draftVersion"])
        self.assertEqual(
            "幸福感演示量表 v1",
            self.store.get_published("wellbeing-demo")["definition"]["title"],
        )
        published_v2 = self.store.publish(
            "wellbeing-demo",
            expected_revision=draft_v2["revision"],
        )
        self.assertEqual([2, 1], [item["version"] for item in published_v2["versions"]])

        with (
            self.data_dir / "published" / "wellbeing-demo" / "v1.json"
        ).open(encoding="utf-8") as handle:
            immutable_v1 = json.load(handle)
        self.assertEqual("幸福感演示量表 v1", immutable_v1["title"])

        self.store.archive("wellbeing-demo")
        with self.assertRaises(AssessmentNotFound):
            self.store.get_published("wellbeing-demo")

        restored = self.store.restore_version("wellbeing-demo", 1)
        self.assertEqual(3, restored["draftVersion"])
        self.assertEqual("幸福感演示量表 v1", restored["definition"]["title"])
        self.assertEqual("draft", restored["definition"]["status"])

    def test_restore_rejects_structurally_corrupted_history(self) -> None:
        source_path = self.store._published_path("psqi", 1)
        with source_path.open(encoding="utf-8") as handle:
            source = json.load(handle)
        source["reverseQuestionIds"] = ["missing-question"]
        self.store._atomic_write(source_path, source)

        with self.assertRaisesRegex(
            AssessmentValidationError,
            "reverseQuestionIds 包含不存在的题目",
        ):
            self.store.restore_version("psqi", 1)

    def test_legacy_external_asset_remains_readable_but_cannot_be_republished(self) -> None:
        assessment_id = "dark-light-personality"
        source_path = self.store._published_path(assessment_id, 1)
        with source_path.open(encoding="utf-8") as handle:
            source = json.load(handle)
        source["cover"] = "https://legacy-assets.example/cover.jpg"
        self.store._atomic_write(source_path, source)

        loaded = self.store.get_published_version(assessment_id, 1)
        self.assertEqual(source["cover"], loaded["cover"])

        restored = self.store.restore_version(assessment_id, 1)
        self.assertEqual(source["cover"], restored["definition"]["cover"])
        with self.assertRaisesRegex(AssessmentValidationError, "cover仅支持"):
            self.store.publish(
                assessment_id,
                expected_revision=restored["revision"],
            )

    def test_admin_pagination_keyword_and_status_filters(self) -> None:
        result = self.store.list_admin(
            page=1,
            page_size=2,
            category="professional",
            status="published",
            keyword="睡眠",
        )
        self.assertEqual(1, result["total"])
        self.assertEqual("psqi", result["items"][0]["id"])
        self.assertEqual(0, result["items"][0]["completedCount"])

    def test_invalid_dimension_reference_is_rejected(self) -> None:
        definition = self.example_definition()
        definition["id"] = "broken-reference"
        definition["dimensions"][0]["questionIds"] = ["missing-question"]
        with self.assertRaises(AssessmentValidationError):
            self.store.create_draft(definition)

    def test_assessment_id_must_fit_static_share_code(self) -> None:
        definition = self.example_definition()
        definition["id"] = "a" * 55
        with self.assertRaisesRegex(AssessmentValidationError, "54"):
            self.store.create_draft(definition)

    def test_new_definition_cannot_select_fixed_scoring_preset(self) -> None:
        definition = self.example_definition()
        definition["id"] = "fixed-preset-not-allowed"
        definition["scoringType"] = "pbi"
        definition["scoringPreset"] = "pbi-v1"
        definition.pop("dimensions")
        with self.assertRaises(AssessmentValidationError):
            self.store.create_draft(definition)

    def test_fixed_scoring_definition_cannot_drop_required_question(self) -> None:
        current = self.store.get_admin("pbi")
        changed = copy.deepcopy(current["definition"])
        changed["questions"] = changed["questions"][:-1]
        with self.assertRaises(AssessmentValidationError):
            self.store.update_draft(
                "pbi",
                changed,
                expected_revision=current["revision"],
            )

    def test_fixed_scoring_definition_locks_required_and_reverse_rules(self) -> None:
        current = self.store.get_admin("aas")

        optional = copy.deepcopy(current["definition"])
        optional["questions"][0]["required"] = False
        with self.assertRaisesRegex(AssessmentValidationError, "必须为必答"):
            self.store.update_draft(
                "aas",
                optional,
                expected_revision=current["revision"],
            )

        changed_reverse = copy.deepcopy(current["definition"])
        changed_reverse["reverseQuestionIds"] = changed_reverse[
            "reverseQuestionIds"
        ][:-1]
        with self.assertRaisesRegex(AssessmentValidationError, "反向题 ID 不匹配"):
            self.store.update_draft(
                "aas",
                changed_reverse,
                expected_revision=current["revision"],
            )

        pbi = self.store.get_admin("pbi")
        pbi_reverse = copy.deepcopy(pbi["definition"])
        pbi_reverse["reverseQuestionIds"] = ["m1"]
        with self.assertRaisesRegex(AssessmentValidationError, "反向题 ID 不匹配"):
            self.store.update_draft(
                "pbi",
                pbi_reverse,
                expected_revision=pbi["revision"],
            )

    def test_fixed_scoring_definition_locks_option_id_value_mapping(self) -> None:
        current = self.store.get_admin("pbi")

        swapped = copy.deepcopy(current["definition"])
        first_options = swapped["questions"][0]["options"]
        first_options[0]["value"], first_options[-1]["value"] = (
            first_options[-1]["value"],
            first_options[0]["value"],
        )
        with self.assertRaisesRegex(AssessmentValidationError, "选项 ID 与分值映射"):
            self.store.update_draft(
                "pbi",
                swapped,
                expected_revision=current["revision"],
            )

        extra_option = copy.deepcopy(current["definition"])
        extra_option["questions"][0]["options"].append(
            {
                "id": "m1-extra",
                "text": "额外选项",
                "value": 0,
            }
        )
        with self.assertRaisesRegex(AssessmentValidationError, "选项 ID 与分值映射"):
            self.store.update_draft(
                "pbi",
                extra_option,
                expected_revision=current["revision"],
            )

    def test_reachable_sum_scores_must_be_covered(self) -> None:
        definition = self.example_definition()
        definition["id"] = "sum-coverage"
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v1"
        definition["questions"] = definition["questions"][:1]
        definition["reverseQuestionIds"] = []
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 0,
                "max": 1,
                "level": "较低",
                "description": "较低分",
                "suggestions": [],
            }
        ]

        with self.assertRaisesRegex(AssessmentValidationError, "未覆盖可达分值：2"):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_unreachable_numeric_gap_does_not_require_a_range(self) -> None:
        definition = self.example_definition()
        definition["id"] = "sum-discrete-gap"
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v1"
        definition["questions"] = definition["questions"][:1]
        definition["questions"][0]["options"] = [
            {"id": "q1-a", "text": "零分", "value": 0},
            {"id": "q1-b", "text": "两分", "value": 2},
        ]
        definition["reverseQuestionIds"] = []
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 0,
                "max": 0,
                "level": "零分",
                "description": "零分结果",
                "suggestions": [],
            },
            {
                "min": 2,
                "max": 2,
                "level": "两分",
                "description": "两分结果",
                "suggestions": [],
            },
        ]

        validate_definition(definition, allow_fixed_scoring=False)

    def test_optional_question_adds_reachable_zero(self) -> None:
        definition = self.example_definition()
        definition["id"] = "sum-optional-zero"
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v1"
        definition["questions"] = definition["questions"][:1]
        definition["questions"][0]["required"] = False
        definition["questions"][0]["options"] = [
            {"id": "q1-a", "text": "一分", "value": 1},
            {"id": "q1-b", "text": "两分", "value": 2},
        ]
        definition["reverseQuestionIds"] = []
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 1,
                "max": 2,
                "level": "已作答",
                "description": "已作答结果",
                "suggestions": [],
            }
        ]

        with self.assertRaisesRegex(AssessmentValidationError, "未覆盖可达分值：0"):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_sum_v2_coverage_uses_runtime_decimal_rounding(self) -> None:
        definition = self.example_definition()
        definition["id"] = "sum-v2-decimal-coverage"
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v2"
        definition["questions"] = [
            {
                "id": "q1",
                "text": "题目 1",
                "required": True,
                "options": [
                    {"id": "q1-a", "text": "0.1", "value": 0.1},
                    {"id": "q1-b", "text": "0.2", "value": 0.2},
                ],
            },
            {
                "id": "q2",
                "text": "题目 2",
                "required": True,
                "options": [
                    {"id": "q2-a", "text": "0.2", "value": 0.2},
                    {"id": "q2-b", "text": "0.3", "value": 0.3},
                ],
            },
        ]
        definition["reverseQuestionIds"] = []
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 0.3,
                "max": 0.3,
                "level": "命中",
                "description": "精确命中",
                "suggestions": [],
            },
            {
                "min": 0.4,
                "max": 0.5,
                "level": "其他",
                "description": "其他分值",
                "suggestions": [],
            },
        ]

        validate_definition(definition, allow_fixed_scoring=False)

    def test_dimension_average_uses_runtime_rounding_and_reverse_scoring(self) -> None:
        definition = self.example_definition()
        definition["id"] = "dimension-average-coverage"
        definition["dimensions"] = [
            {
                "id": "average",
                "title": "平均维度",
                "intro": "",
                "questionIds": ["q1", "q2", "q3"],
                "reverseQuestionIds": ["q1"],
                "aggregate": "average",
                "scoreRanges": [
                    {
                        "min": 0,
                        "max": 0.33,
                        "level": "低",
                        "description": "低分",
                        "suggestions": [],
                    },
                    {
                        "min": 0.67,
                        "max": 1,
                        "level": "高",
                        "description": "高分",
                        "suggestions": [],
                    },
                ],
            }
        ]
        for question in definition["questions"]:
            question["options"] = question["options"][:2]

        validate_definition(definition, allow_fixed_scoring=False)

    def test_dimension_sum_uses_runtime_decimal_rounding(self) -> None:
        definition = self.example_definition()
        definition["id"] = "dimension-sum-decimal-coverage"
        definition["questions"] = [
            {
                "id": "q1",
                "text": "题目 1",
                "required": True,
                "options": [
                    {"id": "q1-a", "text": "0.1", "value": 0.1},
                    {"id": "q1-b", "text": "0.2", "value": 0.2},
                ],
            },
            {
                "id": "q2",
                "text": "题目 2",
                "required": True,
                "options": [
                    {"id": "q2-a", "text": "0.2", "value": 0.2},
                    {"id": "q2-b", "text": "0.3", "value": 0.3},
                ],
            },
        ]
        definition["dimensions"] = [
            {
                "id": "sum",
                "title": "小数求和",
                "intro": "",
                "questionIds": ["q1", "q2"],
                "reverseQuestionIds": [],
                "aggregate": "sum",
                "scoreRanges": [
                    {
                        "min": 0.3,
                        "max": 0.3,
                        "level": "命中",
                        "description": "精确命中",
                        "suggestions": [],
                    },
                    {
                        "min": 0.4,
                        "max": 0.5,
                        "level": "其他",
                        "description": "其他分值",
                        "suggestions": [],
                    },
                ],
            }
        ]

        validate_definition(definition, allow_fixed_scoring=False)

    def test_backend_rejects_non_finite_scores_and_empty_match_tags(self) -> None:
        definition = self.example_definition()
        definition["id"] = "not-finite"
        definition["questions"][0]["options"][0]["value"] = float("nan")
        with self.assertRaisesRegex(AssessmentValidationError, "必须是数字"):
            validate_definition(definition, allow_fixed_scoring=False)

        match = self.example_definition("fun-match.json")
        match["id"] = "missing-match-tag"
        match["questions"][0]["options"][0]["matchTags"] = {}
        with self.assertRaisesRegex(AssessmentValidationError, "至少需要一个结果权重"):
            validate_definition(match, allow_fixed_scoring=False)

    def test_image_references_are_limited_to_controlled_paths(self) -> None:
        definition = self.example_definition()
        definition["id"] = "unsafe-cover"
        definition["cover"] = "data:image/png;base64,AAAA"
        with self.assertRaisesRegex(
            AssessmentValidationError,
            "cover仅支持",
        ):
            validate_definition(definition, allow_fixed_scoring=False)

        match = self.example_definition("fun-match.json")
        match["id"] = "unsafe-result-image"
        match["matchResults"][0]["image"] = "https://tracker.example/pixel.png"
        with self.assertRaisesRegex(
            AssessmentValidationError,
            r"matchResults\[0\]\.image仅支持",
        ):
            validate_definition(match, allow_fixed_scoring=False)

        definition = self.example_definition()
        definition["id"] = "unsafe-profile-image"
        definition["reportProfiles"] = [
            {
                "id": "demo",
                "title": "演示",
                "description": "演示报告",
                "suggestions": [],
                "image": "/images/../secret.png",
            }
        ]
        with self.assertRaisesRegex(
            AssessmentValidationError,
            r"reportProfiles\[0\]\.image仅支持",
        ):
            validate_definition(definition, allow_fixed_scoring=False)

        validate_definition(
            definition,
            allow_fixed_scoring=False,
            strict_assets=False,
        )

    def test_controlled_uploaded_image_reference_is_valid_in_all_modes(self) -> None:
        definition = self.example_definition()
        definition["id"] = "controlled-cover"
        definition["cover"] = (
            "/static/assessment-assets/"
            + ("a" * 64)
            + ".webp"
        )

        validate_definition(definition, allow_fixed_scoring=False)
        validate_definition(
            definition,
            allow_fixed_scoring=False,
            strict_scoring=False,
        )

    def test_strict_match_validation_rejects_unreferenced_result(self) -> None:
        match = self.example_definition("fun-match.json")
        match["id"] = "unreferenced-match-result"
        match["matchResults"].append(
            {
                "id": "unused",
                "title": "未引用结果",
                "description": "不应发布",
                "suggestions": [],
                "image": "",
                "shareText": "",
            }
        )

        with self.assertRaisesRegex(AssessmentValidationError, "未被任何选项引用"):
            validate_definition(match, allow_fixed_scoring=False)

        validate_definition(
            match,
            allow_fixed_scoring=False,
            strict_scoring=False,
        )

    def test_strict_match_validation_requires_one_required_question(self) -> None:
        match = self.example_definition("fun-match.json")
        match["id"] = "all-optional-match"
        for question in match["questions"]:
            question["required"] = False

        with self.assertRaisesRegex(AssessmentValidationError, "至少需要一道必答题"):
            validate_definition(match, allow_fixed_scoring=False)

    def test_historical_published_definition_uses_compatibility_validation(self) -> None:
        definition = self.example_definition()
        definition.update(
            {
                "id": "legacy-sum-gap",
                "version": 1,
                "status": "published",
                "scoringType": "sum",
                "scoringPreset": "generic-sum-v1",
            }
        )
        definition["questions"] = definition["questions"][:1]
        definition["reverseQuestionIds"] = []
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 0,
                "max": 1,
                "level": "旧结果",
                "description": "历史定义",
                "suggestions": [],
            }
        ]
        self.store._atomic_write(
            self.store._published_path("legacy-sum-gap", 1),
            definition,
        )

        loaded = self.store.get_published_version("legacy-sum-gap", 1)
        self.assertEqual("generic-sum-v1", loaded["scoringPreset"])
        with self.assertRaisesRegex(AssessmentValidationError, "未覆盖可达分值"):
            validate_definition(definition, allow_fixed_scoring=False)

        structurally_broken = copy.deepcopy(definition)
        structurally_broken["reverseQuestionIds"] = ["missing-question"]
        with self.assertRaisesRegex(AssessmentValidationError, "不存在的题目"):
            validate_definition(
                structurally_broken,
                allow_fixed_scoring=False,
                strict_scoring=False,
            )

    def test_reachability_limit_fails_closed(self) -> None:
        definition = self.example_definition()
        definition["id"] = "reachability-limit"
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v1"
        definition["questions"] = [
            {
                "id": f"q{index + 1}",
                "text": f"题目 {index + 1}",
                "required": True,
                "options": [
                    {
                        "id": f"q{index + 1}-a",
                        "text": "零分",
                        "value": 0,
                    },
                    {
                        "id": f"q{index + 1}-b",
                        "text": "幂次分值",
                        "value": 2**index,
                    },
                ],
            }
            for index in range(17)
        ]
        definition["reverseQuestionIds"] = []
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 0,
                "max": 2**17 - 1,
                "level": "完整",
                "description": "完整区间",
                "suggestions": [],
            }
        ]

        with self.assertRaisesRegex(AssessmentValidationError, "无法完成精确校验"):
            validate_definition(definition, allow_fixed_scoring=False)


if __name__ == "__main__":
    unittest.main()
