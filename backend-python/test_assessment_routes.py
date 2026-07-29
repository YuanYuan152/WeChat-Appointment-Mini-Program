from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter, HTTPException

import assessment_routes
from api_response import success_payload
from assessment_definition_service import AssessmentDefinitionStore
from config import settings


BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent


class AssessmentRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.store = AssessmentDefinitionStore(
            Path(self.temporary.name) / "assessment-data",
            seed_data_dir=REPOSITORY_DIR / "EAP_front_site" / "src" / "data",
            guidance_file=(
                REPOSITORY_DIR
                / "EAP_front_site"
                / "src"
                / "lib"
                / "assessment"
                / "scale-guidance.ts"
            ),
            report_profiles_file=BACKEND_DIR / "assessment_seed_report_profiles.json",
        )
        self.store.ensure_seeded()

        self.admin_router = APIRouter(prefix="/api/mini/admin")
        assessment_routes.register_assessment_admin_routes(
            self.admin_router,
            require_assessment_editor=lambda: object(),
        )
        self.patch = patch.object(
            assessment_routes,
            "get_assessment_store",
            return_value=self.store,
        )
        self.patch.start()

    def tearDown(self) -> None:
        self.patch.stop()
        self.temporary.cleanup()

    def test_public_list_and_detail_use_api_envelope(self) -> None:
        result = assessment_routes.list_published_assessments(
            category="fun", keyword=None
        )
        payload = success_payload(result)
        self.assertEqual(0, payload["code"])
        self.assertEqual("dark-light-personality", payload["data"][0]["id"])

        with (
            patch.object(
                settings,
                "ASSESSMENT_SHARE_SECRET",
                "assessment-share-test-secret-32-characters",
            ),
            patch.object(settings, "BASE_URL", "https://assessment.test"),
        ):
            detail = assessment_routes.get_published_assessment(
                "dark-light-personality"
            )
        self.assertEqual(12, detail["questionCount"])
        self.assertEqual("published", detail["definition"]["status"])
        self.assertTrue(detail["shareCode"].startswith("as1."))
        self.assertTrue(detail["shareUrl"].startswith("https://assessment.test/"))

    def test_public_missing_definition_returns_wrapped_404(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            assessment_routes.get_published_assessment("not-found")
        self.assertEqual(404, raised.exception.status_code)

    def test_public_detail_disables_insecure_non_local_share_url(self) -> None:
        with (
            patch.object(
                settings,
                "ASSESSMENT_SHARE_SECRET",
                "assessment-share-test-secret-32-characters",
            ),
            patch.object(settings, "BASE_URL", "http://124.221.56.121"),
        ):
            detail = assessment_routes.get_published_assessment(
                "dark-light-personality"
            )

        self.assertIsNone(detail["shareCode"])
        self.assertIsNone(detail["shareUrl"])

    def test_admin_list_is_available_under_existing_prefix(self) -> None:
        route = next(
            item
            for item in self.admin_router.routes
            if item.path == "/api/mini/admin/assessments" and "GET" in item.methods
        )
        with patch.object(
            assessment_routes,
            "assessment_admin_list_stats",
            return_value={},
        ):
            payload = route.endpoint(
                page=1,
                page_size=3,
                category=None,
                status="published",
                keyword=None,
                _actor=object(),
                db=object(),
            )
        self.assertEqual(6, payload["total"])
        self.assertEqual(3, len(payload["items"]))

    def test_admin_list_enriches_current_page_with_real_stats(self) -> None:
        route = next(
            item
            for item in self.admin_router.routes
            if item.path == "/api/mini/admin/assessments" and "GET" in item.methods
        )
        captured_ids: list[str] = []

        def fake_stats(_db, assessment_ids):
            captured_ids.extend(assessment_ids)
            return {
                assessment_ids[0]: {"completedCount": 7, "scanCount": 11},
            }

        with patch.object(
            assessment_routes,
            "assessment_admin_list_stats",
            side_effect=fake_stats,
        ) as stats:
            payload = route.endpoint(
                page=1,
                page_size=2,
                category=None,
                status=None,
                keyword=None,
                _actor=object(),
                db=object(),
            )

        self.assertGreater(payload["total"], len(payload["items"]))
        self.assertEqual(2, len(payload["items"]))
        self.assertEqual(2, len(captured_ids))
        first_item = payload["items"][0]
        self.assertEqual(captured_ids[0], first_item["id"])
        self.assertEqual(7, first_item["completedCount"])
        self.assertEqual(11, first_item["scanCount"])
        self.assertEqual(0, payload["items"][1]["completedCount"])
        self.assertEqual(0, payload["items"][1]["scanCount"])
        stats.assert_called_once()


if __name__ == "__main__":
    unittest.main()
