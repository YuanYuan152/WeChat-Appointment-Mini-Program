from __future__ import annotations

import tempfile
import unittest
import uuid
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from assessment_definition_service import (
    AssessmentDefinitionStore,
    AssessmentNotFound,
    AssessmentValidationError,
)
from assessment_report_routes import (
    _admin_report_items,
    _require_patient,
    register_assessment_report_admin_routes,
)
from assessment_report_service import (
    AssessmentReportError,
    AssessmentReportConflict,
    AssessmentReportValidationError,
    delete_user_report,
    submit_report,
)
from assessment_routes import _run_audited_definition_mutation
from assessment_share_service import build_share_code
from assessment_scoring_service import (
    assessment_result_summary,
    calculate_assessment_result,
    validate_submission_answers,
)
from config import settings
from database import Base
from models import (
    AppAccount,
    AppAssessmentAuditLog,
    AppAssessmentReport,
    AppPsychScaleResult,
    AppRoleBinding,
)


BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent


def request(path: str = "/api/test") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "headers": [(b"x-request-id", b"assessment-test-request")],
        }
    )


class AssessmentScoringTests(unittest.TestCase):
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

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_all_seeded_definitions_are_scored_by_server_whitelist(self) -> None:
        summaries = self.store.list_published()
        self.assertEqual(6, len(summaries))
        for summary in summaries:
            definition = self.store.get_published_version(summary["id"], summary["version"])
            answers = {
                question["id"]: question["options"][0]["id"]
                for question in definition["questions"]
            }
            demographics, normalized = validate_submission_answers(
                definition, {}, answers
            )
            self.assertEqual({}, demographics)
            result = calculate_assessment_result(definition, normalized)
            self.assertIn(result["type"], {"sum", "match", "dimension"})
            self.assertTrue(assessment_result_summary(result))

    def test_exact_unpublished_version_is_rejected(self) -> None:
        with self.assertRaises(AssessmentNotFound):
            self.store.get_published_version("bsi-18", 99)
        with self.assertRaises(AssessmentValidationError):
            self.store.get_published_version("../bsi-18", 1)


