import unittest
from datetime import date, datetime

from web_admin import (
    IMPORT_HEADERS,
    _import_description,
    _parse_duration_minutes,
    _parse_optional_datetime,
)


class DataImportParsingTests(unittest.TestCase):
    def test_headers_match_customer_record_template(self):
        self.assertEqual(
            IMPORT_HEADERS,
            (
                "日期",
                "星期",
                "时间",
                "咨询师",
                "来访者",
                "付费状况",
                "付费时间",
                "付费方式",
                "付费金额",
                "取消备注",
                "形式",
                "地点",
                "咨询室",
                "次数",
                "咨询时数",
                "备注",
                "助理",
                "目前阶段",
                "最后咨询次数",
                "总时长",
                "合计收入",
            ),
        )

    def test_month_day_payment_date_uses_the_previous_year_when_needed(self):
        self.assertEqual(
            _parse_optional_datetime("12/30", date(2026, 1, 1)),
            datetime(2025, 12, 30),
        )

    def test_one_consultation_hour_maps_to_the_standard_fifty_minutes(self):
        self.assertEqual(_parse_duration_minutes(1), 50)

    def test_import_description_keeps_template_metadata(self):
        description = _import_description(
            {
                "星期": "星期四",
                "付费状况": "已付费",
                "付费方式": "微信",
                "次数": 11,
                "咨询时数": 1,
                "助理": "刘又畅",
                "目前阶段": "正在咨询",
                "最后咨询次数": 33,
                "总时长": 32.5,
                "合计收入": 2600,
            },
            "示例咨询师",
            "李hy",
        )

        self.assertIn("星期:星期四", description)
        self.assertIn("付费方式:微信", description)
        self.assertIn("合计收入:2600", description)


if __name__ == "__main__":
    unittest.main()
