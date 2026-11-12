"""量表定义与计分结果的来访端可见范围。

风险维度（定义里的 ``riskDimension``、计分结果里的 ``risk``）只给管理端看：
所有面向来访者的接口（公开量表详情、企业站点量表、提交 / 查看报告）返回前都要经过这里，
管理端接口则直接使用完整数据。报告快照本身仍完整存库，只在输出时剥离。
"""

from __future__ import annotations

from typing import Any

STAFF_ONLY_DEFINITION_FIELDS = ("riskDimension",)
STAFF_ONLY_RESULT_FIELDS = ("risk",)


def public_definition(definition: Any) -> Any:
    """返回去掉仅管理端字段后的量表定义副本（浅拷贝，不修改入参）。"""
    if not isinstance(definition, dict):
        return definition
    if not any(field in definition for field in STAFF_ONLY_DEFINITION_FIELDS):
        return definition
    return {
        key: value
        for key, value in definition.items()
        if key not in STAFF_ONLY_DEFINITION_FIELDS
    }


def public_result(result: Any) -> Any:
    """返回去掉风险维度后的计分结果副本（浅拷贝，不修改入参）。"""
    if not isinstance(result, dict):
        return result
    if not any(field in result for field in STAFF_ONLY_RESULT_FIELDS):
        return result
    return {
        key: value for key, value in result.items() if key not in STAFF_ONLY_RESULT_FIELDS
    }


def public_report_snapshot(snapshot: Any) -> Any:
    """报告快照里的定义和结果都要剥离风险信息。"""
    if not isinstance(snapshot, dict):
        return snapshot
    cleaned = dict(snapshot)
    if "assessment" in cleaned:
        cleaned["assessment"] = public_definition(cleaned["assessment"])
    if "result" in cleaned:
        cleaned["result"] = public_result(cleaned["result"])
    return cleaned
