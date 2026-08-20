import asyncio
import io
import json
import logging
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
import api_response
import auth
import payment
import sms_service
from config import Settings, settings
from runtime_safety import (
    JsonLogFormatter,
    RequestLogMiddleware,
    directory_is_writable,
    readiness_checks,
)


def deployed_settings(app_env: str, **overrides):
    values = {
        "APP_ENV": app_env,
        "AUTO_MIGRATE_SCHEMA": False,
        "JWT_SECRET": "j" * 40,
        "DB_USER": "app_user",
        "DB_PASSWORD": "deployment-secret",
        "CORS_ALLOWED_ORIGINS": "https://admin.example.test,https://eap.example.test",
        "BASE_URL": "https://api.example.test",
        "ASSESSMENT_FRONTEND_BASE_URL": "https://eap.example.test",
        "ASSESSMENT_SHARE_SECRET": "s" * 40,
    }
    values.update(overrides)
    with patch.dict(os.environ, {}, clear=True):
        return Settings(_env_file=None, **values)


class RuntimeConfigurationTests(unittest.TestCase):
    def test_development_defaults_remain_usable_but_have_no_database_password(self):
        with patch.dict(os.environ, {}, clear=True):
            configured = Settings(_env_file=None)

        self.assertEqual("development", configured.APP_ENV)
        self.assertTrue(configured.dev_login_enabled)
        self.assertTrue(configured.simulated_payment_enabled)
        self.assertTrue(configured.AUTO_MIGRATE_SCHEMA)
        self.assertEqual("", configured.DB_PASSWORD)

    def test_test_environment_requires_deployment_secrets_https_and_no_auto_migration(self):
        configured = deployed_settings("test")
        self.assertTrue(configured.dev_login_enabled)
        self.assertTrue(configured.simulated_payment_enabled)
        self.assertFalse(configured.AUTO_MIGRATE_SCHEMA)

        with self.assertRaises(RuntimeError):
            deployed_settings("test", JWT_SECRET="short")
        with self.assertRaises(RuntimeError):
            deployed_settings("test", BASE_URL="http://api.example.test")
        with self.assertRaises(RuntimeError):
            deployed_settings("test", AUTO_MIGRATE_SCHEMA=True)
        with self.assertRaises(RuntimeError):
            deployed_settings("test", CORS_ALLOWED_ORIGINS="*")

    def test_production_rejects_mock_features_and_api_docs(self):
        with self.assertRaises(RuntimeError):
            deployed_settings("production")

        configured = deployed_settings(
            "production",
            ALLOW_DEV_LOGIN=False,
            ALLOW_SIMULATED_PAYMENT=False,
            SMS_MOCK=False,
            ENABLE_API_DOCS=False,
        )
        self.assertFalse(configured.dev_login_enabled)
        self.assertFalse(configured.simulated_payment_enabled)

    def test_deployed_share_secret_cannot_reuse_jwt_secret(self):
        shared = "x" * 40
        with self.assertRaises(RuntimeError):
            deployed_settings(
                "test",
                JWT_SECRET=shared,
                ASSESSMENT_SHARE_SECRET=shared,
            )

    def test_invalid_deployed_configuration_does_not_echo_secret_values(self):
        secret = "do-not-copy-this-database-secret"
        with self.assertRaises(RuntimeError) as caught:
            deployed_settings(
                "production",
                DB_PASSWORD=secret,
            )
        self.assertNotIn(secret, str(caught.exception))


