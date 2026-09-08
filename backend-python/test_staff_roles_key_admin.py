import unittest

from staff_roles import (
    KEY_LOGIN_ADMIN_OPENID,
    assert_can_assign_role,
    assert_can_manage_user,
    can_actor_assign_role,
    can_actor_manage_user,
    is_key_login_admin_account,
)


class StaffRolesKeyAdminTests(unittest.TestCase):
    def test_openid_detection(self):
        self.assertTrue(is_key_login_admin_account(KEY_LOGIN_ADMIN_OPENID))
        self.assertTrue(is_key_login_admin_account(type("A", (), {"OpenId": KEY_LOGIN_ADMIN_OPENID})()))
        self.assertFalse(is_key_login_admin_account("wx_other"))

    def test_only_key_admin_can_assign_admin(self):
        self.assertTrue(
            can_actor_assign_role("Admin", "Admin", actor_is_key_admin=True)
        )
        self.assertFalse(
            can_actor_assign_role("Admin", "Admin", actor_is_key_admin=False)
        )
        self.assertFalse(can_actor_assign_role("Ops", "Admin", actor_is_key_admin=False))

    def test_only_key_admin_can_manage_other_admins(self):
        self.assertTrue(
            can_actor_manage_user(
                "Admin",
                "Admin",
                actor_is_key_admin=True,
                target_is_key_admin=False,
            )
        )
        self.assertFalse(
            can_actor_manage_user(
                "Admin",
                "Admin",
                actor_is_key_admin=False,
                target_is_key_admin=False,
            )
        )

    def test_key_admin_account_is_immutable(self):
        self.assertFalse(
            can_actor_manage_user(
                "Admin",
                "Admin",
                actor_is_key_admin=True,
                target_is_key_admin=True,
            )
        )
        with self.assertRaises(PermissionError) as raised:
            assert_can_manage_user(
                "Admin",
                "Admin",
                actor_is_key_admin=True,
                target_is_key_admin=True,
            )
        self.assertIn("密钥登录管理员", str(raised.exception))

    def test_regular_admin_still_manages_lower_roles(self):
        self.assertTrue(can_actor_manage_user("Admin", "Ops", actor_is_key_admin=False))
        self.assertTrue(can_actor_assign_role("Admin", "Tester", actor_is_key_admin=False))
        assert_can_assign_role("Admin", "Ops", actor_is_key_admin=False)

    def test_admin_only_specialized_web_roles(self):
        for role in ("ContentOps", "Marketing", "Research"):
            self.assertTrue(can_actor_assign_role("Admin", role, actor_is_key_admin=False))
            self.assertFalse(can_actor_assign_role("Ops", role, actor_is_key_admin=False))
            self.assertFalse(can_actor_assign_role("Assistant", role, actor_is_key_admin=False))

    def test_specialized_role_helpers(self):
        from staff_roles import (
            is_assessment_editor_role,
            is_assessment_viewer_role,
            is_content_manager_role,
            is_visitor_ui_role,
        )

        self.assertTrue(is_content_manager_role("ContentOps"))
        self.assertTrue(is_content_manager_role("Marketing"))
        self.assertFalse(is_content_manager_role("Research"))
        self.assertTrue(is_assessment_editor_role("Research"))
        self.assertTrue(is_assessment_viewer_role("Research"))
        self.assertFalse(is_assessment_editor_role("ContentOps"))
        for role in ("Patient", "ContentOps", "Marketing", "Research"):
            self.assertTrue(is_visitor_ui_role(role))
        self.assertFalse(is_visitor_ui_role("Admin"))


if __name__ == "__main__":
    unittest.main()
