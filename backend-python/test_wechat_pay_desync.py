import asyncio
import json
import threading
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app_time import china_now
from database import Base
from models import AppOrder, AppSchedule
from payment import payment_callback
from proxy_booking_service import _cancel_pending_proxy_order, expire_pending_proxy_orders
from wechat_pay_metrics import reset as reset_pay_metrics
from wechat_pay_metrics import snapshot as pay_metrics
from wechat_pay_service import reconcile_wechat_paid_desync
from wechat_pay_v3 import WeChatPayV3Client, WeChatPayV3Error


class _BadKey:
    def verify(self, *_args, **_kwargs):
        raise AssertionError("mismatched serial must not be verified with the configured public key")


def _client(public_key_id="PUB_KEY_ID_expected"):
    client = WeChatPayV3Client.__new__(WeChatPayV3Client)
    client.creds = SimpleNamespace(
        wechat_pay_public_key_id=public_key_id,
        api_v3_key="k" * 32,
    )
    client._public_key = _BadKey()
    client._platform_certs = {}
    client._platform_certs_at = 0.0
    client._cert_lock = threading.Lock()
    client.last_verify_reason = "ok"
    client.verify_failure_counted = False
    return client


class _TradeClient:
    def __init__(self, states, *, close_paid=False, refund_error=False):
        self.states = list(states)
        self.close_paid = close_paid
        self.refund_error = refund_error
        self.queries = 0
        self.closes = 0
        self.refunds = 0

    def query_by_out_trade_no(self, out_trade_no):
        self.queries += 1
        state = self.states.pop(0) if self.states else "SUCCESS"
        payload = {"trade_state": state, "amount": {"total": 100}}
        if state == "SUCCESS":
            payload["transaction_id"] = "WX4200DESYNC"
        return payload

    def close_order(self, out_trade_no):
        self.closes += 1
        if self.close_paid:
            raise WeChatPayV3Error(
                "该订单已支付",
                status_code=400,
                body='{"code":"ORDERPAID","message":"该订单已支付"}',
            )

    def refund(self, **_kwargs):
        self.refunds += 1
        if self.refund_error:
            raise WeChatPayV3Error("退款失败", status_code=500, body='{"code":"SYSTEM_ERROR"}')
        return {"status": "PROCESSING"}

    def query_refund(self, out_refund_no):
        if self.refund_error:
            raise WeChatPayV3Error("退款单不存在", status_code=404, body='{"code":"RESOURCE_NOT_EXISTS"}')
        return {"status": "PROCESSING"}


class SignatureVerifyTests(unittest.TestCase):
    def setUp(self):
        reset_pay_metrics()

    def test_serial_mismatch_fails_without_using_configured_key(self):
        client = _client()

        def request(*_args, **_kwargs):
            raise AssertionError("serial mismatch must not continue into certificate download or RSA verify")

        client.request = request
        with self.assertLogs("wechat_pay_v3", level="WARNING") as logs:
            ok = client.verify_notification_signature(
                timestamp="1710000000",
                nonce="nonce",
                body="{}",
                signature="abc",
                serial="PUB_KEY_ID_other",
            )
        self.assertFalse(ok)
        self.assertEqual(client.last_verify_reason, "serial_mismatch")
        text = "\n".join(logs.output)
        self.assertIn("callback_401", text)
        self.assertIn("PUB_KEY_ID_other", text)
        self.assertIn("serial_mismatch", text)
        self.assertIn("signtest=false", text)
        metrics = pay_metrics()
        self.assertEqual(metrics["callback_401"], 1)
        self.assertEqual(metrics["signtest"], 0)

    def test_signtest_is_counted_apart_from_verify_failure(self):
        client = _client()
        ok = client.verify_notification_signature(
            timestamp="1",
            nonce="n",
            body="{}",
            signature="WECHATPAY/SIGNTEST/abc",
            serial="PUB_KEY_ID_expected",
        )
        self.assertFalse(ok)
        self.assertEqual(client.last_verify_reason, "signtest")
        metrics = pay_metrics()
        self.assertEqual(metrics["signtest"], 1)
        self.assertEqual(metrics["callback_401"], 0)

    def test_platform_serial_does_not_fall_back_to_public_key(self):
        client = _client()
        seen = {}

        def request(method, path, **_kwargs):
            seen["path"] = path
            return 200, {"data": []}

        client.request = request
        ok = client.verify_notification_signature(
            timestamp="1710000000",
            nonce="nonce",
            body="{}",
            signature="abc",
            serial="ABCDEF0123456789",
        )
        self.assertFalse(ok)
        self.assertEqual(seen["path"], "/v3/certificates")
        self.assertEqual(client.last_verify_reason, "platform_cert_not_found")
        self.assertEqual(pay_metrics()["callback_401"], 1)