class AssessmentReportPersistenceTests(unittest.TestCase):
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
                AppPsychScaleResult.__table__,
                AppAssessmentReport.__table__,
                AppAssessmentAuditLog.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.patient = AppAccount(
            Id=701,
            Mobile="13800000701",
            RealName="量表来访者",
            ActiveRole="Patient",
            IsActive=True,
        )
        self.assistant = AppAccount(
            Id=702,
            Mobile="13800000702",
            RealName="量表助理",
            ActiveRole="Assistant",
            IsActive=True,
        )
        self.ops = AppAccount(
            Id=703,
            Mobile="13800000703",
            RealName="量表运营",
            ActiveRole="Ops",
            IsActive=True,
        )
        self.db.add_all([self.patient, self.assistant, self.ops])
        self.db.add_all(
            [
                AppRoleBinding(AccountId=701, RoleType="Patient"),
                AppRoleBinding(AccountId=702, RoleType="Assistant"),
                AppRoleBinding(AccountId=703, RoleType="Ops"),
            ]
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temporary.cleanup()

    def _answers(self, assessment_id: str) -> dict[str, str]:
        definition = self.store.get_published_version(assessment_id, 1)
        return {
            question["id"]: question["options"][0]["id"]
            for question in definition["questions"]
        }

    def _submit(
        self,
        *,
        assessment_id: str = "dark-light-personality",
        submission_id: str | None = None,
    ) -> dict:
        return submit_report(
            self.db,
            account=self.patient,
            store=self.store,
            client_submission_id=submission_id or str(uuid.uuid4()),
            assessment_id=assessment_id,
            assessment_version=1,
            demographic_answers={},
            answers=self._answers(assessment_id),
            entry_source="web",
            share_code=None,
            consent_version=settings.ASSESSMENT_CONSENT_VERSION,
        )

    def test_submit_is_idempotent_and_snapshot_is_immutable_source(self) -> None:
        submission_id = str(uuid.uuid4())
        first = self._submit(submission_id=submission_id)
        second = self._submit(submission_id=submission_id)

        self.assertEqual(first["publicId"], second["publicId"])
        self.assertEqual(1, self.db.query(AppAssessmentReport).count())
        self.assertEqual(
            first["result"], first["reportSnapshot"]["result"]
        )
        row = self.db.query(AppAssessmentReport).one()
        self.assertEqual(64, len(row.SnapshotSha256))

        row.ReportSnapshot = f"{row.ReportSnapshot} "
        self.db.commit()
        with self.assertRaises(AssessmentReportError):
            self._submit(submission_id=submission_id)

    def test_submission_id_cannot_be_reused_for_another_assessment(self) -> None:
        submission_id = str(uuid.uuid4())
        self._submit(submission_id=submission_id)
        with self.assertRaises(AssessmentReportConflict):
            self._submit(assessment_id="aas", submission_id=submission_id)

    def test_invalid_answer_and_share_code_validation(self) -> None:
        answers = self._answers("dark-light-personality")
        answers["d1"] = "not-an-option"
        with self.assertRaises(AssessmentReportValidationError):
            submit_report(
                self.db,
                account=self.patient,
                store=self.store,
                client_submission_id=str(uuid.uuid4()),
                assessment_id="dark-light-personality",
                assessment_version=1,
                demographic_answers={},
                answers=answers,
                entry_source="web",
                share_code=None,
                consent_version=settings.ASSESSMENT_CONSENT_VERSION,
            )
        share_secret = "assessment-share-test-secret-32-characters"
        with patch.object(settings, "ASSESSMENT_SHARE_SECRET", share_secret):
            with self.assertRaises(AssessmentReportValidationError):
                submit_report(
                    self.db,
                    account=self.patient,
                    store=self.store,
                    client_submission_id=str(uuid.uuid4()),
                    assessment_id="dark-light-personality",
                    assessment_version=1,
                    demographic_answers={},
                    answers=self._answers("dark-light-personality"),
                    entry_source="qr",
                    share_code="unverified-code",
                    consent_version=settings.ASSESSMENT_CONSENT_VERSION,
                )

            share_code = build_share_code("dark-light-personality")
            saved = submit_report(
                self.db,
                account=self.patient,
                store=self.store,
                client_submission_id=str(uuid.uuid4()),
                assessment_id="dark-light-personality",
                assessment_version=1,
                demographic_answers={},
                answers=self._answers("dark-light-personality"),
                entry_source="web",
                share_code=share_code,
                consent_version=settings.ASSESSMENT_CONSENT_VERSION,
            )
        row = self.db.query(AppAssessmentReport).filter(
            AppAssessmentReport.PublicId == saved["publicId"]
        ).one()
        self.assertEqual(share_code, row.ShareCode)
        self.assertEqual("qr", row.EntrySource)

    def test_delete_redacts_content_and_writes_content_free_audit(self) -> None:
        saved = self._submit()
        delete_user_report(
            self.db,
            account=self.patient,
            public_id=saved["publicId"],
            request_id="delete-request",
        )
        row = self.db.query(AppAssessmentReport).one()
        self.assertIsNotNone(row.DeletedAt)
        for field in (
            "DemographicAnswers",
            "Answers",
            "ResultJson",
            "ResultSummary",
            "ReportSnapshot",
            "SnapshotSha256",
        ):
            self.assertIsNone(getattr(row, field))
        audit = self.db.query(AppAssessmentAuditLog).one()
        self.assertEqual("REPORT_DELETE", audit.Action)
        self.assertEqual("SUCCEEDED", audit.Outcome)
        self.assertNotIn("answer", (audit.MetadataJson or "").lower())

    def test_admin_list_aggregates_eap_and_legacy_without_mixing_sources(self) -> None:
        self._submit()
        self.db.add(
            AppPsychScaleResult(
                Id=9001,
                AccountId=self.patient.Id,
                ScaleType="PHQ9",
                Answers="[0,0,0,0,0,0,0,0,0]",
                Total=0,
                CreatedAt=datetime(2026, 7, 22, 8, 0, 0),
            )
        )
        self.db.commit()
        items = _admin_report_items(
            self.db,
            visitor_ids={self.patient.Id},
            keyword="13800000701",
            assessment_id=None,
            category=None,
            source=None,
            start_at=None,
            end_at=None,
        )
        self.assertEqual({"eap", "mini-legacy"}, {item["source"] for item in items})
        self.assertTrue(all(item["accountId"] == self.patient.Id for item in items))

    def test_assistant_cannot_read_raw_answers_but_ops_can(self) -> None:
        saved = self._submit()
        admin_router = APIRouter(prefix="/api/mini/admin")
        register_assessment_report_admin_routes(
            admin_router,
            require_assessment_viewer=lambda: self.assistant,
            visitor_patient_ids=lambda _db: {self.patient.Id},
        )
        endpoint = next(
            route.endpoint
            for route in admin_router.routes
            if route.path
            == "/api/mini/admin/assessment-reports/{source}/{report_id}"
        )
        assistant_result = endpoint(
            source="eap",
            report_id=saved["publicId"],
            request=request(),
            actor=self.assistant,
            db=self.db,
        )
        self.assertNotIn("answers", assistant_result)
        self.assertNotIn("demographicAnswers", assistant_result)

        ops_result = endpoint(
            source="eap",
            report_id=saved["publicId"],
            request=request(),
            actor=self.ops,
            db=self.db,
        )
        self.assertIn("answers", ops_result)
        self.assertIn("demographicAnswers", ops_result)
        self.assertEqual(2, self.db.query(AppAssessmentAuditLog).count())

    def test_admin_report_routes_are_registered_under_existing_prefix(self) -> None:
        router = APIRouter(prefix="/api/mini/admin")
        register_assessment_report_admin_routes(
            router,
            require_assessment_viewer=lambda: self.assistant,
            visitor_patient_ids=lambda _db: {self.patient.Id},
        )
        paths = {route.path for route in router.routes}
        self.assertIn("/api/mini/admin/assessment-reports", paths)
        self.assertIn(
            "/api/mini/admin/assessment-reports/{source}/{report_id}", paths
        )
        self.assertIn(
            "/api/mini/admin/boards/patients/{account_id}/assessment-reports",
            paths,
        )

    def test_web_report_permission_is_restricted_to_patient_role(self) -> None:
        self.assertEqual(self.patient.Id, _require_patient(self.patient, self.db).Id)
        with self.assertRaises(HTTPException) as raised:
            _require_patient(self.assistant, self.db)
        self.assertEqual(403, raised.exception.status_code)

    def test_definition_mutation_audit_records_success_and_failure(self) -> None:
        result = _run_audited_definition_mutation(
            self.db,
            actor=self.ops,
            request=request(),
            action="DEFINITION_UPDATE",
            assessment_id="test-assessment",
            assessment_version=None,
            metadata=None,
            operation=lambda: {
                "definition": {"version": 2, "status": "draft"}
            },
        )
        self.assertEqual(2, result["definition"]["version"])

        with self.assertRaises(RuntimeError):
            _run_audited_definition_mutation(
                self.db,
                actor=self.ops,
                request=request(),
                action="DEFINITION_PUBLISH",
                assessment_id="test-assessment",
                assessment_version=2,
                metadata=None,
                operation=lambda: (_ for _ in ()).throw(RuntimeError("boom")),
            )
        audits = (
            self.db.query(AppAssessmentAuditLog)
            .order_by(AppAssessmentAuditLog.Id.asc())
            .all()
        )
        self.assertEqual(["SUCCEEDED", "FAILED"], [row.Outcome for row in audits])
        self.assertTrue(all("boom" not in (row.MetadataJson or "") for row in audits))


if __name__ == "__main__":
    unittest.main()
