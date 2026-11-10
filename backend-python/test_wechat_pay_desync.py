import asyncio
import json
import threading
import unittest
from datetime import datetime, timedelta
from itertools import count
from types import SimpleNamespace
from unittest.mock import patch

import requests
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app_time import china_now
from booking_errors import BookingBusyError, OrderPaymentConflictError
from database import Base
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppMessage,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
)
from payment import payment_callback
from proxy_booking_service import (
    cancel_pending_proxy_orders_for_patient,
    cancel_proxy_order_push,
    expire_pending_proxy_orders,
)
from wechat_pay_metrics import reset as reset_pay_metrics
from wechat_pay_metrics import snapshot as pay_metrics
from wechat_pay_service import order_payment_needs_review, reconcile_wechat_payments
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
    """模拟微信支付：按顺序返回查单状态；记录关单与退款调用次数。"""

    def __init__(self, states, *, close_paid=False, query_error=None):
        self.states = list(states)
        self.close_paid = close_paid
        self.query_error = query_error
        self.queries = 0
        self.closes = 0
        self.refunds = 0

    def query_by_out_trade_no(self, out_trade_no):
        self.queries += 1
        if self.query_error is not None:
            raise self.query_error
        state = self.states.pop(0) if len(self.states) > 1 else self.states[0]
        payload = {"trade_state": state, "amount": {"total": 100}}
        if state in ("SUCCESS", "REFUND"):
            payload["transaction_id"] = "WX4200DESYNC"
            payload["success_time"] = "2026-11-10T10:00:00+08:00"
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
        return {"status": "PROCESSING"}

    def query_refund(self, out_refund_no):
        return {"status": "PROCESSING"}


def _fake_fulfill(db, order, *, center_id=None, transaction_id=None, enforce_lead_time=True):
    """模拟 complete_paid_order 成功落单。"""
    assert enforce_lead_time is False, "微信已收款的入账不应再卡 90 分钟提前量"
    schedule = db.get(AppSchedule, order.SlotId)
    order.Status = "PAID"
    order.PaidAt = datetime.utcnow()
    order.TransactionId = transaction_id
    schedule.Status = "BOOKED"
    db.add(
        AppConsultation(
            OrderId=order.Id,
            PatientId=order.AccountId,
            CounselorId=schedule.CounselorId,
            ScheduleId=schedule.Id,
            Status="CONFIRMED",
            StartTime=schedule.StartTime,
            EndTime=schedule.EndTime,
        )
    )
    db.flush()


def _fake_fulfill_fails_after_partial_writes(db, order, **_kwargs):
    """模拟 complete_paid_order 改了一半才发现无法落单（例如咨询室被占）。"""
    schedule = db.get(AppSchedule, order.SlotId)
    order.Status = "PAID"
    schedule.Status = "BOOKED"
    db.flush()
    raise ValueError("代理预约指定的咨询室已被占用，请联系助理重新预约")


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


class _Headers(dict):
    def get(self, key, default=""):
        return dict.get(self, key, default)


class _CallbackRequest:
    def __init__(self, payload, headers=None):
        self.payload = payload
        self.headers = _Headers(headers or {})

    async def body(self):
        return json.dumps(self.payload).encode("utf-8")


