"""接口返回系统操作时间：按各列的写入口径统一换算成带 +08:00 的北京时间。

写入口径（约定见 app_time.py）：
- default=func.now() 的 CreatedAt / SwitchedAt：数据库服务器本地时间。偏移按当前连接
  实时查询（本地东八区 SQLEXPRESS 为 +8，Docker 内未设 TZ 的 SQL Server 为 UTC）；
- UpdatedAt、PaidAt、豁免/请假的 ReviewedAt、咨询记录 RevisedAt 等系统操作时间：UTC naive；
- 排期/预约起止等业务时间、导入的历史订单、修改申请的 ReviewedAt：北京墙钟。

前端（admin-web 的 formatDateTime、小程序截取字符串）都能直接显示带偏移的时间，
因此接口统一输出 +08:00，不再让前端猜 naive 值的时区。
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Callable, Iterable, Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app_time import as_china_api_time, db_clock_utc_offset, db_local_to_china, utc_to_china

# 旧版修改申请审核通过时用 china_now() 同时写入 ReviewedAt 与咨询记录 UpdatedAt，
# 两者相差不超过这个容差的 UpdatedAt 视为北京墙钟。
AMENDMENT_APPROVAL_WRITE_TOLERANCE = timedelta(seconds=1)

# SQL Server 单条语句最多 2100 个参数
_IN_CHUNK_SIZE = 1000


class ApiTimeClock:
    """把不同口径的 naive 时间换算为带 +08:00 的北京时间。"""

    def __init__(self, db_utc_offset: timedelta = timedelta(0)):
        self.db_utc_offset = db_utc_offset

    @classmethod
    def for_session(cls, db: Session) -> "ApiTimeClock":
        return cls(db_clock_utc_offset(db))

    def db(self, value: Optional[datetime]) -> Optional[datetime]:
        """default/onupdate=func.now() 由数据库服务器按本地时间写入的列。"""
        return db_local_to_china(value, self.db_utc_offset)

    @staticmethod
    def utc(value: Optional[datetime]) -> Optional[datetime]:
        """代码显式 datetime.utcnow() 写入的系统操作时间。"""
        return utc_to_china(value)

    @staticmethod
    def china(value: Optional[datetime]) -> Optional[datetime]:
        """china_now() 写入的列，以及排期/预约等北京墙钟业务时间。"""
        return as_china_api_time(value)

    def business_or(
        self,
        value: Optional[datetime],
        business_value: Optional[datetime],
        fallback: Callable[[Optional[datetime]], Optional[datetime]],
    ) -> Optional[datetime]:
        """导入数据把预约起止时间直接写进 CreatedAt/UpdatedAt：与业务时间完全相等时按北京墙钟处理。"""
        if value is not None and business_value is not None and value == business_value:
            return self.china(value)
        return fallback(value)

    def order_times(self, order: Any) -> tuple[Optional[datetime], Optional[datetime], Optional[datetime]]:
        """订单 (CreatedAt, PaidAt, UpdatedAt)。导入订单写入 CreatedAt=PaidAt=业务时间，按北京墙钟处理。"""
        imported = bool(order.PaidAt and order.PaidAt == order.CreatedAt) or str(
            order.TransactionId or ""
        ).startswith("IMPORT-")
        if imported:
            return self.china(order.CreatedAt), self.china(order.PaidAt), self.utc(order.UpdatedAt)
        return self.db(order.CreatedAt), self.utc(order.PaidAt), self.utc(order.UpdatedAt)

    def case_record_updated_at(
        self,
        record: Any,
        approved_review_times: Iterable[datetime] = (),
    ) -> Optional[datetime]:
        """咨询记录 UpdatedAt：通常是 UTC；旧版审核通过写入的北京墙钟按修改申请审核时间识别。"""
        updated_at = record.UpdatedAt
        if written_by_amendment_approval(updated_at, approved_review_times):
            return self.china(updated_at)
        return self.utc(updated_at)

    def case_record_latest_at(
        self,
        record: Any,
        approved_review_times: Iterable[datetime] = (),
    ) -> Optional[datetime]:
        """咨询记录最近一次写入时间：没有 UpdatedAt 时回退到 CreatedAt（数据库时钟）。"""
        if record.UpdatedAt is not None:
            return self.case_record_updated_at(record, approved_review_times)
        return self.db(record.CreatedAt)


def written_by_amendment_approval(
    updated_at: Optional[datetime],
    approved_review_times: Iterable[datetime],
) -> bool:
    if updated_at is None:
        return False
    return any(
        reviewed_at is not None and abs(updated_at - reviewed_at) <= AMENDMENT_APPROVAL_WRITE_TOLERANCE
        for reviewed_at in approved_review_times
    )


def approved_amendment_review_times(
    db: Session,
    case_record_ids: Iterable[Optional[int]],
) -> dict[int, list[datetime]]:
    """咨询记录 Id -> 已通过修改申请的 ReviewedAt 列表，用于识别旧版审核写入的 UpdatedAt。"""
    from models import AppCaseRecordAmendmentRequest

    ids = sorted({int(record_id) for record_id in case_record_ids if record_id})
    result: dict[int, list[datetime]] = {}
    if not ids:
        return result
    try:
        for start in range(0, len(ids), _IN_CHUNK_SIZE):
            rows = (
                db.query(
                    AppCaseRecordAmendmentRequest.CaseRecordId,
                    AppCaseRecordAmendmentRequest.ReviewedAt,
                )
                .filter(
                    AppCaseRecordAmendmentRequest.CaseRecordId.in_(ids[start:start + _IN_CHUNK_SIZE]),
                    AppCaseRecordAmendmentRequest.Status == "APPROVED",
                    AppCaseRecordAmendmentRequest.ReviewedAt.isnot(None),
                )
                .all()
            )
            for case_record_id, reviewed_at in rows:
                result.setdefault(case_record_id, []).append(reviewed_at)
    except SQLAlchemyError:
        # 与 latest_amendment_for_record 一致：旧库缺表/缺列时不影响主流程
        db.rollback()
        return {}
    return result
