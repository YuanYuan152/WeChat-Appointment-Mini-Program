import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from admin import (
    CounselorDisplayOrderSavePayload,
    CounselorDisplayOrderItemIn,
    CounselorPublicVisibilityPayload,
    get_counselor_display_order,
    save_counselor_display_order,
    set_counselor_public_visibility,
)
from common import _profile_is_public_visible, _sort_counselor_list, list_public_counselors
from database import Base
from models import AppAccount, AppCounselorProfile, AppRoleBinding, AppSchedule


class CounselorDisplayOrderTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppCounselorProfile.__table__,
                AppSchedule.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

        self.staff = AppAccount(
            Id=1, Mobile="13800000001", RealName="助理", ActiveRole="Assistant", IsActive=True
        )
        self.c1 = AppAccount(
            Id=10, Mobile="13800000010", RealName="甲", ActiveRole="Counselor", IsActive=True
        )
        self.c2 = AppAccount(
            Id=20, Mobile="13800000020", RealName="乙", ActiveRole="Counselor", IsActive=True
        )
        self.c3 = AppAccount(
            Id=30, Mobile="13800000030", RealName="丙", ActiveRole="Counselor", IsActive=True
        )
        self.db.add_all([self.staff, self.c1, self.c2, self.c3])
        self.db.add_all(
            [
                AppRoleBinding(AccountId=1, RoleType="Assistant"),
                AppRoleBinding(AccountId=10, RoleType="Counselor"),
                AppRoleBinding(AccountId=20, RoleType="Counselor"),
                AppRoleBinding(AccountId=30, RoleType="Counselor"),
            ]
        )
        self.db.add_all(
            [
                AppCounselorProfile(
                    AccountId=10,
                    Name="甲",
                    Billing=30000,
                    FaceBilling=30000,
                    IsActive=True,
                    IsPinned=False,
                    ListSortRank=0,
                    IsPublicVisible=True,
                ),
                AppCounselorProfile(
                    AccountId=20,
                    Name="乙",
                    Billing=50000,
                    FaceBilling=30000,
                    IsActive=True,
                    IsPinned=False,
                    ListSortRank=0,
                    IsPublicVisible=True,
                ),
                AppCounselorProfile(
                    AccountId=30,
                    Name="丙",
                    Billing=80000,
                    FaceBilling=30000,
                    IsActive=True,
                    IsPinned=False,
                    ListSortRank=0,
                    IsPublicVisible=True,
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_sort_pin_and_rank_before_price(self):
        items = [
            {"id": 1, "billing": 90000, "isPinned": False, "listSortRank": 2, "consultHours": 0, "workYears": 0, "_source": "AppCounselorProfile"},
            {"id": 2, "billing": 10000, "isPinned": True, "listSortRank": 9, "consultHours": 0, "workYears": 0, "_source": "AppCounselorProfile"},
            {"id": 3, "billing": 50000, "isPinned": False, "listSortRank": 1, "consultHours": 0, "workYears": 0, "_source": "AppCounselorProfile"},
        ]
        _sort_counselor_list(items, sort_mode="price_desc", available_ids=set())
        self.assertEqual([i["id"] for i in items], [2, 3, 1])

    def test_hidden_excluded_from_public_list_but_kept_in_admin_order(self):
        profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 20)
            .first()
        )
        profile.IsPublicVisible = False
        self.db.commit()

        public = list_public_counselors(self.db, reconcile_legacy=False)
        public_ids = [int(item["id"]) for item in public["items"]]
        self.assertNotIn(20, public_ids)
        self.assertIn(10, public_ids)
        self.assertIn(30, public_ids)

        admin_order = get_counselor_display_order(_staff=self.staff, db=self.db)
        admin_ids = [int(item["counselorId"]) for item in admin_order["items"]]
        self.assertIn(20, admin_ids)
        hidden = next(item for item in admin_order["items"] if item["counselorId"] == 20)
        self.assertFalse(hidden["isPublicVisible"])
        self.assertFalse(_profile_is_public_visible(profile))

    def test_save_display_order_persists_pin_rank_and_visibility(self):
        payload = CounselorDisplayOrderSavePayload(
            items=[
                CounselorDisplayOrderItemIn(
                    counselorId=10, isPinned=True, isPublicVisible=True, listSortRank=1
                ),
                CounselorDisplayOrderItemIn(
                    counselorId=30, isPinned=False, isPublicVisible=False, listSortRank=2
                ),
                CounselorDisplayOrderItemIn(
                    counselorId=20, isPinned=False, isPublicVisible=True, listSortRank=3
                ),
            ]
        )
        result = save_counselor_display_order(body=payload, _staff=self.staff, db=self.db)
        ids = [item["counselorId"] for item in result["items"]]
        self.assertEqual(ids[0], 10)
        self.assertTrue(result["items"][0]["isPinned"])

        p30 = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 30)
            .first()
        )
        self.assertFalse(p30.IsPublicVisible)
        public = list_public_counselors(self.db, reconcile_legacy=False)
        self.assertNotIn(30, [int(item["id"]) for item in public["items"]])

    def test_set_counselor_public_visibility_endpoint(self):
        result = set_counselor_public_visibility(
            counselor_id=10,
            body=CounselorPublicVisibilityPayload(isPublicVisible=False),
            _admin=self.staff,
            db=self.db,
        )
        self.assertFalse(result["isPublicVisible"])

        profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 10)
            .first()
        )
        self.assertFalse(profile.IsPublicVisible)

        public = list_public_counselors(self.db, reconcile_legacy=False)
        self.assertNotIn(10, [int(row["id"]) for row in public["items"]])

        restored = set_counselor_public_visibility(
            counselor_id=10,
            body=CounselorPublicVisibilityPayload(isPublicVisible=True),
            _admin=self.staff,
            db=self.db,
        )
        self.assertTrue(restored["isPublicVisible"])
        self.db.refresh(profile)
        self.assertTrue(profile.IsPublicVisible)


if __name__ == "__main__":
    unittest.main()
