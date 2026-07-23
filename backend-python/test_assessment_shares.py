from __future__ import annotations

import tempfile
import unittest
from datetime import datetime
from http.cookies import SimpleCookie
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from assessment_definition_service import AssessmentDefinitionStore
from assessment_share_routes import (
    register_assessment_share_admin_routes,
    scan_assessment_share,
)
from assessment_share_service import (
    VISITOR_COOKIE_NAME,
    AssessmentShareCodeError,
    AssessmentShareConfigurationError,
    assessment_admin_list_stats,
    assessment_share_stats,
    build_share_code,
    decode_share_code,
)
from config import settings
from database import Base
from models import (
    AppAccount,
    AppAssessmentAuditLog,
    AppAssessmentReport,
    AppAssessmentShareScan,
    AppRoleBinding,
)


BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent
TEST_SECRET = "assessment-share-test-secret-32-characters"


def request(cookie: str | None = None) -> Request:
    headers = [(b"x-request-id", b"assessment-share-test")]
    if cookie:
        headers.append((b"cookie", cookie.encode("ascii")))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/web/assessment-shares/test/scan",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
            "headers": headers,
        }
    )


class AssessmentShareTests(unittest.TestCase):
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
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppAssessmentReport.__table__,
                AppAssessmentShareScan.__table__,
                AppAssessmentAuditLog.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.actor = AppAccount(
            Id=801,
            Mobile="13800000801",
            RealName="量表助理",
            ActiveRole="Assistant",
            IsActive=True,
        )
        self.db.add(self.actor)
        self.db.add(AppRoleBinding(AccountId=801, RoleType="Assistant"))
        self.db.commit()
        self.secret_patch = patch.object(
            settings, "ASSESSMENT_SHARE_SECRET", TEST_SECRET
        )
        self.frontend_patch = patch.object(
            settings, "ASSESSMENT_FRONTEND_BASE_URL", "http://eap.test"
        )
        self.secret_patch.start()
        self.frontend_patch.start()

    def tearDown(self) -> None:
        self.frontend_patch.stop()
        self.secret_patch.stop()
        self.db.close()
        self.engine.dispose()
        self.temporary.cleanup()

    def test_share_code_is_stable_and_tamper_evident(self) -> None:
        first = build_share_code("dark-light-personality")
        second = build_share_code("dark-light-personality")
        self.assertEqual(first, second)
        self.assertEqual("dark-light-personality", decode_share_code(first))
        with self.assertRaises(AssessmentShareCodeError):
            decode_share_code(f"{first[:-1]}x")
        with self.assertRaises(AssessmentShareCodeError):
            decode_share_code(first, expected_assessment_id="aas")
        with self.assertRaises(AssessmentShareConfigurationError):
            build_share_code("aas", secret="too-short")

    def test_scan_records_minimum_data_redirects_and_reuses_anonymous_cookie(self) -> None:
        share_code = build_share_code("dark-light-personality")
        with patch(
            "assessment_share_routes.get_assessment_store",
            return_value=self.store,
        ):
            first_response = scan_assessment_share(
                share_code=share_code,
                request=request(),
                db=self.db,
            )
            cookie = SimpleCookie()
            cookie.load(first_response.headers["set-cookie"])
            visitor_token = cookie[VISITOR_COOKIE_NAME].value
            second_response = scan_assessment_share(
                share_code=share_code,
                request=request(f"{VISITOR_COOKIE_NAME}={visitor_token}"),
                db=self.db,
            )

        self.assertEqual(302, first_response.status_code)
        self.assertIn(
            "/assessment/fun/dark-light-personality?shareCode=as1.",
            first_response.headers["location"],
        )
        self.assertEqual("no-store", first_response.headers["cache-control"])
        rows = self.db.query(AppAssessmentShareScan).all()
        self.assertEqual(2, len(rows))
        self.assertEqual(rows[0].VisitorHash, rows[1].VisitorHash)
        self.assertEqual(64, len(rows[0].VisitorHash))
        self.assertNotIn("127.0.0.1", rows[0].VisitorHash)
        self.assertEqual(302, second_response.status_code)

    def test_invalid_scan_does_not_write_event(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            scan_assessment_share(
                share_code="as1.invalid.invalid",
                request=request(),
                db=self.db,
            )
        self.assertEqual(404, raised.exception.status_code)
        self.assertEqual(0, self.db.query(AppAssessmentShareScan).count())

    def test_stats_count_total_unique_conversion_and_write_audit(self) -> None:
        share_code = build_share_code("dark-light-personality")
        completed_at = datetime(2026, 7, 23, 8, 0, 0)
        self.db.add_all(
            [
                AppAssessmentShareScan(
                    ShareCode=share_code,
                    AssessmentId="dark-light-personality",
                    VisitorHash="1" * 64,
                    ScannedAt=datetime(2026, 7, 23, 7, 0, 0),
                ),
                AppAssessmentShareScan(
                    ShareCode=share_code,
                    AssessmentId="dark-light-personality",
                    VisitorHash="1" * 64,
                    ScannedAt=datetime(2026, 7, 23, 7, 15, 0),
                ),
                AppAssessmentShareScan(
                    ShareCode=share_code,
                    AssessmentId="dark-light-personality",
                    VisitorHash="2" * 64,
                    ScannedAt=datetime(2026, 7, 23, 7, 30, 0),
                ),
                AppAssessmentReport(
                    PublicId="rpt_share_test",
                    AccountId=999,
                    ClientSubmissionId="share-stats-submission",
                    AssessmentId="dark-light-personality",
                    AssessmentVersion=1,
                    Category="fun",
                    AssessmentTitle="黑暗与光明人格测试",
                    ScoringType="dark-light",
                    EntrySource="qr",
                    ShareCode=share_code,
                    ConsentVersion="not-required",
                    ConsentAcceptedAt=completed_at,
                    CompletedAt=completed_at,
                    CreatedAt=completed_at,
                ),
                AppAssessmentReport(
                    PublicId="rpt_direct_test",
                    AccountId=999,
                    ClientSubmissionId="direct-stats-submission",
                    AssessmentId="dark-light-personality",
                    AssessmentVersion=1,
                    Category="fun",
                    AssessmentTitle="黑暗与光明人格测试",
                    ScoringType="dark-light",
                    EntrySource="direct",
                    ShareCode=None,
                    ConsentVersion="not-required",
                    ConsentAcceptedAt=completed_at,
                    CompletedAt=completed_at,
                    CreatedAt=completed_at,
                ),
                AppAssessmentReport(
                    PublicId="rpt_deleted_test",
                    AccountId=999,
                    ClientSubmissionId="deleted-stats-submission",
                    AssessmentId="dark-light-personality",
                    AssessmentVersion=1,
                    Category="fun",
                    AssessmentTitle="黑暗与光明人格测试",
                    ScoringType="dark-light",
                    EntrySource="qr",
                    ShareCode=share_code,
                    ConsentVersion="not-required",
                    ConsentAcceptedAt=completed_at,
                    CompletedAt=completed_at,
                    DeletedAt=completed_at,
                    CreatedAt=completed_at,
                ),
            ]
        )
        self.db.commit()

        result = assessment_share_stats(
            self.db,
            assessment_id="dark-light-personality",
            start_at=datetime(2026, 7, 23, 0, 0, 0),
            end_at=datetime(2026, 7, 23, 23, 59, 59),
            assessment_titles={"dark-light-personality": "黑暗与光明人格测试"},
        )
        self.assertEqual(3, result["scanCount"])
        self.assertEqual(2, result["uniqueScanCount"])
        self.assertEqual(1, result["completedReportCount"])
        self.assertEqual(0.3333, result["conversionRate"])
        self.assertEqual("黑暗与光明人格测试", result["items"][0]["assessmentTitle"])
        list_stats = assessment_admin_list_stats(
            self.db,
            ["dark-light-personality", "aas"],
        )
        self.assertEqual(
            {"completedCount": 2, "scanCount": 3},
            list_stats["dark-light-personality"],
        )
        self.assertEqual(
            {"completedCount": 0, "scanCount": 0},
            list_stats["aas"],
        )

        admin_router = APIRouter(prefix="/api/mini/admin")
        register_assessment_share_admin_routes(
            admin_router,
            require_assessment_viewer=lambda: self.actor,
        )
        endpoint = next(
            route.endpoint
            for route in admin_router.routes
            if route.path == "/api/mini/admin/assessment-share-stats"
        )
        with patch(
            "assessment_share_routes.get_assessment_store",
            return_value=self.store,
        ):
            endpoint_result = endpoint(
                request=request(),
                assessment_id="dark-light-personality",
                start_at=None,
                end_at=None,
                actor=self.actor,
                db=self.db,
            )
        self.assertEqual(3, endpoint_result["scanCount"])
        audit = self.db.query(AppAssessmentAuditLog).one()
        self.assertEqual("SHARE_STATS_VIEW", audit.Action)
        self.assertEqual("SUCCEEDED", audit.Outcome)
        self.assertNotIn("VisitorHash", audit.MetadataJson or "")

    def test_admin_share_stats_route_is_registered(self) -> None:
        admin_router = APIRouter(prefix="/api/mini/admin")
        register_assessment_share_admin_routes(
            admin_router,
            require_assessment_viewer=lambda: self.actor,
        )
        paths = {route.path for route in admin_router.routes}
        self.assertIn("/api/mini/admin/assessment-share-stats", paths)


if __name__ == "__main__":
    unittest.main()
