"""咨询记录表头字段配置（与前端 constants/caseRecordHeader.ts 保持一致）。"""
from typing import Any, Dict, List, Tuple

HEADER_FIELD_KEYS: Tuple[str, ...] = (
    "code",
    "gender",
    "consult_method",
    "session_number",
    "start_year",
    "start_month",
    "start_day",
    "start_hour",
    "start_minute",
    "end_hour",
    "end_minute",
)

HEADER_FIELD_LABELS: Dict[str, str] = {
    "code": "代码",
    "gender": "性别",
    "consult_method": "咨询方式",
    "session_number": "咨询次数",
    "start_year": "咨询开始年份",
    "start_month": "咨询开始月份",
    "start_day": "咨询开始日期",
    "start_hour": "咨询开始小时",
    "start_minute": "咨询开始分钟",
    "end_hour": "咨询结束小时",
    "end_minute": "咨询结束分钟",
}

DEFAULT_OFFLINE_CONSULT_METHOD = "线下咨询"
DEFAULT_VIDEO_CONSULT_METHOD = "视频咨询"


def empty_header_info() -> Dict[str, str]:
    return {key: "" for key in HEADER_FIELD_KEYS}


def normalize_header_info(data: Any) -> Dict[str, str]:
    base = empty_header_info()
    if not isinstance(data, dict):
        return base
    for key in HEADER_FIELD_KEYS:
        val = data.get(key)
        if val is not None:
            base[key] = str(val).strip()
    return base


def header_info_is_complete(data: Any) -> bool:
    normalized = normalize_header_info(data)
    return all(normalized[key] for key in HEADER_FIELD_KEYS)


def validate_header_info(data: Any) -> None:
    from fastapi import HTTPException

    normalized = normalize_header_info(data)
    missing = [HEADER_FIELD_LABELS[key] for key in HEADER_FIELD_KEYS if not normalized[key]]
    if missing:
        raise HTTPException(status_code=400, detail=f"请填写：{'、'.join(missing)}")
