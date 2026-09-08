import unittest

from common import (
    _normalize_gender_value,
    _profile_completeness_score,
    _sort_counselor_list,
    list_public_counselors,
)


class CounselorListSortTests(unittest.TestCase):
    def test_price_desc_sort_then_secondary(self):
        items = [
            {
                "id": 1,
                "name": "低价完整",
                "billing": 30000,
                "consultHours": 2000,
                "workYears": 10,
                "introduce": "x",
                "title": "t",
                "specialty": "s",
                "avatarUrl": "a",
                "_source": "AppCounselorProfile",
            },
            {
                "id": 2,
                "name": "高价简单",
                "billing": 80000,
                "consultHours": 100,
                "workYears": 1,
                "_source": "AppCounselorProfile",
            },
            {
                "id": 3,
                "name": "同价更完整有档",
                "billing": 80000,
                "consultHours": 500,
                "workYears": 5,
                "introduce": "intro",
                "title": "资深",
                "specialty": "焦虑",
                "avatarUrl": "a",
                "field": "f",
                "career": "c",
                "mode": "面询",
                "_source": "AppCounselorProfile",
            },
            {
                "id": 4,
                "name": "同价更完整无档",
                "billing": 80000,
                "consultHours": 500,
                "workYears": 5,
                "introduce": "intro",
                "title": "资深",
                "specialty": "焦虑",
                "avatarUrl": "a",
                "field": "f",
                "career": "c",
                "mode": "面询",
                "_source": "AppCounselorProfile",
            },
        ]
        available = {3}
        _sort_counselor_list(items, sort_mode="price_desc", available_ids=available)
        self.assertEqual([item["id"] for item in items], [3, 4, 2, 1])
        self.assertGreater(
            _profile_completeness_score(items[0]),
            _profile_completeness_score(items[2]),
        )

    def test_default_sort_follows_admin_rank(self):
        items = [
            {
                "id": 1,
                "billing": 10000,
                "isPinned": False,
                "listSortRank": 3,
                "consultHours": 0,
                "workYears": 0,
                "_source": "AppCounselorProfile",
            },
            {
                "id": 2,
                "billing": 90000,
                "isPinned": False,
                "listSortRank": 1,
                "consultHours": 0,
                "workYears": 0,
                "_source": "AppCounselorProfile",
            },
            {
                "id": 3,
                "billing": 50000,
                "isPinned": False,
                "listSortRank": 2,
                "consultHours": 0,
                "workYears": 0,
                "_source": "AppCounselorProfile",
            },
        ]
        _sort_counselor_list(items, sort_mode=None, available_ids=set())
        self.assertEqual([item["id"] for item in items], [2, 3, 1])
        _sort_counselor_list(items, sort_mode="price_asc", available_ids=set())
        self.assertEqual([item["id"] for item in items], [1, 3, 2])
        _sort_counselor_list(items, sort_mode=None, available_ids=set())
        self.assertEqual([item["id"] for item in items], [2, 3, 1])


class CommonSearchSafetyTests(unittest.TestCase):
    def test_normalize_gender_ignores_non_string_query_defaults(self):
        class FakeQuery:
            def strip(self):
                raise AttributeError("Query objects must not be treated as gender")

        self.assertIsNone(_normalize_gender_value(FakeQuery()))
        self.assertIsNone(_normalize_gender_value(None))
        self.assertEqual(_normalize_gender_value("female"), "女")

    def test_list_public_counselors_is_callable_without_query_objects(self):
        self.assertTrue(callable(list_public_counselors))
        names = list_public_counselors.__code__.co_varnames[:6]
        self.assertIn("keyword", names)
        self.assertIn("gender", names)


if __name__ == "__main__":
    unittest.main()
