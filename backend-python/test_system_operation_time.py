"""系统操作时间的写入与接口返回口径（操作记录页之外的看板与咨询记录接口）。

- 写入：UpdatedAt 一律 UTC naive（业务代码显式 utcnow，未显式赋值时 onupdate 补写也是 UTC）；
- 返回：default=func.now() 的 CreatedAt 按数据库时钟换算；UpdatedAt / PaidAt / 审核时间 /
  RevisedAt 按 UTC 换算；导入订单与旧版审核通过写入的咨询记录 UpdatedAt 按北京墙钟；
  统一输出带 +08:00 的时间，前端 formatDateTime 与小程序截取都不会二次偏移。
"""
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from admin import (
    get_admin_case_record,
    list_admin_case_record_revisions,
    list_counselor_consultation_records,
    list_shell_users,
)
from admin_board_routes import register_admin_board_routes
from app_time import china_now
from case_record_amendment_service import approve_amendment
from counselor import (
    get_case_record,
    list_case_record_revisions,
    list_case_records,
    list_completed_consultations,
)
from database import Base
from models import (
    AppAccount,
    AppCaseRecord,
    AppCaseRecordAmendmentRequest,
    AppCaseRecordRevision,
    AppConsultation,
    AppLeaveRequest,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
    AppSchedule,
    AppScheduleCancelLog,
)
from patient_contract_service import retire_counselor_booking_relationships
from proxy_booking_service import cancel_pending_order
from web_admin import counselor_board_detail as legacy_counselor_board_detail
from web_admin import user_board_detail as legacy_user_board_detail

BEIJING_DB = timedelta(hours=8)
UTC_DB = timedelta(0)


class _SqliteTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def assertRecentUtc(self, value, before, after):
        """值落在调用前后的 utcnow 之间：说明写入的是 UTC，而不是快 8 小时的北京墙钟。"""
        self.assertIsNotNone(value)
        self.assertLessEqual(before, value)
        self.assertLessEqual(value, after)


