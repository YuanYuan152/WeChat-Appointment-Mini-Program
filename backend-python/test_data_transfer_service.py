import unittest
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook, load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from data_transfer_service import (
    KIND_COLUMNS,
    ORDER_STATUSES,
    export_bytes,
    import_workbook,
    template_bytes,
)
from database import Base
from models import (
    AppAccount,
    AppCaseRecord,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
    AppStaffAccountRemark,
)


TABLES = [
    AppAccount.__table__,
    AppRoleBinding.__table__,
    AppCounselorProfile.__table__,
    AppStaffAccountRemark.__table__,
    AppOrder.__table__,
    AppSchedule.__table__,
    AppConsultation.__table__,
    AppCaseRecord.__table__,
]


def workbook_bytes(kind, rows, *, second_sheet_rows=None):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "数据一"
    headers = [column.header for column in KIND_COLUMNS[kind]]
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    if second_sheet_rows is not None:
        second = workbook.create_sheet("数据二")
        second.append(headers)
        for row in second_sheet_rows:
            second.append(row)
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


class DataTransferServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine, tables=TABLES)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.db.add(AppAccount(Id=99, Mobile="13800000099", ActiveRole="Admin"))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_role_account(self, account_id, mobile, role, name):
        account = AppAccount(
            Id=account_id,
            Mobile=mobile,
            RealName=name,
            Nickname=name,
            ActiveRole=role,
            IsActive=True,
        )
        self.db.add(account)
        self.db.add(AppRoleBinding(AccountId=account_id, RoleType=role))
        self.db.flush()
        return account

    def test_templates_use_the_shared_column_definitions(self):
        for kind, columns in KIND_COLUMNS.items():
            workbook = load_workbook(BytesIO(template_bytes(kind)))
            headers = [cell.value for cell in workbook.active[1]]
            self.assertEqual(headers, [column.header for column in columns])

    def test_validation_collects_errors_from_every_sheet_without_writes(self):
        content = workbook_bytes(
            "visitors",
            [["123", "", "", "", "", "", "未知来源", ""]],
            second_sheet_rows=[["", "", "", "", "", "", "", "仅备注"]],
        )
        result = import_workbook("visitors", content, self.db, 99)

        self.assertEqual(result["importedCount"], 0)
        self.assertEqual(result["totalRows"], 2)
        self.assertGreaterEqual(len(result["errors"]), 4)
        self.assertEqual(
            self.db.query(AppRoleBinding).filter(AppRoleBinding.RoleType == "Patient").count(),
            0,
        )

    def test_visitor_and_counselor_import_upsert_profiles_prices_and_remarks(self):
        visitor_result = import_workbook(
            "visitors",
            workbook_bytes(
                "visitors",
                [[
                    "13800000001",
                    "来访甲",
                    "小甲",
                    "已签约",
                    "",
                    "",
                    "小程序注册",
                    "来访备注",
                ]],
            ),
            self.db,
            99,
        )
        counselor_result = import_workbook(
            "counselors",
            workbook_bytes(
                "counselors",
                [["13800000002", "咨询师甲", "专业咨询师", 688.5, "咨询师备注"]],
            ),
            self.db,
            99,
        )

        self.assertEqual(visitor_result["importedCount"], 1)
        self.assertEqual(counselor_result["importedCount"], 1)
        visitor = self.db.query(AppAccount).filter(AppAccount.Mobile == "13800000001").one()
        counselor = self.db.query(AppAccount).filter(AppAccount.Mobile == "13800000002").one()
        profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == counselor.Id)
            .one()
        )
        self.assertTrue(visitor.IsContractSigned)
        self.assertEqual(visitor.PatientSource, "MINI_PROGRAM")
        self.assertEqual(profile.Billing, 68850)
        self.assertEqual(
            self.db.query(AppStaffAccountRemark)
            .filter(AppStaffAccountRemark.AccountId == visitor.Id)
            .one()
            .Remark,
            "来访备注",
        )

    def test_order_import_creates_single_sixty_minute_transaction_graph(self):
        patient = self.add_role_account(1, "13800000001", "Patient", "来访甲")
        counselor = self.add_role_account(2, "13800000002", "Counselor", "咨询师甲")
        self.db.add(
            AppCounselorProfile(
                AccountId=counselor.Id,
                Name="咨询师甲",
                CounselorType="PROFESSIONAL",
                Billing=70000,
                IsActive=True,
            )
        )
        self.db.commit()

        result = import_workbook(
            "orders",
            workbook_bytes(
                "orders",
                [[
                    "ORDER-001",
                    patient.Mobile,
                    "小甲",
                    counselor.Mobile,
                    "咨询师甲",
                    ORDER_STATUSES[2],
                    datetime(2026, 8, 12, 14, 0),
                    "视频",
                    "线上",
                    "主观",
                    "",
                    "",
                    "",
                    "",
                ]],
            ),
            self.db,
            99,
        )

        self.assertEqual(result["errors"], [])
        self.assertEqual(result["importedCount"], 1)
        order = self.db.query(AppOrder).one()
        schedule = self.db.query(AppSchedule).one()
        consultation = self.db.query(AppConsultation).one()
        record = self.db.query(AppCaseRecord).one()
        self.assertEqual(order.TotalFee, 70000)
        self.assertEqual(schedule.EndTime - schedule.StartTime, consultation.EndTime - consultation.StartTime)
        self.assertEqual(consultation.EndTime - consultation.StartTime, datetime(2026, 8, 12, 15, 0) - datetime(2026, 8, 12, 14, 0))
        self.assertEqual(consultation.Status, "DONE")
        self.assertEqual(record.Subjective, "主观")

    def test_order_without_code_is_idempotent_and_risk_text_alone_is_not_a_record(self):
        patient = self.add_role_account(1, "13800000001", "Patient", "来访甲")
        counselor = self.add_role_account(2, "13800000002", "Counselor", "咨询师甲")
        self.db.add(
            AppCounselorProfile(
                AccountId=counselor.Id,
                Name="咨询师甲",
                CounselorType="PROFESSIONAL",
                Billing=70000,
                IsActive=True,
            )
        )
        self.db.commit()
        base_row = [
            "",
            patient.Mobile,
            "小甲",
            counselor.Mobile,
            "咨询师甲",
            ORDER_STATUSES[0],
            datetime(2026, 8, 12, 14, 0),
            "视频",
            "线上",
            "",
            "",
            "",
            "",
            "",
        ]

        first = import_workbook(
            "orders", workbook_bytes("orders", [base_row]), self.db, 99
        )
        second = import_workbook(
            "orders", workbook_bytes("orders", [base_row]), self.db, 99
        )

        self.assertEqual(first["importedCount"], 1)
        self.assertEqual(second["importedCount"], 1)
        self.assertEqual(self.db.query(AppOrder).count(), 1)
        self.assertEqual(self.db.query(AppConsultation).count(), 1)
        self.assertEqual(self.db.query(AppSchedule).count(), 1)

        risk_only_row = list(base_row)
        risk_only_row[5] = ORDER_STATUSES[2]
        risk_only_row[6] = datetime(2026, 8, 13, 14, 0)
        risk_only_row[13] = "普通文本"
        invalid = import_workbook(
            "orders", workbook_bytes("orders", [risk_only_row]), self.db, 99
        )
        self.assertEqual(invalid["importedCount"], 0)
        self.assertTrue(
            any("主观、客观、评估或计划" in error["message"] for error in invalid["errors"])
        )
        self.assertEqual(self.db.query(AppOrder).count(), 1)

    def test_order_export_filters_inclusive_dates_and_derives_status(self):
        patient = self.add_role_account(1, "13800000001", "Patient", "来访甲")
        counselor = self.add_role_account(2, "13800000002", "Counselor", "咨询师甲")
        self.db.add(
            AppCounselorProfile(
                AccountId=counselor.Id,
                Name="咨询师甲",
                CounselorType="PROFESSIONAL",
                Billing=60000,
                IsActive=True,
            )
        )
        order = AppOrder(
            Id=1,
            AccountId=patient.Id,
            OutTradeNo="ORDER-EXPORT",
            TotalFee=60000,
            Status="PAID",
        )
        self.db.add(order)
        self.db.add(
            AppConsultation(
                Id=1,
                OrderId=1,
                PatientId=patient.Id,
                CounselorId=counselor.Id,
                Status="DONE",
                StartTime=datetime(2026, 8, 12, 23, 59),
                EndTime=datetime(2026, 8, 13, 0, 59),
                Note="center:video",
            )
        )
        self.db.add(
            AppConsultation(
                Id=2,
                PatientId=patient.Id,
                CounselorId=counselor.Id,
                Status="PENDING",
                StartTime=datetime(2026, 8, 12, 10, 0),
                EndTime=datetime(2026, 8, 12, 11, 0),
                Note="center:yangpu",
            )
        )
        self.db.add(
            AppConsultation(
                Id=3,
                PatientId=patient.Id,
                CounselorId=counselor.Id,
                Status="CANCELLED",
                StartTime=datetime(2026, 8, 12, 12, 0),
                EndTime=datetime(2026, 8, 12, 13, 0),
                Note="center:yangpu",
            )
        )
        self.db.commit()

        workbook = load_workbook(
            BytesIO(
                export_bytes(
                    "orders",
                    self.db,
                    start_date=date(2026, 8, 12),
                    end_date=date(2026, 8, 12),
                )
            ),
            data_only=True,
        )
        values = list(workbook.active.values)
        self.assertEqual(len(values), 3)
        self.assertEqual(values[1][5], ORDER_STATUSES[0])
        self.assertEqual(values[2][0], "ORDER-EXPORT")
        self.assertEqual(values[2][5], ORDER_STATUSES[1])


if __name__ == "__main__":
    unittest.main()
