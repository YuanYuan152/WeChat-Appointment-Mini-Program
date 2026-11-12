"""官网短信验证码注册回归测试。

所有用例都替换了短信下发（sms_service._dispatch_sms / tencent_sms_client._require_sdk），
即使 backend-python/.env 配置了真实腾讯云凭证也不会真的发短信。
"""

import unittest
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sms_service
import tencent_sms_client
from config import settings
from database import Base
from models import AppAccount, AppRoleBinding, AppSmsVerification
from web_auth import RegisterRequest, SendCodeRequest, web_register, web_send_code

MOBILE = "13900001111"


class WebSmsRegisterTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.sent = []
        for active_patch in (
            # 与生产一致：响应里不返回验证码，只能从“短信”里拿
            patch.object(settings, "SMS_MOCK", False),
            patch.object(
                sms_service,
                "_dispatch_sms",
                side_effect=lambda mobile, code, purpose="login": self.sent.append(
                    (mobile, code, purpose)
                ),
            ),
        ):
            active_patch.start()
            self.addCleanup(active_patch.stop)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _send_register_code(self):
        response = web_send_code(SendCodeRequest(phone=MOBILE, purpose="register"), db=self.db)
        self.assertNotIn("mockCode", response)
        mobile, code, purpose = self.sent[-1]
        self.assertEqual((MOBILE, "register"), (mobile, purpose))
        return code

    def _register(self, code):
        with patch("web_auth._issue_token", return_value="test-token"):
            return web_register(
                RegisterRequest(phone=MOBILE, code=code, password="secret1"),
                db=self.db,
            )

    def test_register_with_sms_code_creates_patient_account(self):
        code = self._send_register_code()

        result = self._register(code)

        self.assertEqual("test-token", result.token)
        self.assertTrue(result.is_new_user)
        account = self.db.query(AppAccount).filter(AppAccount.Mobile == MOBILE).one()
        self.assertEqual("Patient", account.ActiveRole)
        self.assertIsNotNone(account.PasswordHash)
        self.assertEqual(
            1,
            self.db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == account.Id).count(),
        )
        self.assertIsNotNone(self.db.query(AppSmsVerification).one().UsedAt)

    def test_code_is_not_consumed_when_account_creation_fails(self):
        code = self._send_register_code()

        with patch("web_auth._ensure_patient_role", side_effect=RuntimeError("db down")):
            with self.assertRaises(RuntimeError):
                self._register(code)
        self.db.rollback()  # 请求结束时 get_db 关闭会话，即回滚未提交的事务

        self.assertEqual(0, self.db.query(AppAccount).count())
        self.assertIsNone(self.db.query(AppSmsVerification).one().UsedAt)
        # 同一个验证码可以直接重试成功
        self.assertEqual("test-token", self._register(code).token)

    def test_wrong_code_keeps_the_real_code_usable(self):
        code = self._send_register_code()
        wrong = "000000" if code != "000000" else "111111"

        with self.assertRaises(HTTPException) as raised:
            self._register(wrong)
        self.db.rollback()

        self.assertEqual(400, raised.exception.status_code)
        self.assertEqual(0, self.db.query(AppAccount).count())
        self.assertEqual("test-token", self._register(code).token)

    def test_code_can_only_be_used_once(self):
        code = self._send_register_code()
        sms_service.verify_code(self.db, MOBILE, code, "register")

        with self.assertRaises(HTTPException) as raised:
            sms_service.verify_code(self.db, MOBILE, code, "register")

        self.assertEqual(400, raised.exception.status_code)

    def test_login_code_is_not_sent_to_unregistered_phone(self):
        with self.assertRaises(HTTPException) as raised:
            web_send_code(SendCodeRequest(phone=MOBILE, purpose="login"), db=self.db)

        self.assertEqual(404, raised.exception.status_code)
        self.assertEqual([], self.sent)
        self.assertEqual(0, self.db.query(AppSmsVerification).count())

    def test_login_code_is_sent_to_registered_phone(self):
        self.db.add(
            AppAccount(
                Mobile=MOBILE,
                OpenId="web_phone_" + MOBILE,
                ActiveRole="Patient",
                IsActive=True,
            )
        )
        self.db.commit()

        response = web_send_code(SendCodeRequest(phone=MOBILE, purpose="login"), db=self.db)

        self.assertEqual("验证码已发送", response["message"])
        self.assertEqual([(MOBILE, "login")], [(m, p) for m, _, p in self.sent])