class SystemTimeWriteTests(_SqliteTestCase):
    def test_every_updated_at_onupdate_is_python_side_utc(self):
        """onupdate 不能再用 func.now()：GETDATE() 随数据库服务器时区（本地东八区 / Docker UTC）。"""
        checked = 0
        for table in Base.metadata.tables.values():
            column = table.c.get("UpdatedAt")
            if column is None or column.onupdate is None:
                continue
            checked += 1
            with self.subTest(table=table.name):
                self.assertTrue(column.onupdate.is_callable)
        self.assertGreater(checked, 20)

    def test_implicit_update_writes_utc_updated_at(self):
        order = AppOrder(Id=1, AccountId=1, OutTradeNo="T1", TotalFee=100, Status="PENDING")
        self.db.add(order)
        self.db.commit()

        before = datetime.utcnow()
        order.Status = "PAID"  # 不显式赋值 UpdatedAt，由 onupdate 补写
        self.db.commit()
        after = datetime.utcnow()

        self.db.refresh(order)
        self.assertRecentUtc(order.UpdatedAt, before, after)

    def test_cancel_pending_proxy_order_writes_utc_updated_at(self):
        start = (china_now() + timedelta(days=3)).replace(hour=15, minute=0, second=0, microsecond=0)
        expires_at = china_now() + timedelta(minutes=30)
        schedule = AppSchedule(Id=10, CounselorId=2, StartTime=start, EndTime=start + timedelta(minutes=50),
                               Status="AVAILABLE", Note="center:FUTIAN")
        order = AppOrder(Id=20, AccountId=1, SlotId=10, OutTradeNo="PROXY20", TotalFee=100, Status="PENDING",
                         Description="proxy:offline;schedule:new", ExpiresAt=expires_at)
        self.db.add_all([schedule, order])
        self.db.commit()

        before = datetime.utcnow()
        with patch("wechat_pay_service.settle_pending_order_before_cancel", return_value="unpaid"):
            outcome = cancel_pending_order(self.db, order)
        after = datetime.utcnow()

        self.assertEqual(outcome, "cancelled")
        self.assertEqual(order.Status, "CANCELLED")
        self.assertRecentUtc(order.UpdatedAt, before, after)
        # 代理单新建的排期被一并取消，同样按 UTC 记录操作时间
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertRecentUtc(schedule.UpdatedAt, before, after)
        # 过期时间仍是北京墙钟（业务比较用），不受影响
        self.assertEqual(order.ExpiresAt, expires_at)

    def test_retire_counselor_cancels_future_schedule_with_utc_updated_at(self):
        start = (china_now() + timedelta(days=2)).replace(hour=10, minute=0, second=0, microsecond=0)
        schedule = AppSchedule(Id=11, CounselorId=2, StartTime=start, EndTime=start + timedelta(minutes=50),
                               Status="AVAILABLE", Note="center:FUTIAN")
        self.db.add(schedule)
        self.db.commit()

        before = datetime.utcnow()
        result = retire_counselor_booking_relationships(self.db, 2)
        after = datetime.utcnow()

        self.assertEqual(result["cancelledFutureSchedules"], 1)
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertRecentUtc(schedule.UpdatedAt, before, after)

    def test_approve_amendment_writes_utc_record_time_and_keeps_beijing_review_time(self):
        record = AppCaseRecord(Id=40, ConsultationId=10, CounselorId=2, Subjective="原记录",
                               Objective="o", Assessment="a", Plan="p")
        amendment = AppCaseRecordAmendmentRequest(Id=50, CaseRecordId=40, ConsultationId=10, CounselorId=2,
                                                  Subjective="新记录", Objective="o2", Assessment="a2",
                                                  Plan="p2", Status="PENDING")
        self.db.add_all([record, amendment])
        self.db.commit()

        before = datetime.utcnow()
        with patch("case_record_amendment_service._update_admin_pending_messages"), \
                patch("case_record_amendment_service.notify_counselor_amendment_result"), \
                patch("case_record_amendment_service.notify_admins_crisis_report_if_needed"):
            approve_amendment(self.db, amendment, admin_id=100)
        after = datetime.utcnow()

        self.assertEqual(record.Subjective, "新记录")
        self.assertRecentUtc(record.UpdatedAt, before, after)
        # 修改申请的审核时间仍按北京墙钟（审核结果消息直接 strftime）
        self.assertRecentUtc(amendment.ReviewedAt - timedelta(hours=8), before, after)


