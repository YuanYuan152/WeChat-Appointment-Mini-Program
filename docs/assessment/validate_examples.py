"""Validate the assessment protocol examples without third-party packages."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
EXAMPLES = ROOT / "examples"
BACKEND = ROOT.parent.parent / "backend-python"
sys.path.insert(0, str(BACKEND))

from assessment_definition_service import validate_definition as validate_runtime_definition
from assessment_asset_service import (
    AssessmentAssetReferenceError,
    validate_assessment_asset_reference,
)
from assessment_scoring_service import calculate_assessment_result


ID_PATTERN = re.compile(r"^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$")
ASSESSMENT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise AssertionError(f"{path}: root must be an object")
    return value


def assert_unique_ids(items: list[dict[str, Any]], label: str) -> set[str]:
    values = [str(item.get("id", "")) for item in items]
    if any(not ID_PATTERN.fullmatch(value) for value in values):
        raise AssertionError(f"{label}: invalid id")
    if len(values) != len(set(values)):
        raise AssertionError(f"{label}: duplicate id")
    return set(values)


def assert_ranges(ranges: list[dict[str, Any]], label: str) -> None:
    ordered = sorted(ranges, key=lambda item: float(item["min"]))
    previous_max: float | None = None
    for item in ordered:
        low = float(item["min"])
        high = float(item["max"])
        if low > high:
            raise AssertionError(f"{label}: min exceeds max")
        if previous_max is not None and low <= previous_max:
            raise AssertionError(f"{label}: overlapping ranges")
        previous_max = high


def assert_image_reference(value: Any, label: str, *, allow_empty: bool) -> None:
    try:
        validate_assessment_asset_reference(
            value,
            label,
            allow_empty=allow_empty,
        )
    except AssessmentAssetReferenceError as exc:
        raise AssertionError(str(exc)) from exc


def validate_definition(definition: dict[str, Any], schema: dict[str, Any]) -> None:
    required = set(schema["required"])
    missing = sorted(required - definition.keys())
    if missing:
        raise AssertionError(f"{definition.get('id', '<unknown>')}: missing {missing}")

    allowed = set(schema["properties"])
    extra = sorted(definition.keys() - allowed)
    if extra:
        raise AssertionError(f"{definition['id']}: unknown fields {extra}")

    if definition["schemaVersion"] != 1:
        raise AssertionError(f"{definition['id']}: schemaVersion must be 1")
    if not ASSESSMENT_ID_PATTERN.fullmatch(str(definition["id"])):
        raise AssertionError(f"{definition['id']}: invalid assessment id")
    if definition["status"] not in {"draft", "published", "archived"}:
        raise AssertionError(f"{definition['id']}: invalid status")
    if definition["category"] not in {"professional", "fun"}:
        raise AssertionError(f"{definition['id']}: invalid category")
    assert_image_reference(definition["cover"], f"{definition['id']} cover", allow_empty=False)

    demographic_questions = definition.get("demographicQuestions", [])
    assert_unique_ids(demographic_questions, f"{definition['id']} demographics")
    for question in demographic_questions:
        if question["inputType"] in {"single", "multiple"} and not question.get("options"):
            raise AssertionError(f"{definition['id']}: select demographic needs options")
        if question.get("options"):
            assert_unique_ids(question["options"], f"{definition['id']} demographic options")

    questions = definition["questions"]
    question_ids = assert_unique_ids(questions, f"{definition['id']} questions")
    option_ids: set[str] = set()
    for question in questions:
        if len(question.get("options", [])) < 2:
            raise AssertionError(f"{definition['id']}:{question['id']}: at least two options")
        current_option_ids = assert_unique_ids(
            question["options"], f"{definition['id']}:{question['id']} options"
        )
        duplicate_options = option_ids & current_option_ids
        if duplicate_options:
            raise AssertionError(f"{definition['id']}: option ids must be globally unique")
        option_ids.update(current_option_ids)

    scoring_type = definition["scoringType"]
    if scoring_type in {"sum", "psqi"}:
        assert_ranges(definition.get("scoreRanges", []), f"{definition['id']} scoreRanges")
    if scoring_type == "dimension":
        dimensions = definition.get("dimensions", [])
        assert_unique_ids(dimensions, f"{definition['id']} dimensions")
        if not dimensions:
            raise AssertionError(f"{definition['id']}: dimensions required")
        for dimension in dimensions:
            references = set(dimension["questionIds"])
            reverse_references = set(dimension.get("reverseQuestionIds", []))
            if not references <= question_ids or not reverse_references <= references:
                raise AssertionError(f"{definition['id']}:{dimension['id']}: invalid question reference")
            assert_ranges(
                dimension["scoreRanges"],
                f"{definition['id']}:{dimension['id']} scoreRanges",
            )

    if scoring_type in {"match", "aas"}:
        match_results = definition.get("matchResults", [])
        result_ids = assert_unique_ids(match_results, f"{definition['id']} matchResults")
        if not result_ids:
            raise AssertionError(f"{definition['id']}: matchResults required")
        tag_ids = {
            tag
            for question in questions
            for option in question["options"]
            for tag in option.get("matchTags", {})
        }
        if not tag_ids <= result_ids:
            raise AssertionError(f"{definition['id']}: match tag has no result")
        for result in match_results:
            assert_image_reference(
                result["image"],
                f"{definition['id']}:{result['id']} image",
                allow_empty=True,
            )

    for profile in definition.get("reportProfiles", []):
        if "image" in profile:
            assert_image_reference(
                profile["image"],
                f"{definition['id']}:{profile['id']} image",
                allow_empty=True,
            )


def validate_report_submit(
    payload: dict[str, Any], definition: dict[str, Any]
) -> None:
    required = {
        "clientSubmissionId",
        "assessmentId",
        "assessmentVersion",
        "demographicAnswers",
        "answers",
        "entrySource",
        "shareCode",
        "consentVersion",
    }
    if payload.keys() != required:
        raise AssertionError("report-submit: fields do not match the API contract")
    if payload["assessmentId"] != definition["id"]:
        raise AssertionError("report-submit: assessmentId mismatch")
    if payload["assessmentVersion"] != definition["version"]:
        raise AssertionError("report-submit: assessmentVersion mismatch")

    questions = {item["id"]: item for item in definition["questions"]}
    required_question_ids = {
        item["id"] for item in definition["questions"] if item["required"]
    }
    if set(payload["answers"]) != required_question_ids:
        raise AssertionError("report-submit: required answers mismatch")
    for question_id, option_id in payload["answers"].items():
        valid_options = {item["id"] for item in questions[question_id]["options"]}
        if option_id not in valid_options:
            raise AssertionError(f"report-submit: invalid option for {question_id}")

    required_demographic_ids = {
        item["id"]
        for item in definition.get("demographicQuestions", [])
        if item["required"]
    }
    if not required_demographic_ids <= set(payload["demographicAnswers"]):
        raise AssertionError("report-submit: missing required demographic answer")


def main() -> None:
    schema = load_json(ROOT / "assessment-schema-v1.json")
    professional = load_json(EXAMPLES / "professional-dimension.json")
    fun = load_json(EXAMPLES / "fun-match.json")
    report_submit = load_json(EXAMPLES / "report-submit.json")

    for definition in (professional, fun):
        validate_definition(definition, schema)
        validate_runtime_definition(definition, allow_fixed_scoring=False)
    validate_report_submit(report_submit, professional)

    professional_result = calculate_assessment_result(
        professional,
        report_submit["answers"],
    )
    if professional_result.get("type") != "dimension" or any(
        item.get("level") == "未知"
        for item in professional_result.get("dimensions", [])
    ):
        raise AssertionError("professional scoring example did not resolve a report")

    fun_answers = {
        question["id"]: question["options"][0]["id"]
        for question in fun["questions"]
    }
    fun_result = calculate_assessment_result(fun, fun_answers)
    if (
        fun_result.get("type") != "match"
        or fun_result.get("resultId") != "quiet"
    ):
        raise AssertionError("fun scoring example did not resolve the expected result")

    print("assessment protocol examples: OK")


if __name__ == "__main__":
    main()
