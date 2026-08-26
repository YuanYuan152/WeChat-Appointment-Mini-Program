"""咨询师从业时间（开始年份）与来访端从业年限展示换算。"""

from typing import Optional

from app_time import china_now

WORK_START_YEAR_MIN = 1950


def current_calendar_year() -> int:
    return china_now().year


def is_work_start_year(value: int, now_year: Optional[int] = None) -> bool:
    """判断存储值是否为从业开始年份（兼容历史「年限数字」）。"""
    year = now_year if now_year is not None else current_calendar_year()
    try:
        raw = int(value)
    except (TypeError, ValueError):
        return False
    return WORK_START_YEAR_MIN <= raw <= year


def work_start_year_for_admin(stored: Optional[int]) -> int:
    """管理端编辑：返回从业开始年份；历史「年限」值换算为约略开始年。"""
    now = current_calendar_year()
    try:
        raw = int(stored or 0)
    except (TypeError, ValueError):
        return 0
    if raw <= 0:
        return 0
    if is_work_start_year(raw, now):
        return raw
    return max(WORK_START_YEAR_MIN, now - raw)


def display_work_years(stored: Optional[int]) -> int:
    """来访端从业年限：当前年 − 开始年；历史数据若已是年限则原样返回。"""
    now = current_calendar_year()
    try:
        raw = int(stored or 0)
    except (TypeError, ValueError):
        return 0
    if raw <= 0:
        return 0
    if is_work_start_year(raw, now):
        return max(0, now - raw)
    return max(0, raw)


def display_work_years_label(stored: Optional[int]) -> str:
    return f"{display_work_years(stored)}年+"


def validate_work_start_year(value: int) -> int:
    """校验并规范化管理端提交的从业开始年份。"""
    now = current_calendar_year()
    try:
        year = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("从业时间需为年份数字") from exc
    if year < WORK_START_YEAR_MIN or year > now:
        raise ValueError(f"从业时间需为 {WORK_START_YEAR_MIN}–{now} 年之间的年份")
    return year