class _ReadFixture(_SqliteTestCase):
    """固定数据：数据库时钟列（CreatedAt）按东八区服务器写入，其余列按各自口径。"""

    def setUp(self):
        super().setUp()
        self.admin = AppAccount(Id=100, Mobile="13800000100", RealName="管理员", ActiveRole="Admin", IsActive=True)
        self.patient = AppAccount(Id=1, Mobile="13800000001", RealName="来访甲", ActiveRole="Patient",
                                  IsActive=True, CreatedAt=datetime(2026, 8, 1, 9, 0))
        self.counselor = AppAccount(Id=2, Mobile="13800000002", RealName="咨询师甲", ActiveRole="Counselor",
                                    IsActive=True)
        self.shell = AppAccount(Id=7, Nickname="用户7", IsActive=True, CreatedAt=datetime(2026, 8, 2, 10, 0))
        start = datetime(2026, 8, 30, 15, 0)
        self.db.add_all([
            self.admin,
            self.patient,
            self.counselor,
            self.shell,
            AppRoleBinding(AccountId=100, RoleType="Admin"),
            AppRoleBinding(AccountId=1, RoleType="Patient"),
            AppRoleBinding(AccountId=2, RoleType="Counselor"),
            AppSchedule(Id=10, CounselorId=2, StartTime=start, EndTime=start + timedelta(minutes=50),
                        Status="BOOKED", Note="center:FUTIAN"),
            AppConsultation(Id=10, OrderId=30, PatientId=1, CounselorId=2, ScheduleId=10, Status="DONE",
                            StartTime=start, EndTime=start + timedelta(minutes=50)),
            AppConsultation(Id=11, PatientId=1, CounselorId=2, Status="DONE",
                            StartTime=datetime(2026, 8, 31, 9, 0), EndTime=datetime(2026, 8, 31, 9, 50)),
            AppConsultation(Id=12, PatientId=1, CounselorId=2, Status="DONE",
                            StartTime=datetime(2026, 9, 1, 8, 0), EndTime=datetime(2026, 9, 1, 8, 50)),
            # 普通订单：CreatedAt 为数据库时钟，PaidAt/UpdatedAt 为 UTC
            AppOrder(Id=30, AccountId=1, SlotId=10, OutTradeNo="T30", TotalFee=100, Status="PAID",
                     CreatedAt=datetime(2026, 8, 28, 11, 0), PaidAt=datetime(2026, 8, 28, 3, 5),
                     UpdatedAt=datetime(2026, 8, 28, 3, 5)),
            # 导入订单：CreatedAt=PaidAt=付费业务时间（北京墙钟）
            AppOrder(Id=31, AccountId=1, OutTradeNo="IMPORT-ABC", TransactionId="IMPORT-2", TotalFee=100,
                     Status="PAID", CreatedAt=datetime(2026, 8, 20, 14, 0), PaidAt=datetime(2026, 8, 20, 14, 0)),
            # 已退款订单：退款时间记在 UpdatedAt（UTC）
            AppOrder(Id=32, AccountId=1, OutTradeNo="T32", TotalFee=200, Status="REFUNDED",
                     CreatedAt=datetime(2026, 8, 28, 12, 0), PaidAt=datetime(2026, 8, 28, 4, 0),
                     UpdatedAt=datetime(2026, 8, 28, 6, 30)),
            # 豁免：提交时间为数据库时钟，审核时间为 UTC
            AppRefundExemption(Id=20, ConsultationId=10, AccountId=1, Amount=100, Reason="临时有事",
                               Status="APPROVED", ReviewedBy=100, CreatedAt=datetime(2026, 8, 28, 10, 0),
                               ReviewedAt=datetime(2026, 8, 28, 2, 20), UpdatedAt=datetime(2026, 8, 28, 2, 20)),
            # 咨询师自己写的记录：UpdatedAt 为 UTC
            AppCaseRecord(Id=40, ConsultationId=10, CounselorId=2, Subjective="记录甲", Objective="o",
                          Assessment="a", Plan="p", CreatedAt=datetime(2026, 8, 30, 16, 0),
                          UpdatedAt=datetime(2026, 8, 30, 8, 30)),
            # 旧版修改申请审核通过：UpdatedAt 与 ReviewedAt 都由 china_now() 写入
            AppCaseRecord(Id=41, ConsultationId=11, CounselorId=2, Subjective="记录乙", Objective="o",
                          Assessment="a", Plan="p", CreatedAt=datetime(2026, 8, 31, 9, 55),
                          UpdatedAt=datetime(2026, 8, 31, 10, 0, 0, 100)),
            AppCaseRecordAmendmentRequest(Id=50, CaseRecordId=41, ConsultationId=11, CounselorId=2,
                                          Subjective="记录乙", Objective="o", Assessment="a", Plan="p",
                                          Status="APPROVED", ReviewedBy=100,
                                          CreatedAt=datetime(2026, 8, 31, 9, 58),
                                          ReviewedAt=datetime(2026, 8, 31, 10, 0, 0, 200)),
            # 从未更新的记录：最近写入时间回退到 CreatedAt（数据库时钟）
            AppCaseRecord(Id=42, ConsultationId=12, CounselorId=2, Subjective="记录丙", Objective="o",
                          Assessment="a", Plan="p", CreatedAt=datetime(2026, 9, 1, 9, 0)),
            # 历史版本：RevisedAt 由 save_case_record_revision 以 utcnow 写入
            AppCaseRecordRevision(Id=60, CaseRecordId=40, ConsultationId=10, CounselorId=2, Subjective="旧版",
                                  RevisedAt=datetime(2026, 8, 30, 8, 30), RevisedBy=2),
            AppLeaveRequest(Id=70, ScheduleId=10, CounselorId=2, Reason="请假", Status="APPROVED",
                            CreatedAt=datetime(2026, 8, 29, 9, 0), UpdatedAt=datetime(2026, 8, 29, 2, 0)),
            AppScheduleCancelLog(Id=80, ScheduleId=10, CounselorId=2, ScreenshotUrl="/uploads/x.png",
                                 CreatedAt=datetime(2026, 8, 29, 11, 0)),
        ])
        self.db.commit()

    def _call(self, db_utc_offset, func, **kwargs):
        with patch("api_time_clock.db_clock_utc_offset", return_value=db_utc_offset):
            result = func(db=self.db, **kwargs)
        # 与 FastAPI 响应一致的 JSON 形态
        return jsonable_encoder(result)

    def _board_endpoints(self):
        router = APIRouter()
        register_admin_board_routes(
            router,
            require_staff_workbench=lambda: self.admin,
            visitor_patient_ids=lambda db: {1},
            counselor_account_ids=lambda db: [2],
        )
        return {route.path: route.endpoint for route in router.routes}

    @staticmethod
    def _by_id(items, key="id"):
        return {item[key]: item for item in items}


