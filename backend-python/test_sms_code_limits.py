"""短信验证码错误次数上限与重发间隔回归测试。

每个用例都替换了短信下发（sms_service._dispatch_sms），即使 backend-python/.env
配置了真实腾讯云凭证也不会真的发短信；时间通过替换 sms_service.china_now 控制。
"""

import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sms_service
from config import settings
from database import Base
from models import AppAccount, AppLoginSession, AppSmsVerification
from web_auth import (
    LoginRequest,
    RegisterRequest,
    SendCodeRequest,
    web_login,
    web_register,
    web_send_code,
)

MOBILE = "13900002222"
MAX_ATTEMPTS = 5
RESEND_INTERVAL = 60
START = datetime(2026, 11, 11, 12, 0, 0)


class SmsCodeLimitTestBase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.now = START
        self.sent = []
        self.dispatch_error = None
        for active_patch in (
            # 与生产一致：响应里不返回验证码，只能从“短信”里拿
            patch.object(settings, "SMS_MOCK", False),
            patch.object(settings, "SMS_CODE_LENGTH", 6),
            patch.object(settings, "SMS_CODE_TTL_MINUTES", 5),
            patch.object(settings, "SMS_RESEND_INTERVAL_SECONDS", RESEND_INTERVAL),
            patch.object(settings, "SMS_CODE_MAX_ATTEMPTS", MAX_ATTEMPTS),
            patch.object(sms_service, "_dispatch_sms", side_effect=self._fake_dispatch),
            patch.object(sms_service, "china_now", side_effect=lambda: self.now),
            patch("web_auth._issue_token", return_value="test-token"),
        ):
            active_patch.start()
            self.addCleanup(active_patch.stop)

    def tearDown(self):
        self.engine.dispose()

    def _fake_dispatch(self, mobile, code, purpose="login"):
        if self.dispatch_error is not None:
            raise self.dispatch_error
        self.sent.append((mobile, code, purpose))

    def _request(self, handler):
        """模拟一次 HTTP 请求：独立会话，结束时关闭（与 get_db 一致，未提交的改动回滚）。"""
        db = self.Session()
        try:
            return handler(db)
        finally:
            db.close()

    def _advance(self, seconds):
        self.now += timedelta(seconds=seconds)

    def _send(self, purpose):
        self._request(
            lambda db: web_send_code(SendCodeRequest(phone=MOBILE, purpose=purpose), db=db)
        )
        mobile, code, sent_purpose = self.sent[-1]
        self.assertEqual((MOBILE, purpose), (mobile, sent_purpose))
        return code

    def _expect_http_error(self, handler):
        with self.assertRaises(HTTPException) as raised:
            self._request(handler)
        return raised.exception

    def _records(self):
        db = self.Session()
        try:
            return (
                db.query(AppSmsVerification)
                .order_by(AppSmsVerification.Id.asc())
                .all()
            )
        finally:
            db.close()

    @staticmethod
    def _wrong(code):
        return "000000" if code != "000000" else "111111"


