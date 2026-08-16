import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from auth import BindMobileRequest, bind_mobile
from models import AppAccount, AppLoginSession, AppRoleBinding
from web_auth import (
    RegisterRequest,
    SendCodeRequest,
    StaffLoginRequest,
    StaffSendCodeRequest,
    web_register,
    web_send_code,
    web_staff_login,
    web_staff_send_code,
)


class WebAuthStaffInviteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppLoginSession.__table__,
            ],
        )
        self.db = sessionmaker(bind=self.engine, autoflush=False)()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_account(self, mobile, openid, role="Patient"):
        account = AppAccount(
            Mobile=mobile,
            OpenId=openid,
            ActiveRole=role,
            IsActive=True,
        )
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    @patch("web_auth.send_verification_code")
    def test_staff_invite_can_request_register_code(self, send_code):
        mobile = "13800000001"
        self.add_account(mobile, "admin_invite_" + mobile)
        send_code.return_value = {"message": "ok", "expiresIn": 300}

        result = web_send_code(
            SendCodeRequest(phone=mobile, purpose="register"),
            db=self.db,
        )

        self.assertEqual("ok", result["message"])
        send_code.assert_called_once_with(self.db, mobile, "register")

    @patch("web_auth._issue_token", return_value="test-token")
    @patch("web_auth.verify_code")
    def test_register_claims_staff_invite_instead_of_rejecting(self, verify_code, _issue_token):
        mobile = "13800000002"
        account = self.add_account(mobile, "admin_invite_" + mobile)

        result = web_register(
            RegisterRequest(phone=mobile, code="123456"),
            db=self.db,
        )

        self.db.refresh(account)
        self.assertEqual("test-token", result.token)
        self.assertTrue(result.is_new_user)
        self.assertEqual("web_phone_" + mobile, account.OpenId)
        verify_code.assert_called_once_with(self.db, mobile, "123456", "register")

    def test_regular_registered_account_is_still_rejected(self):
        mobile = "13800000003"
        self.add_account(mobile, "web_phone_" + mobile)

        with self.assertRaises(HTTPException) as raised:
            web_register(
                RegisterRequest(phone=mobile, code="123456"),
                db=self.db,
            )

        self.assertEqual(409, raised.exception.status_code)

    @patch("web_auth.send_verification_code")
    def test_staff_account_requests_separate_login_purpose(self, send_code):
        mobile = "13800000005"
        self.add_account(mobile, "admin_invite_" + mobile, role="Admin")
        send_code.return_value = {"message": "ok", "expiresIn": 300, "resendAfter": 60}

        result = web_staff_send_code(StaffSendCodeRequest(phone=mobile), db=self.db)

        self.assertEqual("ok", result["message"])
        send_code.assert_called_once_with(self.db, mobile, "staff_login")

    @patch("web_auth.send_verification_code")
    def test_patient_cannot_request_staff_login_code(self, send_code):
        mobile = "13800000006"
        self.add_account(mobile, "web_phone_" + mobile, role="Patient")

        result = web_staff_send_code(StaffSendCodeRequest(phone=mobile), db=self.db)

        self.assertIn("如该手机号", result["message"])
        send_code.assert_not_called()

    @patch("web_auth._issue_token", return_value="staff-token")
    @patch("web_auth.verify_code")
    def test_staff_login_requires_staff_role(self, verify_code, issue_token):
        mobile = "13800000007"
        account = self.add_account(mobile, "admin_invite_" + mobile, role="Assistant")

        result = web_staff_login(
            StaffLoginRequest(phone=mobile, code="123456"),
            db=self.db,
        )

        self.assertEqual("staff-token", result.token)
        verify_code.assert_called_once_with(self.db, mobile, "123456", "staff_login")
        issue_token.assert_called_once_with(self.db, account)

    @patch("web_auth.verify_code")
    def test_patient_is_rejected_by_staff_login(self, verify_code):
        mobile = "13800000008"
        self.add_account(mobile, "web_phone_" + mobile, role="Patient")

        with self.assertRaises(HTTPException) as raised:
            web_staff_login(
                StaffLoginRequest(phone=mobile, code="123456"),
                db=self.db,
            )

        self.assertEqual(403, raised.exception.status_code)
        verify_code.assert_not_called()

    @patch(
        "auth.create_access_token",
        return_value=("replacement-token", datetime.utcnow() + timedelta(hours=1)),
    )
    @patch("auth._exchange_wechat_phone_number")
    @patch("auth._is_wechat_configured", return_value=True)
    def test_wechat_mobile_binding_claims_staff_invite(
        self,
        _wechat_configured,
        exchange_phone,
        _create_token,
    ):
        mobile = "13800000004"
        invited = self.add_account(mobile, "admin_invite_" + mobile)
        current = AppAccount(OpenId="wx_openid_new", ActiveRole="Patient", IsActive=True)
        self.db.add(current)
        self.db.commit()
        self.db.refresh(current)
        self.db.add(
            AppLoginSession(
                Id=100,
                AccountId=current.Id,
                Token="temporary-token",
                SessionKey="wechat-session-key",
                ExpiresAt=datetime.utcnow() + timedelta(hours=1),
            )
        )
        self.db.commit()
        exchange_phone.return_value = mobile

        result = bind_mobile(
            BindMobileRequest(phoneCode="wechat-phone-code"),
            current_account=current,
            db=self.db,
        )

        self.db.refresh(invited)
        self.db.refresh(current)
        self.assertEqual("replacement-token", result["token"])
        self.assertEqual(invited.Id, result["id"])
        self.assertEqual("wx_openid_new", invited.OpenId)
        self.assertFalse(current.IsActive)
        self.assertEqual(
            0,
            self.db.query(AppLoginSession)
            .filter(AppLoginSession.AccountId == current.Id)
            .count(),
        )
        self.assertEqual(
            1,
            self.db.query(AppLoginSession)
            .filter(AppLoginSession.AccountId == invited.Id)
            .count(),
        )


if __name__ == "__main__":
    unittest.main()