class PatientBoardTimezoneTests(_ReadFixture):
    def _detail(self, db_utc_offset):
        endpoint = self._board_endpoints()["/boards/patients/{account_id}"]
        return self._call(db_utc_offset, endpoint, account_id=1, _staff=self.admin)

    def test_patient_board_detail_outputs_beijing_time_for_each_source(self):
        detail = self._detail(BEIJING_DB)

        self.assertEqual(detail["profile"]["createdAt"], "2026-08-01T09:00:00+08:00")
        orders = self._by_id(detail["orders"])
        self.assertEqual(orders[30]["createdAt"], "2026-08-28T11:00:00+08:00")
        self.assertEqual(orders[30]["paidAt"], "2026-08-28T11:05:00+08:00")
        self.assertEqual(orders[30]["updatedAt"], "2026-08-28T11:05:00+08:00")
        # 导入订单按北京墙钟，不能再加 8 小时
        self.assertEqual(orders[31]["createdAt"], "2026-08-20T14:00:00+08:00")
        self.assertEqual(orders[31]["paidAt"], "2026-08-20T14:00:00+08:00")
        self.assertEqual(orders[32]["updatedAt"], "2026-08-28T14:30:00+08:00")

        payments = self._by_id(detail["payments"])
        self.assertEqual(payments[30]["paidAt"], "2026-08-28T11:05:00+08:00")
        self.assertEqual(payments[31]["paidAt"], "2026-08-20T14:00:00+08:00")
        refunds = self._by_id(detail["refunds"])
        self.assertEqual(refunds[32]["updatedAt"], "2026-08-28T14:30:00+08:00")

        exemption = detail["exemptions"][0]
        self.assertEqual(exemption["createdAt"], "2026-08-28T10:00:00+08:00")
        self.assertEqual(exemption["reviewedAt"], "2026-08-28T10:20:00+08:00")

        # 预约起止是北京墙钟业务时间，保持原样（前端按北京时间解释），不被二次偏移
        consultation = self._by_id(detail["consultations"])[10]
        self.assertEqual(consultation["startTime"], "2026-08-30T15:00:00")

    def test_patient_board_detail_with_utc_database_clock(self):
        """Docker 中未设 TZ 的 SQL Server：func.now() 写入的是 UTC，需要 +8。"""
        detail = self._detail(UTC_DB)

        self.assertEqual(detail["profile"]["createdAt"], "2026-08-01T17:00:00+08:00")
        orders = self._by_id(detail["orders"])
        self.assertEqual(orders[30]["createdAt"], "2026-08-28T19:00:00+08:00")
        # UTC 写入的列与导入订单不受数据库时钟影响
        self.assertEqual(orders[30]["paidAt"], "2026-08-28T11:05:00+08:00")
        self.assertEqual(orders[31]["createdAt"], "2026-08-20T14:00:00+08:00")
        self.assertEqual(detail["exemptions"][0]["createdAt"], "2026-08-28T18:00:00+08:00")
        self.assertEqual(detail["exemptions"][0]["reviewedAt"], "2026-08-28T10:20:00+08:00")

    def test_patient_board_list_created_at(self):
        endpoint = self._board_endpoints()["/boards/patients"]
        result = self._call(UTC_DB, endpoint, keyword=None, gender=None, mobile=None, page=1, page_size=20,
                            _staff=self.admin)
        item = self._by_id(result["items"])[1]
        self.assertEqual(item["createdAt"], "2026-08-01T17:00:00+08:00")

    def test_legacy_web_admin_user_board_detail_matches(self):
        detail = self._call(BEIJING_DB, legacy_user_board_detail, account_id=1, _staff=self.admin)

        orders = self._by_id(detail["orders"])
        self.assertEqual(orders[30]["createdAt"], "2026-08-28T11:00:00+08:00")
        self.assertEqual(orders[30]["paidAt"], "2026-08-28T11:05:00+08:00")
        self.assertEqual(orders[31]["paidAt"], "2026-08-20T14:00:00+08:00")
        self.assertEqual(self._by_id(detail["refunds"])[32]["updatedAt"], "2026-08-28T14:30:00+08:00")
        self.assertEqual(detail["exemptions"][0]["reviewedAt"], "2026-08-28T10:20:00+08:00")
        self.assertEqual(detail["profile"]["createdAt"], "2026-08-01T09:00:00+08:00")

    def test_shell_user_created_at(self):
        result = self._call(UTC_DB, list_shell_users, admin=self.admin)
        shell = self._by_id(result["items"])[7]
        self.assertEqual(shell["createdAt"], "2026-08-02T18:00:00+08:00")


