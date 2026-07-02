"""数据库兼容读取工具。

本地旧库可能暂时没有 new_design 中新增的可选字段。读取这些字段时返回默认值，
避免列表接口因为缺列而整体失败；正式库字段存在时行为不变。
"""
from typing import Any

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import object_session


_MISSING_OPTIONAL_MODEL_FIELDS: set[tuple[str, str]] = set()


def _is_missing_column_error(exc: SQLAlchemyError, attr: str) -> bool:
    msg = str(getattr(exc, "orig", exc))
    return (
        attr in msg
        and (
            "Invalid column name" in msg
            or "invalid column name" in msg.lower()
            or "无效的列名" in msg
        )
    )


def optional_model_value(obj: Any, attr: str, default: Any = None) -> Any:
    if obj is None:
        return default
    table = getattr(getattr(obj, "__table__", None), "name", obj.__class__.__name__)
    key = (table, attr)
    if key in _MISSING_OPTIONAL_MODEL_FIELDS:
        return default
    try:
        value = getattr(obj, attr)
    except AttributeError:
        return default
    except SQLAlchemyError as exc:
        if not _is_missing_column_error(exc, attr):
            raise
        _MISSING_OPTIONAL_MODEL_FIELDS.add(key)
        session = object_session(obj)
        if session:
            session.rollback()
        return default
    return default if value is None else value