class TencentSmsFailureTests(unittest.TestCase):
    """腾讯云拒发时应返回明确提示，而不是 500“服务器内部错误”。"""

    @staticmethod
    def _fake_sdk(*, status_code="Ok", raise_code=None):
        class FakeSdkError(Exception):
            def __init__(self, code):
                super().__init__(code)
                self.code = code

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            def SendSms(self, request):
                if raise_code:
                    raise FakeSdkError(raise_code)
                status = SimpleNamespace(Code=status_code, Message="provider text", SerialNo="sn")
                return SimpleNamespace(SendStatusSet=[status])

        return (
            SimpleNamespace(Credential=lambda *args: None),
            FakeSdkError,
            SimpleNamespace,  # ClientProfile
            SimpleNamespace,  # HttpProfile
            SimpleNamespace(SendSmsRequest=SimpleNamespace),
            SimpleNamespace(SmsClient=FakeClient),
        )

    def _send(self, **fake_options):
        with ExitStack() as stack:
            for name, value in {
                "TENCENT_SMS_SECRET_ID": "id",
                "TENCENT_SMS_SECRET_KEY": "key",
                "TENCENT_SMS_SDK_APP_ID": "app",
                "TENCENT_SMS_SIGN_NAME": "sign",
            }.items():
                stack.enter_context(patch.object(settings, name, value))
            stack.enter_context(
                patch(
                    "tencent_sms_client._require_sdk",
                    return_value=self._fake_sdk(**fake_options),
                )
            )
            tencent_sms_client.send_sms_code(MOBILE, "123456", template_id="1")

    def _assert_failure(self, expected_status, expected_text, **fake_options):
        with self.assertLogs("tencent_sms_client", level="ERROR") as logs:
            with self.assertRaises(HTTPException) as raised:
                self._send(**fake_options)
        self.assertEqual(expected_status, raised.exception.status_code)
        self.assertIn(expected_text, raised.exception.detail)
        return logs.records[0]

    def test_successful_send(self):
        self._send(status_code="Ok")

    def test_per_number_frequency_limits_explain_what_happened(self):
        for sdk_code, text in (
            ("LimitExceeded.PhoneNumberThirtySecondLimit", "30 秒"),
            ("LimitExceeded.PhoneNumberOneHourLimit", "1 小时"),
            ("LimitExceeded.PhoneNumberDailyLimit", "今日"),
            ("LimitExceeded.PhoneNumberSameContentDailyLimit", "今日"),
        ):
            with self.subTest(sdk_code=sdk_code):
                record = self._assert_failure(429, text, status_code=sdk_code)
                self.assertEqual("tencent_sms_rejected", record.event)
                self.assertEqual(sdk_code, record.result)

    def test_unknown_rejection_is_a_generic_send_failure(self):
        record = self._assert_failure(
            502,
            "短信发送失败",
            status_code="FailedOperation.TemplateIncorrectOrUnapproved",
        )
        self.assertEqual("FailedOperation.TemplateIncorrectOrUnapproved", record.result)

    def test_sdk_exception_codes_are_mapped_too(self):
        record = self._assert_failure(
            429,
            "今日",
            raise_code="LimitExceeded.PhoneNumberDailyLimit",
        )
        self.assertEqual("tencent_sms_send_failed", record.event)
        self._assert_failure(502, "短信发送失败", raise_code="AuthFailure.SecretIdNotFound")


if __name__ == "__main__":
    unittest.main()
