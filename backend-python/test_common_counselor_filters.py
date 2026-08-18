import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from common import _mode_supports, common_counselors
from database import Base
from models import AppAccount, AppCounselorProfile


class CommonCounselorFilterTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[AppAccount.__table__, AppCounselorProfile.__table__],
        )
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.db.add_all(
            [
                AppAccount(Id=1, Gender="女", IsActive=True),
                AppAccount(Id=2, Gender="男", IsActive=True),
                AppAccount(Id=3, Gender="女", IsActive=True),
                AppCounselorProfile(
                    AccountId=1,
                    Name="线上低价",
                    Billing=40_000,
                    Mode="视频",
                    TrainingExperience="认知行为培训\n危机干预培训",
                    IsActive=True,
                ),
                AppCounselorProfile(
                    AccountId=2,
                    Name="线下高价",
                    Billing=80_000,
                    Mode="线下面询",
                    IsActive=True,
                ),
                AppCounselorProfile(
                    AccountId=3,
                    Name="双模式中价",
                    Billing=60_000,
                    Mode="面询/视频",
                    IsActive=True,
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def list_items(self, **kwargs):
        params = {
            "keyword": None,
            "page": 1,
            "page_size": 20,
            "sort": None,
            "gender": None,
            "consult_method": None,
            "current_account": None,
            "db": self.db,
        }
        params.update(kwargs)
        with patch("common.settings.SKIP_LEGACY_QUERIES", True):
            return common_counselors(**params)["items"]

    def test_filters_gender_and_historical_online_mode(self):
        items = self.list_items(gender="女", consult_method="online")
        self.assertEqual([item["id"] for item in items], [3, 1])

    def test_sorts_by_resolved_display_price(self):
        ascending = self.list_items(sort="price_asc")
        descending = self.list_items(sort="price_desc")
        self.assertEqual([item["id"] for item in ascending], [1, 3, 2])
        self.assertEqual([item["id"] for item in descending], [2, 3, 1])

    def test_exposes_new_training_experience(self):
        item = next(item for item in self.list_items() if item["id"] == 1)
        self.assertEqual(item["trainingExperience"], "认知行为培训\n危机干预培训")

    def test_mode_compatibility(self):
        self.assertTrue(_mode_supports("线上/线下", "online"))
        self.assertTrue(_mode_supports("面询/视频", "offline"))
        self.assertFalse(_mode_supports("线下面询", "online"))
        self.assertTrue(_mode_supports("", "online"))
        self.assertTrue(_mode_supports(None, "offline"))
        self.assertTrue(_mode_supports("视频咨询", "online"))
        self.assertTrue(_mode_supports("面询", "offline"))
        self.assertTrue(_mode_supports("视频咨询/面询", "online"))

    def test_normalizes_english_gender(self):
        self.db.query(AppAccount).filter(AppAccount.Id == 2).update({"Gender": "male"})
        self.db.commit()
        items = self.list_items(gender="男")
        self.assertEqual([item["id"] for item in items], [2])


if __name__ == "__main__":
    unittest.main()