class AuthAndPaymentSafetyTests(unittest.TestCase):
    def test_fixed_dev_login_is_rejected_when_disabled(self):
        with (
            patch.object(settings, "APP_ENV", "production"),
            patch.object(settings, "ALLOW_DEV_LOGIN", False),
            patch.object(settings, "ALLOW_ACCESS_KEY_LOGIN", False),
        ):
            with self.assertRaises(HTTPException) as caught:
                auth._should_use_mock_login("dev_admin")
        self.assertEqual(403, caught.exception.status_code)

    def test_access_key_login_allowed_when_dev_login_disabled(self):
        with (
            patch.object(settings, "APP_ENV", "production"),
            patch.object(settings, "ALLOW_DEV_LOGIN", False),
            patch.object(settings, "ALLOW_ACCESS_KEY_LOGIN", True),
        ):
            self.assertTrue(auth._should_use_mock_login("dev_admin"))

    def test_patient_mock_login_still_requires_dev_login(self):
        with (
            patch.object(settings, "APP_ENV", "production"),
            patch.object(settings, "ALLOW_DEV_LOGIN", False),
            patch.object(settings, "ALLOW_ACCESS_KEY_LOGIN", True),
        ):
            with self.assertRaises(HTTPException) as caught:
                auth._should_use_mock_login("dev_patient")
        self.assertEqual(403, caught.exception.status_code)

    def test_missing_wechat_credentials_fail_closed_when_dev_login_is_disabled(self):
        with (
            patch.object(settings, "APP_ENV", "test"),
            patch.object(settings, "ALLOW_DEV_LOGIN", False),
            patch("auth._is_wechat_configured", return_value=False),
        ):
            with self.assertRaises(HTTPException) as caught:
                auth._should_use_mock_login("real-looking-code")
        self.assertEqual(503, caught.exception.status_code)

    def test_development_mock_login_remains_compatible(self):
        with (
            patch.object(settings, "APP_ENV", "development"),
            patch.object(settings, "ALLOW_DEV_LOGIN", True),
            patch("auth._is_wechat_configured", return_value=False),
        ):
            self.assertTrue(auth._should_use_mock_login("dev_admin"))
            self.assertTrue(auth._should_use_mock_login("local-code"))

    def test_payment_without_provider_or_allowed_simulation_returns_503(self):
        with (
            patch.object(settings, "APP_ENV", "production"),
            patch.object(settings, "ALLOW_SIMULATED_PAYMENT", False),
            patch("payment._is_real_wechat_pay_configured", return_value=False),
        ):
            with self.assertRaises(HTTPException) as caught:
                payment._require_payment_provider_or_simulation()
            self.assertEqual(503, caught.exception.status_code)

            with self.assertRaises(HTTPException) as simulated:
                payment._mock_pay_params("ORDER-1", 100)
            self.assertEqual(403, simulated.exception.status_code)

    def test_all_mock_payment_routes_stop_before_database_access(self):
        class NoDatabaseAccess:
            def __getattr__(self, name):
                raise AssertionError(f"database must not be accessed: {name}")

        account = object()
        database = NoDatabaseAccess()
        calls = (
            lambda: payment.create_order(
                payment.CreateOrderRequest(slot_id=1, total_fee=100),
                current_account=account,
                db=database,
            ),
            lambda: payment.pay_existing_order(
                payment.PayExistingOrderRequest(order_id=1),
                current_account=account,
                db=database,
            ),
            lambda: payment.simulate_pay_existing_order(
                payment.PayExistingOrderRequest(order_id=1),
                current_account=account,
                db=database,
            ),
            lambda: payment.simulate_pay(
                payment.CreateOrderRequest(slot_id=1, total_fee=100),
                current_account=account,
                db=database,
            ),
            lambda: payment.confirm_dev_payment(
                payment.ConfirmDevPaymentRequest(out_trade_no="ORDER-1"),
                current_account=account,
                db=database,
            ),
        )
        with (
            patch.object(settings, "APP_ENV", "production"),
            patch.object(settings, "ALLOW_SIMULATED_PAYMENT", False),
            patch("payment._is_real_wechat_pay_configured", return_value=False),
        ):
            statuses = []
            for call in calls:
                with self.assertRaises(HTTPException) as caught:
                    call()
                statuses.append(caught.exception.status_code)

        self.assertEqual([503, 503, 403, 403, 403], statuses)

    def test_unsigned_callback_is_never_valid_without_real_payment_credentials(self):
        with patch("payment._is_real_wechat_pay_configured", return_value=False):
            self.assertFalse(
                payment._wechat_callback_signature_valid(
                    {"return_code": "SUCCESS", "result_code": "SUCCESS"}
                )
            )

    def test_non_mock_sms_fails_before_writing_a_false_success(self):
        class NoDatabaseAccess:
            def __getattr__(self, name):
                raise AssertionError(f"database must not be accessed: {name}")

        with patch.object(settings, "SMS_MOCK", False):
            with self.assertRaises(HTTPException) as caught:
                sms_service.send_verification_code(
                    NoDatabaseAccess(),
                    "13800000000",
                )
        self.assertEqual(503, caught.exception.status_code)

    def test_mock_sms_creates_code_with_configured_ttl(self):
        class RecordingDatabase:
            def __init__(self):
                self.added = None
                self.committed = False

            def add(self, record):
                self.added = record

            def commit(self):
                self.committed = True

        database = RecordingDatabase()
        now = datetime(2026, 7, 30, 12, 0, 0)
        with (
            patch.object(settings, "SMS_MOCK", True),
            patch.object(settings, "SMS_CODE_TTL_MINUTES", 5),
            patch("sms_service.china_now", return_value=now),
            patch("sms_service._find_reusable_code", return_value=None),
            patch("sms_service.generate_code", return_value="123456"),
        ):
            response = sms_service.send_verification_code(
                database,
                "13800000000",
            )

        self.assertTrue(database.committed)
        self.assertEqual("123456", response["mockCode"])
        self.assertEqual(now + timedelta(minutes=5), database.added.ExpiresAt)


