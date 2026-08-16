import json
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import settings
from database import Base
from models import AppSmsVerification
import sms_service


class SmsServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine, tables=[AppSmsVerification.__table__])
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.now = datetime(2026, 8, 16, 10, 0, 0)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def mock_settings(self):
        return (
            patch.object(settings, "SMS_MOCK", True),
            patch.object(settings, "SMS_CODE_LENGTH", 6),
            patch.object(settings, "SMS_CODE_TTL_MINUTES", 5),
            patch.object(settings, "SMS_RESEND_INTERVAL_SECONDS", 60),
            patch.object(settings, "SMS_MAX_SENDS_PER_HOUR", 10),
            patch.object(settings, "SMS_MAX_VERIFY_ATTEMPTS", 5),
            patch.object(settings, "SMS_CODE_HASH_SECRET", "test-hash-secret-at-least-32-characters"),
            patch("sms_service.china_now", return_value=self.now),
        )

    def test_mock_code_is_hashed_at_rest_and_can_only_be_used_once(self):
        patches = self.mock_settings()
        with patches[0], patches[1], patches[2], patches[3], patches[4], patches[5], patches[6], patches[7], patch(
            "sms_service.generate_code", return_value="123456"
        ):
            response = sms_service.send_verification_code(self.db, "13800000000", "login")
            record = self.db.query(AppSmsVerification).one()

            self.assertEqual("123456", response["mockCode"])
            self.assertEqual(60, response["resendAfter"])
            self.assertNotEqual("123456", record.Code)
            self.assertEqual(10, len(record.Code))

            sms_service.verify_code(self.db, "13800000000", "123456", "login")
            with self.assertRaises(HTTPException) as raised:
                sms_service.verify_code(self.db, "13800000000", "123456", "login")

        self.assertEqual(400, raised.exception.status_code)

    def test_resend_is_rate_limited_by_existing_table(self):
        patches = self.mock_settings()
        with patches[0], patches[1], patches[2], patches[3], patches[4], patches[5], patches[6], patches[7], patch(
            "sms_service.generate_code", return_value="123456"
        ):
            sms_service.send_verification_code(self.db, "13800000001", "register")
            with self.assertRaises(HTTPException) as raised:
                sms_service.send_verification_code(self.db, "13800000001", "register")

        self.assertEqual(429, raised.exception.status_code)
        self.assertIn("60 秒", raised.exception.detail)

    def test_failed_attempt_limit_invalidates_code(self):
        patches = self.mock_settings()
        with patches[0], patches[1], patches[2], patches[3], patches[4], patch.object(
            settings, "SMS_MAX_VERIFY_ATTEMPTS", 2
        ), patches[6], patches[7], patch("sms_service.generate_code", return_value="123456"):
            sms_service.send_verification_code(self.db, "13800000002", "staff_login")
            for wrong_code in ("111111", "222222"):
                with self.assertRaises(HTTPException):
                    sms_service.verify_code(self.db, "13800000002", wrong_code, "staff_login")
            with self.assertRaises(HTTPException) as raised:
                sms_service.verify_code(self.db, "13800000002", "123456", "staff_login")

        self.assertEqual(400, raised.exception.status_code)

    def test_real_mode_uses_tencent_adapter_and_persists_digest(self):
        with (
            patch.object(settings, "SMS_MOCK", False),
            patch.object(settings, "SMS_PROVIDER", "tencent"),
            patch.object(settings, "SMS_CODE_HASH_SECRET", "test-hash-secret-at-least-32-characters"),
            patch.object(settings, "TENCENTCLOUD_SECRET_ID", "secret-id"),
            patch.object(settings, "TENCENTCLOUD_SECRET_KEY", "secret-key"),
            patch.object(settings, "TENCENT_SMS_REGION", "ap-guangzhou"),
            patch.object(settings, "TENCENT_SMS_SDK_APP_ID", "1400000000"),
            patch.object(settings, "TENCENT_SMS_SIGN_NAME", "连心心理"),
            patch.object(settings, "TENCENT_SMS_TEMPLATE_ID", "123456"),
            patch("sms_service.china_now", return_value=self.now),
            patch("sms_service.generate_code", return_value="654321"),
            patch("sms_service._send_via_tencent") as send_tencent,
        ):
            response = sms_service.send_verification_code(self.db, "13800000003", "login")

        send_tencent.assert_called_once_with("13800000003", "654321")
        self.assertNotIn("mockCode", response)
        self.assertNotEqual("654321", self.db.query(AppSmsVerification).one().Code)

    def test_provider_failure_invalidates_the_persisted_code(self):
        with (
            patch.object(settings, "SMS_MOCK", False),
            patch.object(settings, "SMS_CODE_HASH_SECRET", "test-hash-secret-at-least-32-characters"),
            patch("sms_service._validate_delivery_configuration"),
            patch("sms_service.china_now", return_value=self.now),
            patch("sms_service.generate_code", return_value="654321"),
            patch(
                "sms_service._deliver_code",
                side_effect=sms_service.SmsProviderError("provider unavailable"),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                sms_service.send_verification_code(self.db, "13800000009", "login")

        self.assertEqual(503, raised.exception.status_code)
        self.assertIsNotNone(self.db.query(AppSmsVerification).one().UsedAt)

    def test_tencent_request_uses_api_v3_expected_fields(self):
        captured = {}

        class Credential:
            def __init__(self, secret_id, secret_key):
                captured["credentials"] = (secret_id, secret_key)

        class Request:
            def from_json_string(self, value):
                captured["request"] = json.loads(value)

        class Client:
            def __init__(self, credential, region):
                captured["region"] = region

            def SendSms(self, request):
                return SimpleNamespace(SendStatusSet=[SimpleNamespace(Code="Ok")])

        fake_sdk = (
            SimpleNamespace(Credential=Credential),
            SimpleNamespace(SendSmsRequest=Request),
            SimpleNamespace(SmsClient=Client),
        )
        with (
            patch.object(settings, "TENCENTCLOUD_SECRET_ID", "secret-id"),
            patch.object(settings, "TENCENTCLOUD_SECRET_KEY", "secret-key"),
            patch.object(settings, "TENCENT_SMS_REGION", "ap-guangzhou"),
            patch.object(settings, "TENCENT_SMS_SDK_APP_ID", "1400000000"),
            patch.object(settings, "TENCENT_SMS_SIGN_NAME", "连心心理"),
            patch.object(settings, "TENCENT_SMS_TEMPLATE_ID", "123456"),
            patch.object(settings, "SMS_CODE_TTL_MINUTES", 5),
            patch("sms_service._load_tencent_sdk", return_value=fake_sdk),
        ):
            sms_service._send_via_tencent("13800000004", "123456")

        self.assertEqual(("secret-id", "secret-key"), captured["credentials"])
        self.assertEqual("ap-guangzhou", captured["region"])
        self.assertEqual(["+8613800000004"], captured["request"]["PhoneNumberSet"])
        self.assertEqual(["123456", "5"], captured["request"]["TemplateParamSet"])


if __name__ == "__main__":
    unittest.main()
