from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from assessment_definition_service import AssessmentDefinitionStore, validate_definition
from assessment_scoring_service import calculate_assessment_result


BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent
EXAMPLES_DIR = REPOSITORY_DIR / "docs" / "assessment" / "examples"


def load_example(name: str) -> dict:
    with (EXAMPLES_DIR / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def choose_options(definition: dict, index: int) -> dict[str, str]:
    return {
        str(question["id"]): str(question["options"][index]["id"])
        for question in definition["questions"]
    }


class GenericScoringExamplesTests(unittest.TestCase):
    def test_sum_reverse_example_has_expected_score_and_level(self) -> None:
        definition = load_example("professional-dimension.json")
        definition["id"] = "sum-reverse-example"
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v2"
        definition["questions"] = definition["questions"][:2]
        definition["reverseQuestionIds"] = ["q1"]
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 0,
                "max": 1,
                "level": "较低",
                "description": "较低分",
                "suggestions": [],
            },
            {
                "min": 2,
                "max": 4,
                "level": "较高",
                "description": "较高分",
                "suggestions": [],
            },
        ]
        validate_definition(definition, allow_fixed_scoring=False)

        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-c"},
        )
        self.assertEqual(
            {"type": "sum", "totalScore": 4.0, "level": "较高"},
            {
                "type": result["type"],
                "totalScore": result["totalScore"],
                "level": result["level"],
            },
        )

    def test_sum_v1_preserves_legacy_raw_behavior(self) -> None:
        definition = load_example("professional-dimension.json")
        definition["id"] = "sum-v1-legacy-example"
        definition["scoringType"] = "sum"
        definition["scoringPreset"] = "generic-sum-v1"
        definition["questions"] = definition["questions"][:2]
        definition["reverseQuestionIds"] = ["q1"]
        definition.pop("dimensions")
        definition["scoreRanges"] = [
            {
                "min": 0,
                "max": 4,
                "level": "有效",
                "description": "兼容旧版总分",
                "suggestions": [],
            }
        ]
        validate_definition(definition, allow_fixed_scoring=False)

        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-c"},
        )
        self.assertEqual(2.0, result["totalScore"])

    def test_sum_v2_rounds_decimal_total_before_range_matching(self) -> None:
        definition = load_example("professional-dimension.json")
        definition["id"] = "sum-v2-decimal-example"
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

        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-a"},
        )
        self.assertEqual((0.3, "命中"), (result["totalScore"], result["level"]))

    def test_dimension_examples_have_expected_sum_and_average(self) -> None:
        definition = load_example("professional-dimension.json")
        average_dimension = copy.deepcopy(definition["dimensions"][1])
        average_dimension.update(
            {
                "id": "average",
                "title": "平均值",
                "questionIds": ["q1", "q2", "q3"],
                "reverseQuestionIds": ["q1"],
                "aggregate": "average",
                "scoreRanges": [
                    {
                        "min": 0,
                        "max": 0.99,
                        "level": "较低",
                        "description": "较低分",
                        "suggestions": [],
                    },
                    {
                        "min": 1,
                        "max": 2,
                        "level": "较高",
                        "description": "较高分",
                        "suggestions": [],
                    },
                ],
            }
        )
        definition["dimensions"].append(average_dimension)
        validate_definition(definition, allow_fixed_scoring=False)

        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-c", "q3": "q3-b"},
        )
        scores = {item["id"]: item["score"] for item in result["dimensions"]}
        self.assertEqual(2.0, scores["emotion"])
        self.assertEqual(1.67, scores["average"])

    def test_match_example_uses_accumulated_weights(self) -> None:
        definition = load_example("fun-match.json")
        definition["questions"][0]["options"][0]["matchTags"] = {
            "quiet": 2,
            "social": 1,
        }
        definition["questions"][1]["options"][1]["matchTags"] = {
            "quiet": 0,
            "social": 2,
        }
        validate_definition(definition, allow_fixed_scoring=False)

        result = calculate_assessment_result(
            definition,
            {"q1": "q1-a", "q2": "q2-b"},
        )
        self.assertEqual("match", result["type"])
        self.assertEqual("social", result["resultId"])


class FixedScoringExamplesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory()
        cls.store = AssessmentDefinitionStore(
            Path(cls.temporary.name) / "assessment-data",
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
        cls.store.ensure_seeded()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def result(self, assessment_id: str, option_index: int) -> dict:
        definition = self.store.get_published_version(assessment_id, 1)
        return calculate_assessment_result(
            definition,
            choose_options(definition, option_index),
        )

    def test_bsi_first_and_last_option_profiles(self) -> None:
        first = self.result("bsi-18", 0)
        last = self.result("bsi-18", -1)
        self.assertEqual([6.0, 6.0, 6.0], [item["score"] for item in first["dimensions"]])
        self.assertEqual(["正常", "正常", "正常"], [item["level"] for item in first["dimensions"]])
        self.assertEqual([30.0, 30.0, 30.0], [item["score"] for item in last["dimensions"]])
        self.assertEqual(
            ["重度躯体化", "重度抑郁", "重度焦虑"],
            [item["level"] for item in last["dimensions"]],
        )

    def test_aas_first_and_last_option_profiles(self) -> None:
        self.assertEqual("secure", self.result("aas", 0)["resultId"])
        self.assertEqual("fearful", self.result("aas", -1)["resultId"])

    def test_psqi_first_and_last_option_profiles(self) -> None:
        first = self.result("psqi", 0)
        last = self.result("psqi", -1)
        self.assertEqual((0, "睡眠质量很好"), (first["totalScore"], first["level"]))
        self.assertEqual((18, "睡眠质量差"), (last["totalScore"], last["level"]))

    def test_pbi_first_and_last_option_profiles(self) -> None:
        first = self.result("pbi", 0)
        last = self.result("pbi", -1)
        self.assertEqual("母亲教养方式：放任型；父亲教养方式：放任型", first["summary"])
        self.assertEqual("母亲教养方式：专制型；父亲教养方式：放任型", last["summary"])
        self.assertEqual(
            [15, 0, 3, 9, 0, 3],
            [item["score"] for item in first["dimensions"]],
        )
        self.assertEqual(
            [18, 18, 15, 24, 18, 15],
            [item["score"] for item in last["dimensions"]],
        )

    def test_cbcl_first_and_last_option_profiles(self) -> None:
        first = self.result("cbcl", 0)["dimensions"][-1]
        last = self.result("cbcl", -1)["dimensions"][-1]
        self.assertEqual(("behavior-total", 0, "正常"), (first["id"], first["score"], first["level"]))
        self.assertEqual(
            ("behavior-total", 238, "需关注"),
            (last["id"], last["score"], last["level"]),
        )

    def test_dark_light_first_and_last_option_profiles(self) -> None:
        first = self.result("dark-light-personality", 0)
        last = self.result("dark-light-personality", -1)
        self.assertEqual([4, 4, 4, 12], [item["score"] for item in first["dimensions"]])
        self.assertEqual(["低", "低", "低", "低"], [item["level"] for item in first["dimensions"]])
        self.assertEqual([28, 28, 28, 84], [item["score"] for item in last["dimensions"]])
        self.assertEqual(["高", "高", "高", "高"], [item["level"] for item in last["dimensions"]])


if __name__ == "__main__":
    unittest.main()