class StructuredRequestLogTests(unittest.TestCase):
    def test_unhandled_error_log_excludes_raw_path_and_exception_text(self):
        request = SimpleNamespace(
            url=SimpleNamespace(path="/api/mini/admin/users/13800000000")
        )
        error = RuntimeError("database-password-must-not-be-logged")

        with patch.object(api_response.logger, "error") as logged:
            response = asyncio.run(
                api_response.api_unhandled_exception_handler(request, error)
            )

        self.assertEqual(500, response.status_code)
        logged.assert_called_once()
        rendered_call = str(logged.call_args)
        self.assertIn("unhandled_api_error", rendered_call)
        self.assertNotIn("13800000000", rendered_call)
        self.assertNotIn("database-password-must-not-be-logged", rendered_call)

    def test_request_log_excludes_query_headers_and_body(self):
        output = io.StringIO()
        logger = logging.getLogger("test.runtime.request")
        logger.handlers.clear()
        logger.propagate = False
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(output)
        handler.setFormatter(JsonLogFormatter())
        logger.addHandler(handler)

        async def app(scope, receive, send):
            del scope, receive
            await send(
                {
                    "type": "http.response.start",
                    "status": 204,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            await send({"type": "http.response.body", "body": b""})

        ticks = iter((10.0, 10.125))
        middleware = RequestLogMiddleware(app, logger=logger, clock=lambda: next(ticks))
        sent = []

        async def receive():
            return {
                "type": "http.request",
                "body": b'{"password":"body-secret"}',
                "more_body": False,
            }

        async def send(message):
            sent.append(message)

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/mini/admin/users/13800000000",
            "query_string": b"phone=13800000000&token=query-secret",
            "headers": [
                (b"authorization", b"Bearer header-secret"),
                (b"x-request-id", b"request-123"),
            ],
            "route": SimpleNamespace(path="/api/mini/admin/users/{account_id}"),
        }
        asyncio.run(middleware(scope, receive, send))

        event = json.loads(output.getvalue())
        self.assertEqual("request-123", event["request_id"])
        self.assertEqual("/api/mini/admin/users/{account_id}", event["path"])
        self.assertEqual(204, event["status"])
        self.assertEqual(125.0, event["duration_ms"])
        self.assertNotIn("13800000000", output.getvalue())
        self.assertNotIn("query-secret", output.getvalue())
        self.assertNotIn("header-secret", output.getvalue())
        self.assertNotIn("body-secret", output.getvalue())

        response_headers = dict(sent[0]["headers"])
        self.assertEqual(b"request-123", response_headers[b"x-request-id"])

    def test_invalid_request_id_is_not_reflected(self):
        output = io.StringIO()
        logger = logging.getLogger("test.runtime.invalid-request-id")
        logger.handlers.clear()
        logger.propagate = False
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(output)
        handler.setFormatter(JsonLogFormatter())
        logger.addHandler(handler)

        async def app(scope, receive, send):
            del scope, receive
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        middleware = RequestLogMiddleware(app, logger=logger, clock=lambda: 1.0)
        sent = []

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            sent.append(message)

        asyncio.run(
            middleware(
                {
                    "type": "http",
                    "method": "GET",
                    "path": "/",
                    "query_string": b"",
                    "headers": [(b"x-request-id", b"invalid id with spaces")],
                },
                receive,
                send,
            )
        )
        reflected = dict(sent[0]["headers"])[b"x-request-id"].decode("ascii")
        self.assertRegex(reflected, r"^[a-f0-9]{32}$")
        self.assertNotIn("invalid id with spaces", output.getvalue())


class ReadinessTests(unittest.TestCase):
    class HealthyEngine:
        class Connection:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, _statement):
                return 1

        def connect(self):
            return self.Connection()

    class FailingEngine:
        def connect(self):
            raise RuntimeError("database unavailable with secret detail")

    def test_directory_probe_is_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            self.assertTrue(directory_is_writable(path))
            self.assertEqual([], list(path.iterdir()))

    def test_readiness_reports_database_and_directory_without_sensitive_details(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "missing"
            ready, checks = readiness_checks(
                self.HealthyEngine(),
                (("upload_dir", Path(directory)), ("assessment_data_dir", missing)),
            )
        self.assertFalse(ready)
        self.assertEqual(
            {
                "database": "ok",
                "upload_dir": "ok",
                "assessment_data_dir": "error",
            },
            checks,
        )

        ready, checks = readiness_checks(self.FailingEngine(), ())
        self.assertFalse(ready)
        self.assertEqual({"database": "error"}, checks)


class StartupAndHealthRouteTests(unittest.TestCase):
    def test_schema_auto_migration_can_be_disabled(self):
        import main

        logger = logging.getLogger("uvicorn.error")
        with (
            patch.object(main.settings, "AUTO_MIGRATE_SCHEMA", False),
            patch.object(logger, "warning") as warning,
        ):
            main._ensure_db_schema()
        warning.assert_not_called()

    def test_health_routes_expose_only_bounded_status(self):
        import main

        live = main.health_live()
        self.assertEqual("ok", live["status"])
        self.assertEqual("backend", live["service"])

        with patch(
            "main.readiness_checks",
            return_value=(
                False,
                {
                    "database": "error",
                    "upload_dir": "ok",
                    "assessment_data_dir": "ok",
                    "assessment_asset_dir": "ok",
                },
            ),
        ):
            response = main.health_ready()
        self.assertEqual(503, response.status_code)
        body = json.loads(response.body)
        self.assertEqual("not_ready", body["status"])
        self.assertNotIn("path", body)
        self.assertNotIn("exception", body)


if __name__ == "__main__":
    unittest.main()
