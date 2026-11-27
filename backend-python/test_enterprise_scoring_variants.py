"""企业站提交量表人口学答案：按人口学计分方案计分，结果页拿到实际使用的计分结构。"""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import enterprise_data_service as data_service
from assessment_definition_service import AssessmentDefinitionStore
from database import Base
from enterprise_onboarding_progress_service import align_progress_with_submissions
from models import AppAssessmentReport, EnterpriseSitePersonnel
from test_assessment_scoring_variants import answers, base_definition


class ReportStructureTests(unittest.TestCase):
    def test_structure_keeps_visual_fields_only(self):
        definition = base_definition()
        structure = data_service.report_structure(definition)
        self.assertEqual(
            set(structure),
            {"scoringType", "scoringPreset", "scoreRanges", "questions"},
        )
        self.assertEqual(structure["questions"], [{"id": "q1"}, {"id": "q2"}, {"id": "q3"}])
        self.assertEqual(structure["scoreRanges"], definition["scoreRanges"])
        self.assertIsNone(data_service.report_structure(None))

    def test_variant_detection(self):
        self.assertTrue(data_service.scoring_variant_applied({"scoringVariant": {"id": "female"}}))
        self.assertFalse(data_service.scoring_variant_applied({"level": "正常"}))
        self.assertFalse(data_service.scoring_variant_applied(None))

    def test_alignment_takes_structure_from_the_latest_submission(self):
        stale = {"scoreRanges": [{"min": 0, "max": 2, "level": "正常"}]}
        common = dict(
            step="select",
            active_scale_id="",
            answers_by_scale={},
            basic_info={},
            completed_scale_ids=["variant-demo"],
            authorized_ids=["variant-demo"],
        )
        submission = {
            "assessmentId": "variant-demo",
            "publicId": "rpt_new",
            "result": {"level": "正常"},
            "submittedAt": "2026-11-26T08:00:00Z",
        }
        # 重新作答改按默认方案计分：上一次留下的计分结构要去掉
        aligned = align_progress_with_submissions(
            **common,
            results_by_scale={"variant-demo": {"publicId": "rpt_old", "reportStructure": stale}},
            submissions={"variant-demo": submission},
        )
        self.assertNotIn("reportStructure", aligned["resultsByScale"]["variant-demo"])
        self.assertEqual(aligned["resultsByScale"]["variant-demo"]["publicId"], "rpt_new")

        fresh = {"scoreRanges": [{"min": 0, "max": 3, "level": "正常"}]}
        aligned = align_progress_with_submissions(
            **common,
            results_by_scale={"variant-demo": {"publicId": "rpt_old", "reportStructure": stale}},
            submissions={"variant-demo": {**submission, "reportStructure": fresh}},
        )
        self.assertEqual(aligned["resultsByScale"]["variant-demo"]["reportStructure"], fresh)


