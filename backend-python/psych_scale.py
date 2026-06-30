"""心理量表（PHQ-9 / GAD-7）校验与解读。"""

import json
from typing import Any, Optional

SCALE_TYPES = {
    "PHQ9": {
        "label": "PHQ-9 抑郁量表",
        "questionCount": 9,
        "levels": [
            (0, 4, "无或极轻微"),
            (5, 9, "轻度"),
            (10, 14, "中度"),
            (15, 19, "中重度"),
            (20, 27, "重度"),
        ],
    },
    "GAD7": {
        "label": "GAD-7 焦虑量表",
        "questionCount": 7,
        "levels": [
            (0, 4, "无或极轻微"),
            (5, 9, "轻度"),
            (10, 14, "中度"),
            (15, 21, "重度"),
        ],
    },
}


def normalize_scale_type(scale_type: str) -> str:
    key = (scale_type or "").strip().upper().replace("-", "")
    if key in ("PHQ9", "PHQ"):
        return "PHQ9"
    if key in ("GAD7", "GAD"):
        return "GAD7"
    raise ValueError("不支持的量表类型")


def validate_answers(scale_type: str, answers: list[int]) -> tuple[str, list[int], int]:
    key = normalize_scale_type(scale_type)
    meta = SCALE_TYPES[key]
    expected = meta["questionCount"]
    if len(answers) != expected:
        raise ValueError(f"请完成全部 {expected} 道题目")
    normalized: list[int] = []
    total = 0
    for i, val in enumerate(answers):
        if val is None or int(val) < 0 or int(val) > 3:
            raise ValueError(f"第 {i + 1} 题请选择 0-3 分")
        n = int(val)
        normalized.append(n)
        total += n
    return key, normalized, total


def level_label(scale_type: str, total: int) -> str:
    key = normalize_scale_type(scale_type)
    for low, high, label in SCALE_TYPES[key]["levels"]:
        if low <= total <= high:
            return label
    return "—"


def scale_label(scale_type: str) -> str:
    return SCALE_TYPES[normalize_scale_type(scale_type)]["label"]


def encode_answers(answers: list[int]) -> str:
    return json.dumps(answers, ensure_ascii=False)


def decode_answers(raw: Optional[str]) -> list[int]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return [int(x) for x in data]
    return []


def result_dict(
    row_id: int,
    scale_type: str,
    answers: list[int],
    total: int,
    created_at,
) -> dict[str, Any]:
    key = normalize_scale_type(scale_type)
    return {
        "id": row_id,
        "scaleType": key,
        "scaleLabel": scale_label(key),
        "total": total,
        "levelLabel": level_label(key, total),
        "answers": answers,
        "createdAt": created_at,
    }