class CounselorBoardTimezoneTests(_ReadFixture):
    def _assert_counselor_detail(self, detail):
        records = self._by_id(detail["caseRecords"])
        self.assertEqual(records[40]["createdAt"], "2026-08-30T16:00:00+08:00")
        self.assertEqual(records[40]["updatedAt"], "2026-08-30T16:30:00+08:00")
        # 旧版审核通过写入的北京墙钟不能再 +8
        self.assertTrue(records[41]["updatedAt"].startswith("2026-08-31T10:00:00"))
        self.assertTrue(records[41]["updatedAt"].endswith("+08:00"))
        self.assertIsNone(records[42]["updatedAt"])

        leave = detail["leaveRequests"][0]
        self.assertEqual(leave["createdAt"], "2026-08-29T09:00:00+08:00")
        self.assertEqual(leave["updatedAt"], "2026-08-29T10:00:00+08:00")
        self.assertEqual(detail["scheduleCancelLogs"][0]["createdAt"], "2026-08-29T11:00:00+08:00")
        # 排期起止仍是北京墙钟业务时间
        self.assertEqual(leave["startTime"], "2026-08-30T15:00:00")

    def test_counselor_board_detail(self):
        endpoint = self._board_endpoints()["/boards/counselors/{account_id}"]
        detail = self._call(BEIJING_DB, endpoint, account_id=2, _staff=self.admin)
        self._assert_counselor_detail(detail)

    def test_legacy_web_admin_counselor_board_detail(self):
        detail = self._call(BEIJING_DB, legacy_counselor_board_detail, account_id=2, _staff=self.admin)
        self._assert_counselor_detail(detail)


