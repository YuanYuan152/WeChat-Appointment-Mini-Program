"""入职测评进度：按人员账号读写、冲突检测，并以正式答卷对齐 completed。"""
import json
import unittest
import uuid
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from enterprise_onboarding_progress_service import (
    OnboardingProgressConflict,
    get_progress,
    upsert_progress,
)
from models import AppAccount, AppAssessmentReport, EnterpriseOnboardingProgress


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class EnterpriseOnboardingProgressTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.enterprise = {
            "id": "ent-progress-1",
            "slug": "progress-slug",
            "assessmentIds": ["scale-a", "scale-b"],
        }

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_report(self, *, personnel_id: int, assessment_id: str, public_id: str = ""):
        account = AppAccount(
            OpenId=f"visitor-{uuid.uuid4().hex[:12]}",
            ActiveRole="Patient",
            IsActive=True,
            CreatedAt=datetime.utcnow(),
        )
        self.db.add(account)
        self.db.flush()
        completed = datetime.utcnow()
        row = AppAssessmentReport(
            PublicId=public_id or f"rpt_{uuid.uuid4().hex}",
            AccountId=account.Id,
            ClientSubmissionId=str(uuid.uuid4()),
            AssessmentId=assessment_id,
            AssessmentVersion=1,
            Category="professional",
            AssessmentTitle=assessment_id,
            ScoringType="sum",
            EntrySource="web",
            ConsentVersion="v1",
            ConsentAcceptedAt=completed,
            DemographicAnswers=_canonical(
                {
                    "_enterpriseId": self.enterprise["id"],
                    "_enterpriseSlug": self.enterprise["slug"],
                    "_personnel": {"id": personnel_id, "username": "u1"},
                    "_employeeInfo": {"name": "张三"},
                }
            ),
            Answers="{}",
            ResultJson=_canonical({"type": "sum", "totalScore": 10}),
            ResultSummary="摘要",
            ReportSnapshot="{}",
            SnapshotSha256="0" * 64,
            CompletedAt=completed,
            CreatedAt=completed,
        )
        self.db.add(row)
        self.db.commit()
        return row

    def test_upsert_and_get_by_personnel(self):
        saved = upsert_progress(
            self.db,
            enterprise=self.enterprise,
            personnel_id=7,
            payload={
                "step": "scale",
                "activeScaleId": "scale-a",
                "answersByScale": {"scale-a": {"q1": "a"}},
                "basicInfo": {"name": "张三"},
                "completedScaleIds": [],
                "resultsByScale": {},
                "status": "in_progress",
            },
        )
        self.assertTrue(saved["exists"])
        self.assertEqual(saved["step"], "select")
        self.assertEqual(saved["answersByScale"]["scale-a"]["q1"], "a")
        self.assertEqual(saved["personnelId"], 7)

        other = get_progress(self.db, enterprise=self.enterprise, personnel_id=8)
        self.assertFalse(other["exists"])

        same = get_progress(self.db, enterprise=self.enterprise, personnel_id=7)
        self.assertTrue(same["exists"])
        self.assertEqual(same["completedScaleIds"], [])

    def test_conflict_when_server_newer(self):
        first = upsert_progress(
            self.db,
            enterprise=self.enterprise,
            personnel_id=3,
            payload={
                "step": "basic",
                "answersByScale": {},
                "basicInfo": {},
                "completedScaleIds": [],
                "resultsByScale": {},
            },
        )
        row = self.db.query(EnterpriseOnboardingProgress).one()
        row.UpdatedAt = datetime.utcnow()
        self.db.commit()

        stale = datetime.utcnow() - timedelta(minutes=5)
        with self.assertRaises(OnboardingProgressConflict) as ctx:
            upsert_progress(
                self.db,
                enterprise=self.enterprise,
                personnel_id=3,
                payload={
                    "step": "select",
                    "answersByScale": {"x": 1},
                    "basicInfo": {},
                    "completedScaleIds": ["scale-a"],
                    "resultsByScale": {},
                },
                client_updated_at=stale,
            )
        self.assertTrue(ctx.exception.progress["exists"])
        self.assertEqual(ctx.exception.progress["step"], first["step"])

    def test_put_strips_completed_without_report(self):
        saved = upsert_progress(
            self.db,
            enterprise=self.enterprise,
            personnel_id=9,
            payload={
                "step": "select",
                "answersByScale": {},
                "basicInfo": {},
                "completedScaleIds": ["scale-a", "scale-b"],
                "resultsByScale": {"scale-a": {"assessmentTitle": "假完成"}},
                "status": "completed",
            },
        )
        self.assertEqual(saved["completedScaleIds"], [])
        self.assertEqual(saved["status"], "in_progress")

    def test_keeps_completed_when_results_have_public_id(self):
        saved = upsert_progress(
            self.db,
            enterprise=self.enterprise,
            personnel_id=12,
            payload={
                "step": "select",
                "answersByScale": {},
                "basicInfo": {"name": "李四", "empNo": "12"},
                "completedScaleIds": ["scale-a"],
                "resultsByScale": {
                    "scale-a": {
                        "publicId": "rpt_local_keep",
                        "submittedAt": "2026-11-17T00:00:00Z",
                    }
                },
            },
        )
        self.assertEqual(saved["completedScaleIds"], ["scale-a"])
        self.assertEqual(saved["basicInfo"]["name"], "李四")

    def test_empty_put_does_not_wipe_existing(self):
        upsert_progress(
            self.db,
            enterprise=self.enterprise,
            personnel_id=13,
            payload={
                "step": "select",
                "answersByScale": {"scale-a": {"q1": "1"}},
                "basicInfo": {"name": "王五", "empNo": "13", "gender": "男", "age": "23-28",
                              "dept": "d", "post": "p", "category": "职能支持", "workLoc": "公司本部"},
                "completedScaleIds": ["scale-a"],
                "resultsByScale": {
                    "scale-a": {"publicId": "rpt_keep_13", "submittedAt": "2026-11-17T00:00:00Z"}
                },
            },
        )
        with self.assertRaises(OnboardingProgressConflict):
            upsert_progress(
                self.db,
                enterprise=self.enterprise,
                personnel_id=13,
                payload={
                    "step": "welcome",
                    "answersByScale": {},
                    "basicInfo": {},
                    "completedScaleIds": [],
                    "resultsByScale": {},
                },
                client_updated_at=None,
            )

    def test_get_reconciles_from_formal_reports(self):
        report = self.add_report(personnel_id=11, assessment_id="scale-a", public_id="rpt_align_1")
        progress = get_progress(self.db, enterprise=self.enterprise, personnel_id=11)
        self.assertTrue(progress["exists"])
        self.assertEqual(progress["completedScaleIds"], ["scale-a"])
        self.assertEqual(progress["resultsByScale"]["scale-a"]["publicId"], report.PublicId)
        self.assertEqual(progress["status"], "in_progress")
        self.assertEqual(len(progress["submittedReports"]), 1)

        self.add_report(personnel_id=11, assessment_id="scale-b", public_id="rpt_align_2")
        done = get_progress(self.db, enterprise=self.enterprise, personnel_id=11)
        self.assertEqual(sorted(done["completedScaleIds"]), ["scale-a", "scale-b"])
        self.assertEqual(done["status"], "completed")


if __name__ == "__main__":
    unittest.main()
