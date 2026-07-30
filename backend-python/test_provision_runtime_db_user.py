import contextlib
import io
import unittest

import provision_runtime_db_user as subject


class ProvisionRuntimeDbUserTests(unittest.TestCase):
    def test_valid_runtime_credentials_are_accepted(self):
        user, password = subject.validate_runtime_credentials(
            "mini_test_app",
            "Runtime_Test_2026!Strong",
            "sa",
            "Migration_Test_2026!Different",
        )
        self.assertEqual(user, "mini_test_app")
        self.assertEqual(password, "Runtime_Test_2026!Strong")

    def test_runtime_identity_must_differ_from_migration_identity(self):
        with self.assertRaises(subject.ProvisioningError):
            subject.validate_runtime_credentials(
                "migration_user",
                "Runtime_Test_2026!Strong",
                "migration_user",
                "Migration_Test_2026!Different",
            )

    def test_runtime_password_must_not_reuse_migration_password(self):
        shared = "Shared_Password_2026!Strong"
        with self.assertRaises(subject.ProvisioningError):
            subject.validate_runtime_credentials(
                "mini_test_app",
                shared,
                "sa",
                shared,
            )

    def test_runtime_password_rejects_odbc_delimiters(self):
        with self.assertRaises(subject.ProvisioningError):
            subject.validate_runtime_credentials(
                "mini_test_app",
                "Runtime_Test_2026!Bad;Value",
                "sa",
                "Migration_Test_2026!Different",
            )

    def test_create_login_statement_uses_bound_parameters(self):
        self.assertNotIn("Runtime_Test_2026!Strong", subject.CREATE_LOGIN_SQL)
        self.assertGreaterEqual(subject.CREATE_LOGIN_SQL.count("?"), 3)
        self.assertIn("QUOTENAME(@password", subject.CREATE_LOGIN_SQL)

    def test_offline_plan_contains_no_secret(self):
        secret = "Runtime_Test_2026!NeverPrint"
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            subject.print_offline_plan()
        self.assertNotIn(secret, output.getvalue())
        self.assertIn("[DRY-RUN]", output.getvalue())


if __name__ == "__main__":
    unittest.main()
