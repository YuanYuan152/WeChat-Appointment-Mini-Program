"""EAP 量表 JSON 定义的文件存储、版本和发布服务。

这一版故意不依赖数据库和第三方 JSON Schema 库：定义文件可以独立挂载，
同时保持已发布版本不可变。
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional


ASSESSMENT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ASSESSMENT_ID_MAX_LENGTH = 54
STABLE_ID_PATTERN = re.compile(r"^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$")
PRESET_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$")

GENERIC_SCORING_PRESETS = {
    "sum": "generic-sum-v1",
    "dimension": "generic-dimension-v1",
    "match": "generic-match-v1",
}
FIXED_SCORING_PRESETS = {
    "aas": "aas-v1",
    "psqi": "psqi-v1",
    "pbi": "pbi-v1",
    "cbcl": "cbcl-v1",
    "dark-light": "dark-light-v1",
}
ALL_SCORING_PRESETS = {**GENERIC_SCORING_PRESETS, **FIXED_SCORING_PRESETS}

FIXED_QUESTION_IDS = {
    "aas": {f"q{index}" for index in range(1, 19)},
    "psqi": {"q2", "q4", "q6", "q7", "q8", "q9"}
    | {f"q5{suffix}" for suffix in "abcdefghij"},
    "pbi": {f"m{index}" for index in range(1, 24)}
    | {f"f{index}" for index in range(1, 24)},
    "cbcl": {f"q{index}" for index in range(1, 120)},
    "dark-light": {f"d{index}" for index in range(1, 13)},
}
FIXED_OPTION_VALUES = {
    "aas": {1.0, 2.0, 3.0, 4.0, 5.0},
    "psqi": {0.0, 1.0, 2.0, 3.0},
    "pbi": {0.0, 1.0, 2.0, 3.0},
    "cbcl": {0.0, 1.0, 2.0},
    "dark-light": {1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0},
}
FIXED_REPORT_PROFILE_IDS = {
    "pbi": {
        "pbi-summary",
        "pbi-style-authoritative",
        "pbi-style-authoritarian",
        "pbi-style-democratic",
        "pbi-style-permissive",
        "pbi-autonomy-high",
        "pbi-autonomy-normal",
        "pbi-control-high",
        "pbi-control-normal",
    },
    "cbcl": {
        "cbcl-summary",
        "cbcl-concern",
        "cbcl-normal",
        "cbcl-total-concern",
        "cbcl-total-normal",
    },
    "dark-light": {
        "dark-summary",
        "dark-machiavellianism-low",
        "dark-machiavellianism-middle",
        "dark-machiavellianism-high",
        "dark-psychopathy-low",
        "dark-psychopathy-middle",
        "dark-psychopathy-high",
        "dark-narcissism-low",
        "dark-narcissism-middle",
        "dark-narcissism-high",
        "dark-total-low",
        "dark-total-middle",
        "dark-total-high",
    },
}

TOP_LEVEL_FIELDS = {
    "schemaVersion",
    "id",
    "version",
    "status",
    "category",
    "title",
    "subtitle",
    "description",
    "instructions",
    "features",
    "cover",
    "duration",
    "sortOrder",
    "demographicQuestions",
    "scoringType",
    "scoringPreset",
    "questions",
    "scoreRanges",
    "dimensions",
    "reverseQuestionIds",
    "matchResults",
    "reportIntro",
    "reportProfiles",
    "disclaimer",
    "createdAt",
    "updatedAt",
    "publishedAt",
}
REQUIRED_TOP_LEVEL_FIELDS = {
    "schemaVersion",
    "id",
    "version",
    "status",
    "category",
    "title",
    "subtitle",
    "description",
    "cover",
    "duration",
    "scoringType",
    "scoringPreset",
    "questions",
    "disclaimer",
}


class AssessmentDefinitionError(Exception):
    """Base error for the file-backed assessment definition store."""


class AssessmentNotFound(AssessmentDefinitionError):
    pass


class AssessmentConflict(AssessmentDefinitionError):
    pass


class AssessmentValidationError(AssessmentDefinitionError):
    pass


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canonical_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def definition_revision(definition: dict[str, Any]) -> str:
    return f"sha256:{hashlib.sha256(_canonical_json(definition)).hexdigest()}"


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _assert_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AssessmentValidationError(f"{label}必须是对象")
    return value


def _assert_string(value: Any, label: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        raise AssessmentValidationError(f"{label}必须是非空字符串")
    return value


def _assert_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AssessmentValidationError(f"{label}必须是数字")
    return float(value)


def _assert_optional_string(value: Any, label: str) -> None:
    if value is not None and not isinstance(value, str):
        raise AssessmentValidationError(f"{label}必须是字符串")


def _validate_id_list(value: Any, label: str, *, allow_empty: bool = True) -> set[str]:
    if not isinstance(value, list) or (not allow_empty and not value):
        suffix = "且不能为空" if not allow_empty else ""
        raise AssessmentValidationError(f"{label}必须是数组{suffix}")
    result: set[str] = set()
    for item in value:
        if not isinstance(item, str) or not STABLE_ID_PATTERN.fullmatch(item):
            raise AssessmentValidationError(f"{label}包含非法 ID")
        if item in result:
            raise AssessmentValidationError(f"{label}包含重复 ID：{item}")
        result.add(item)
    return result


def _assert_unique_ids(items: Any, label: str) -> set[str]:
    if not isinstance(items, list) or not items:
        raise AssessmentValidationError(f"{label}至少需要一项")
    result: set[str] = set()
    for index, raw in enumerate(items):
        item = _assert_object(raw, f"{label}[{index}]")
        item_id = _assert_string(item.get("id"), f"{label}[{index}].id")
        if not STABLE_ID_PATTERN.fullmatch(item_id):
            raise AssessmentValidationError(f"{label}包含非法 ID：{item_id}")
        if item_id in result:
            raise AssessmentValidationError(f"{label}包含重复 ID：{item_id}")
        result.add(item_id)
    return result


def _validate_ranges(ranges: Any, label: str) -> None:
    if not isinstance(ranges, list) or not ranges:
        raise AssessmentValidationError(f"{label}至少需要一个分数区间")
    ordered: list[tuple[float, float]] = []
    for index, raw in enumerate(ranges):
        item = _assert_object(raw, f"{label}[{index}]")
        required = {"min", "max", "level", "description", "suggestions"}
        missing = required - item.keys()
        if missing:
            raise AssessmentValidationError(f"{label}[{index}]缺少字段：{sorted(missing)}")
        if item.keys() - required:
            raise AssessmentValidationError(f"{label}[{index}]包含未知字段")
        low = _assert_number(item["min"], f"{label}[{index}].min")
        high = _assert_number(item["max"], f"{label}[{index}].max")
        if low > high:
            raise AssessmentValidationError(f"{label}[{index}]的 min 不能大于 max")
        _assert_string(item["level"], f"{label}[{index}].level")
        _assert_string(item["description"], f"{label}[{index}].description")
        if not isinstance(item["suggestions"], list) or any(
            not isinstance(value, str) or not value.strip() for value in item["suggestions"]
        ):
            raise AssessmentValidationError(f"{label}[{index}].suggestions 格式错误")
        ordered.append((low, high))
    ordered.sort()
    for previous, current in zip(ordered, ordered[1:]):
        if current[0] <= previous[1]:
            raise AssessmentValidationError(f"{label}存在重叠区间")


def validate_definition(
    definition: dict[str, Any],
    *,
    allow_fixed_scoring: bool,
) -> None:
    """Validate the v1 contract and semantic references.

    New admin-created definitions must use one of the three generic presets.
    Fixed presets are reserved for the migrated built-in assessments.
    """

    _assert_object(definition, "definition")
    missing = REQUIRED_TOP_LEVEL_FIELDS - definition.keys()
    if missing:
        raise AssessmentValidationError(f"量表缺少字段：{sorted(missing)}")
    extra = definition.keys() - TOP_LEVEL_FIELDS
    if extra:
        raise AssessmentValidationError(f"量表包含未知字段：{sorted(extra)}")
    if definition.get("schemaVersion") != 1:
        raise AssessmentValidationError("schemaVersion 必须为 1")

    assessment_id = _assert_string(definition.get("id"), "id")
    if not ASSESSMENT_ID_PATTERN.fullmatch(assessment_id):
        raise AssessmentValidationError("id 只能使用小写字母、数字和连字符")
    if len(assessment_id) > ASSESSMENT_ID_MAX_LENGTH:
        raise AssessmentValidationError(
            f"id 不能超过 {ASSESSMENT_ID_MAX_LENGTH} 个字符"
        )
    version = definition.get("version")
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise AssessmentValidationError("version 必须是大于等于 1 的整数")
    if definition.get("status") not in {"draft", "published", "archived"}:
        raise AssessmentValidationError("status 不合法")
    if definition.get("category") not in {"professional", "fun"}:
        raise AssessmentValidationError("category 不合法")
    _assert_string(definition.get("title"), "title")
    _assert_string(definition.get("subtitle"), "subtitle", allow_empty=True)
    _assert_string(definition.get("description"), "description", allow_empty=True)
    _assert_string(definition.get("cover"), "cover")
    _assert_string(definition.get("disclaimer"), "disclaimer")
    for field in ("instructions", "features", "reportIntro"):
        _assert_optional_string(definition.get(field), field)
    for field in ("createdAt", "updatedAt"):
        _assert_optional_string(definition.get(field), field)
    if definition.get("publishedAt") is not None:
        _assert_optional_string(definition.get("publishedAt"), "publishedAt")
    duration = definition.get("duration")
    if isinstance(duration, bool) or not isinstance(duration, int) or not 1 <= duration <= 240:
        raise AssessmentValidationError("duration 必须是 1 到 240 的整数")
    sort_order = definition.get("sortOrder", 0)
    if isinstance(sort_order, bool) or not isinstance(sort_order, int) or sort_order < 0:
        raise AssessmentValidationError("sortOrder 必须是非负整数")

    scoring_type = definition.get("scoringType")
    expected_preset = ALL_SCORING_PRESETS.get(str(scoring_type))
    if not expected_preset:
        raise AssessmentValidationError("scoringType 不合法")
    scoring_preset = _assert_string(definition.get("scoringPreset"), "scoringPreset")
    if not PRESET_PATTERN.fullmatch(scoring_preset) or scoring_preset != expected_preset:
        raise AssessmentValidationError(
            f"scoringPreset 与 scoringType 不匹配，应为 {expected_preset}"
        )
    if not allow_fixed_scoring and scoring_type not in GENERIC_SCORING_PRESETS:
        raise AssessmentValidationError("新建量表仅支持求和、维度和匹配三种通用计分方式")

    questions = definition.get("questions")
    question_ids = _assert_unique_ids(questions, "questions")
    option_ids: set[str] = set()
    for question_index, raw_question in enumerate(questions):
        question = _assert_object(raw_question, f"questions[{question_index}]")
        allowed_question_fields = {"id", "text", "helpText", "required", "options"}
        if question.keys() - allowed_question_fields:
            raise AssessmentValidationError(
                f"questions[{question_index}]包含未知字段"
            )
        _assert_string(question.get("text"), f"questions[{question_index}].text")
        _assert_optional_string(
            question.get("helpText"), f"questions[{question_index}].helpText"
        )
        if not isinstance(question.get("required"), bool):
            raise AssessmentValidationError(f"questions[{question_index}].required 必须是布尔值")
        options = question.get("options")
        current_ids = _assert_unique_ids(options, f"questions[{question_index}].options")
        if len(current_ids) < 2:
            raise AssessmentValidationError(f"questions[{question_index}]至少需要两个选项")
        duplicates = current_ids & option_ids
        if duplicates:
            raise AssessmentValidationError(f"选项 ID 必须全局唯一：{sorted(duplicates)}")
        option_ids.update(current_ids)
        for option_index, raw_option in enumerate(options):
            option = _assert_object(
                raw_option,
                f"questions[{question_index}].options[{option_index}]",
            )
            if option.keys() - {"id", "text", "value", "matchTags"}:
                raise AssessmentValidationError(
                    f"questions[{question_index}].options[{option_index}]包含未知字段"
                )
            _assert_string(
                option.get("text"),
                f"questions[{question_index}].options[{option_index}].text",
            )
            _assert_number(
                option.get("value"),
                f"questions[{question_index}].options[{option_index}].value",
            )
            match_tags = option.get("matchTags")
            if match_tags is not None:
                if not isinstance(match_tags, dict):
                    raise AssessmentValidationError("matchTags 必须是对象")
                for tag, weight in match_tags.items():
                    if not STABLE_ID_PATTERN.fullmatch(str(tag)):
                        raise AssessmentValidationError(f"matchTags 包含非法 ID：{tag}")
                    _assert_number(weight, f"matchTags.{tag}")

    demographic_questions = definition.get("demographicQuestions", [])
    if not isinstance(demographic_questions, list):
        raise AssessmentValidationError("demographicQuestions 必须是数组")
    if demographic_questions:
        _assert_unique_ids(demographic_questions, "demographicQuestions")
        for index, raw in enumerate(demographic_questions):
            question = _assert_object(raw, f"demographicQuestions[{index}]")
            allowed_fields = {
                "id",
                "text",
                "helpText",
                "inputType",
                "required",
                "options",
                "validation",
            }
            if question.keys() - allowed_fields:
                raise AssessmentValidationError(
                    f"demographicQuestions[{index}]包含未知字段"
                )
            input_type = question.get("inputType")
            if input_type not in {"single", "multiple", "text", "number", "date"}:
                raise AssessmentValidationError(f"demographicQuestions[{index}].inputType 不合法")
            if not isinstance(question.get("required"), bool):
                raise AssessmentValidationError(f"demographicQuestions[{index}].required 必须是布尔值")
            _assert_string(question.get("text"), f"demographicQuestions[{index}].text")
            _assert_optional_string(
                question.get("helpText"), f"demographicQuestions[{index}].helpText"
            )
            if input_type in {"single", "multiple"}:
                options = question.get("options")
                _assert_unique_ids(options, f"demographicQuestions[{index}].options")
                for option_index, raw_option in enumerate(options):
                    option = _assert_object(
                        raw_option,
                        f"demographicQuestions[{index}].options[{option_index}]",
                    )
                    if option.keys() != {"id", "text", "value"}:
                        raise AssessmentValidationError(
                            f"demographicQuestions[{index}].options[{option_index}] 字段不完整"
                        )
                    _assert_string(
                        option.get("text"),
                        f"demographicQuestions[{index}].options[{option_index}].text",
                    )
                    if isinstance(option.get("value"), (dict, list)) or option.get("value") is None:
                        raise AssessmentValidationError(
                            f"demographicQuestions[{index}].options[{option_index}].value 格式错误"
                        )
            validation = question.get("validation")
            if validation is not None:
                validation = _assert_object(
                    validation, f"demographicQuestions[{index}].validation"
                )
                allowed_validation = {"min", "max", "minLength", "maxLength", "pattern"}
                if validation.keys() - allowed_validation:
                    raise AssessmentValidationError(
                        f"demographicQuestions[{index}].validation 包含未知字段"
                    )
                for field in ("min", "max", "minLength", "maxLength"):
                    if field in validation:
                        _assert_number(
                            validation[field],
                            f"demographicQuestions[{index}].validation.{field}",
                        )
                _assert_optional_string(
                    validation.get("pattern"),
                    f"demographicQuestions[{index}].validation.pattern",
                )

    reverse_ids = _validate_id_list(
        definition.get("reverseQuestionIds", []), "reverseQuestionIds"
    )
    if not reverse_ids <= question_ids:
        raise AssessmentValidationError("reverseQuestionIds 包含不存在的题目")

    if scoring_type in {"sum", "psqi"}:
        _validate_ranges(definition.get("scoreRanges"), "scoreRanges")
    if scoring_type == "dimension":
        dimensions = definition.get("dimensions")
        _assert_unique_ids(dimensions, "dimensions")
        for index, raw_dimension in enumerate(dimensions):
            dimension = _assert_object(raw_dimension, f"dimensions[{index}]")
            allowed_dimension_fields = {
                "id",
                "title",
                "intro",
                "questionIds",
                "reverseQuestionIds",
                "aggregate",
                "scoreRanges",
            }
            if dimension.keys() - allowed_dimension_fields:
                raise AssessmentValidationError(f"dimensions[{index}]包含未知字段")
            _assert_string(dimension.get("title"), f"dimensions[{index}].title")
            _assert_optional_string(dimension.get("intro"), f"dimensions[{index}].intro")
            references = _validate_id_list(
                dimension.get("questionIds"),
                f"dimensions[{index}].questionIds",
                allow_empty=False,
            )
            dimension_reverse = _validate_id_list(
                dimension.get("reverseQuestionIds", []),
                f"dimensions[{index}].reverseQuestionIds",
            )
            if not references or not references <= question_ids:
                raise AssessmentValidationError(f"dimensions[{index}]包含不存在的题目")
            if not dimension_reverse <= references:
                raise AssessmentValidationError(
                    f"dimensions[{index}].reverseQuestionIds 必须属于该维度"
                )
            if dimension.get("aggregate") not in {"sum", "average"}:
                raise AssessmentValidationError(f"dimensions[{index}].aggregate 不合法")
            _validate_ranges(dimension.get("scoreRanges"), f"dimensions[{index}].scoreRanges")
    if scoring_type in {"match", "aas"}:
        match_results = definition.get("matchResults")
        result_ids = _assert_unique_ids(match_results, "matchResults")
        for index, raw_result in enumerate(match_results):
            result = _assert_object(raw_result, f"matchResults[{index}]")
            required_result_fields = {"id", "title", "description", "image", "shareText"}
            allowed_result_fields = required_result_fields | {"suggestions"}
            missing_result_fields = required_result_fields - result.keys()
            if missing_result_fields or result.keys() - allowed_result_fields:
                raise AssessmentValidationError(f"matchResults[{index}] 字段不完整")
            for field in ("title", "description"):
                _assert_string(result.get(field), f"matchResults[{index}].{field}")
            for field in ("image", "shareText"):
                _assert_string(
                    result.get(field),
                    f"matchResults[{index}].{field}",
                    allow_empty=True,
                )
            suggestions = result.get("suggestions", [])
            if not isinstance(suggestions, list) or any(
                not isinstance(value, str) or not value.strip() for value in suggestions
            ):
                raise AssessmentValidationError(f"matchResults[{index}].suggestions 格式错误")
        tag_ids = {
            tag
            for question in questions
            for option in question["options"]
            for tag in option.get("matchTags", {})
        }
        if not tag_ids <= result_ids:
            raise AssessmentValidationError("matchTags 包含没有对应结果的 ID")

    report_profiles = definition.get("reportProfiles", [])
    report_profile_ids: set[str] = set()
    if report_profiles:
        report_profile_ids = _assert_unique_ids(report_profiles, "reportProfiles")
        for index, raw in enumerate(report_profiles):
            profile = _assert_object(raw, f"reportProfiles[{index}]")
            required_profile_fields = {"id", "title", "description", "suggestions"}
            allowed_profile_fields = required_profile_fields | {"image", "shareText"}
            if required_profile_fields - profile.keys() or profile.keys() - allowed_profile_fields:
                raise AssessmentValidationError(f"reportProfiles[{index}] 字段不完整")
            for field in ("title", "description"):
                _assert_string(profile.get(field), f"reportProfiles[{index}].{field}")
            suggestions = profile.get("suggestions")
            if not isinstance(suggestions, list) or any(
                not isinstance(value, str) or not value.strip() for value in suggestions
            ):
                raise AssessmentValidationError(f"reportProfiles[{index}].suggestions 格式错误")
            for field in ("image", "shareText"):
                _assert_optional_string(
                    profile.get(field), f"reportProfiles[{index}].{field}"
                )

    if scoring_type in FIXED_SCORING_PRESETS:
        expected_question_ids = FIXED_QUESTION_IDS[scoring_type]
        if question_ids != expected_question_ids:
            missing_ids = sorted(expected_question_ids - question_ids)
            extra_ids = sorted(question_ids - expected_question_ids)
            raise AssessmentValidationError(
                f"{scoring_type} 固定计分题目不匹配，缺少 {missing_ids}，多出 {extra_ids}"
            )
        expected_values = FIXED_OPTION_VALUES[scoring_type]
        for question in questions:
            values = {float(option["value"]) for option in question["options"]}
            if values != expected_values:
                raise AssessmentValidationError(
                    f"{scoring_type} 固定计分题目 {question['id']} 的选项分值不匹配"
                )
        required_profile_ids = FIXED_REPORT_PROFILE_IDS.get(scoring_type, set())
        if not required_profile_ids <= report_profile_ids:
            raise AssessmentValidationError(
                f"{scoring_type} 缺少报告文案：{sorted(required_profile_ids - report_profile_ids)}"
            )
        if scoring_type == "aas":
            result_ids = {item["id"] for item in definition.get("matchResults", [])}
            expected_result_ids = {"secure", "preoccupied", "dismissive", "fearful"}
            if result_ids != expected_result_ids:
                raise AssessmentValidationError("aas 固定计分结果 ID 不匹配")


class AssessmentDefinitionStore:
    """File-backed assessment definitions with immutable published versions."""

    def __init__(
        self,
        data_dir: Path | str,
        *,
        seed_data_dir: Optional[Path | str] = None,
        guidance_file: Optional[Path | str] = None,
        report_profiles_file: Optional[Path | str] = None,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.seed_data_dir = Path(seed_data_dir) if seed_data_dir else None
        self.guidance_file = Path(guidance_file) if guidance_file else None
        self.report_profiles_file = (
            Path(report_profiles_file) if report_profiles_file else None
        )
        self.index_path = self.data_dir / "index.json"
        self.drafts_dir = self.data_dir / "drafts"
        self.published_dir = self.data_dir / "published"
        self.backups_dir = self.data_dir / "backups"
        self._thread_lock = threading.RLock()

    def _ensure_directories(self) -> None:
        self.drafts_dir.mkdir(parents=True, exist_ok=True)
        self.published_dir.mkdir(parents=True, exist_ok=True)
        self.backups_dir.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def _write_lock(self) -> Iterator[None]:
        self._ensure_directories()
        with self._thread_lock:
            lock_handle = (self.data_dir / ".write.lock").open("a+")
            try:
                try:
                    import fcntl

                    fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX)
                except ImportError:
                    pass
                yield
            finally:
                try:
                    import fcntl

                    fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
                except ImportError:
                    pass
                lock_handle.close()

    @staticmethod
    def _atomic_write(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
        payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            if temporary.exists():
                temporary.unlink()

    def _empty_index(self) -> dict[str, Any]:
        return {"schemaVersion": 1, "updatedAt": _utc_now(), "assessments": {}}

    def _read_index(self) -> dict[str, Any]:
        if not self.index_path.exists():
            return self._empty_index()
        value = _load_json(self.index_path)
        if not isinstance(value, dict) or not isinstance(value.get("assessments"), dict):
            raise AssessmentDefinitionError("量表索引文件已损坏")
        return value

    def _write_index(self, index: dict[str, Any]) -> None:
        index["schemaVersion"] = 1
        index["updatedAt"] = _utc_now()
        self._atomic_write(self.index_path, index)

    def _draft_path(self, assessment_id: str) -> Path:
        return self.drafts_dir / f"{assessment_id}.json"

    def _published_path(self, assessment_id: str, version: int) -> Path:
        return self.published_dir / assessment_id / f"v{version}.json"

    def _backup_draft(self, assessment_id: str) -> None:
        draft_path = self._draft_path(assessment_id)
        if not draft_path.exists():
            return
        current = _load_json(draft_path)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        revision = definition_revision(current).split(":", 1)[1][:12]
        self._atomic_write(
            self.backups_dir / assessment_id / f"{timestamp}-{revision}.json",
            current,
        )

    def ensure_seeded(self) -> None:
        with self._write_lock():
            index = self._read_index()
            if index["assessments"]:
                return
            if not self.seed_data_dir:
                self._write_index(index)
                return
            definitions = self._load_seed_definitions()
            now = _utc_now()
            for sort_order, definition in enumerate(definitions):
                assessment_id = definition["id"]
                definition["sortOrder"] = sort_order
                definition["createdAt"] = now
                definition["updatedAt"] = now
                definition["publishedAt"] = now
                validate_definition(definition, allow_fixed_scoring=True)
                path = self._published_path(assessment_id, 1)
                self._atomic_write(path, definition)
                index["assessments"][assessment_id] = self._index_entry(
                    definition,
                    status="published",
                    published_version=1,
                    draft_version=None,
                    draft_revision=None,
                )
            self._write_index(index)

    def _load_seed_definitions(self) -> list[dict[str, Any]]:
        if not self.seed_data_dir:
            return []
        sources = [
            (self.seed_data_dir / "assessments-professional.json", "professional"),
            (self.seed_data_dir / "assessments-fun.json", "fun"),
        ]
        guidance = self._load_guidance()
        report_profiles = self._load_report_profiles()
        result: list[dict[str, Any]] = []
        for path, category in sources:
            if not path.exists():
                raise AssessmentDefinitionError(f"找不到量表种子文件：{path}")
            values = _load_json(path)
            if not isinstance(values, list):
                raise AssessmentDefinitionError(f"量表种子必须是数组：{path}")
            for raw in values:
                definition = copy.deepcopy(_assert_object(raw, str(path)))
                definition.pop("questionCount", None)
                if definition.get("id") == "dark-light-personality":
                    definition["questions"] = definition.get("questions", [])[:12]
                for question in definition.get("questions", []):
                    question["required"] = True
                scoring_type = str(definition.get("scoringType"))
                definition.update(
                    {
                        "schemaVersion": 1,
                        "version": 1,
                        "status": "published",
                        "category": category,
                        "scoringPreset": ALL_SCORING_PRESETS.get(scoring_type, ""),
                    }
                )
                content = guidance.get(str(definition.get("id")), {})
                if content:
                    definition["instructions"] = content.get("instructions", "")
                    if content.get("features"):
                        definition["features"] = content["features"]
                    definition.setdefault("reportIntro", content.get("features", ""))
                profiles = report_profiles.get(str(definition.get("id")))
                if profiles:
                    definition["reportProfiles"] = profiles
                result.append(definition)
        return result

    def _load_guidance(self) -> dict[str, dict[str, str]]:
        if not self.guidance_file or not self.guidance_file.exists():
            return {}
        source = self.guidance_file.read_text(encoding="utf-8")
        entry_pattern = re.compile(
            r'^  (?:(?:"(?P<quoted>[^"]+)")|(?P<bare>[a-z][a-z0-9-]*)):\s*\{(?P<body>.*?)^  \},',
            re.MULTILINE | re.DOTALL,
        )
        string_pattern = r'"(?:\\.|[^"\\])*"'
        result: dict[str, dict[str, str]] = {}
        for match in entry_pattern.finditer(source):
            assessment_id = match.group("quoted") or match.group("bare")
            body = match.group("body")
            item: dict[str, str] = {}
            for field in ("instructions", "features"):
                field_match = re.search(rf"{field}:\s*({string_pattern})", body)
                if field_match:
                    item[field] = json.loads(field_match.group(1))
            if item:
                result[assessment_id] = item
        return result

    def _load_report_profiles(self) -> dict[str, list[dict[str, Any]]]:
        if not self.report_profiles_file or not self.report_profiles_file.exists():
            return {}
        value = _load_json(self.report_profiles_file)
        if not isinstance(value, dict):
            raise AssessmentDefinitionError("量表报告文案种子必须是对象")
        return value

    @staticmethod
    def _index_entry(
        definition: dict[str, Any],
        *,
        status: str,
        published_version: Optional[int],
        draft_version: Optional[int],
        draft_revision: Optional[str],
        archived_at: Optional[str] = None,
    ) -> dict[str, Any]:
        return {
            "id": definition["id"],
            "category": definition["category"],
            "title": definition["title"],
            "status": status,
            "sortOrder": definition.get("sortOrder", 0),
            "publishedVersion": published_version,
            "draftVersion": draft_version,
            "draftRevision": draft_revision,
            "updatedAt": definition.get("updatedAt") or _utc_now(),
            "archivedAt": archived_at,
        }

    @staticmethod
    def _summary(definition: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": definition["id"],
            "version": definition["version"],
            "category": definition["category"],
            "title": definition["title"],
            "subtitle": definition["subtitle"],
            "description": definition["description"],
            "cover": definition["cover"],
            "questionCount": len(definition["questions"]),
            "duration": definition["duration"],
            "scoringType": definition["scoringType"],
            "sortOrder": definition.get("sortOrder", 0),
        }

    def list_published(
        self,
        *,
        category: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        self.ensure_seeded()
        if category and category not in {"professional", "fun"}:
            raise AssessmentValidationError("category 不合法")
        normalized_keyword = (keyword or "").strip().casefold()
        index = self._read_index()
        items: list[dict[str, Any]] = []
        for entry in index["assessments"].values():
            # 已发布版本和新草稿可以并存；草稿编辑期间 EAP 仍读取旧发布版。
            if not entry.get("publishedVersion") or entry.get("archivedAt"):
                continue
            if category and entry.get("category") != category:
                continue
            definition = _load_json(
                self._published_path(entry["id"], int(entry["publishedVersion"]))
            )
            if normalized_keyword and normalized_keyword not in (
                f"{definition.get('title', '')} {definition.get('subtitle', '')}"
            ).casefold():
                continue
            items.append(self._summary(definition))
        return sorted(items, key=lambda item: (item["sortOrder"], item["id"]))

    def get_published(self, assessment_id: str) -> dict[str, Any]:
        self.ensure_seeded()
        index = self._read_index()
        entry = index["assessments"].get(assessment_id)
        if not entry or not entry.get("publishedVersion") or entry.get("archivedAt"):
            raise AssessmentNotFound("量表不存在或未发布")
        definition = _load_json(
            self._published_path(assessment_id, int(entry["publishedVersion"]))
        )
        return {
            "definition": definition,
            "questionCount": len(definition["questions"]),
        }

    def get_published_version(
        self,
        assessment_id: str,
        version: int,
    ) -> dict[str, Any]:
        """读取曾经发布的指定版本，供历史提交重新计分和生成快照。"""
        self.ensure_seeded()
        if not isinstance(assessment_id, str) or not ASSESSMENT_ID_PATTERN.fullmatch(
            assessment_id
        ):
            raise AssessmentValidationError("量表 ID 不合法")
        if isinstance(version, bool) or not isinstance(version, int) or version < 1:
            raise AssessmentValidationError("量表版本不合法")
        path = self._published_path(assessment_id, version)
        if not path.exists():
            raise AssessmentNotFound("量表版本不存在或从未发布")
        definition = _load_json(path)
        if (
            definition.get("id") != assessment_id
            or definition.get("version") != version
            or definition.get("status") != "published"
        ):
            raise AssessmentDefinitionError("已发布量表版本文件不完整")
        validate_definition(
            definition,
            allow_fixed_scoring=definition.get("scoringType") in FIXED_SCORING_PRESETS,
        )
        return copy.deepcopy(definition)

    def list_admin(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        category: Optional[str] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> dict[str, Any]:
        self.ensure_seeded()
        if category and category not in {"professional", "fun"}:
            raise AssessmentValidationError("category 不合法")
        if status and status not in {"draft", "published", "archived"}:
            raise AssessmentValidationError("status 不合法")
        normalized_keyword = (keyword or "").strip().casefold()
        entries = list(self._read_index()["assessments"].values())
        filtered = [
            entry
            for entry in entries
            if (not category or entry.get("category") == category)
            and (not status or entry.get("status") == status)
            and (
                not normalized_keyword
                or normalized_keyword
                in f"{entry.get('id', '')} {entry.get('title', '')}".casefold()
            )
        ]
        filtered.sort(key=lambda item: (item.get("sortOrder", 0), item["id"]))
        start = (page - 1) * page_size
        items = []
        for entry in filtered[start : start + page_size]:
            definition = self._editable_definition(entry)
            item = {**entry, **self._summary(definition)}
            item.update({"completedCount": 0, "scanCount": 0})
            items.append(item)
        return {
            "items": items,
            "page": page,
            "pageSize": page_size,
            "total": len(filtered),
        }

    def _editable_definition(self, entry: dict[str, Any]) -> dict[str, Any]:
        if entry.get("draftVersion") and self._draft_path(entry["id"]).exists():
            return _load_json(self._draft_path(entry["id"]))
        published_version = entry.get("publishedVersion")
        if published_version:
            return _load_json(self._published_path(entry["id"], int(published_version)))
        raise AssessmentNotFound("量表定义不存在")

    def get_admin(self, assessment_id: str) -> dict[str, Any]:
        self.ensure_seeded()
        entry = self._read_index()["assessments"].get(assessment_id)
        if not entry:
            raise AssessmentNotFound("量表不存在")
        definition = self._editable_definition(entry)
        return {
            "definition": definition,
            "revision": definition_revision(definition),
            "lifecycleStatus": entry.get("status"),
            "publishedVersion": entry.get("publishedVersion"),
            "draftVersion": entry.get("draftVersion"),
            "versions": self.list_versions(assessment_id),
        }

    def create_draft(self, definition: dict[str, Any]) -> dict[str, Any]:
        self.ensure_seeded()
        draft = copy.deepcopy(definition)
        now = _utc_now()
        draft["version"] = 1
        draft["status"] = "draft"
        draft["createdAt"] = now
        draft["updatedAt"] = now
        draft["publishedAt"] = None
        validate_definition(draft, allow_fixed_scoring=False)
        assessment_id = draft["id"]
        with self._write_lock():
            index = self._read_index()
            if assessment_id in index["assessments"]:
                raise AssessmentConflict("量表 ID 已存在")
            revision = definition_revision(draft)
            self._atomic_write(self._draft_path(assessment_id), draft)
            index["assessments"][assessment_id] = self._index_entry(
                draft,
                status="draft",
                published_version=None,
                draft_version=1,
                draft_revision=revision,
            )
            self._write_index(index)
        return self.get_admin(assessment_id)

    def update_draft(
        self,
        assessment_id: str,
        definition: dict[str, Any],
        *,
        expected_revision: str,
    ) -> dict[str, Any]:
        self.ensure_seeded()
        with self._write_lock():
            index = self._read_index()
            entry = index["assessments"].get(assessment_id)
            if not entry:
                raise AssessmentNotFound("量表不存在")
            current = self._editable_definition(entry)
            current_revision = definition_revision(current)
            if expected_revision != current_revision:
                raise AssessmentConflict("量表已被其他管理员修改，请刷新后重试")
            if definition.get("id") != assessment_id:
                raise AssessmentValidationError("量表 ID 发布后不可修改")
            draft = copy.deepcopy(definition)
            draft_version = int(entry.get("publishedVersion") or 0) + 1
            if entry.get("draftVersion"):
                draft_version = int(entry["draftVersion"])
            draft["version"] = draft_version
            draft["status"] = "draft"
            draft["createdAt"] = current.get("createdAt") or _utc_now()
            draft["updatedAt"] = _utc_now()
            draft["publishedAt"] = None
            if (
                current.get("scoringType") in FIXED_SCORING_PRESETS
                and draft.get("scoringType") != current.get("scoringType")
            ):
                raise AssessmentValidationError("固定计分量表不能更换计分模板")
            allow_fixed = draft.get("scoringType") in FIXED_SCORING_PRESETS
            if allow_fixed and draft.get("scoringType") != current.get("scoringType"):
                raise AssessmentValidationError("固定计分量表不能更换计分模板")
            validate_definition(draft, allow_fixed_scoring=allow_fixed)
            self._backup_draft(assessment_id)
            revision = definition_revision(draft)
            self._atomic_write(self._draft_path(assessment_id), draft)
            entry.update(
                self._index_entry(
                    draft,
                    status="draft",
                    published_version=entry.get("publishedVersion"),
                    draft_version=draft_version,
                    draft_revision=revision,
                    archived_at=entry.get("archivedAt"),
                )
            )
            index["assessments"][assessment_id] = entry
            self._write_index(index)
        return self.get_admin(assessment_id)

    def publish(self, assessment_id: str, *, expected_revision: str) -> dict[str, Any]:
        self.ensure_seeded()
        with self._write_lock():
            index = self._read_index()
            entry = index["assessments"].get(assessment_id)
            if not entry or not entry.get("draftVersion"):
                raise AssessmentNotFound("量表没有可发布的草稿")
            draft_path = self._draft_path(assessment_id)
            if not draft_path.exists():
                raise AssessmentDefinitionError("量表草稿文件缺失")
            draft = _load_json(draft_path)
            current_revision = definition_revision(draft)
            if expected_revision != current_revision:
                raise AssessmentConflict("量表已被其他管理员修改，请刷新后重试")
            allow_fixed = draft.get("scoringType") in FIXED_SCORING_PRESETS
            validate_definition(draft, allow_fixed_scoring=allow_fixed)
            version = int(entry["draftVersion"])
            published_path = self._published_path(assessment_id, version)
            if published_path.exists():
                raise AssessmentConflict("该发布版本已存在")
            published = copy.deepcopy(draft)
            published["status"] = "published"
            published["version"] = version
            published["updatedAt"] = _utc_now()
            published["publishedAt"] = published["updatedAt"]
            validate_definition(published, allow_fixed_scoring=allow_fixed)
            self._atomic_write(published_path, published)
            draft_path.unlink()
            index["assessments"][assessment_id] = self._index_entry(
                published,
                status="published",
                published_version=version,
                draft_version=None,
                draft_revision=None,
            )
            self._write_index(index)
        return self.get_admin(assessment_id)

    def archive(self, assessment_id: str) -> dict[str, Any]:
        self.ensure_seeded()
        with self._write_lock():
            index = self._read_index()
            entry = index["assessments"].get(assessment_id)
            if not entry:
                raise AssessmentNotFound("量表不存在")
            entry["status"] = "archived"
            entry["archivedAt"] = _utc_now()
            entry["updatedAt"] = entry["archivedAt"]
            index["assessments"][assessment_id] = entry
            self._write_index(index)
        return self.get_admin(assessment_id)

    def list_versions(self, assessment_id: str) -> list[dict[str, Any]]:
        directory = self.published_dir / assessment_id
        if not directory.exists():
            return []
        result: list[dict[str, Any]] = []
        for path in directory.glob("v*.json"):
            definition = _load_json(path)
            result.append(
                {
                    "version": definition["version"],
                    "status": definition["status"],
                    "publishedAt": definition.get("publishedAt"),
                    "revision": definition_revision(definition),
                }
            )
        return sorted(result, key=lambda item: item["version"], reverse=True)

    def restore_version(self, assessment_id: str, version: int) -> dict[str, Any]:
        self.ensure_seeded()
        with self._write_lock():
            index = self._read_index()
            entry = index["assessments"].get(assessment_id)
            source_path = self._published_path(assessment_id, version)
            if not entry or not source_path.exists():
                raise AssessmentNotFound("量表历史版本不存在")
            source = _load_json(source_path)
            next_version = max(
                [item["version"] for item in self.list_versions(assessment_id)]
                + [int(entry.get("publishedVersion") or 0)]
            ) + 1
            if entry.get("draftVersion"):
                next_version = int(entry["draftVersion"])
            restored = copy.deepcopy(source)
            restored["version"] = next_version
            restored["status"] = "draft"
            restored["updatedAt"] = _utc_now()
            restored["publishedAt"] = None
            self._backup_draft(assessment_id)
            revision = definition_revision(restored)
            self._atomic_write(self._draft_path(assessment_id), restored)
            index["assessments"][assessment_id] = self._index_entry(
                restored,
                status="draft",
                published_version=entry.get("publishedVersion"),
                draft_version=next_version,
                draft_revision=revision,
                archived_at=entry.get("archivedAt"),
            )
            self._write_index(index)
        return self.get_admin(assessment_id)
