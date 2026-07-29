from __future__ import annotations

import asyncio
import json
import tempfile
import unittest
from datetime import datetime, timedelta
from http.cookies import SimpleCookie
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter, FastAPI, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from api_response import ApiResponseEnvelopeMiddleware
from assessment_definition_service import AssessmentDefinitionStore
from assessment_share_routes import (
    register_assessment_share_admin_routes,
    router as assessment_share_router,
    scan_assessment_share,
)
from assessment_share_service import (
    VISITOR_COOKIE_NAME,
    AssessmentShareCodeError,
    AssessmentShareConfigurationError,
    add_scan_if_not_recent,
    assessment_admin_list_stats,
    assessment_share_stats,
    build_share_code,
    decode_share_code,
)
from config import settings
from database import Base, get_db
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


def request(cookie: str | None = None, query_string: str = "") -> Request:
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
            "query_string": query_string.encode("ascii"),
            "headers": headers,
        }
    )


async def asgi_get_json(
    app: FastAPI,
    path: str,
    query_string: str = "",
) -> tuple[int, dict[str, object]]:
    """Exercise FastAPI's real ASGI routing without the unavailable httpx package."""
    status, _, body = await asgi_request(app, path, query_string=query_string)
    return status, json.loads(body)


async def asgi_request(
    app: FastAPI,
    path: str,
    *,
    method: str = "GET",
    query_string: str = "",
) -> tuple[int, dict[str, str], bytes]:
    """Exercise FastAPI's real ASGI routing and expose status, headers and body."""
    messages: list[dict[str, object]] = []
    request_sent = False

    async def receive() -> dict[str, object]:
        nonlocal request_sent
        if request_sent:
            return {"type": "http.disconnect"}
        request_sent = True
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, object]) -> None:
        messages.append(message)

    await app(
        {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": query_string.encode("ascii"),
            "root_path": "",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 12345),
            "headers": [(b"host", b"testserver")],
        },
        receive,
        send,
    )
    start = next(message for message in messages if message["type"] == "http.response.start")
    body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    headers = {
        key.decode("latin-1").lower(): value.decode("latin-1")
        for key, value in start.get("headers", [])
    }
    return int(start["status"]), headers, body


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
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
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
            settings, "ASSESSMENT_FRONTEND_BASE_URL", "https://eap.test"
        )
        self.secret_patch.start()
        self.frontend_patch.start()

    def tearDown(self) -> None:
        self.frontend_patch.stop()
        self.secret_patch.stop()
        self.db.close()
        self.engine.dispose()
        self.temporary.cleanup()

    def build_stats_app(self) -> FastAPI:
        admin_router = APIRouter(prefix="/api/mini/admin")
        register_assessment_share_admin_routes(
            admin_router,
            require_assessment_viewer=lambda: self.actor,
        )
        app = FastAPI()
        app.add_middleware(ApiResponseEnvelopeMiddleware)
        app.include_router(admin_router)
        app.dependency_overrides[get_db] = lambda: self.db
        return app

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

    def test_scan_records_minimum_data_and_suppresses_immediate_refresh(self) -> None:
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
        self.assertEqual(1, len(rows))
        self.assertEqual(64, len(rows[0].VisitorHash))
        self.assertNotIn("127.0.0.1", rows[0].VisitorHash)
        self.assertEqual(302, second_response.status_code)

    def test_head_scan_validates_and_redirects_without_tracking_or_cookie(self) -> None:
        share_code = build_share_code("dark-light-personality")
        app = FastAPI()
        app.include_router(assessment_share_router)

        with (
            patch(
                "assessment_share_routes.get_assessment_store",
                return_value=self.store,
            ),
            patch("assessment_share_routes.new_visitor_token") as new_token,
            patch(
                "assessment_share_routes.add_scan_if_not_recent"
            ) as add_scan,
        ):
            status, headers, _ = asyncio.run(
                asgi_request(
                    app,
                    (
                        "/api/web/assessment-shares/"
                        f"{share_code}/scan"
                    ),
                    method="HEAD",
                )
            )

        self.assertEqual(302, status)
        self.assertIn(
            "/assessment/fun/dark-light-personality?shareCode=as1.",
            headers["location"],
        )
        self.assertEqual("no-store", headers["cache-control"])
        self.assertEqual("no-referrer", headers["referrer-policy"])
        self.assertNotIn("set-cookie", headers)
        new_token.assert_not_called()
        add_scan.assert_not_called()
        self.assertEqual(0, self.db.query(AppAssessmentShareScan).count())

    def test_scan_rejects_insecure_public_frontend_before_tracking(self) -> None:
        share_code = build_share_code("dark-light-personality")
        with (
            patch(
                "assessment_share_routes.get_assessment_store",
                return_value=self.store,
            ),
            patch.object(
                settings,
                "ASSESSMENT_FRONTEND_BASE_URL",
                "http://124.221.56.121",
            ),
            patch("assessment_share_routes.new_visitor_token") as new_token,
            patch(
                "assessment_share_routes.add_scan_if_not_recent"
            ) as add_scan,
        ):
            with self.assertRaises(HTTPException) as raised:
                scan_assessment_share(
                    share_code=share_code,
                    request=request(),
                    db=self.db,
                )

        self.assertEqual(503, raised.exception.status_code)
        self.assertIn("HTTPS", str(raised.exception.detail))
        new_token.assert_not_called()
        add_scan.assert_not_called()
        self.assertEqual(0, self.db.query(AppAssessmentShareScan).count())

    def test_scan_records_different_visitors_and_same_visitor_after_31_seconds(
        self,
    ) -> None:
        share_code = build_share_code("dark-light-personality")
        started_at = datetime(2026, 7, 23, 7, 0, 0)
        with (
            patch(
                "assessment_share_routes.get_assessment_store",
                return_value=self.store,
            ),
            patch(
                "assessment_share_routes.new_visitor_token",
                side_effect=["A" * 32, "B" * 32],
            ),
            patch(
                "assessment_share_routes._utc_now",
                side_effect=[
                    started_at,
                    started_at,
                    started_at + timedelta(seconds=10),
                    started_at + timedelta(seconds=31),
                ],
            ),
        ):
            first_response = scan_assessment_share(
                share_code=share_code,
                request=request(),
                db=self.db,
            )
            first_cookie = SimpleCookie()
            first_cookie.load(first_response.headers["set-cookie"])
            first_token = first_cookie[VISITOR_COOKIE_NAME].value

            second_response = scan_assessment_share(
                share_code=share_code,
                request=request(),
                db=self.db,
            )
            repeated_response = scan_assessment_share(
                share_code=share_code,
                request=request(f"{VISITOR_COOKIE_NAME}={first_token}"),
                db=self.db,
            )
            later_response = scan_assessment_share(
                share_code=share_code,
                request=request(f"{VISITOR_COOKIE_NAME}={first_token}"),
                db=self.db,
            )

        self.assertEqual(302, second_response.status_code)
        self.assertEqual(302, repeated_response.status_code)
        self.assertEqual(302, later_response.status_code)
        rows = (
            self.db.query(AppAssessmentShareScan)
            .order_by(AppAssessmentShareScan.ScannedAt, AppAssessmentShareScan.Id)
            .all()
        )
        self.assertEqual(3, len(rows))
        self.assertEqual(2, len({row.VisitorHash for row in rows}))
        first_visitor_rows = [
            row for row in rows if row.VisitorHash == rows[0].VisitorHash
        ]
        self.assertEqual(2, len(first_visitor_rows))
        self.assertEqual(
            timedelta(seconds=31),
            first_visitor_rows[1].ScannedAt - first_visitor_rows[0].ScannedAt,
        )

    def test_scan_dedup_window_is_half_open_at_29_30_and_31_seconds(self) -> None:
        share_code = build_share_code("dark-light-personality")
        started_at = datetime(2026, 7, 23, 7, 0, 0)
        visitor_hashes = {
            "at-29": "1" * 64,
            "at-30": "2" * 64,
            "at-31": "3" * 64,
        }
        self.db.add_all(
            [
                AppAssessmentShareScan(
                    ShareCode=share_code,
                    AssessmentId="dark-light-personality",
                    VisitorHash=value,
                    ScannedAt=started_at,
                )
                for value in visitor_hashes.values()
            ]
        )
        self.db.commit()

        at_29 = add_scan_if_not_recent(
            self.db,
            share_code=share_code,
            assessment_id="dark-light-personality",
            visitor_hash_value=visitor_hashes["at-29"],
            scanned_at=started_at + timedelta(seconds=29),
        )
        at_30 = add_scan_if_not_recent(
            self.db,
            share_code=share_code,
            assessment_id="dark-light-personality",
            visitor_hash_value=visitor_hashes["at-30"],
            scanned_at=started_at + timedelta(seconds=30),
        )
        at_31 = add_scan_if_not_recent(
            self.db,
            share_code=share_code,
            assessment_id="dark-light-personality",
            visitor_hash_value=visitor_hashes["at-31"],
            scanned_at=started_at + timedelta(seconds=31),
        )
        self.db.commit()

        self.assertFalse(at_29)
        self.assertTrue(at_30)
        self.assertTrue(at_31)
        self.assertEqual(5, self.db.query(AppAssessmentShareScan).count())

    def test_scan_write_failure_rolls_back_but_still_redirects(self) -> None:
        share_code = build_share_code("dark-light-personality")
        with (
            patch(
                "assessment_share_routes.get_assessment_store",
                return_value=self.store,
            ),
            patch.object(
                self.db,
                "commit",
                side_effect=RuntimeError("temporary database failure"),
            ),
            self.assertLogs("uvicorn.error", level="ERROR") as captured,
        ):
            response = scan_assessment_share(
                share_code=share_code,
                request=request(),
                db=self.db,
            )

        self.assertEqual(302, response.status_code)
        self.assertIn(
            "/assessment/fun/dark-light-personality",
            response.headers["location"],
        )
        self.assertEqual(0, self.db.query(AppAssessmentShareScan).count())
        self.assertTrue(
            any("scan tracking failed" in message for message in captured.output)
        )

    def test_scan_query_failure_rolls_back_but_still_redirects(self) -> None:
        share_code = build_share_code("dark-light-personality")
        with (
            patch(
                "assessment_share_routes.get_assessment_store",
                return_value=self.store,
            ),
            patch.object(
                self.db,
                "query",
                side_effect=RuntimeError("temporary scan query failure"),
            ),
            self.assertLogs("uvicorn.error", level="ERROR") as captured,
        ):
            response = scan_assessment_share(
                share_code=share_code,
                request=request(),
                db=self.db,
            )

        self.assertEqual(302, response.status_code)
        self.assertTrue(
            any("scan tracking failed" in message for message in captured.output)
        )
        self.assertEqual(0, self.db.query(AppAssessmentShareScan).count())

    def test_scan_query_and_rollback_failure_still_redirect_and_log_both(self) -> None:
        share_code = build_share_code("dark-light-personality")
        with (
            patch(
                "assessment_share_routes.get_assessment_store",
                return_value=self.store,
            ),
            patch.object(
                self.db,
                "query",
                side_effect=RuntimeError("temporary scan query failure"),
            ),
            patch.object(
                self.db,
                "rollback",
                side_effect=RuntimeError("temporary rollback failure"),
            ),
            self.assertLogs("uvicorn.error", level="ERROR") as captured,
        ):
            response = scan_assessment_share(
                share_code=share_code,
                request=request(),
                db=self.db,
            )

        self.assertEqual(302, response.status_code)
        self.assertTrue(
            any("scan rollback failed" in message for message in captured.output)
        )
        self.assertTrue(
            any("scan tracking failed" in message for message in captured.output)
        )

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

    def test_admin_stats_fastapi_binding_handles_dates_and_timezones(self) -> None:
        share_code = build_share_code("dark-light-personality")
        self.db.add_all(
            [
                AppAssessmentShareScan(
                    ShareCode=share_code,
                    AssessmentId="dark-light-personality",
                    VisitorHash=str(index) * 64,
                    ScannedAt=scanned_at,
                )
                for index, scanned_at in enumerate(
                    [
                        datetime(2026, 7, 22, 15, 59, 59),
                        datetime(2026, 7, 22, 16, 0, 0),
                        datetime(2026, 7, 23, 15, 59, 59),
                        datetime(2026, 7, 23, 16, 0, 0),
                    ],
                    start=1,
                )
            ]
        )
        self.db.commit()

        app = self.build_stats_app()
        path = "/api/mini/admin/assessment-share-stats"
        successful_queries = {
            "bare China natural day": (
                "assessment_id=dark-light-personality"
                "&start_at=2026-07-23&end_at=2026-07-23"
            ),
            "UTC Z precise datetime": (
                "assessment_id=dark-light-personality"
                "&start_at=2026-07-22T16%3A00%3A00Z"
                "&end_at=2026-07-23T15%3A59%3A59.999Z"
            ),
            "UTC+08 precise datetime": (
                "assessment_id=dark-light-personality"
                "&start_at=2026-07-23T00%3A00%3A00%2B08%3A00"
                "&end_at=2026-07-23T23%3A59%3A59.999%2B08%3A00"
            ),
            "bare start and precise end": (
                "assessment_id=dark-light-personality"
                "&start_at=2026-07-23"
                "&end_at=2026-07-23T23%3A59%3A59.999%2B08%3A00"
            ),
            "precise start and bare end": (
                "assessment_id=dark-light-personality"
                "&start_at=2026-07-22T16%3A00%3A00Z"
                "&end_at=2026-07-23"
            ),
        }
        with patch(
            "assessment_share_routes.get_assessment_store",
            return_value=self.store,
        ):
            for label, query_string in successful_queries.items():
                with self.subTest(label):
                    status, payload = asyncio.run(
                        asgi_get_json(app, path, query_string)
                    )
                    self.assertEqual(200, status)
                    self.assertEqual(0, payload["code"])
                    self.assertEqual(2, payload["data"]["scanCount"])

            invalid_queries = {
                "invalid calendar date": (
                    "assessment_id=dark-light-personality"
                    "&start_at=2026-02-30&end_at=2026-07-23"
                ),
                "reversed bare dates": (
                    "assessment_id=dark-light-personality"
                    "&start_at=2026-07-24&end_at=2026-07-23"
                ),
                "reversed mixed boundaries": (
                    "assessment_id=dark-light-personality"
                    "&start_at=2026-07-24"
                    "&end_at=2026-07-23T23%3A59%3A59.999%2B08%3A00"
                ),
            }
            for label, query_string in invalid_queries.items():
                with self.subTest(label):
                    status, payload = asyncio.run(
                        asgi_get_json(app, path, query_string)
                    )
                    self.assertEqual(422, status)
                    self.assertEqual(422, payload["code"])
                    self.assertIsNone(payload["data"])


if __name__ == "__main__":
    unittest.main()
