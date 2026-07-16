import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from admin import StaffRemarkUpdatePayload, update_staff_account_remark
from database import Base
from models import (
    AppAccount,
    AppCaseRecord,
    AppConsultation,
    AppLeaveRequest,
    AppRoleBinding,
    AppSchedule,
    AppScheduleCancelLog,
    AppStaffAccountRemark,
)
from web_admin import (
    counselor_board_detail,
    counselor_board_list,
    require_staff_workbench,
)


class AdminCounselorManagementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppConsultation.__table__,
                AppCaseRecord.__table__,
                AppSchedule.__table__,
                AppLeaveRequest.__table__,
                AppScheduleCancelLog.__table__,
                AppStaffAccountRemark.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

        self.assistant = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="咨询助理甲",
            ActiveRole="Assistant",
            IsActive=True,
        )
        self.counselor = AppAccount(
            Id=2,
            Mobile="13800000002",
            RealName="咨询师甲",
            ActiveRole="Counselor",
            IsActive=True,
        )
        self.db.add_all([self.assistant, self.counselor])
        self.db.add_all(
            [
                AppRoleBinding(AccountId=1, RoleType="Assistant"),
                AppRoleBinding(AccountId=2, RoleType="Counselor"),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_assistant_has_counselor_management_read_access(self):
        self.assertIs(require_staff_workbench(self.assistant, self.db), self.assistant)

        result = counselor_board_list(
            keyword=None,
            page=1,
            page_size=20,
            _staff=self.assistant,
            db=self.db,
        )

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["id"], self.counselor.Id)

    def test_assistant_remark_is_returned_by_list_and_detail(self):
        saved = update_staff_account_remark(
            self.counselor.Id,
            StaffRemarkUpdatePayload(remark="首次沟通需提前确认时间"),
            admin=self.assistant,
            db=self.db,
        )
        self.assertEqual(saved["staffRemark"], "首次沟通需提前确认时间")

        list_result = counselor_board_list(
            keyword=None,
            page=1,
            page_size=20,
            _staff=self.assistant,
            db=self.db,
        )
        detail_result = counselor_board_detail(
            self.counselor.Id,
            _staff=self.assistant,
            db=self.db,
        )

        self.assertEqual(list_result["items"][0]["staffRemark"], "首次沟通需提前确认时间")
        self.assertEqual(detail_result["profile"]["staffRemark"], "首次沟通需提前确认时间")


if __name__ == "__main__":
    unittest.main()
