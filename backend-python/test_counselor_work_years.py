import unittest
from unittest.mock import patch

from counselor_work_years import (
    display_work_years,
    display_work_years_label,
    validate_work_start_year,
    work_start_year_for_admin,
)


class CounselorWorkYearsTests(unittest.TestCase):
    @patch("counselor_work_years.current_calendar_year", return_value=2026)
    def test_display_from_start_year(self, _mock_year):
        self.assertEqual(display_work_years(2015), 11)
        self.assertEqual(display_work_years_label(2015), "11年+")

    @patch("counselor_work_years.current_calendar_year", return_value=2026)
    def test_legacy_years_count_still_displays(self, _mock_year):
        self.assertEqual(display_work_years(9), 9)
        self.assertEqual(work_start_year_for_admin(9), 2017)

    @patch("counselor_work_years.current_calendar_year", return_value=2026)
    def test_validate_start_year(self, _mock_year):
        self.assertEqual(validate_work_start_year(2018), 2018)
        with self.assertRaises(ValueError):
            validate_work_start_year(1800)
        with self.assertRaises(ValueError):
            validate_work_start_year(2099)


if __name__ == "__main__":
    unittest.main()
