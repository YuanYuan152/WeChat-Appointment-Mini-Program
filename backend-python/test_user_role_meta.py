import unittest

from user_role_meta import (
    is_charity_patient_source,
    normalize_admin_user_list_filters,
    normalize_patient_source,
    patient_source_label,
    validate_patient_source,
    validate_patient_source_detail,
)


class PatientSourceMetaTests(unittest.TestCase):
    def test_legacy_sources_are_normalized_without_data_migration(self):
        self.assertEqual(normalize_patient_source("MINI_PROGRAM"), "PROFESSIONAL")
        self.assertEqual(normalize_patient_source("CHARITY_PROJECT_1"), "CHARITY")
        self.assertEqual(patient_source_label("CHARITY_VISITOR"), "公益")
        self.assertEqual(patient_source_label("MINI_PROGRAM"), "正价")

    def test_charity_check_accepts_new_and_legacy_values(self):
        for value in ("CHARITY", "CHARITY_VISITOR", "CHARITY_PROJECT_1", "CHARITY_PROJECT_2"):
            self.assertTrue(is_charity_patient_source(value))
        for value in ("PROFESSIONAL", "MINI_PROGRAM", "HOSPITAL", None):
            self.assertFalse(is_charity_patient_source(value))

    def test_new_writes_only_accept_three_sources_and_detail_whitelist(self):
        for value in ("CHARITY", "PROFESSIONAL", "HOSPITAL"):
            self.assertEqual(validate_patient_source(value), value)
        with self.assertRaises(ValueError):
            validate_patient_source("MINI_PROGRAM")

        self.assertEqual(validate_patient_source_detail(" 小红书 "), "小红书")
        self.assertIsNone(validate_patient_source_detail(""))
        with self.assertRaises(ValueError):
            validate_patient_source_detail("医院转介")


class AdminUserListFilterTests(unittest.TestCase):
    def test_normalize_admin_user_list_filters(self):
        self.assertEqual(normalize_admin_user_list_filters(None, None), (None, None))
        self.assertEqual(normalize_admin_user_list_filters("counselor", None), ("counselor", None))
        self.assertEqual(
            normalize_admin_user_list_filters("patient", "charity"),
            ("patient", "CHARITY"),
        )
        self.assertEqual(
            normalize_admin_user_list_filters("counselor", "professional"),
            ("counselor", "PROFESSIONAL"),
        )

        with self.assertRaises(ValueError):
            normalize_admin_user_list_filters("invalid", None)
        with self.assertRaises(ValueError):
            normalize_admin_user_list_filters(None, "CHARITY")
        with self.assertRaises(ValueError):
            normalize_admin_user_list_filters("staff", "PROFESSIONAL")


if __name__ == "__main__":
    unittest.main()
