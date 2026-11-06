import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from app_time import china_now
from consultation_cancel import (
    order_is_offline_payment,
    visitor_must_apply_to_cancel,
)
from refund_exemption_service import validate_exemption_submission


def _consultation(*, start: datetime, status: str = "CONFIRMED"):
    return SimpleNamespace(PatientId=7, Status=status, StartTime=start)


class OfflineCancelRuleTests(unittest.TestCase):
    def test_offline_order_detected_by_flag_or_transaction(self):
        self.assertTrue(order_is_offline_payment(SimpleNamespace(ProxyIsOfflinePayment=True, TransactionId="WX1")))
        self.assertTrue(order_is_offline_payment(SimpleNamespace(ProxyIsOfflinePayment=False, TransactionId="OFFLINE_abc")))
        self.assertFalse(order_is_offline_payment(SimpleNamespace(ProxyIsOfflinePayment=False, TransactionId="WX1")))
        self.assertFalse(order_is_offline_payment(None))

    def test_offline_and_within_24h_must_apply(self):
        soon = china_now() + timedelta(hours=2)
        later = china_now() + timedelta(hours=48)
        offline = SimpleNamespace(ProxyIsOfflinePayment=True, TransactionId="OFFLINE_1")
        online = SimpleNamespace(ProxyIsOfflinePayment=False, TransactionId="WX1")
        self.assertTrue(visitor_must_apply_to_cancel(later, offline))
        self.assertTrue(visitor_must_apply_to_cancel(soon, offline))
        self.assertTrue(visitor_must_apply_to_cancel(soon, online))
        self.assertFalse(visitor_must_apply_to_cancel(later, online))

    def test_offline_application_allows_zero_amount_even_beyond_24h(self):
        later = china_now() + timedelta(hours=48)
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


if __name__ == "__main__":
    unittest.main()
