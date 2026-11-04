"""企业咨询师勾选：只写企业配置，排序和文案覆盖不碰主档。"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from assessment_enterprise_service import (
    build_stored_counselor,
    effective_counselor_copy,
    normalize_enterprise_counselors,
    save_enterprise,
    save_enterprise_counselor_config,
)


class EnterpriseCounselorConfigTests(unittest.TestCase):
    def test_normalize_keeps_enterprise_pin_and_drops_master_fields(self):
        stored = normalize_enterprise_counselors(
            [
                {
                    "accountId": 8,
                    "pinned": False,
                    "isPinned": True,
                    "billing": 60000,
                    "sortOrder": 2,
                    "introduce": "  企业介绍  ",
                    "qualification": "企业资质",
                },
                {
                    "accountId": 3,
                    "pinned": True,
                    "sortOrder": 5,
                    "career": "企业经历",
                },
                {
                    "accountId": 3,
                    "pinned": False,
                    "sortOrder": 0,
                },
                {"accountId": "bad"},
            ]
        )
        self.assertEqual([item["accountId"] for item in stored], [3, 8])
        self.assertTrue(stored[0]["pinned"])
        self.assertNotIn("isPinned", stored[0])
        self.assertNotIn("billing", stored[1])
        self.assertEqual(stored[1]["introduce"], "企业介绍")
        self.assertEqual(stored[1]["qualification"], "企业资质")
        self.assertNotIn("career", stored[1])

    def test_same_tier_order_follows_enterprise_sort(self):
        stored = normalize_enterprise_counselors(
            [
                {"accountId": 1, "pinned": False, "sortOrder": 0},
                {"accountId": 2, "pinned": True, "sortOrder": 5},
                {"accountId": 4, "pinned": False, "sortOrder": 2},
                {"accountId": 3, "pinned": True, "sortOrder": 1},
            ]
        )
        self.assertEqual([item["accountId"] for item in stored], [3, 2, 1, 4])

    def test_unchanged_copy_is_not_stored(self):
        stored = build_stored_counselor(
            {
                "accountId": 9,
                "pinned": True,
                "sortOrder": 0,
                "introduce": " 主档介绍 ",
                "qualification": "只属于这家企业",
                "specialty": "主档流派",
                "field": "",
                "trainingExperience": "主档受训",
                "targetGroup": "主档人群",
                "career": "旧字段不保存",
                "billing": 1,
            },
            {
                "introduce": "主档介绍",
                "qualification": "主档资质",
                "specialty": "主档流派",
                "field": "主档领域",
                "trainingExperience": "主档受训",
                "targetGroup": "主档人群",
            },
        )
        self.assertEqual(
            stored,
            {
                "accountId": 9,
                "pinned": True,
                "sortOrder": 0,
                "qualification": "只属于这家企业",
                "field": "",
            },
        )
        self.assertNotIn("introduce", stored)
        self.assertNotIn("career", stored)
        self.assertNotIn("billing", stored)

    def test_missing_override_uses_master_text(self):
        self.assertEqual(effective_counselor_copy({}, "introduce", "主档介绍"), "主档介绍")
        self.assertEqual(
            effective_counselor_copy({"introduce": "企业介绍"}, "introduce", "主档介绍"),
            "企业介绍",
        )
        self.assertEqual(
            effective_counselor_copy({"introduce": ""}, "introduce", "主档介绍"),
            "",
        )

    def test_save_updates_only_counselors_on_this_enterprise(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "enterprises.json"
            path.write_text(
                json.dumps(
                    [
                        {
                            "id": "ent-a",
                            "companyName": "甲公司",
                            "siteName": "心安 EAP",
                            "logoUrl": "/static/uploads/eap-default-logo.png",
                            "slogan": "原口号",
                            "url": "https://example.com/abcdefghijklmnopqrst",
                            "slug": "abcdefghijklmnopqrst",
                            "assessmentIds": ["scale-1"],
                            "counselors": [{"accountId": 1, "pinned": False, "sortOrder": 0}],
                        },
                        {
                            "id": "ent-b",
                            "companyName": "乙公司",
                            "siteName": "心安 EAP",
                            "logoUrl": "/static/uploads/eap-default-logo.png",
                            "slogan": "乙口号",
                            "url": "https://example.com/bbcdefghijklmnopqrst",
                            "slug": "bbcdefghijklmnopqrst",
                            "assessmentIds": ["scale-1"],
                            "counselors": [{"accountId": 7, "pinned": True, "sortOrder": 0}],
                        },
                    ],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            with patch("assessment_enterprise_service._data_path", return_value=path):
                save_enterprise_counselor_config(
                    "ent-a",
                    [
                        {
                            "accountId": 4,
                            "pinned": True,
                            "sortOrder": 1,
                            "introduce": "甲企业介绍",
                            "isPinned": True,
                            "billing": 100,
                        }
                    ],
                )
                saved = save_enterprise(
                    enterprise_id="ent-a",
                    company_name="甲公司",
                    url="https://example.com/abcdefghijklmnopqrst",
                    assessment_ids=["scale-1"],
                    site_name="心安 EAP",
                    logo_url="/static/uploads/eap-default-logo.png",
                    slogan="新口号",
                )
            payload = json.loads(path.read_text(encoding="utf-8"))
            company_a = next(item for item in payload if item["id"] == "ent-a")
            company_b = next(item for item in payload if item["id"] == "ent-b")
            self.assertEqual(company_a["slogan"], "新口号")
            self.assertEqual(company_a["counselors"][0]["accountId"], 4)
            self.assertEqual(company_a["counselors"][0]["introduce"], "甲企业介绍")
            self.assertTrue(company_a["counselors"][0]["pinned"])
            self.assertNotIn("isPinned", company_a["counselors"][0])
            self.assertNotIn("billing", company_a["counselors"][0])
            self.assertEqual(company_b["counselors"][0]["accountId"], 7)
            self.assertEqual(saved["counselors"][0]["accountId"], 4)


if __name__ == "__main__":
    unittest.main()
