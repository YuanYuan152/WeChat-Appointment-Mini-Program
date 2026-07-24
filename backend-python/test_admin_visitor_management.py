import unittest
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import (
    AppAccount,
    AppConsultation,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
    AppStaffAccountRemark,
)
from web_admin import _visitor_account_ids, user_board_detail, user_board_list


class AdminVisitorManagementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppOrder.__table__,
                AppConsultation.__table__,
                AppRefundExemption.__table__,
                AppStaffAccountRemark.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

        self.admin = AppAccount(
            Id=100,
            Mobile="13800000100",
            RealName="管理员",
            ActiveRole="Admin",
            IsActive=True,
        )
        self.patient = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="来访甲",
            ActiveRole="Patient",
            IsActive=True,
        )
        self.counselor = AppAccount(
            Id=2,
            Mobile="13800000002",
            RealName="咨询师甲",
            ActiveRole="Counselor",
            IsActive=True,
        )
        self.assistant = AppAccount(
            Id=3,
            Mobile="13800000003",
            RealName="咨询助理甲",
            ActiveRole="Assistant",
            IsActive=True,
        )
        self.legacy_patient = AppAccount(
            Id=4,
            Mobile="13800000004",
            RealName="历史来访甲",
            IsActive=True,
        )
        self.db.add_all(
            [self.admin, self.patient, self.counselor, self.assistant, self.legacy_patient]
        )
        self.db.add_all(
            [
                AppRoleBinding(AccountId=100, RoleType="Admin"),
                AppRoleBinding(AccountId=1, RoleType="Patient"),
                # 即使工作人员同时带有 Patient 角色，也不能混入来访管理。
                AppRoleBinding(AccountId=2, RoleType="Counselor"),
                AppRoleBinding(AccountId=2, RoleType="Patient"),
                AppRoleBinding(AccountId=3, RoleType="Assistant"),
                AppRoleBinding(AccountId=3, RoleType="Patient"),
            ]
        )
        self.db.add(
            AppConsultation(
                Id=1,
                PatientId=4,
                CounselorId=2,
                Status="DONE",
                StartTime=datetime(2026, 1, 1, 9, 0),
                EndTime=datetime(2026, 1, 1, 10, 0),
            )
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_visitor_ids_include_patient_and_legacy_consultation_only(self):
        self.assertEqual(_visitor_account_ids(self.db), {1, 4})

    def test_admin_list_still_excludes_counselors_and_staff(self):
        result = user_board_list(
            keyword=None,
            gender=None,
            mobile=None,
            page=1,
            page_size=20,
            _staff=self.admin,
            db=self.db,
        )

        self.assertEqual(result["total"], 2)
        self.assertEqual({item["id"] for item in result["items"]}, {1, 4})
        self.assertTrue(all(item["isVisitor"] for item in result["items"]))

    def test_admin_cannot_open_counselor_through_visitor_detail_endpoint(self):
        with self.assertRaises(HTTPException) as raised:
            user_board_detail(2, _staff=self.admin, db=self.db)

        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.detail, "来访者不存在")


if __name__ == "__main__":
    unittest.main()