class CaseRecordTimezoneTests(_ReadFixture):
    def test_admin_consultation_records_record_updated_at(self):
        items = self._call(
            UTC_DB, list_counselor_consultation_records, counselor_id=2, period="all", days=30, _admin=self.admin,
        )
        by_consultation = self._by_id(items, key="consultationId")
        self.assertEqual(by_consultation[10]["recordUpdatedAt"], "2026-08-30T16:30:00+08:00")
        self.assertTrue(by_consultation[11]["recordUpdatedAt"].startswith("2026-08-31T10:00:00"))
        # 没有 UpdatedAt 时回退 CreatedAt，按数据库时钟（此处为 UTC）换算
        self.assertEqual(by_consultation[12]["recordUpdatedAt"], "2026-09-01T17:00:00+08:00")
        self.assertEqual(by_consultation[10]["startTime"], "2026-08-30T15:00:00")

    def test_admin_case_record_detail_and_revisions(self):
        record = self._call(BEIJING_DB, get_admin_case_record, record_id=40, _admin=self.admin)
        self.assertEqual(record["CreatedAt"], "2026-08-30T16:00:00+08:00")
        self.assertEqual(record["UpdatedAt"], "2026-08-30T16:30:00+08:00")

        approved = self._call(BEIJING_DB, get_admin_case_record, record_id=41, _admin=self.admin)
        self.assertTrue(approved["UpdatedAt"].startswith("2026-08-31T10:00:00"))
        self.assertTrue(approved["UpdatedAt"].endswith("+08:00"))

        revisions = self._call(BEIJING_DB, list_admin_case_record_revisions, record_id=40, _admin=self.admin)
        self.assertEqual(revisions[0]["RevisedAt"], "2026-08-30T16:30:00+08:00")

    def test_counselor_case_record_endpoints(self):
        completed = self._call(UTC_DB, list_completed_consultations, counselor=self.counselor)
        by_id = self._by_id(completed, key="Id")
        self.assertEqual(by_id[10]["RecordUpdatedAt"], "2026-08-30T16:30:00+08:00")
        self.assertTrue(by_id[11]["RecordUpdatedAt"].startswith("2026-08-31T10:00:00"))
        self.assertEqual(by_id[12]["RecordUpdatedAt"], "2026-09-01T17:00:00+08:00")

        record = self._call(BEIJING_DB, get_case_record, record_id=40, counselor=self.counselor)
        self.assertEqual(record["CreatedAt"], "2026-08-30T16:00:00+08:00")
        self.assertEqual(record["UpdatedAt"], "2026-08-30T16:30:00+08:00")

        records = self._by_id(self._call(BEIJING_DB, list_case_records, counselor=self.counselor), key="Id")
        self.assertTrue(records[41]["UpdatedAt"].startswith("2026-08-31T10:00:00"))
        self.assertIsNone(records[42]["UpdatedAt"])
        self.assertEqual(records[42]["CreatedAt"], "2026-09-01T09:00:00+08:00")

        revisions = self._call(BEIJING_DB, list_case_record_revisions, record_id=40, counselor=self.counselor)
        self.assertEqual(revisions[0]["RevisedAt"], "2026-08-30T16:30:00+08:00")

    def test_record_approved_after_fix_is_read_as_utc(self):
        """修复后审核通过写入 UTC，与北京墙钟的 ReviewedAt 相差 8 小时，不会被误判为旧数据。"""
        amendment = AppCaseRecordAmendmentRequest(Id=51, CaseRecordId=40, ConsultationId=10, CounselorId=2,
                                                  Subjective="改后", Objective="o", Assessment="a", Plan="p",
                                                  Status="PENDING")
        self.db.add(amendment)
        self.db.commit()
        with patch("case_record_amendment_service._update_admin_pending_messages"), \
                patch("case_record_amendment_service.notify_counselor_amendment_result"), \
                patch("case_record_amendment_service.notify_admins_crisis_report_if_needed"):
            approve_amendment(self.db, amendment, admin_id=100)
        self.db.commit()

        record = self._call(BEIJING_DB, get_admin_case_record, record_id=40, _admin=self.admin)
        expected = (datetime.utcnow() + timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M")
        self.assertTrue(record["UpdatedAt"].endswith("+08:00"))
        self.assertLessEqual(
            abs(datetime.fromisoformat(record["UpdatedAt"][:19]) - datetime.fromisoformat(expected + ":00")),
            timedelta(minutes=2),
        )


if __name__ == "__main__":
    unittest.main()