class EnterpriseVariantRouteTests(unittest.TestCase):
    """真实计分：企业站提交量表人口学答案，答卷按计分方案计分并归档到企业。"""

    def setUp(self):
        import assessment_enterprise_routes as routes
        from enterprise_site_personnel_service import generate_personnel, login_personnel

        self.routes = routes
        self.temporary = tempfile.TemporaryDirectory()
        self.store = AssessmentDefinitionStore(Path(self.temporary.name) / "assessment-data")
        created = self.store.create_draft(copy.deepcopy(base_definition()))
        self.store.publish("variant-demo", expected_revision=created["revision"])

        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.enterprise = {
            "id": "ent-variant-0001",
            "slug": "variant-secure-suffix-abcdef123456",
            "companyName": "示例建设",
            "siteName": "心安 EAP",
            "assessmentIds": ["variant-demo"],
            "hideLibrary": False,
        }
        generate_personnel(
            self.db,
            enterprise_id=self.enterprise["id"],
            enterprise_slug=self.enterprise["slug"],
            employee_count=1,
            admin_count=0,
            account_mode="custom",
            account_prefix="acme",
            password_mode="unified",
            unified_password="Passw0rd",
        )
        token = login_personnel(
            self.db,
            slug=self.enterprise["slug"],
            username="acme00001",
            password="Passw0rd",
        )["token"]
        self.authorization = f"Bearer {token}"
        self.person = self.db.query(EnterpriseSitePersonnel).one()
        self.patches = [
            patch.object(
                routes,
                "get_enterprise_by_slug",
                side_effect=lambda _slug: copy.deepcopy(self.enterprise),
            ),
            patch.object(routes, "get_assessment_store", return_value=self.store),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in self.patches:
            item.stop()
        self.db.close()
        self.engine.dispose()
        self.temporary.cleanup()

    def submit(self, demographic_answers=None):
        report = {
            "clientSubmissionId": str(uuid.uuid4()),
            "assessmentId": "variant-demo",
            "assessmentVersion": 1,
            # 总分 3：默认方案（0–3 正常）判“正常”，女性方案（0–2 正常）判“偏高”
            "answers": answers(q1="q1-b", q2="q2-c"),
        }
        if demographic_answers is not None:
            report["demographicAnswers"] = demographic_answers
        body = self.routes.EnterpriseReportsSubmitPayload(
            visitorKey="device-a-0001",
            employeeInfo={"name": "李明", "dept": "工程部"},
            reports=[report],
        )
        response = self.routes.submit_enterprise_assessment_reports(
            self.enterprise["slug"],
            body,
            authorization=self.authorization,
            db=self.db,
        )
        return response["reports"][0]

    def stored_meta(self, public_id):
        row = self.db.query(AppAssessmentReport).filter_by(PublicId=public_id).one()
        return json.loads(row.DemographicAnswers)

    def progress(self):
        return self.routes.get_enterprise_onboarding_progress(
            self.enterprise["slug"],
            authorization=self.authorization,
            db=self.db,
        )

    def test_variant_scoring_and_structure(self):
        saved = self.submit(
            {
                "gender": "female",
                # 客户端不能冒充归档字段
                "_enterpriseSlug": "someone-else",
                "_personnel": {"id": 999},
            }
        )
        self.assertEqual(saved["result"]["level"], "偏高")
        self.assertEqual(saved["result"]["scoringVariant"]["title"], "女性")
        self.assertNotIn("risk", saved["result"])

        structure = saved["reportStructure"]
        self.assertEqual(structure["scoreRanges"][0]["max"], 2)
        self.assertEqual(structure["questions"], [{"id": "q1"}, {"id": "q2"}, {"id": "q3"}])
        self.assertNotIn("riskDimension", structure)

        meta = self.stored_meta(saved["publicId"])
        self.assertEqual(meta["gender"], "female")
        self.assertEqual(meta["_enterpriseSlug"], self.enterprise["slug"])
        self.assertEqual(meta["_enterpriseId"], self.enterprise["id"])
        self.assertEqual(meta["_personnel"]["id"], self.person.Id)

        # 换设备读取进度：结果带着实际计分结构，且不含风险维度
        progress = self.progress()
        entry = progress["resultsByScale"]["variant-demo"]
        self.assertEqual(entry["publicId"], saved["publicId"])
        self.assertEqual(entry["reportStructure"]["scoreRanges"][0]["max"], 2)
        self.assertNotIn("risk", entry["result"])
        self.assertTrue(all("risk" not in item["result"] for item in progress["submittedReports"]))

        # 重新作答改选“男”：按默认方案计分，进度里不再带女性方案的结构
        retake = self.submit({"gender": "male"})
        self.assertEqual(retake["result"]["level"], "正常")
        self.assertNotIn("reportStructure", retake)
        entry = self.progress()["resultsByScale"]["variant-demo"]
        self.assertEqual(entry["publicId"], retake["publicId"])
        self.assertNotIn("reportStructure", entry)

    def test_old_clients_without_demographics_still_submit(self):
        saved = self.submit()
        self.assertEqual(saved["result"]["level"], "正常")
        self.assertNotIn("scoringVariant", saved["result"])
        self.assertNotIn("reportStructure", saved)
        meta = self.stored_meta(saved["publicId"])
        self.assertNotIn("gender", meta)
        self.assertEqual(meta["_enterpriseSlug"], self.enterprise["slug"])

    def test_invalid_demographics_are_rejected(self):
        with self.assertRaises(HTTPException) as context:
            self.submit({"gender": "unknown"})
        self.assertEqual(context.exception.status_code, 422)
        with self.assertRaises(HTTPException) as context:
            self.submit({"hobby": "music"})
        self.assertEqual(context.exception.status_code, 422)
        self.assertEqual(self.db.query(AppAssessmentReport).count(), 0)


if __name__ == "__main__":
    unittest.main()
