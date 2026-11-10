"""操作记录接口的时间口径：各来源列统一输出带 +08:00 的北京时间。

操作记录聚合自多张业务表，时间列写入方式不同：
- default/onupdate=func.now()：数据库服务器本地时间（本地 SQLEXPRESS 为东八区，Docker 内为 UTC）；
- 显式 datetime.utcnow()：UTC；
- china_now() 与排期/预约业务时间、导入数据：北京墙钟。
"""
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi.encoders import jsonable_encoder
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app_time import db_clock_utc_offset
from database import Base
from models import (
    AppAccount,
    AppCaseRecord,
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppConsultationFeedback,
    AppOrder,
    AppRefundExemption,
    AppRoleSwitchLog,
)
from web_admin import operation_records

BEIJING_DB = timedelta(hours=8)
UTC_DB = timedelta(0)


class OperationRecordsTimezoneTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.admin = AppAccount(Id=100, Mobile="13800000100", RealName="管理员", ActiveRole="Admin", IsActive=True)
        self.db.add_all([
            self.admin,
            AppAccount(Id=1, Mobile="13800000001", RealName="来访甲", ActiveRole="Patient", IsActive=True),
            AppAccount(Id=2, Mobile="13800000002", RealName="咨询师甲", ActiveRole="Counselor", IsActive=True),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _records(self, db_utc_offset: timedelta, **filters) -> list[dict]:
        params = {
            "role": None,
            "operator_id": None,
            "action_type": None,
            "keyword": None,
            "start_at": None,
            "end_at": None,
            "page": 1,
            "page_size": 100,
        }
        params.update(filters)
        with patch("web_admin.db_clock_utc_offset", return_value=db_utc_offset):
            result = operation_records(_admin=self.admin, db=self.db, **params)
        # 与 FastAPI 响应一致的 JSON 形态
        return jsonable_encoder(result)["items"]

    @staticmethod
    def _by_id(items: list[dict]) -> dict[str, dict]:
        return {item["id"]: item for item in items}

    def test_beijing_db_outputs_every_source_in_china_time(self):
        """本地东八区 SQL Server：func.now() 列已是北京墙钟，utcnow 列需 +8，同一行混存也要各自换算。"""
        self.db.add_all([
            # 角色切换：SwitchedAt 由 func.now() 写入
            AppRoleSwitchLog(Id=1, AccountId=1, FromRole="Patient", ToRole="Counselor",
                             SwitchedAt=datetime(2026, 8, 28, 9, 0)),
            # 普通预约：CreatedAt 为 func.now()，UpdatedAt 为 utcnow，起止为业务时间
            AppConsultation(Id=10, PatientId=1, CounselorId=2, Status="CONFIRMED",
                            StartTime=datetime(2026, 8, 30, 15, 0), EndTime=datetime(2026, 8, 30, 15, 50),
                            CreatedAt=datetime(2026, 8, 28, 11, 0), UpdatedAt=datetime(2026, 8, 28, 4, 0)),
            # Web 导入的预约：CreatedAt/UpdatedAt 直接写入业务起止时间
            AppConsultation(Id=11, PatientId=1, CounselorId=2, Status="DONE",
                            StartTime=datetime(2026, 8, 20, 14, 0), EndTime=datetime(2026, 8, 20, 14, 50),
                            CreatedAt=datetime(2026, 8, 20, 14, 0), UpdatedAt=datetime(2026, 8, 20, 14, 50)),
            # 豁免申请：提交时间 func.now()，审核时间 utcnow
            AppRefundExemption(Id=20, ConsultationId=10, AccountId=1, Amount=100, Reason="临时有事",
                               Status="APPROVED", ReviewedBy=100,
                               CreatedAt=datetime(2026, 8, 28, 10, 0),
                               ReviewedAt=datetime(2026, 8, 28, 2, 20), UpdatedAt=datetime(2026, 8, 28, 2, 20)),
            # 普通订单：CreatedAt func.now()，PaidAt utcnow
            AppOrder(Id=30, AccountId=1, OutTradeNo="T30", TotalFee=100, Status="PAID",
                     CreatedAt=datetime(2026, 8, 28, 11, 0), PaidAt=datetime(2026, 8, 28, 3, 5)),
            # 导入订单：CreatedAt=PaidAt=付费业务时间
            AppOrder(Id=31, AccountId=1, OutTradeNo="IMPORT-ABC", TransactionId="IMPORT-2", TotalFee=100,
                     Status="PAID", CreatedAt=datetime(2026, 8, 20, 14, 0), PaidAt=datetime(2026, 8, 20, 14, 0)),
            # 修改申请审核通过：ReviewedAt 与咨询记录 UpdatedAt 均由 china_now() 写入
            AppCaseRecord(Id=40, ConsultationId=10, CounselorId=2, Subjective="记录",
                          CreatedAt=datetime(2026, 8, 28, 15, 0),
                          UpdatedAt=datetime(2026, 8, 28, 16, 30, 0, 100)),
            AppCaseRecordAmendmentRequest(Id=50, CaseRecordId=40, ConsultationId=10, CounselorId=2,
                                          Subjective="s", Objective="o", Assessment="a", Plan="p",
                                          Status="APPROVED", ReviewedBy=100,
                                          CreatedAt=datetime(2026, 8, 28, 16, 0),
                                          ReviewedAt=datetime(2026, 8, 28, 16, 30, 0, 200)),
            # 咨询师自己编辑的记录：UpdatedAt 为 utcnow
            AppCaseRecord(Id=41, ConsultationId=11, CounselorId=2, Subjective="记录",
                          CreatedAt=datetime(2026, 8, 28, 15, 0), UpdatedAt=datetime(2026, 8, 28, 9, 45)),
        ])
        self.db.commit()

        items = self._records(BEIJING_DB)
        records = self._by_id(items)

        self.assertEqual(records["role-switch-1"]["occurredAt"], "2026-08-28T09:00:00+08:00")

        consultation = records["consultation-10"]
        self.assertEqual(consultation["occurredAt"], "2026-08-28T12:00:00+08:00")
        self.assertEqual(consultation["createdAt"], "2026-08-28T11:00:00+08:00")
        # 业务时间不能被二次偏移
        self.assertEqual(consultation["startTime"], "2026-08-30T15:00:00+08:00")
        self.assertEqual(consultation["endTime"], "2026-08-30T15:50:00+08:00")

        imported_consultation = records["consultation-11"]
        self.assertEqual(imported_consultation["occurredAt"], "2026-08-20T14:50:00+08:00")
        self.assertEqual(imported_consultation["createdAt"], "2026-08-20T14:00:00+08:00")

        exemption = records["refund-exemption-20"]
        self.assertEqual(exemption["occurredAt"], "2026-08-28T10:20:00+08:00")
        self.assertEqual(exemption["createdAt"], "2026-08-28T10:00:00+08:00")
        self.assertEqual(exemption["updatedAt"], "2026-08-28T10:20:00+08:00")
        self.assertEqual(exemption["startTime"], "2026-08-30T15:00:00+08:00")

        order = records["order-30"]
        self.assertEqual(order["occurredAt"], "2026-08-28T11:05:00+08:00")
        self.assertEqual(order["createdAt"], "2026-08-28T11:00:00+08:00")
        imported_order = records["order-31"]
        self.assertEqual(imported_order["occurredAt"], "2026-08-20T14:00:00+08:00")
        self.assertEqual(imported_order["createdAt"], "2026-08-20T14:00:00+08:00")

        approved_record = records["case-record-40"]
        self.assertTrue(approved_record["occurredAt"].startswith("2026-08-28T16:30:00"))
        self.assertTrue(approved_record["occurredAt"].endswith("+08:00"))
        self.assertEqual(approved_record["createdAt"], "2026-08-28T15:00:00+08:00")
        amendment = records["case-record-amendment-50"]
        self.assertTrue(amendment["occurredAt"].startswith("2026-08-28T16:30:00"))
        self.assertEqual(amendment["createdAt"], "2026-08-28T16:00:00+08:00")
        self.assertEqual(records["case-record-41"]["occurredAt"], "2026-08-28T17:45:00+08:00")

        # 所有时间字段都带东八区偏移，前端无需再猜时区
        for item in items:
            for key in ("occurredAt", "createdAt", "updatedAt", "startTime", "endTime"):
                if item.get(key):
                    self.assertTrue(item[key].endswith("+08:00"), f"{item['id']}.{key}={item[key]}")

        # 按真实发生时刻倒序：审核 10:20 晚于角色切换 09:00（naive 比较时 02:20 会排到后面）
        ids = [item["id"] for item in items]
        self.assertLess(ids.index("refund-exemption-20"), ids.index("role-switch-1"))

    def test_utc_db_converts_func_now_columns_from_utc(self):
        """Docker 中未设 TZ 的 SQL Server：func.now() 列为 UTC，同样输出北京时间。"""
        self.db.add_all([
            AppRoleSwitchLog(Id=1, AccountId=1, FromRole="Patient", ToRole="Counselor",
                             SwitchedAt=datetime(2026, 8, 28, 1, 0)),
            AppOrder(Id=30, AccountId=1, OutTradeNo="T30", TotalFee=100, Status="PAID",
                     CreatedAt=datetime(2026, 8, 28, 3, 0), PaidAt=datetime(2026, 8, 28, 3, 5)),
        ])
        self.db.commit()

        records = self._by_id(self._records(UTC_DB))

        self.assertEqual(records["role-switch-1"]["occurredAt"], "2026-08-28T09:00:00+08:00")
        self.assertEqual(records["order-30"]["createdAt"], "2026-08-28T11:00:00+08:00")
        self.assertEqual(records["order-30"]["occurredAt"], "2026-08-28T11:05:00+08:00")

    def test_date_filter_uses_china_calendar_day(self):
        """筛选日期按北京自然日：UTC 前一日 16:00 之后的记录属于北京当日。"""
        self.db.add_all([
            AppConsultationFeedback(Id=1, ConsultationId=97, AccountId=1, Content="北京 8/28 01:30",
                                    CreatedAt=datetime(2026, 8, 27, 17, 30)),
            AppConsultationFeedback(Id=2, ConsultationId=98, AccountId=1, Content="北京 8/27 23:00",
                                    CreatedAt=datetime(2026, 8, 27, 15, 0)),
            AppConsultationFeedback(Id=3, ConsultationId=99, AccountId=1, Content="北京 8/29 00:30",
                                    CreatedAt=datetime(2026, 8, 28, 16, 30)),
        ])
        self.db.commit()

        items = self._records(
            UTC_DB,
            action_type="CONSULTATION_FEEDBACK",
            start_at="2026-08-28T00:00:00",
            end_at="2026-08-28T23:59:59",
        )

        self.assertEqual([item["id"] for item in items], ["consultation-feedback-1"])
        self.assertEqual(items[0]["occurredAt"], "2026-08-28T01:30:00+08:00")

    def test_sqlite_clock_is_utc(self):
        self.assertEqual(db_clock_utc_offset(self.db), timedelta(0))


if __name__ == "__main__":
    unittest.main()
