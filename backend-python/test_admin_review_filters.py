import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from admin import list_leave_requests, list_refund_exemptions
from database import Base
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppLeaveRequest,
    AppRefundExemption,
    AppSchedule,
    AppScheduleCancelLog,
)


class AdminReviewFilterTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppConsultation.__table__,
                AppCounselorProfile.__table__,
                AppLeaveRequest.__table__,
                AppRefundExemption.__table__,
                AppSchedule.__table__,
                AppScheduleCancelLog.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

        self.admin = AppAccount(
            Id=100,
            RealName="管理员",
            Mobile="13800000100",
            ActiveRole="Admin",
            IsActive=True,
        )
        patient_match = AppAccount(
            Id=1,
            RealName="王小明",
            Mobile="13800000001",
            ActiveRole="Patient",
            IsActive=True,
        )
        patient_other = AppAccount(
            Id=2,
            Nickname="周女士",
            Mobile="13800000002",
            ActiveRole="Patient",
            IsActive=True,
        )
        counselor_match = AppAccount(
            Id=10,
            RealName="咨询师账号甲",
            Mobile="13900000010",
            ActiveRole="Counselor",
            IsActive=True,
        )
        counselor_other = AppAccount(
            Id=20,
            RealName="张明远",
            Mobile="13900000020",
            ActiveRole="Counselor",
            IsActive=True,
        )
        self.db.add_all(
            [self.admin, patient_match, patient_other, counselor_match, counselor_other]
        )
        self.db.add_all(
            [
                AppCounselorProfile(
                    AccountId=10,
                    Name="李心怡",
                    Billing=60_000,
                    FaceBilling=30_000,
                    IsActive=True,
                ),
                AppCounselorProfile(
                    AccountId=20,
                    Name="张明远",
                    Billing=60_000,
                    FaceBilling=30_000,
                    IsActive=True,
                ),
                AppConsultation(
                    Id=101,
                    PatientId=1,
                    CounselorId=10,
                    Status="DONE",
                    StartTime=datetime(2026, 7, 1, 9, 0),
                ),
                AppConsultation(
                    Id=102,
                    PatientId=2,
                    CounselorId=20,
                    Status="DONE",
                    StartTime=datetime(2026, 7, 2, 9, 0),
                ),
                AppRefundExemption(
                    Id=1,
                    ConsultationId=101,
                    AccountId=1,
                    Amount=60_000,
                    Reason="无法前来",
                    Status="PENDING",
                    CreatedAt=datetime(2026, 7, 1, 8, 0),
                ),
                AppRefundExemption(
                    Id=2,
                    ConsultationId=102,
                    AccountId=2,
                    Amount=60_000,
                    Reason="临时有事",
                    Status="PENDING",
                    CreatedAt=datetime(2026, 7, 2, 8, 0),
                ),
                AppSchedule(
                    Id=201,
                    CounselorId=10,
                    StartTime=datetime(2026, 7, 3, 9, 0),
                    EndTime=datetime(2026, 7, 3, 10, 0),
                    Status="BOOKED",
                ),
                AppSchedule(
                    Id=202,
                    CounselorId=20,
                    StartTime=datetime(2026, 7, 4, 9, 0),
                    EndTime=datetime(2026, 7, 4, 10, 0),
                    Status="BOOKED",
                ),
                AppLeaveRequest(
                    Id=1,
                    ScheduleId=201,
                    CounselorId=10,
                    Reason="身体不适",
                    Status="PENDING",
                    CreatedAt=datetime(2026, 7, 1, 8, 0),
                ),
                AppLeaveRequest(
                    Id=2,
                    ScheduleId=202,
                    CounselorId=20,
                    Reason="临时有事",
                    Status="PENDING",
                    CreatedAt=datetime(2026, 7, 2, 8, 0),
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_refund_exemption_filters_name_and_mobile_before_pagination(self):
        by_name = list_refund_exemptions(
            status="ALL",
            keyword="王小",
            offset=0,
            limit=1,
            _staff=self.admin,
            db=self.db,
        )
        by_mobile = list_refund_exemptions(
            status="ALL",
            keyword="00000001",
            offset=0,
            limit=1,
            _staff=self.admin,
            db=self.db,
        )

        self.assertEqual([item.id for item in by_name], [1])
        self.assertEqual([item.id for item in by_mobile], [1])

    def test_leave_request_filters_profile_name_and_mobile_before_pagination(self):
        by_name = list_leave_requests(
            status="ALL",
            keyword="李心",
            offset=0,
            limit=1,
            _staff=self.admin,
            db=self.db,
        )
        by_mobile = list_leave_requests(
            status="ALL",
            keyword="00000010",
            offset=0,
            limit=1,
            _staff=self.admin,
            db=self.db,
        )

        self.assertEqual([item["id"] for item in by_name], [1])
        self.assertEqual([item["id"] for item in by_mobile], [1])


if __name__ == "__main__":
    unittest.main()