class SmsCodeAttemptLimitTests(SmsCodeLimitTestBase):
    def _create_account(self):
        db = self.Session()
        try:
            db.add(
                AppAccount(
                    Mobile=MOBILE,
                    OpenId="web_phone_" + MOBILE,
                    ActiveRole="Patient",
                    IsActive=True,
                )
            )
            db.commit()
        finally:
            db.close()

    def _login(self, code):
        return self._request(
            lambda db: web_login(LoginRequest(phone=MOBILE, code=code), db=db)
        )

    def _register(self, code):
        return self._request(
            lambda db: web_register(
                RegisterRequest(phone=MOBILE, code=code, password="secret1"),
                db=db,
            )
        )

    def test_correct_code_is_rejected_after_too_many_wrong_attempts(self):
        self._create_account()
        code = self._send("login")

        for remaining in range(MAX_ATTEMPTS - 1, 0, -1):
            error = self._expect_http_error(lambda db: web_login(
                LoginRequest(phone=MOBILE, code=self._wrong(code)), db=db
            ))
            self.assertEqual(400, error.status_code)
            self.assertIn(f"还可尝试 {remaining} 次", error.detail)

        with self.assertLogs("sms_service", level="WARNING") as logs:
            error = self._expect_http_error(lambda db: web_login(
                LoginRequest(phone=MOBILE, code=self._wrong(code)), db=db
            ))
        self.assertEqual(400, error.status_code)
        self.assertEqual(sms_service.TOO_MANY_ATTEMPTS_DETAIL, error.detail)
        (log_record,) = logs.records
        self.assertEqual("sms_code_attempts_exhausted", log_record.event)
        self.assertEqual("login", log_record.purpose)
        self.assertNotIn(MOBILE, repr(vars(log_record)))

        # 达到上限后，正确的验证码也不能再登录
        error = self._expect_http_error(
            lambda db: web_login(LoginRequest(phone=MOBILE, code=code), db=db)
        )
        self.assertEqual(400, error.status_code)
        self.assertEqual(sms_service.TOO_MANY_ATTEMPTS_DETAIL, error.detail)

        (record,) = self._records()
        self.assertEqual(MAX_ATTEMPTS, record.FailedAttempts)
        self.assertIsNone(record.UsedAt)
        db = self.Session()
        try:
            self.assertEqual(0, db.query(AppLoginSession).count())
        finally:
            db.close()

    def test_wrong_attempt_count_survives_the_failed_request(self):
        self._create_account()
        code = self._send("login")

        # 每次失败请求结束时会话被关闭（未提交的改动全部回滚），计数仍要保留
        self._expect_http_error(lambda db: web_login(
            LoginRequest(phone=MOBILE, code=self._wrong(code)), db=db
        ))
        self.assertEqual(1, self._records()[0].FailedAttempts)

        self._expect_http_error(lambda db: web_login(
            LoginRequest(phone=MOBILE, code=self._wrong(code)), db=db
        ))
        self.assertEqual(2, self._records()[0].FailedAttempts)

        # 次数未用完时正确验证码仍可登录
        self.assertEqual("test-token", self._login(code).token)
        self.assertIsNotNone(self._records()[0].UsedAt)

    def test_register_counts_wrong_attempts_but_still_defers_consumption(self):
        """注册用 commit=False：输错仍单独提交计数，输对则与建账号同一事务提交。"""
        code = self._send("register")

        error = self._expect_http_error(lambda db: web_register(
            RegisterRequest(phone=MOBILE, code=self._wrong(code), password="secret1"),
            db=db,
        ))
        self.assertIn(f"还可尝试 {MAX_ATTEMPTS - 1} 次", error.detail)
        self.assertEqual(1, self._records()[0].FailedAttempts)

        # 建账号失败时整体回滚：验证码不被消耗，已有的错误计数也不受影响
        with patch("web_auth._ensure_patient_role", side_effect=RuntimeError("db down")):
            with self.assertRaises(RuntimeError):
                self._register(code)
        (record,) = self._records()
        self.assertIsNone(record.UsedAt)
        self.assertEqual(1, record.FailedAttempts)
        db = self.Session()
        try:
            self.assertEqual(0, db.query(AppAccount).count())
        finally:
            db.close()

        self.assertEqual("test-token", self._register(code).token)
        self.assertIsNotNone(self._records()[0].UsedAt)

    def test_verify_code_with_commit_false_persists_wrong_attempts(self):
        code = self._send("register")

        db = self.Session()
        try:
            with self.assertRaises(HTTPException):
                sms_service.verify_code(db, MOBILE, self._wrong(code), "register", commit=False)
        finally:
            db.close()  # 不提交直接关闭，等同请求以 400 结束

        self.assertEqual(1, self._records()[0].FailedAttempts)

    def test_resend_after_lockout_issues_a_new_code(self):
        self._create_account()
        code = self._send("login")
        with self.assertLogs("sms_service", level="WARNING"):
            for _ in range(MAX_ATTEMPTS):
                self._expect_http_error(lambda db: web_login(
                    LoginRequest(phone=MOBILE, code=self._wrong(code)), db=db
                ))

        self._advance(RESEND_INTERVAL + 1)
        new_code = self._send("login")

        old_record, new_record = self._records()
        self.assertEqual(MAX_ATTEMPTS, old_record.FailedAttempts)
        self.assertEqual(0, new_record.FailedAttempts)
        self.assertEqual(new_code, new_record.Code)
        self.assertEqual("test-token", self._login(new_code).token)

    def test_resend_within_validity_keeps_the_wrong_attempt_count(self):
        """重发复用同一验证码时不清零错误次数，否则可以靠重发无限猜。"""
        self._create_account()
        code = self._send("login")
        for _ in range(MAX_ATTEMPTS - 1):
            self._expect_http_error(lambda db: web_login(
                LoginRequest(phone=MOBILE, code=self._wrong(code)), db=db
            ))

        self._advance(RESEND_INTERVAL + 1)
        self.assertEqual(code, self._send("login"))

        with self.assertLogs("sms_service", level="WARNING"):
            error = self._expect_http_error(lambda db: web_login(
                LoginRequest(phone=MOBILE, code=self._wrong(code)), db=db
            ))
        self.assertEqual(sms_service.TOO_MANY_ATTEMPTS_DETAIL, error.detail)
        error = self._expect_http_error(
            lambda db: web_login(LoginRequest(phone=MOBILE, code=code), db=db)
        )
        self.assertEqual(sms_service.TOO_MANY_ATTEMPTS_DETAIL, error.detail)

    def test_malformed_code_does_not_count_as_an_attempt(self):
        self._create_account()
        self._send("login")

        error = self._expect_http_error(
            lambda db: web_login(LoginRequest(phone=MOBILE, code="12ab"), db=db)
        )
        self.assertEqual(400, error.status_code)
        self.assertEqual(0, self._records()[0].FailedAttempts)