class PaymentSyncNeverRefundsTests(unittest.TestCase):
    """对账/过期/回调/员工取消都只与微信对齐，任何情况下都不能自动退款。"""

    def setUp(self):
        reset_pay_metrics()
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # sqlite 不会给 BIGINT 主键自增，站内消息在测试里补一个递增 Id
        message_ids = count(1)

        def assign_message_id(_mapper, _connection, target):
            if target.Id is None:
                target.Id = next(message_ids)

        event.listen(AppMessage, "before_insert", assign_message_id)
        self.addCleanup(event.remove, AppMessage, "before_insert", assign_message_id)

        self.db.add_all(
            [
                AppAccount(Id=1, Mobile="13800000001", RealName="咨询师甲", IsActive=True),
                AppCounselorProfile(AccountId=1, Name="咨询师甲", Billing=100, IsActive=True),
                AppRoleBinding(AccountId=1, RoleType="Counselor"),
                AppAccount(Id=7, Mobile="13800000007", RealName="来访甲", IsActive=True, BoundCounselorId=1),
                AppAccount(Id=50, Mobile="13800000050", RealName="助理甲", IsActive=True),
                AppRoleBinding(AccountId=50, RoleType="Assistant"),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _order(self, *, status="PENDING", out_trade_no="PROXY17941071628194", expired=True):
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
            ExpiresAt=china_now() + (timedelta(minutes=-1) if expired else timedelta(minutes=30)),
            CreatedAt=datetime.utcnow(),
            PaidAt=None,
            ProxyIsOfflinePayment=False,
            ProxyIsFreeExperience=False,
        )
        self.db.add(order)
        self.db.commit()
        return order, schedule

    def _wechat(self, client):
        return (
            patch("wechat_pay_service.is_real_wechat_pay_configured", return_value=True),
            patch("wechat_pay_service.get_wechat_pay_client", return_value=client),
        )

    def _messages(self, related_type, order_id):
        return (
            self.db.query(AppMessage)
            .filter(AppMessage.RelatedType == related_type, AppMessage.RelatedId == order_id)
            .all()
        )

    def _reload(self, *rows):
        self.db.expire_all()
        for row in rows:
            self.db.refresh(row)

    # ------------------------------------------------------------------
    # 订单过期（请求触发的 expire_pending_proxy_orders）
    # ------------------------------------------------------------------

    def test_expired_but_paid_order_is_fulfilled_instead_of_refunded(self):
        order, schedule = self._order()
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory, patch("payment_service.complete_paid_order", side_effect=_fake_fulfill):
            expire_pending_proxy_orders(self.db)
            self.db.commit()
        self._reload(order, schedule)
        self.assertEqual(order.Status, "PAID")
        self.assertEqual(order.TransactionId, "WX4200DESYNC")
        self.assertEqual(schedule.Status, "BOOKED")
        self.assertEqual(client.refunds, 0)
        self.assertEqual(client.closes, 0)
        self.assertFalse(order_payment_needs_review(self.db, order))

    def test_close_reports_paid_then_order_is_fulfilled_without_refund(self):
        order, schedule = self._order()
        client = _TradeClient(["NOTPAY", "SUCCESS"], close_paid=True)
        real, factory = self._wechat(client)
        with real, factory, patch("payment_service.complete_paid_order", side_effect=_fake_fulfill):
            expire_pending_proxy_orders(self.db)
            self.db.commit()
        self._reload(order, schedule)
        self.assertEqual(order.Status, "PAID")
        self.assertEqual(schedule.Status, "BOOKED")
        self.assertEqual(client.closes, 1)
        self.assertEqual(client.refunds, 0)
        self.assertGreaterEqual(pay_metrics()["close_already_paid"], 1)

    def test_unfulfillable_paid_order_is_recorded_for_review_without_refund(self):
        order, schedule = self._order(out_trade_no="PROXY-REVIEW")
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory, patch(
            "payment_service.complete_paid_order",
            side_effect=_fake_fulfill_fails_after_partial_writes,
        ):
            expire_pending_proxy_orders(self.db)
            self.db.commit()
            # 再次触发过期处理和对账：不能重复通知，更不能退款
            expire_pending_proxy_orders(self.db)
            self.db.commit()
            reconcile_wechat_payments(self.db)
        self._reload(order, schedule)
        self.assertEqual(order.Status, "PAID")
        self.assertIsNotNone(order.PaidAt)
        self.assertEqual(order.TransactionId, "WX4200DESYNC")
        # 失败的履约尝试被 SAVEPOINT 回滚；推送新建的时段释放
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertEqual(self.db.query(AppConsultation).count(), 0)
        self.assertTrue(order_payment_needs_review(self.db, order))
        self.assertEqual(client.refunds, 0)
        staff = self._messages("PAYMENT_REVIEW", order.Id)
        self.assertEqual([m.AccountId for m in staff], [50])
        self.assertIn("咨询室已被占用", staff[0].Content)
        self.assertEqual(len(self._messages("PATIENT_PAYMENT_REVIEW", order.Id)), 1)
        self.assertEqual(pay_metrics()["pay_needs_review"], 1)

    def test_busy_fulfillment_keeps_order_pending_for_next_sync(self):
        order, schedule = self._order(out_trade_no="PROXY-BUSY")
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory, patch(
            "payment_service.complete_paid_order",
            side_effect=BookingBusyError("该订单或预约时段正在处理，请稍后重试"),
        ):
            expire_pending_proxy_orders(self.db)
            self.db.commit()
        self._reload(order, schedule)
        self.assertEqual(order.Status, "PENDING")
        self.assertIsNone(order.PaidAt)
        self.assertEqual(schedule.Status, "AVAILABLE")
        self.assertEqual(client.refunds, 0)
        self.assertEqual(client.closes, 0)
        self.assertEqual(self._messages("PAYMENT_REVIEW", order.Id), [])

    def test_paying_or_unreachable_wechat_never_cancels_or_refunds(self):
        paying, paying_schedule = self._order(out_trade_no="PROXY-PAYING")
        client = _TradeClient(["USERPAYING"])
        real, factory = self._wechat(client)
        with real, factory:
            expire_pending_proxy_orders(self.db)
            self.db.commit()
        self._reload(paying, paying_schedule)
        self.assertEqual(paying.Status, "PENDING")
        self.assertEqual(paying_schedule.Status, "AVAILABLE")
        self.assertEqual(client.closes, 0)

        broken = _TradeClient(["NOTPAY"], query_error=requests.exceptions.ConnectionError("timeout"))
        real, factory = self._wechat(broken)
        with real, factory:
            expire_pending_proxy_orders(self.db)  # 网络异常不能让调用方请求失败
            self.db.commit()
        self._reload(paying)
        self.assertEqual(paying.Status, "PENDING")
        self.assertEqual(broken.closes, 0)
        self.assertEqual(client.refunds + broken.refunds, 0)

    def test_unpaid_wechat_order_is_still_cancelled(self):
        order, schedule = self._order(out_trade_no="PROXY-UNPAID")
        client = _TradeClient(["NOTPAY"])
        real, factory = self._wechat(client)
        with real, factory:
            expire_pending_proxy_orders(self.db)
            self.db.commit()
        self._reload(order, schedule)
        self.assertEqual(order.Status, "CANCELLED")
        self.assertIsNone(order.PaidAt)
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertEqual(client.refunds, 0)
        self.assertEqual(client.closes, 1)

    # ------------------------------------------------------------------
    # 后台对账
    # ------------------------------------------------------------------

    def test_reconcile_records_payment_on_cancelled_order_without_refund(self):
        order, _schedule = self._order(status="CANCELLED", out_trade_no="PROXY-RECONCILE")
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory:
            first = reconcile_wechat_payments(self.db)
            second = reconcile_wechat_payments(self.db)
        self._reload(order)
        self.assertEqual(first["needs_review"], 1)
        self.assertEqual(second["needs_review"], 1)  # 仍待人工处理，但不重复记录
        self.assertEqual(order.Status, "PAID")
        self.assertIsNotNone(order.PaidAt)
        self.assertEqual(client.refunds, 0)
        self.assertEqual(len(self._messages("PAYMENT_REVIEW", order.Id)), 1)
        self.assertEqual(len(self._messages("PATIENT_PAYMENT_REVIEW", order.Id)), 1)

    def test_reconcile_syncs_manual_refund_from_merchant_platform(self):
        order, _schedule = self._order(status="CANCELLED", out_trade_no="PROXY-MANUAL-REFUND")
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory:
            reconcile_wechat_payments(self.db)
        self._reload(order)
        self.assertEqual(order.Status, "PAID")

        # 助理在商户平台退款后，对账把订单同步为已退款（系统本身没有发起退款）
        client.states = ["REFUND"]
        real, factory = self._wechat(client)
        with real, factory:
            stats = reconcile_wechat_payments(self.db)
        self._reload(order)
        self.assertEqual(stats["refunded"], 1)
        self.assertEqual(order.Status, "REFUNDED")
        self.assertEqual(client.refunds, 0)

    def test_reconcile_surfaces_legacy_paid_but_unbooked_order_once(self):
        # 旧逻辑"退款失败"留下的订单：已收款、无咨询单、从未通知过任何人
        order, _schedule = self._order(status="PAID", out_trade_no="PROXY-LEGACY")
        order.PaidAt = datetime.utcnow() - timedelta(days=1)
        order.TransactionId = "WX4200LEGACY"
        self.db.commit()
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory:
            first = reconcile_wechat_payments(self.db)
            second = reconcile_wechat_payments(self.db)
        self._reload(order)
        self.assertEqual((first["needs_review"], second["needs_review"]), (1, 1))
        self.assertEqual(order.Status, "PAID")
        self.assertEqual(len(self._messages("PAYMENT_REVIEW", order.Id)), 1)
        self.assertEqual(client.refunds, 0)

    def test_reconcile_leaves_unexpired_unpaid_order_alone(self):
        order, schedule = self._order(out_trade_no="PROXY-OPEN", expired=False)
        client = _TradeClient(["NOTPAY"])
        real, factory = self._wechat(client)
        with real, factory:
            stats = reconcile_wechat_payments(self.db)
        self._reload(order, schedule)
        self.assertEqual(stats["unchanged"], 1)
        self.assertEqual(order.Status, "PENDING")
        self.assertEqual(schedule.Status, "AVAILABLE")
        self.assertEqual(client.closes, 0)

    def test_reconcile_fulfills_paid_orders_expired_or_not(self):
        open_order, open_schedule = self._order(out_trade_no="PROXY-OPEN-PAID", expired=False)
        late_order, late_schedule = self._order(out_trade_no="PROXY-LATE-PAID", expired=True)
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory, patch("payment_service.complete_paid_order", side_effect=_fake_fulfill):
            stats = reconcile_wechat_payments(self.db)
        self._reload(open_order, open_schedule, late_order, late_schedule)
        self.assertEqual(stats["fulfilled"], 2)
        self.assertEqual((open_order.Status, late_order.Status), ("PAID", "PAID"))
        self.assertEqual((open_schedule.Status, late_schedule.Status), ("BOOKED", "BOOKED"))
        self.assertEqual(client.refunds, 0)

    # ------------------------------------------------------------------
    # 员工主动取消：来访已付款时拒绝取消，不退款
    # ------------------------------------------------------------------

    def test_staff_cancel_push_refuses_when_patient_already_paid(self):
        order, schedule = self._order(out_trade_no="PROXY-STAFF-PAID", expired=False)
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory:
            with self.assertRaises(OrderPaymentConflictError):
                cancel_proxy_order_push(self.db, order_id=order.Id, operator_account_id=50)
        self.db.rollback()
        self._reload(order, schedule)
        self.assertEqual(order.Status, "PENDING")
        self.assertEqual(schedule.Status, "AVAILABLE")
        self.assertEqual(client.closes, 0)
        self.assertEqual(client.refunds, 0)

    def test_staff_cancel_refuses_order_that_just_became_paid_locally(self):
        order, schedule = self._order(out_trade_no="PROXY-STAFF-RACE", expired=False)
        order.Status = "PAID"  # 支付回调抢先一步入账
        order.PaidAt = datetime.utcnow()
        self.db.commit()
        client = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(client)
        with real, factory:
            with self.assertRaises(OrderPaymentConflictError):
                cancel_proxy_order_push(self.db, order_id=order.Id, operator_account_id=50)
        self.db.rollback()
        self._reload(order, schedule)
        self.assertEqual(order.Status, "PAID")
        self.assertEqual(client.refunds, 0)

    def test_staff_cancel_push_still_cancels_unpaid_order(self):
        order, schedule = self._order(out_trade_no="PROXY-STAFF-UNPAID", expired=False)
        client = _TradeClient(["NOTPAY"])
        real, factory = self._wechat(client)
        with real, factory:
            result = cancel_proxy_order_push(self.db, order_id=order.Id, operator_account_id=50)
            self.db.commit()
        self._reload(order, schedule)
        self.assertEqual(result["status"], "CANCELLED")
        self.assertEqual(order.Status, "CANCELLED")
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertEqual(client.closes, 1)
        self.assertEqual(client.refunds, 0)

    def test_rebind_refuses_while_pending_order_payment_is_uncertain(self):
        order, _schedule = self._order(out_trade_no="PROXY-REBIND", expired=False)
        client = _TradeClient(["USERPAYING"])
        real, factory = self._wechat(client)
        with real, factory:
            with self.assertRaises(OrderPaymentConflictError):
                cancel_pending_proxy_orders_for_patient(self.db, 7, keep_counselor_id=None)
        self.db.rollback()
        self._reload(order)
        self.assertEqual(order.Status, "PENDING")
        self.assertEqual(client.refunds, 0)

    # ------------------------------------------------------------------
    # 支付回调
    # ------------------------------------------------------------------

    def test_callback_verify_fail_then_expiry_fulfills_instead_of_refunding(self):
        order, schedule = self._order(out_trade_no="PROXY-COMBO")

        class RejectingClient:
            def verify_notification_signature(self, **_kwargs):
                return False

        request = _CallbackRequest(
            {
                "trade_state": "SUCCESS",
                "out_trade_no": "PROXY-COMBO",
                "transaction_id": "WX4200DESYNC",
                "amount": {"total": 100},
            },
            headers={
                "Wechatpay-Timestamp": "1710000000",
                "Wechatpay-Nonce": "nonce",
                "Wechatpay-Signature": "invalid",
                "Wechatpay-Serial": "PUB_KEY_ID_other",
            },
        )
        trade = _TradeClient(["SUCCESS"])
        real, factory = self._wechat(trade)
        with (
            patch("payment.is_real_wechat_pay_configured", return_value=True),
            patch("payment.get_wechat_pay_client", return_value=RejectingClient()),
            real,
            factory,
            patch("payment_service.complete_paid_order", side_effect=_fake_fulfill),
        ):
            response = asyncio.run(payment_callback(request, db=self.db))
            self.assertEqual(response.status_code, 401)
            self._reload(order)
            self.assertEqual(order.Status, "PENDING")
            expire_pending_proxy_orders(self.db)
            self.db.commit()

        self._reload(order, schedule)
        self.assertEqual(order.Status, "PAID")
        self.assertEqual(schedule.Status, "BOOKED")
        self.assertEqual(trade.refunds, 0)
        self.assertGreaterEqual(pay_metrics()["callback_401"], 1)

    def test_callback_for_locally_cancelled_order_records_payment_for_review(self):
        order, _schedule = self._order(status="CANCELLED", out_trade_no="PROXY-CB-CANCELLED")
        request = _CallbackRequest(
            {
                "trade_state": "SUCCESS",
                "out_trade_no": "PROXY-CB-CANCELLED",
                "transaction_id": "WX4200CB",
                "amount": {"total": 100},
            }
        )
        with patch("payment.is_real_wechat_pay_configured", return_value=False):
            response = asyncio.run(payment_callback(request, db=self.db))
        self._reload(order)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(order.Status, "PAID")
        self.assertEqual(order.TransactionId, "WX4200CB")
        self.assertTrue(order_payment_needs_review(self.db, order))
        self.assertEqual(len(self._messages("PAYMENT_REVIEW", order.Id)), 1)

    def test_callback_asks_wechat_to_retry_when_booking_is_busy(self):
        order, _schedule = self._order(out_trade_no="PROXY-CB-BUSY", expired=False)
        request = _CallbackRequest(
            {
                "trade_state": "SUCCESS",
                "out_trade_no": "PROXY-CB-BUSY",
                "transaction_id": "WX4200BUSY",
                "amount": {"total": 100},
            }
        )
        with (
            patch("payment.is_real_wechat_pay_configured", return_value=False),
            patch(
                "payment_service.complete_paid_order",
                side_effect=BookingBusyError("该订单或预约时段正在处理，请稍后重试"),
            ),
        ):
            response = asyncio.run(payment_callback(request, db=self.db))
        self._reload(order)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(order.Status, "PENDING")
        self.assertIsNone(order.PaidAt)


if __name__ == "__main__":
    unittest.main()
