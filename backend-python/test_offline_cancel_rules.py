import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app_time import china_now
from consultation_cancel import (
    cancel_consultation_for_visitor,
    order_is_confirm_only,
    order_is_offline_payment,
    visitor_must_apply_to_cancel,
)
from database import Base
from models import AppConsultation, AppOrder, AppRefundExemption, AppRemindTask, AppSchedule
from refund_exemption_service import validate_exemption_submission


def _consultation(*, start: datetime, status: str = "CONFIRMED"):
    return SimpleNamespace(PatientId=7, Status=status, StartTime=start)


class OfflineCancelRuleTests(unittest.TestCase):
    def test_offline_order_detected_by_flag_or_transaction(self):
        self.assertTrue(order_is_offline_payment(SimpleNamespace(ProxyIsOfflinePayment=True, TransactionId="WX1")))
        self.assertTrue(order_is_offline_payment(SimpleNamespace(ProxyIsOfflinePayment=False, TransactionId="OFFLINE_abc")))
        self.assertFalse(order_is_offline_payment(SimpleNamespace(ProxyIsOfflinePayment=False, TransactionId="WX1")))
        self.assertFalse(order_is_offline_payment(None))
        free = SimpleNamespace(ProxyIsOfflinePayment=False, ProxyIsFreeExperience=True, TotalFee=0, TransactionId=None)
        priced = SimpleNamespace(ProxyIsOfflinePayment=False, ProxyIsFreeExperience=False, TotalFee=100, TransactionId="WX1")
        self.assertTrue(order_is_confirm_only(free))
        self.assertTrue(order_is_confirm_only(SimpleNamespace(ProxyIsOfflinePayment=True, ProxyIsFreeExperience=False, TotalFee=100, TransactionId="WX1")))
        self.assertFalse(order_is_confirm_only(priced))

    def test_only_within_24h_must_apply(self):
        soon = china_now() + timedelta(hours=2)
        later = china_now() + timedelta(hours=48)
        offline = SimpleNamespace(ProxyIsOfflinePayment=True, TransactionId="OFFLINE_1")
        online = SimpleNamespace(ProxyIsOfflinePayment=False, TransactionId="WX1")
        self.assertFalse(visitor_must_apply_to_cancel(later, offline))
        self.assertTrue(visitor_must_apply_to_cancel(soon, offline))
        self.assertTrue(visitor_must_apply_to_cancel(soon, online))
        self.assertFalse(visitor_must_apply_to_cancel(later, online))

    def test_offline_within_24h_allows_zero_amount(self):
        soon = china_now() + timedelta(hours=2)
        validate_exemption_submission(
            _consultation(start=soon),
            patient_id=7,
            amount=0,
            reason="临时有事",
            screenshot_url="/static/uploads/proof.png",
            pending=None,
            offline=True,
        )

    def test_offline_beyond_24h_cancels_directly_without_application(self):
        later = china_now() + timedelta(hours=48)
        with self.assertRaisesRegex(ValueError, "直接取消预约"):
            validate_exemption_submission(
                _consultation(start=later),
                patient_id=7,
                amount=0,
                reason="临时有事",
                screenshot_url="/static/uploads/proof.png",
                pending=None,
                offline=True,
            )

    def test_online_beyond_24h_cannot_apply(self):
        later = china_now() + timedelta(hours=48)
        with self.assertRaisesRegex(ValueError, "超过24小时"):
            validate_exemption_submission(
                _consultation(start=later),
                patient_id=7,
                amount=10000,
                reason="临时有事",
                screenshot_url="/static/uploads/proof.png",
                pending=None,
                offline=False,
            )


class VisitorCancelScheduleReleaseTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppOrder.__table__,
                AppSchedule.__table__,
                AppConsultation.__table__,
                AppRemindTask.__table__,
                AppRefundExemption.__table__,
            ],
        )
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.db.close()

    def _cancel_booked(self, *, description: str):
        start = china_now() + timedelta(days=3)
        schedule = AppSchedule(
            CounselorId=10,
            StartTime=start,
            EndTime=start + timedelta(minutes=50),
            Status="BOOKED",
            Note="center:yangpu;room:A",
        )
        self.db.add(schedule)
        self.db.flush()
        order = AppOrder(
            AccountId=7,
            SlotId=schedule.Id,
            OutTradeNo=f"PROXY-{schedule.Id}",
            TotalFee=60000,
            Status="PAID",
            Description=description,
            ProxyIsOfflinePayment=True,
        )
        self.db.add(order)
        self.db.flush()
        consultation = AppConsultation(
            OrderId=order.Id,
            PatientId=7,
            CounselorId=10,
            ScheduleId=schedule.Id,
            Status="CONFIRMED",
            StartTime=start,
            EndTime=start + timedelta(minutes=50),
        )
        self.db.add(consultation)
        self.db.commit()
        cancel_consultation_for_visitor(self.db, consultation, patient_id=7)
        self.db.commit()
        return self.db.query(AppSchedule).filter(AppSchedule.Id == schedule.Id).one()

    def test_pushed_new_slot_is_not_returned_to_counselor_schedule(self):
        schedule = self._cancel_booked(description="proxy:3|center:yangpu|schedule:new")
        self.assertEqual(schedule.Status, "CANCELLED")

    def test_free_experience_cancel_is_cancelled_not_refunded(self):
        start = china_now() + timedelta(days=3)
        schedule = AppSchedule(
            CounselorId=10,
            StartTime=start,
            EndTime=start + timedelta(minutes=50),
            Status="BOOKED",
            Note="center:yangpu",
        )
        self.db.add(schedule)
        self.db.flush()
        order = AppOrder(
            AccountId=7,
            SlotId=schedule.Id,
            OutTradeNo="FREE-EXPERIENCE",
            TotalFee=0,
            Status="PAID",
            Description="proxy:3|center:yangpu|schedule:existing",
            ProxyIsFreeExperience=True,
            TransactionId="FREE_FREE-EXPERIENCE",
        )
        self.db.add(order)
        self.db.flush()
        consultation = AppConsultation(
            OrderId=order.Id,
            PatientId=7,
            CounselorId=10,
            ScheduleId=schedule.Id,
            Status="CONFIRMED",
            StartTime=start,
            EndTime=start + timedelta(minutes=50),
        )
        self.db.add(consultation)
        self.db.commit()
        refunded, message = cancel_consultation_for_visitor(self.db, consultation, patient_id=7)
        self.db.commit()
        self.db.refresh(order)
        self.assertFalse(refunded)
        self.assertEqual(message, "预约已取消")
        self.assertEqual(order.Status, "CANCELLED")

    def test_existing_counselor_slot_returns_to_schedule(self):
        schedule = self._cancel_booked(description="proxy:3|center:yangpu|schedule:existing")
        self.assertEqual(schedule.Status, "AVAILABLE")


if __name__ == "__main__":
    unittest.main()