class SmsResendIntervalTests(SmsCodeLimitTestBase):
    def _send_register_code(self):
        return self._send("register")

    def _expect_too_frequent(self):
        error = self._expect_http_error(
            lambda db: web_send_code(SendCodeRequest(phone=MOBILE, purpose="register"), db=db)
        )
        self.assertEqual(429, error.status_code)
        return error.detail

    def test_resend_interval_restarts_when_the_code_is_reused(self):
        code = self._send_register_code()

        self._advance(RESEND_INTERVAL + 1)
        self.assertEqual(code, self._send_register_code())  # 有效期内复用同一个码
        (record,) = self._records()
        self.assertEqual(START, record.CreatedAt)
        self.assertEqual(self.now, record.LastSentAt)

        # 距首次发送已 90 秒，但距上次发送只有 29 秒，仍要等
        self._advance(29)
        self.assertIn("31 秒", self._expect_too_frequent())
        self.assertEqual(2, len(self.sent))

        self._advance(32)  # 距上次发送 61 秒
        self.assertEqual(code, self._send_register_code())
        self.assertEqual(3, len(self.sent))

    def test_resend_within_interval_is_rejected_for_a_new_code(self):
        self._send_register_code()

        self._advance(10)
        self.assertIn("50 秒", self._expect_too_frequent())
        self.assertEqual(1, len(self.sent))

    def test_failed_dispatch_does_not_start_the_interval(self):
        code = self._send_register_code()

        self._advance(RESEND_INTERVAL + 1)
        self.dispatch_error = HTTPException(status_code=502, detail="短信发送失败，请稍后重试")
        error = self._expect_http_error(
            lambda db: web_send_code(SendCodeRequest(phone=MOBILE, purpose="register"), db=db)
        )
        self.assertEqual(502, error.status_code)
        self.assertEqual(START, self._records()[0].LastSentAt)  # 下发失败整体回滚

        self.dispatch_error = None
        self._advance(1)
        self.assertEqual(code, self._send_register_code())

    def test_legacy_record_without_last_sent_at_falls_back_to_created_at(self):
        db = self.Session()
        try:
            db.add(
                AppSmsVerification(
                    Mobile=MOBILE,
                    Code="123456",
                    Purpose="register",
                    ExpiresAt=START + timedelta(minutes=5),
                    CreatedAt=START,
                    LastSentAt=None,
                )
            )
            db.commit()
        finally:
            db.close()

        self._advance(20)
        self.assertIn("40 秒", self._expect_too_frequent())

        self._advance(41)
        self.assertEqual("123456", self._send_register_code())
        self.assertEqual(self.now, self._records()[0].LastSentAt)


if __name__ == "__main__":
    unittest.main()
