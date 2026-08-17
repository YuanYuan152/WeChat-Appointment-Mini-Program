import unittest

from refund_exemption_service import validate_uploaded_screenshot_url


class RefundExemptionScreenshotTests(unittest.TestCase):
    def test_accepts_upload_api_image_urls(self):
        self.assertEqual(
            validate_uploaded_screenshot_url("/static/uploads/proof.png"),
            "/static/uploads/proof.png",
        )
        self.assertEqual(
            validate_uploaded_screenshot_url(
                "https://api.example.test/static/uploads/proof.webp"
            ),
            "https://api.example.test/static/uploads/proof.webp",
        )

    def test_rejects_missing_or_non_upload_urls(self):
        for value in (
            "",
            "https://example.test/proof.png",
            "/static/uploads/../proof.png",
            "/static/uploads/proof.png?download=1",
            "file:///static/uploads/proof.png",
        ):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_uploaded_screenshot_url(value)


if __name__ == "__main__":
    unittest.main()
