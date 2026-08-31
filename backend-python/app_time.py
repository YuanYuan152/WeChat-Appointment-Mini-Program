"""业务时区：排期、预约、取消/请假均以中国时间（UTC+8）计算。"""
from datetime import datetime, timedelta, timezone
from typing import Optional

CHINA_UTC_OFFSET = timedelta(hours=8)
CHINA_TIMEZONE = timezone(CHINA_UTC_OFFSET, name="Asia/Shanghai")


def china_now() -> datetime:
    """当前中国时间（naive datetime，与库中排期 StartTime/EndTime 一致）。"""
    return datetime.utcnow() + CHINA_UTC_OFFSET


def utc_to_china(value: Optional[datetime]) -> Optional[datetime]:
    """把数据库中的 UTC 时间转换为带 +08:00 时区的中国标准时间。

    系统操作时间在数据库中统一保存为 UTC naive datetime；个别驱动可能返回
    已带时区的 datetime，因此两种形式都在这里兼容。
    """
    if value is None:
        return None
    source = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return source.astimezone(CHINA_TIMEZONE)


def as_china_api_time(value: Optional[datetime]) -> Optional[datetime]:
    """导出「已是北京墙钟」的 naive 时间，挂上 +08:00 供前端按北京时间展示。

    适用于 china_now() / SQL Server GETDATE()（服务器在东八区）写入的字段，
    切勿用于 UTC naive 字段（那些应走 utc_to_china）。
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=CHINA_TIMEZONE)
    return value.astimezone(CHINA_TIMEZONE)


def hours_until(start_time: Optional[datetime]) -> Optional[float]:
    if not start_time:
        return None
    return (start_time - china_now()).total_seconds() / 3600
