import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from case_record_service import (
    encode_risk_assessment,
    notify_admins_crisis_report_if_needed,
)
from database import Base
from models import (
    AppAccount,
    AppCaseRecord,
    AppConsultation,
    AppCounselorProfile,
)


class CaseRecordRiskNotificationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_risky_case_record_notifies_staff_with_counselor_profile_name(self):
        counselor = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="咨询师账号名",
            ActiveRole="Counselor",
            IsActive=True,
        )
        patient = AppAccount(
            Id=2,
            Mobile="13800000002",
            RealName="风险来访者",
            ActiveRole="Patient",
            IsActive=True,
        )
        self.db.add_all(
            [
                counselor,
                patient,
                AppCounselorProfile(
                    AccountId=counselor.Id,
                    Name="咨询师档案名",
                    Billing=60_000,
                    FaceBilling=30_000,
                    IsActive=True,
                ),
            ]
        )
        consultation = AppConsultation(
            Id=10,
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            Status="DONE",
        )
        self.db.add(consultation)
        record = AppCaseRecord(
            Id=20,
            ConsultationId=consultation.Id,
            CounselorId=counselor.Id,
            RiskAssessment=encode_risk_assessment(
                {
                    "items": {
                        "support_system": {"choice": "B", "note": ""},
                    }
                }
            ),
        )
        self.db.add(record)
        self.db.flush()

        with patch(
            "staff_message_service.notify_staff_workbench_inbox"
        ) as notify_staff:
            notify_admins_crisis_report_if_needed(
                self.db,
                record,
                counselor_id=counselor.Id,
            )

        notify_staff.assert_called_once()
        call = notify_staff.call_args.kwargs
        self.assertEqual(call["title"], "个案风险需上报")
        self.assertEqual(call["related_type"], "CASE_RECORD_CRISIS_REPORT")
        self.assertEqual(call["related_id"], record.Id)
        self.assertIn("咨询师档案名", call["content"])


if __name__ == "__main__":
    unittest.main()
