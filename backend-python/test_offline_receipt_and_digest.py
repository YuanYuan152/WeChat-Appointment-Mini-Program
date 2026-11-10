import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from message import _merge_pinned_offline_messages, _message_response
from message_digest_service import today_message_digest
from models import (
    AppAccount,
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppCounselorProfile,
    AppLeaveRequest,
    AppMessage,
    AppOrder,
    AppRefundExemption,
    AppRoleBinding,
)
from offline_payment_receipt_service import OfflineReceiptError, confirm_offline_payment_receipt
from staff_message_service import notify_staff_offline_payment_due


class OfflineReceiptAndDigestTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppOrder.__table__,
                AppConsultation.__table__,
                AppMessage.__table__,
                AppCounselorProfile.__table__,
                AppLeaveRequest.__table__,
                AppRefundExemption.__table__,
                AppCaseRecordAmendmentRequest.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_account(self, role: str, name: str) -> AppAccount:
        account = AppAccount(Nickname=name, ActiveRole=role, IsActive=True, IsContractSigned=False)
        self.db.add(account)
        self.db.flush()
        self.db.add(AppRoleBinding(AccountId=account.Id, RoleType=role))
        self.db.flush()
        return account

    def test_digest_uses_operation_day_not_appointment_day(self):
        china_now = datetime(2026, 11, 6, 15, 0)
        patient = self.add_account("Patient", "来访")
        counselor = self.add_account("Counselor", "咨询师")
        self.db.add_all([
            AppOrder(
                AccountId=patient.Id,
                OutTradeNo="paid-today",
                TotalFee=100,
                Status="PAID",
                PaidAt=datetime(2026, 11, 6, 1, 0),
            ),
            AppOrder(
                AccountId=patient.Id,
                OutTradeNo="paid-yesterday",
                TotalFee=100,
                Status="PAID",
                PaidAt=datetime(2026, 11, 5, 15, 0),
            ),
            AppOrder(
                AccountId=patient.Id,
                OutTradeNo="refunded-today",
                TotalFee=100,
                Status="REFUNDED",
                PaidAt=datetime(2026, 11, 6, 2, 0),
            ),
            AppOrder(
                AccountId=patient.Id,
                OutTradeNo="unpaid-today",
                TotalFee=100,
                Status="PENDING",
                PaidAt=datetime(2026, 11, 6, 3, 0),
            ),
            AppConsultation(
                PatientId=patient.Id,
                CounselorId=counselor.Id,
                Status="CANCELLED",
                StartTime=datetime(2026, 12, 1, 10, 0),
                UpdatedAt=datetime(2026, 11, 6, 1, 30),
            ),
            AppConsultation(
                PatientId=patient.Id,
                CounselorId=counselor.Id,
                Status="CANCELLED",
                StartTime=datetime(2026, 11, 6, 10, 0),
                UpdatedAt=datetime(2026, 11, 5, 10, 0),
            ),
            AppLeaveRequest(
                ScheduleId=1,
                CounselorId=counselor.Id,
                Reason="今天已审请假",
                Status="APPROVED",
                CreatedAt=datetime(2026, 11, 6, 9, 0),
            ),
            AppLeaveRequest(
                ScheduleId=3,
                CounselorId=counselor.Id,
                Reason="今天待审请假",
                Status="PENDING",
                CreatedAt=datetime(2026, 11, 6, 9, 30),
            ),
            AppLeaveRequest(
                ScheduleId=2,
                CounselorId=counselor.Id,
                Reason="昨天请假",
                Status="PENDING",
                CreatedAt=datetime(2026, 11, 5, 23, 0),
            ),
            AppRefundExemption(
                ConsultationId=1,
                AccountId=patient.Id,
                Amount=100,
                Reason="今天取消申请",
                Status="PENDING",
                CreatedAt=datetime(2026, 11, 6, 11, 0),
            ),
            AppRefundExemption(
                ConsultationId=2,
                AccountId=patient.Id,
                Amount=100,
                Reason="今天已审取消申请",
                Status="APPROVED",
                CreatedAt=datetime(2026, 11, 6, 11, 20),
            ),
            AppCaseRecordAmendmentRequest(
                CaseRecordId=1,
                ConsultationId=1,
                CounselorId=counselor.Id,
                Subjective="s",
                Objective="o",
                Assessment="a",
                Plan="p",
                Status="PENDING",
                CreatedAt=datetime(2026, 11, 6, 12, 0),
            ),
            AppCaseRecordAmendmentRequest(
                CaseRecordId=2,
                ConsultationId=1,
                CounselorId=counselor.Id,
                Subjective="s",
                Objective="o",
                Assessment="a",
                Plan="p",
                Status="REJECTED",
                CreatedAt=datetime(2026, 11, 6, 12, 30),
            ),
        ])
        self.db.commit()

        digest = today_message_digest(self.db, now=china_now)

        self.assertEqual(digest["cancelledCount"], 1)
        self.assertEqual(digest["newBookingCount"], 2)
        self.assertEqual(digest["leavePendingCount"], 1)
        self.assertEqual(digest["visitorCancelPendingCount"], 1)
        self.assertEqual(digest["recordAmendmentPendingCount"], 1)

    def test_receipt_confirmation_is_shared_and_does_not_follow_read_state(self):
        patient = self.add_account("Patient", "来访")
        counselor = self.add_account("Counselor", "咨询师")
        admin = self.add_account("Admin", "管理员")
        assistant = self.add_account("Assistant", "助理")
        ops = self.add_account("Ops", "主任")
        order = AppOrder(
            AccountId=patient.Id,
            OutTradeNo="OFFLINE1",
            TotalFee=60000,
            Status="PAID",
            ProxyIsOfflinePayment=True,
            ProxyOfflinePaymentOperator="王助理",
            ProxyOfflinePaymentReason="来访已线下付款",
            PaidAt=datetime.utcnow(),
        )
        consultation = AppConsultation(
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            Status="CONFIRMED",
            StartTime=datetime(2026, 11, 8, 10, 0),
            EndTime=datetime(2026, 11, 8, 10, 50),
        )
        self.db.add_all([order, consultation])
        self.db.commit()

        next_id = iter(range(5000, 5100))

        def create_with_id(db, *args, **kwargs):
            from message import create_message

            message = create_message(db, *args, **kwargs)
            message.Id = next(next_id)
            return message

        with patch("staff_message_service.create_message", create_with_id):
            notify_staff_offline_payment_due(self.db, consultation, order)
            notify_staff_offline_payment_due(self.db, consultation, order)
        self.db.commit()

        messages = self.db.query(AppMessage).filter(AppMessage.RelatedType == "OFFLINE_PAYMENT_DUE").all()
        self.assertEqual(sorted(message.AccountId for message in messages), sorted([admin.Id, assistant.Id, ops.Id]))
        self.assertTrue(all(message.Title == "待付款" for message in messages))

        assistant_message = next(message for message in messages if message.AccountId == assistant.Id)
        assistant_message.IsRead = True
        self.db.commit()
        pinned = _message_response(assistant_message, self.db)
        self.assertTrue(pinned["IsPinned"])
        self.assertTrue(pinned["OfflineReceiptPending"])

        with self.assertRaises(OfflineReceiptError) as empty_name:
            confirm_offline_payment_receipt(self.db, assistant, assistant_message, "  ")
        self.assertEqual(empty_name.exception.status_code, 400)

        with self.assertRaises(OfflineReceiptError) as counselor_denied:
            confirm_offline_payment_receipt(self.db, counselor, assistant_message, "咨询师")
        self.assertEqual(counselor_denied.exception.status_code, 403)

        confirm_offline_payment_receipt(self.db, assistant, assistant_message, " 李助理 ")
        self.db.refresh(order)
        self.assertEqual(order.ProxyOfflineReceiptOperator, "李助理")
        self.assertEqual(order.ProxyOfflineReceiptByAccountId, assistant.Id)
        self.assertEqual(order.ProxyOfflineReceiptByRole, "Assistant")
        self.assertIsNotNone(order.ProxyOfflineReceiptConfirmedAt)

        confirm_offline_payment_receipt(self.db, admin, messages[0], "管理员覆盖")
        self.db.refresh(order)
        self.assertEqual(order.ProxyOfflineReceiptOperator, "李助理")

        for message in messages:
            payload = _message_response(message, self.db)
            self.assertFalse(payload["IsPinned"])
            self.assertEqual(payload["OfflineReceiptOperator"], "李助理")

    def test_old_pending_receipt_stays_ahead_of_newer_messages(self):
        staff = self.add_account("Admin", "管理员")
        order = AppOrder(
            AccountId=staff.Id,
            OutTradeNo="OLD-OFFLINE",
            TotalFee=100,
            Status="PAID",
            ProxyIsOfflinePayment=True,
        )
        self.db.add(order)
        self.db.flush()
        old = AppMessage(
            Id=8001,
            AccountId=staff.Id,
            Type="ORDER",
            Title="待付款",
            RelatedType="OFFLINE_PAYMENT_DUE",
            RelatedId=order.Id,
            IsRead=True,
            CreatedAt=datetime.utcnow() - timedelta(days=3),
        )
        newer = [
            AppMessage(
                Id=8100 + index,
                AccountId=staff.Id,
                Type="ORDER",
                Title=f"新消息{index}",
                RelatedType="APPOINTMENT_NEW",
                IsRead=False,
                CreatedAt=datetime.utcnow(),
            )
            for index in range(3)
        ]
        self.db.add_all([old, *newer])
        self.db.commit()

        query = self.db.query(AppMessage).filter(AppMessage.AccountId == staff.Id)
        page = query.order_by(AppMessage.CreatedAt.desc()).limit(2).all()
        merged, _orders = _merge_pinned_offline_messages(query, page, self.db)

        self.assertEqual(merged[0].Id, old.Id)
        self.assertEqual(len(merged), 3)

    def test_cancelled_offline_appointment_is_not_pinned(self):
        staff = self.add_account("Assistant", "助理")
        patient = self.add_account("Patient", "来访")
        counselor = self.add_account("Counselor", "咨询师")
        order = AppOrder(
            AccountId=patient.Id,
            OutTradeNo="CANCELLED-OFFLINE",
            TotalFee=60000,
            Status="CANCELLED",
            ProxyIsOfflinePayment=True,
        )
        self.db.add(order)
        self.db.flush()
        consultation = AppConsultation(
            OrderId=order.Id,
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            Status="CANCELLED",
            StartTime=datetime(2026, 11, 8, 10, 0),
            EndTime=datetime(2026, 11, 8, 10, 50),
        )
        message = AppMessage(
            Id=8201,
            AccountId=staff.Id,
            Type="ORDER",
            Title="待付款",
            RelatedType="OFFLINE_PAYMENT_DUE",
            RelatedId=order.Id,
            IsRead=False,
            CreatedAt=datetime.utcnow() - timedelta(days=1),
        )
        newer = AppMessage(
            Id=8202,
            AccountId=staff.Id,
            Type="ORDER",
            Title="新消息",
            RelatedType="APPOINTMENT_NEW",
            IsRead=False,
            CreatedAt=datetime.utcnow(),
        )
        self.db.add_all([consultation, message, newer])
        self.db.commit()

        payload = _message_response(message, self.db)
        self.assertFalse(payload["IsPinned"])
        self.assertFalse(payload["OfflineReceiptPending"])

        query = self.db.query(AppMessage).filter(AppMessage.AccountId == staff.Id)
        page = query.order_by(AppMessage.CreatedAt.desc()).limit(1).all()
        merged, _orders = _merge_pinned_offline_messages(query, page, self.db)
        self.assertEqual([row.Id for row in merged], [newer.Id])

        with self.assertRaises(OfflineReceiptError) as cancelled:
            confirm_offline_payment_receipt(self.db, staff, message, "李助理")
        self.assertEqual(cancelled.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
