# -*- coding: utf-8 -*-
import unittest

from assessment_definition_service import AssessmentValidationError, validate_definition
from assessment_scoring_service import (
    AssessmentAnswerError,
    calculate_assessment_result,
    validate_submission_answers,
)


def _base_definition(**overrides):
    definition = {
        "schemaVersion": 1,
        "id": "input-type-demo",
        "version": 1,
        "status": "draft",
        "category": "professional",
        "title": "题型演示",
        "subtitle": "",
        "description": "demo",
        "cover": "/static/assessments/demo.jpg",
        "duration": 5,
        "scoringType": "sum",
        "scoringPreset": "generic-sum-v2",
        "questions": [
            {
                "id": "q1",
                "text": "你最近睡眠如何？",
                "required": True,
                "inputType": "choice",
                "options": [
                    {
                        "id": "q1-a",
                        "text": "不好，请填天数",
                        "value": 1,
                        "followUp": {
                            "inputType": "number",
                            "label": "失眠天数",
                            "required": True,
                            "scoreMode": "value",
                            "validation": {"min": 0, "max": 7},
                        },
                    },
                    {"id": "q1-b", "text": "还好", "value": 0},
                ],
            },
            {
                "id": "q2",
                "text": "请填写最想改善的一点",
                "required": True,
                "inputType": "text",
                "scoreMode": "filled",
                "completedScore": 2,
                "emptyScore": 0,
                "options": [],
            },
            {
                "id": "q3",
                "text": "本周运动次数",
                "required": True,
                "inputType": "number",
                "scoreMode": "value",
                "validation": {"min": 0, "max": 7},
                "options": [],
            },
        ],
        "scoreRanges": [
            {
                "min": 2,
                "max": 17,
                "level": "低",
                "visitorDescription": "访客说明",
                "analystDescription": "分析说明",
                "suggestions": ["建议一"],
            }
        ],
        "disclaimer": "仅供参考",
    }
    definition.update(overrides)
    return definition


class AssessmentInputTypeTests(unittest.TestCase):
    def test_definition_accepts_mixed_question_types(self):
        definition = _base_definition()
        validate_definition(definition, allow_fixed_scoring=False)

    def test_text_question_cannot_keep_options(self):
        definition = _base_definition()
        definition["questions"][1]["options"] = [
            {"id": "bad", "text": "x", "value": 1},
            {"id": "bad2", "text": "y", "value": 2},
        ]
        with self.assertRaises(AssessmentValidationError):
            validate_definition(definition, allow_fixed_scoring=False)

    def test_scoring_combines_follow_up_and_fill_modes(self):
        definition = _base_definition()
        answers = {
            "q1": {"optionId": "q1-a", "followUp": 3},
            "q2": {"text": "改善睡眠"},
            "q3": {"number": 4},
        }
        demographics, normalized = validate_submission_answers(definition, {}, answers)
        self.assertEqual(demographics, {})
        result = calculate_assessment_result(definition, normalized)
        # q1: 1 + 3 = 4; q2 filled = 2; q3 value = 4 => 10
        self.assertEqual(result["totalScore"], 10)
        self.assertEqual(result["level"], "低")

    def test_choice_follow_up_required(self):
        definition = _base_definition()
        with self.assertRaises(AssessmentAnswerError):
            validate_submission_answers(
                definition,
                {},
                {
                    "q1": {"optionId": "q1-a"},
                    "q2": {"text": "x"},
                    "q3": {"number": 1},
                },
            )


if __name__ == "__main__":
    unittest.main()
