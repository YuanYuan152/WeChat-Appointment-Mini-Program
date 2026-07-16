import json
import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from message_enrich import enrich_message
from models import AppLeaveRequest, AppMessage


class MessageLeaveEnrichTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[AppLeaveRequest.__table__],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_leave(
        self,
        *,
        leave_id: int,
        schedule_id: int,
        status: str = "PENDING",
        reason: str = "身体不适",
        reject_reason: str | None = None,
        reviewed_by: int | None = None,
        reviewed_at: datetime | None = None,
        created_at: datetime | None = None,
    ) -> AppLeaveRequest:
        leave = AppLeaveRequest(
            Id=leave_id,
            ScheduleId=schedule_id,
            CounselorId=21,
            Reason=reason,
            Status=status,
            RejectReason=reject_reason,
            ReviewedBy=reviewed_by,
            ReviewedAt=reviewed_at,
            CreatedAt=created_at or datetime(2026, 7, 16, 9, 0),
        )
        self.db.add(leave)
        self.db.commit()
        return leave

    @staticmethod
    def leave_message(
        *,
        related_id: int,
        detail: dict,
        title: str = "咨询师请假",
    ) -> AppMessage:
        return AppMessage(
            Id=1001,
            AccountId=1,
            Type="CONSULTATION",
            Title=title,
            Content=json.dumps(
                {
                    "summary": "李心怡 · 2026/07/17 09:00 · 浦东预约中心",
                    "detail": detail,
                },
                ensure_ascii=False,
            ),
            RelatedType="COUNSELOR_LEAVE",
            RelatedId=related_id,
            IsRead=False,
            CreatedAt=datetime(2026, 7, 16, 9, 5),
        )

    def test_pending_message_reflects_approved_status_on_next_enrich(self):
        leave = self.add_leave(leave_id=11, schedule_id=501)
        message = self.leave_message(
            related_id=11,
            detail={
                "leaveRequestId": 11,
                "scheduleId": 501,
                "counselorName": "李心怡",
                "startTime": "2026/07/17 09:00",
                "location": "浦东预约中心",
                "leaveReason": "身体不适",
            },
        )

        pending = enrich_message(message, self.db)
        pending_payload = json.loads(pending.Content)
        self.assertEqual(pending.Title, "咨询师请假待审核")
        self.assertEqual(pending_payload["detail"]["status"], "PENDING")
        self.assertIsNone(pending_payload["detail"]["approved"])

        reviewed_at = datetime(2026, 7, 16, 10, 30)
        leave.Status = "APPROVED"
        leave.ReviewedBy = 99
        leave.ReviewedAt = reviewed_at
        self.db.commit()

        approved = enrich_message(message, self.db)
        approved_payload = json.loads(approved.Content)
        self.assertEqual(approved.Title, "咨询师请假已通过")
        self.assertEqual(approved.RelatedType, "COUNSELOR_LEAVE")
        self.assertEqual(approved_payload["detail"]["status"], "APPROVED")
        self.assertTrue(approved_payload["detail"]["approved"])
        self.assertEqual(approved_payload["detail"]["reviewedBy"], 99)
        self.assertEqual(
            approved_payload["detail"]["reviewedAt"],
            reviewed_at.isoformat(),
        )
        self.assertIn("审核已通过", approved_payload["summary"])

    def test_rejected_message_contains_latest_reason(self):
        reviewed_at = datetime(2026, 7, 16, 11, 0)
        self.add_leave(
            leave_id=12,
            schedule_id=502,
            status="REJECTED",
            reject_reason="沟通凭证不完整",
            reviewed_by=98,
            reviewed_at=reviewed_at,
        )
        message = self.leave_message(
            related_id=12,
            detail={
                "leaveRequestId": 12,
                "scheduleId": 502,
                "counselorName": "李心怡",
                "startTime": "2026/07/17 10:00",
                "location": "浦东预约中心",
            },
        )

        enriched = enrich_message(message, self.db)
        payload = json.loads(enriched.Content)

        self.assertEqual(enriched.Title, "咨询师请假未通过")
        self.assertEqual(payload["detail"]["status"], "REJECTED")
        self.assertFalse(payload["detail"]["approved"])
        self.assertEqual(payload["detail"]["rejectReason"], "沟通凭证不完整")
        self.assertIn("沟通凭证不完整", payload["summary"])

    def test_historical_schedule_linked_message_uses_latest_leave_request(self):
        self.add_leave(
            leave_id=31,
            schedule_id=700,
            status="REJECTED",
            reject_reason="较早申请",
            created_at=datetime(2026, 7, 15, 9, 0),
        )
        self.add_leave(
            leave_id=32,
            schedule_id=700,
            status="APPROVED",
            created_at=datetime(2026, 7, 16, 9, 0),
        )
        message = self.leave_message(
            related_id=700,
            detail={
                "scheduleId": 700,
                "counselorName": "李心怡",
                "startTime": "2026/07/17 11:00",
                "location": "浦东预约中心",
            },
        )

        enriched = enrich_message(message, self.db)
        payload = json.loads(enriched.Content)

        self.assertEqual(enriched.Title, "咨询师请假已通过")
        self.assertEqual(payload["detail"]["leaveRequestId"], 32)
        self.assertEqual(payload["detail"]["status"], "APPROVED")

    def test_unresolved_historical_leave_message_is_left_unchanged(self):
        message = self.leave_message(
            related_id=999,
            detail={"scheduleId": 999},
            title="历史请假消息",
        )
        original_content = message.Content

        enriched = enrich_message(message, self.db)

        self.assertEqual(enriched.Title, "历史请假消息")
        self.assertEqual(enriched.Content, original_content)
        self.assertEqual(enriched.RelatedType, "COUNSELOR_LEAVE")

    def test_non_leave_message_is_not_changed(self):
        original_content = json.dumps(
            {"summary": "系统维护通知", "detail": {"status": "PENDING"}},
            ensure_ascii=False,
        )
        message = AppMessage(
            Id=1002,
            AccountId=1,
            Type="SYSTEM",
            Title="系统通知",
            Content=original_content,
            RelatedType="SYSTEM_NOTICE",
            RelatedId=88,
            IsRead=False,
            CreatedAt=datetime(2026, 7, 16, 9, 5),
        )

        enriched = enrich_message(message, self.db)

        self.assertEqual(enriched.Title, "系统通知")
        self.assertEqual(enriched.Content, original_content)
        self.assertEqual(enriched.RelatedType, "SYSTEM_NOTICE")


if __name__ == "__main__":
    unittest.main()
