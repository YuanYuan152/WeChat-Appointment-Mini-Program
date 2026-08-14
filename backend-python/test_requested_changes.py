import unittest
from datetime import date, datetime, timedelta

from models import AppAccount
from order_contract_agreement import apply_real_name_to_account
from schedule_slots import all_slot_bounds_for_date, is_aligned_standard_slot


class RequestedChangesTests(unittest.TestCase):
    def test_slot_options_end_at_2300(self):
        starts = [start.strftime("%H:%M") for start, _ in all_slot_bounds_for_date(date(2026, 8, 13))]

        self.assertIn("23:00", starts)
        self.assertNotIn("23:30", starts)
        self.assertEqual("23:00", starts[-1])

    def test_2330_is_not_a_valid_standard_slot(self):
        start = datetime(2026, 8, 13, 23, 30)

        self.assertFalse(is_aligned_standard_slot(start, start + timedelta(minutes=50)))

    def test_real_name_is_required_when_account_has_none(self):
        account = AppAccount()

        with self.assertRaisesRegex(ValueError, "请填写真实姓名"):
            apply_real_name_to_account(account, real_name=" ")

    def test_existing_real_name_is_kept_without_reentry(self):
        account = AppAccount(RealName="原姓名")

        apply_real_name_to_account(account, real_name=None)

        self.assertEqual("原姓名", account.RealName)


if __name__ == "__main__":
    unittest.main()