class PaidDesyncTests(unittest.TestCase):
    def setUp(self):
        reset_pay_metrics()
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[AppOrder.__table__, AppSchedule.__table__],
        )
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _order(self, *, status="PENDING", out_trade_no="PROXY17941071628194"):
        schedule = AppSchedule(
            CounselorId=1,
            StartTime=china_now() + timedelta(days=3),
            EndTime=china_now() + timedelta(days=3, hours=1),
            Status="AVAILABLE",
            Note="center:yangpu",
        )
        self.db.add(schedule)
        self.db.flush()
        order = AppOrder(
            AccountId=7,
            SlotId=schedule.Id,
            OutTradeNo=out_trade_no,
            TotalFee=100,
            Status=status,
            Description="proxy:9|center:yangpu|schedule:new",
            ExpiresAt=china_now() - timedelta(minutes=1),
            CreatedAt=datetime.utcnow(),
            PaidAt=None,
            ProxyIsOfflinePayment=False,
            ProxyIsFreeExperience=False,
        )
        self.db.add(order)
        self.db.commit()
        return order, schedule

    def test_close_already_paid_and_query_success_refunds_instead_of_cancel(self):
        order, schedule = self._order()
        client = _TradeClient(["NOTPAY", "SUCCESS"], close_paid=True)
        with (
            patch("wechat_pay_service.is_real_wechat_pay_configured", return_value=True),
            patch("wechat_pay_service.get_wechat_pay_client", return_value=client),
        ):
            _cancel_pending_proxy_order(self.db, order)
        self.db.refresh(order)
        self.db.refresh(schedule)
        self.assertEqual(order.Status, "REFUNDED")
        self.assertIsNotNone(order.PaidAt)
        self.assertEqual(order.TransactionId, "WX4200DESYNC")
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertEqual(client.closes, 1)
        self.assertEqual(client.refunds, 1)
        self.assertGreaterEqual(pay_metrics()["close_already_paid"], 1)
        self.assertGreaterEqual(pay_metrics()["pay_desync"], 1)

    def test_refund_failure_stays_paid_for_manual_handling(self):
        order, schedule = self._order(out_trade_no="PROXY-REFUND-FAIL")
        client = _TradeClient(["SUCCESS"], refund_error=True)
        with (
            patch("wechat_pay_service.is_real_wechat_pay_configured", return_value=True),
            patch("wechat_pay_service.get_wechat_pay_client", return_value=client),
        ):
            _cancel_pending_proxy_order(self.db, order)
        self.db.flush()
        self.db.refresh(order)
        self.db.refresh(schedule)
        self.assertEqual(order.Status, "PAID")
        self.assertIsNotNone(order.PaidAt)
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertGreaterEqual(pay_metrics()["pay_desync"], 1)

    def test_callback_verify_fail_then_short_ttl_does_not_leave_cancelled_unrefunded(self):
        order, schedule = self._order(out_trade_no="PROXY-COMBO")

        class RejectingClient:
            def verify_notification_signature(self, **_kwargs):
                return False

        class Headers(dict):
            def get(self, key, default=""):
                return dict.get(self, key, default)

        class FakeRequest:
            headers = Headers(
                {
                    "Wechatpay-Timestamp": "1710000000",
                    "Wechatpay-Nonce": "nonce",
                    "Wechatpay-Signature": "invalid",
                    "Wechatpay-Serial": "PUB_KEY_ID_other",
                }
            )

            async def body(self):
                return json.dumps(
                    {
                        "trade_state": "SUCCESS",
                        "out_trade_no": "PROXY-COMBO",
                        "transaction_id": "WX4200DESYNC",
                        "amount": {"total": 100},
                    }
                ).encode("utf-8")

        trade = _TradeClient(["SUCCESS"])
        with (
            patch("payment.is_real_wechat_pay_configured", return_value=True),
            patch("payment.get_wechat_pay_client", return_value=RejectingClient()),
            patch("wechat_pay_service.is_real_wechat_pay_configured", return_value=True),
            patch("wechat_pay_service.get_wechat_pay_client", return_value=trade),
            patch("patient_contract_service.acquire_patient_contract_lock"),
        ):
            response = asyncio.run(payment_callback(FakeRequest(), db=self.db))
            self.assertEqual(response.status_code, 401)
            self.db.refresh(order)
            self.assertEqual(order.Status, "PENDING")
            self.assertIsNone(order.PaidAt)
            expire_pending_proxy_orders(self.db)

        self.db.refresh(order)
        self.db.refresh(schedule)
        self.assertEqual(order.Status, "REFUNDED")
        self.assertIsNotNone(order.PaidAt)
        self.assertEqual(trade.refunds, 1)
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertGreaterEqual(pay_metrics()["callback_401"], 1)

    def test_cancelled_order_reconcile_refunds_wechat_success(self):
        order, _schedule = self._order(status="CANCELLED", out_trade_no="PROXY-RECONCILE")
        client = _TradeClient(["SUCCESS"])
        with (
            patch("wechat_pay_service.is_real_wechat_pay_configured", return_value=True),
            patch("wechat_pay_service.get_wechat_pay_client", return_value=client),
        ):
            count = reconcile_wechat_paid_desync(self.db)
        self.db.refresh(order)
        self.assertEqual(count, 1)
        self.assertEqual(order.Status, "REFUNDED")
        self.assertIsNotNone(order.PaidAt)
        self.assertEqual(client.refunds, 1)
        self.assertGreaterEqual(pay_metrics()["pay_desync"], 1)

    def test_unpaid_wechat_order_is_still_cancelled(self):
        order, schedule = self._order(out_trade_no="PROXY-UNPAID")
        client = _TradeClient(["NOTPAY"])
        with (
            patch("wechat_pay_service.is_real_wechat_pay_configured", return_value=True),
            patch("wechat_pay_service.get_wechat_pay_client", return_value=client),
        ):
            _cancel_pending_proxy_order(self.db, order)
        self.db.refresh(order)
        self.db.refresh(schedule)
        self.assertEqual(order.Status, "CANCELLED")
        self.assertIsNone(order.PaidAt)
        self.assertEqual(client.refunds, 0)
        self.assertEqual(client.closes, 1)
