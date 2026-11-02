import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from fastapi import HTTPException

from auth import create_access_token, get_current_account
from database import Base
from enterprise_site_personnel_service import (
    EnterprisePersonnelError,
    ROLE_ADMIN,
    ROLE_EMPLOYEE,
    assert_enterprise_deletable,
    assert_not_app_account_table,
    delete_personnel,
    generate_personnel,
    login_personnel,
    login_required,
    personnel_count,
    personnel_summary,
    resolve_personnel_from_authorization,
)
from models import AppAccount, EnterpriseSitePersonnel
from password_utils import hash_password


class EnterpriseSitePersonnelTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.enterprise_id = "ent-isolated-1"
        self.slug = "acme-secure-suffix-abcdef1234"

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def generate(self, **overrides):
        payload = {
            "enterprise_id": self.enterprise_id,
            "enterprise_slug": self.slug,
            "employee_count": 3,
            "admin_count": 2,
            "account_mode": "custom",
            "account_prefix": "acme",
            "password_mode": "unified",
            "unified_password": "Passw0rd",
        }
        payload.update(overrides)
        return generate_personnel(self.db, **payload)

    def test_table_is_isolated_from_app_account(self):
        assert_not_app_account_table()
        self.generate()
        self.assertEqual(self.db.query(EnterpriseSitePersonnel).count(), 5)
        self.assertEqual(self.db.query(AppAccount).count(), 0)

    def test_custom_accounts_and_unified_password(self):
        result = self.generate()
        self.assertEqual(result["employeeCount"], 3)
        self.assertEqual(result["adminCount"], 2)
        rows = (
            self.db.query(EnterpriseSitePersonnel)
            .order_by(EnterpriseSitePersonnel.Id.asc())
            .all()
        )
        self.assertEqual([row.Username for row in rows], [
            "acme00001",
            "acme00002",
            "acme00003",
            "acme00004",
            "acme00005",
        ])
        self.assertEqual([row.Role for row in rows[:3]], [ROLE_EMPLOYEE] * 3)
        self.assertEqual([row.Role for row in rows[3:]], [ROLE_ADMIN] * 2)
        self.assertEqual([row.EmpNo for row in rows], ["00001", "00002", "00003", "00004", "00005"])
        self.assertTrue(all(row.PasswordExport == "Passw0rd" for row in rows))

    def test_password_last4_and_random_accounts(self):
        self.generate(
            account_mode="random",
            account_prefix="",
            password_mode="account_last4",
            unified_password="",
        )
        rows = self.db.query(EnterpriseSitePersonnel).all()
        self.assertEqual(len({row.Username for row in rows}), 5)
        for row in rows:
            self.assertEqual(row.PasswordExport, row.Username[-4:])
            self.assertEqual(len(row.Username), 8)

    def test_cannot_generate_twice_without_delete(self):
        self.generate()
        with self.assertRaises(EnterprisePersonnelError):
            self.generate()

    def test_delete_personnel_then_enterprise_can_be_removed(self):
        self.generate()
        with self.assertRaises(EnterprisePersonnelError):
            assert_enterprise_deletable(self.db, self.enterprise_id)
        deleted = delete_personnel(self.db, self.enterprise_id)
        self.assertEqual(deleted, 5)
        self.assertEqual(personnel_count(self.db, self.enterprise_id), 0)
        assert_enterprise_deletable(self.db, self.enterprise_id)

    def test_login_only_uses_isolated_table(self):
        self.generate()
        own = AppAccount(
            Mobile="13800000000",
            RealName="自有管理员",
            ActiveRole="Admin",
            PasswordHash=hash_password("Passw0rd"),
            IsActive=True,
        )
        self.db.add(own)
        self.db.commit()

        result = login_personnel(
            self.db,
            slug=self.slug,
            username="acme00001",
            password="Passw0rd",
        )
        self.assertTrue(result["token"])
        self.assertEqual(result["profile"]["username"], "acme00001")
        self.assertEqual(result["profile"]["role"], ROLE_EMPLOYEE)

        with self.assertRaises(EnterprisePersonnelError):
            login_personnel(
                self.db,
                slug=self.slug,
                username="13800000000",
                password="Passw0rd",
            )

    def test_enterprise_site_token_cannot_resolve_app_account(self):
        self.generate()
        result = login_personnel(
            self.db,
            slug=self.slug,
            username="acme00004",
            password="Passw0rd",
        )
        person = resolve_personnel_from_authorization(
            self.db,
            f"Bearer {result['token']}",
            self.slug,
        )
        self.assertIsNotNone(person)
        self.assertEqual(person.Role, ROLE_ADMIN)

        with self.assertRaises(HTTPException) as ctx:
            get_current_account(
                authorization=f"Bearer {result['token']}",
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 401)

    def test_app_account_token_still_works(self):
        account = AppAccount(
            Mobile="13900000001",
            RealName="后台管理员",
            ActiveRole="Admin",
            PasswordHash=hash_password("secret1"),
            IsActive=True,
        )
        self.db.add(account)
        self.db.commit()
        token, _ = create_access_token({"sub": str(account.Id)})
        resolved = get_current_account(
            authorization=f"Bearer {token}",
            db=self.db,
        )
        self.assertEqual(resolved.Id, account.Id)

    def test_login_required_only_when_personnel_exists(self):
        self.assertFalse(login_required(self.db, self.slug))
        self.generate()
        self.assertTrue(login_required(self.db, self.slug))
        summary = personnel_summary(self.db, self.enterprise_id)
        self.assertEqual(summary["totalCount"], 5)
        self.assertEqual(summary["employeeCount"], 3)
        self.assertEqual(summary["adminCount"], 2)


if __name__ == "__main__":
    unittest.main()
