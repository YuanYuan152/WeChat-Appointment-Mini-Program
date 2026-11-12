import json
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import assessment_enterprise_service
import enterprise_data_service as service
from database import Base
from models import (
    AppAccount,
    AppAssessmentAuditLog,
    AppAssessmentReport,
    EnterpriseLearningEvent,
    EnterpriseRiskFollowUp,
    EnterpriseSitePersonnel,
)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class SeverityClassificationTests(unittest.TestCase):
    def test_common_level_texts(self):
        cases = {
            "正常": "ok",
            "轻度抑郁": "watch",
            "中度焦虑": "mid",
            "重度躯体化": "high",
            "睡眠质量很好": "ok",
            "睡眠质量较好": "ok",
            "睡眠质量一般": "watch",
            "睡眠质量差": "mid",
            "需关注": "watch",
            "低风险": "ok",
            "高风险": "high",
            "未见异常": "ok",
            "综合测评结果": None,
            "未知": None,
            "": None,
        }
        for level, expected in cases.items():
            with self.subTest(level=level):
                self.assertEqual(service.classify_level(level), expected)

    def test_dimension_result_uses_worst_dimension(self):
        summary = service.summarize_result(
            {
                "type": "dimension",
                "dimensions": [
                    {"id": "som", "title": "躯体化", "score": 3, "level": "正常"},
                    {"id": "dep", "title": "抑郁", "score": 12.0, "level": "中度抑郁"},
                    {"id": "anx", "title": "焦虑", "score": 8, "level": "轻度焦虑"},
                ],
            }
        )
        self.assertEqual(summary["resultType"], "dimension")
        self.assertEqual(summary["autoSeverity"], "mid")
        self.assertEqual([item["title"] for item in summary["triggers"]], ["抑郁", "焦虑"])
        self.assertEqual(summary["dimensions"][1]["score"], 12)

    def test_sum_and_match_results(self):
        summary = service.summarize_result({"type": "sum", "totalScore": 18, "level": "重度抑郁"})
        self.assertEqual(summary["score"], 18)
        self.assertEqual(summary["autoSeverity"], "high")
        self.assertEqual(len(summary["triggers"]), 1)
        match = service.summarize_result({"type": "match", "title": "安全型"})
        self.assertIsNone(match["autoSeverity"])
        self.assertEqual(match["level"], "安全型")
        self.assertIsNone(service.summarize_result(None)["resultType"])


class EnterpriseDataServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.enterprise = {
            "id": "ent0000000000000000000000000001",
            "slug": "acme-secure-suffix-abcdef123456",
            "companyName": "示例建设",
            "siteName": "心安 EAP",
            "url": "https://corp.example.com/acme-secure-suffix-abcdef123456",
            "logoUrl": "/static/logo.png",
            "assessmentIds": ["bsi-18", "psqi"],
            "assessmentTitles": {"psqi": "睡眠质量自评"},
            "employeeInfoFields": ["empNo", "name", "dept", "category"],
            "customEmployeeInfoFields": [],
        }
        self.other = {**self.enterprise, "id": "ent0000000000000000000000000002", "slug": "other-secure-suffix-abcdef123456"}
        self.admin = AppAccount(RealName="王运营", ActiveRole="Admin", IsActive=True)
        self.db.add(self.admin)
        self.db.commit()
        self.definition_patch = patch.object(service, "_definition", return_value=None)
        self.definition_patch.start()

    def tearDown(self):
        self.definition_patch.stop()
        self.db.close()
        self.engine.dispose()

    def visitor(self, key, enterprise=None):
        enterprise = enterprise or self.enterprise
        account = AppAccount(
            OpenId=service.enterprise_visitor_openid(enterprise["slug"], key),
            ActiveRole="Patient",
            PatientSource="ENTERPRISE_EAP",
            IsActive=True,
        )
        self.db.add(account)
        self.db.commit()
        return account

    def add_report(self, account, assessment_id, result, *, meta=None, minutes=0, enterprise=None):
        enterprise = enterprise or self.enterprise
        completed = datetime(2026, 10, 1, 8, 0) + timedelta(minutes=minutes)
        demographic = {
            "_enterpriseId": enterprise["id"],
            "_enterpriseSlug": enterprise["slug"],
            "_employeeInfo": {},
        }
        demographic.update(meta or {})
        row = AppAssessmentReport(
            PublicId=f"rpt_{uuid.uuid4().hex}",
            AccountId=account.Id,
            ClientSubmissionId=str(uuid.uuid4()),
            AssessmentId=assessment_id,
            AssessmentVersion=1,
            Category="professional",
            AssessmentTitle="简明症状量表" if assessment_id == "bsi-18" else "匹兹堡睡眠质量指数",
            ScoringType=result["type"],
            EntrySource="web",
            ConsentVersion="v1",
            ConsentAcceptedAt=completed,
            DemographicAnswers=canonical(demographic),
            Answers="{}",
            ResultJson=canonical(result),
            ResultSummary="摘要",
            ReportSnapshot="{}",
            SnapshotSha256="0" * 64,
            CompletedAt=completed,
            CreatedAt=completed,
        )
        self.db.add(row)
        self.db.commit()
        return row

    @staticmethod
    def bsi(level_dep="正常", level_anx="正常"):
        return {
            "type": "dimension",
            "dimensions": [
                {"id": "dep", "title": "抑郁", "score": 5, "level": level_dep},
                {"id": "anx", "title": "焦虑", "score": 4, "level": level_anx},
            ],
        }

    @staticmethod
    def psqi(level):
        return {"type": "sum", "totalScore": 12, "level": level}

    def seed(self):
        personnel = EnterpriseSitePersonnel(
            EnterpriseId=self.enterprise["id"],
            EnterpriseSlug=self.enterprise["slug"],
            Role="employee",
            Username="acme00001",
            PasswordHash="x",
            PasswordExport="x",
            EmpNo="00001",
            RealName="",
        )
        idle = EnterpriseSitePersonnel(
            EnterpriseId=self.enterprise["id"],
            EnterpriseSlug=self.enterprise["slug"],
            Role="employee",
            Username="acme00002",
            PasswordHash="x",
            PasswordExport="x",
            EmpNo="00002",
            RealName="",
        )
        self.db.add_all([personnel, idle])
        self.db.commit()
        person_meta = {
            "_personnel": {"id": personnel.Id, "username": "acme00001", "empNo": "00001", "realName": ""},
            "_employeeInfo": {"name": "李明", "empNo": "E-01", "dept": "工程部", "category": "一线业务"},
        }
        # 同一人员表账号在两台设备上填写：访客账号不同，但应归为同一份档案
        device_a = self.visitor("device-a-0001")
        device_b = self.visitor("device-b-0002")
        first = self.add_report(device_a, "bsi-18", self.bsi("重度抑郁"), meta=person_meta, minutes=0)
        retake = self.add_report(device_b, "bsi-18", self.bsi("轻度抑郁"), meta=person_meta, minutes=30)
        sleep = self.add_report(device_b, "psqi", self.psqi("睡眠质量差"), meta=person_meta, minutes=40)
        # 旧答卷：没有 _enterpriseId，只能按 slug 归档
        legacy_account = self.visitor("legacy-visitor-01")
        legacy_meta = {
            "_enterpriseSlug": self.enterprise["slug"],
            "_employeeInfo": {"name": "张华", "dept": "综合办", "category": "职能支持"},
        }
        legacy = AppAssessmentReport(
            PublicId=f"rpt_{uuid.uuid4().hex}",
            AccountId=legacy_account.Id,
            ClientSubmissionId=str(uuid.uuid4()),
            AssessmentId="bsi-18",
            AssessmentVersion=1,
            Category="professional",
            AssessmentTitle="简明症状量表",
            ScoringType="dimension",
            EntrySource="web",
            ConsentVersion="v1",
            ConsentAcceptedAt=datetime(2026, 9, 1),
            DemographicAnswers=canonical(legacy_meta),
            Answers="{}",
            ResultJson=canonical(self.bsi()),
            ResultSummary="摘要",
            ReportSnapshot="{}",
            SnapshotSha256="0" * 64,
            CompletedAt=datetime(2026, 9, 1),
            CreatedAt=datetime(2026, 9, 1),
        )
        self.db.add(legacy)
        # 其他企业与改过后缀但 ID 不同的答卷都不能混入
        other_account = self.visitor("other-visitor-01", self.other)
        self.add_report(other_account, "bsi-18", self.bsi("重度抑郁"), enterprise=self.other)
        spoofed = self.visitor("spoof-visitor-01")
        self.add_report(
            spoofed,
            "bsi-18",
            self.bsi("重度抑郁"),
            meta={"_enterpriseId": self.other["id"], "_enterpriseSlug": self.enterprise["slug"]},
        )
        self.db.commit()
        return {
            "personnel": personnel,
            "idle": idle,
            "device_a": device_a,
            "device_b": device_b,
            "first": first,
            "retake": retake,
            "sleep": sleep,
            "legacy_account": legacy_account,
            "legacy": legacy,
        }

    def test_dataset_groups_reports_by_enterprise_and_person(self):
        seeded = self.seed()
        dataset = service.build_enterprise_dataset(self.db, self.enterprise)

        self.assertEqual(len(dataset["reports"]), 4)
        keys = {item["key"] for item in dataset["respondents"]}
        person_key = f"p{seeded['personnel'].Id}"
        legacy_key = f"a{seeded['legacy_account'].Id}"
        self.assertEqual(keys, {person_key, legacy_key})

        person = next(item for item in dataset["respondents"] if item["key"] == person_key)
        self.assertEqual(person["displayName"], "李明")
        self.assertEqual(person["reportCount"], 3)
        self.assertEqual(sorted(person["accountIds"]), sorted([seeded["device_a"].Id, seeded["device_b"].Id]))
        self.assertEqual(person["status"], "done")
        self.assertEqual(person["completedCount"], 2)
        # 最新一次 BSI 为轻度，睡眠差为中度，取最新答卷中最严重的等级
        self.assertEqual(person["severity"], "mid")

        by_id = {item["publicId"]: item for item in dataset["reports"]}
        self.assertFalse(by_id[seeded["first"].PublicId]["isLatest"])
        self.assertEqual(by_id[seeded["first"].PublicId]["severity"], "high")
        self.assertTrue(by_id[seeded["retake"].PublicId]["isLatest"])
        self.assertEqual(by_id[seeded["sleep"].PublicId]["assessmentTitle"], "睡眠质量自评")

        legacy = next(item for item in dataset["respondents"] if item["key"] == legacy_key)
        self.assertEqual(legacy["status"], "doing")
        self.assertEqual(legacy["severity"], "ok")

        roster = {item["username"]: item for item in dataset["roster"]}
        self.assertEqual(roster["acme00001"]["respondentKey"], person_key)
        self.assertIsNone(roster["acme00002"]["respondentKey"])
        self.assertTrue(dataset["enterprise"]["loginRequired"])
        self.assertEqual(dataset["enterprise"]["personnelEmployeeCount"], 2)

        field_ids = [field["id"] for field in dataset["fields"]]
        self.assertEqual(field_ids, ["empNo", "name", "dept", "category"])
        assessment_ids = [item["id"] for item in dataset["assessments"]]
        self.assertEqual(assessment_ids, ["bsi-18", "psqi"])
        self.assertEqual(dataset["assessments"][0]["dimensions"][0]["title"], "抑郁")
        self.assertEqual(len(dataset["tagLibrary"]), len(service.DEFAULT_TAG_GROUPS))

    def test_follow_up_override_and_history(self):
        seeded = self.seed()
        result = service.save_follow_up(
            self.db,
            enterprise=self.enterprise,
            public_id=seeded["sleep"].PublicId,
            status="engaged",
            severity_override="high",
            owner="周咨询师",
            note="已电话联系",
            actor=self.admin,
        )
        self.assertEqual(result["status"], "engaged")
        self.assertEqual(result["updatedBy"], "王运营")
        service.save_follow_up(
            self.db,
            enterprise=self.enterprise,
            public_id=seeded["sleep"].PublicId,
            status="resolved",
            severity_override=None,
            owner="周咨询师",
            note="复测正常",
            actor=self.admin,
        )
        row = self.db.query(EnterpriseRiskFollowUp).one()
        self.assertEqual(row.Status, "resolved")
        self.assertIsNone(row.SeverityOverride)
        self.assertEqual(len(json.loads(row.HistoryJson)), 2)

        service.save_follow_up(
            self.db,
            enterprise=self.enterprise,
            public_id=seeded["retake"].PublicId,
            status="following",
            severity_override="high",
            owner="",
            note="",
            actor=self.admin,
        )
        dataset = service.build_enterprise_dataset(self.db, self.enterprise)
        retake = next(item for item in dataset["reports"] if item["publicId"] == seeded["retake"].PublicId)
        self.assertEqual(retake["autoSeverity"], "watch")
        self.assertEqual(retake["severity"], "high")
        person = next(item for item in dataset["respondents"] if item["key"].startswith("p"))
        self.assertEqual(person["severity"], "high")

        with self.assertRaises(service.EnterpriseDataError):
            service.save_follow_up(
                self.db,
                enterprise=self.other,
                public_id=seeded["sleep"].PublicId,
                status="pending",
                severity_override=None,
                owner="",
                note="",
                actor=self.admin,
            )
        with self.assertRaises(service.EnterpriseDataError):
            service.save_follow_up(
                self.db,
                enterprise=self.enterprise,
                public_id=seeded["sleep"].PublicId,
                status="unknown",
                severity_override=None,
                owner="",
                note="",
                actor=self.admin,
            )

    def test_annotations_latest_tags_and_delete_permissions(self):
        seeded = self.seed()
        key = f"p{seeded['personnel'].Id}"
        first = service.create_annotation(
            self.db,
            enterprise=self.enterprise,
            respondent_key=key,
            respondent_name="李明",
            tags=["需要持续关注", "需要持续关注", "  独居 "],
            note="团辅中情绪低落",
            source="线下团辅",
            actor=self.admin,
        )
        self.assertEqual(first["tags"], ["需要持续关注", "独居"])
        service.create_annotation(
            self.db,
            enterprise=self.enterprise,
            respondent_key=key,
            respondent_name="李明",
            tags=["状态明显好转"],
            note="",
            source="",
            actor=self.admin,
        )
        dataset = service.build_enterprise_dataset(self.db, self.enterprise)
        person = next(item for item in dataset["respondents"] if item["key"] == key)
        self.assertEqual(person["tags"], ["状态明显好转"])
        self.assertEqual(person["annotationCount"], 2)
        self.assertEqual(person["lastNote"], "团辅中情绪低落")
        self.assertEqual(dataset["recentAnnotations"][0]["tags"], ["状态明显好转"])

        other_staff = AppAccount(RealName="科研员", ActiveRole="Research", IsActive=True)
        self.db.add(other_staff)
        self.db.commit()
        with self.assertRaises(service.EnterpriseDataError) as ctx:
            service.delete_annotation(
                self.db,
                enterprise=self.enterprise,
                annotation_id=first["id"],
                actor=other_staff,
                is_admin=False,
            )
        self.assertEqual(ctx.exception.status_code, 403)
        service.delete_annotation(
            self.db,
            enterprise=self.enterprise,
            annotation_id=first["id"],
            actor=self.admin,
            is_admin=False,
        )
        detail = service.respondent_detail(self.db, enterprise=self.enterprise, respondent_key=key)
        self.assertEqual(len(detail["annotations"]), 1)

        with self.assertRaises(service.EnterpriseDataError):
            service.create_annotation(
                self.db,
                enterprise=self.enterprise,
                respondent_key="x1",
                respondent_name="",
                tags=["独居"],
                note="",
                source="",
                actor=self.admin,
            )

    def test_learning_events_dedupe_and_link_to_respondents(self):
        seeded = self.seed()
        now = datetime(2026, 10, 2, 9, 0)
        common = {
            "enterprise": self.enterprise,
            "visitor_key": "legacy-visitor-01",
            "personnel_id": None,
            "content_type": "article",
            "content_id": "sleep-tips",
            "content_title": "睡个好觉",
        }
        self.assertTrue(service.record_learning_event(self.db, action="view", duration_sec=None, now=now, **common))
        self.assertFalse(
            service.record_learning_event(
                self.db, action="view", duration_sec=None, now=now + timedelta(minutes=5), **common
            )
        )
        self.assertFalse(
            service.record_learning_event(self.db, action="read", duration_sec=2, now=now, **common)
        )
        self.assertTrue(
            service.record_learning_event(self.db, action="read", duration_sec=180, now=now, **common)
        )
        self.assertTrue(
            service.record_learning_event(
                self.db,
                enterprise=self.enterprise,
                visitor_key="device-z-9999",
                personnel_id=seeded["personnel"].Id,
                content_type="audio",
                content_id="breath-5min",
                content_title="五分钟呼吸",
                action="play",
                duration_sec=None,
                now=now,
            )
        )
        with self.assertRaises(service.EnterpriseDataError):
            service.record_learning_event(self.db, action="view", duration_sec=None, now=now, **{**common, "visitor_key": "bad"})
        self.assertEqual(self.db.query(EnterpriseLearningEvent).count(), 3)

        dataset = service.build_enterprise_dataset(self.db, self.enterprise)
        learning = dataset["learning"]
        self.assertEqual(learning["totalViews"], 2)
        self.assertEqual(learning["learnerCount"], 2)
        self.assertEqual(learning["linkedLearnerCount"], 2)
        self.assertEqual(learning["totalMinutes"], 3)
        legacy = next(item for item in dataset["respondents"] if item["key"] == f"a{seeded['legacy_account'].Id}")
        self.assertEqual(legacy["learning"]["views"], 1)
        self.assertEqual(legacy["learning"]["minutes"], 3)

        detail = service.respondent_detail(
            self.db,
            enterprise=self.enterprise,
            respondent_key=f"p{seeded['personnel'].Id}",
        )
        self.assertEqual([item["contentId"] for item in detail["learningEvents"]], ["breath-5min"])

    def test_delete_report_wipes_content_and_audits(self):
        seeded = self.seed()
        service.save_follow_up(
            self.db,
            enterprise=self.enterprise,
            public_id=seeded["first"].PublicId,
            status="pending",
            severity_override=None,
            owner="",
            note="",
            actor=self.admin,
        )
        service.delete_enterprise_report(
            self.db,
            enterprise=self.enterprise,
            public_id=seeded["first"].PublicId,
            actor=self.admin,
        )
        row = self.db.query(AppAssessmentReport).filter_by(PublicId=seeded["first"].PublicId).one()
        self.assertIsNotNone(row.DeletedAt)
        self.assertIsNone(row.ResultJson)
        self.assertEqual(self.db.query(EnterpriseRiskFollowUp).count(), 0)
        audit = self.db.query(AppAssessmentAuditLog).one()
        self.assertEqual(audit.Action, "REPORT_DELETE")
        self.assertEqual(audit.TargetPublicId, seeded["first"].PublicId)
        dataset = service.build_enterprise_dataset(self.db, self.enterprise)
        self.assertEqual(len(dataset["reports"]), 3)
        with self.assertRaises(service.EnterpriseDataError):
            service.delete_enterprise_report(
                self.db,
                enterprise=self.enterprise,
                public_id=seeded["first"].PublicId,
                actor=self.admin,
            )

    def test_export_workbook_contains_detail_summary_and_roster(self):
        self.seed()
        response = service.export_enterprise_dataset_xlsx(self.db, self.enterprise)
        self.assertIn("filename*=UTF-8''", response.headers["content-disposition"])
        workbook = load_workbook(BytesIO(response.body))
        self.assertEqual(workbook.sheetnames, ["答卷明细", "员工汇总", "人员表完成情况"])
        detail = workbook["答卷明细"]
        self.assertEqual(detail.max_row, 5)
        headers = [cell.value for cell in detail[1]]
        self.assertIn("所属部门", headers)
        self.assertIn("风险等级", headers)
        self.assertEqual(headers.count("工号"), 1)
        self.assertEqual(headers.count("姓名"), 1)
        names = {detail.cell(row, 1).value for row in range(2, detail.max_row + 1)}
        self.assertEqual(names, {"李明", "张华"})
        roster = workbook["人员表完成情况"]
        statuses = sorted(roster.cell(row, 4).value for row in range(2, roster.max_row + 1))
        self.assertEqual(statuses, ["已完成", "未开始"])

    def test_list_summaries_count_pending_risks(self):
        seeded = self.seed()
        with patch.object(service, "list_enterprises", return_value=[self.enterprise, self.other]):
            items = {item["id"]: item for item in service.list_enterprise_data_summaries(self.db)}
        mine = items[self.enterprise["id"]]
        self.assertEqual(mine["respondentCount"], 2)
        self.assertEqual(mine["reportCount"], 4)
        self.assertEqual(mine["riskRespondentCount"], 1)
        self.assertEqual(mine["pendingAlertCount"], 1)
        self.assertEqual(mine["personnelEmployeeCount"], 2)
        self.assertEqual(items[self.other["id"]]["reportCount"], 2)

        service.save_follow_up(
            self.db,
            enterprise=self.enterprise,
            public_id=seeded["sleep"].PublicId,
            status="resolved",
            severity_override=None,
            owner="",
            note="",
            actor=self.admin,
        )
        with patch.object(service, "list_enterprises", return_value=[self.enterprise]):
            mine = service.list_enterprise_data_summaries(self.db)[0]
        self.assertEqual(mine["pendingAlertCount"], 0)
        self.assertEqual(mine["riskRespondentCount"], 1)


class EnterprisePublicRouteTests(unittest.TestCase):
    """企业站公开接口：答卷带企业 ID / 站点人员，学习记录遵循站点登录要求。"""

    def setUp(self):
        import assessment_enterprise_routes as routes
        from enterprise_site_personnel_service import generate_personnel, login_personnel

        self.routes = routes
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.enterprise = {
            "id": "ent-route-0001",
            "slug": "route-secure-suffix-abcdef123456",
            "companyName": "示例建设",
            "siteName": "心安 EAP",
            "assessmentIds": ["bsi-18"],
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
        self.slug_patch = patch.object(routes, "get_enterprise_by_slug", side_effect=lambda _slug: dict(self.enterprise))
        self.slug_patch.start()

    def tearDown(self):
        self.slug_patch.stop()
        self.db.close()
        self.engine.dispose()

    def submit(self, authorization):
        body = self.routes.EnterpriseReportsSubmitPayload(
            visitorKey="device-a-0001",
            employeeInfo={"name": "李明", "dept": "工程部"},
            reports=[
                {
                    "clientSubmissionId": str(uuid.uuid4()),
                    "assessmentId": "bsi-18",
                    "assessmentVersion": 1,
                    "answers": {"q1": "a"},
                }
            ],
        )
        captured = {}

        def fake_submit_report(db, **kwargs):
            captured.update(kwargs)
            return {"publicId": "rpt_x", "assessmentTitle": "BSI", "result": {"type": "sum"}}

        with patch.object(self.routes, "submit_report", side_effect=fake_submit_report), patch.object(
            self.routes, "get_assessment_store"
        ):
            result = self.routes.submit_enterprise_assessment_reports(
                self.enterprise["slug"],
                body,
                authorization=authorization,
                db=self.db,
            )
        return result, captured

    def test_submission_records_enterprise_id_and_site_person(self):
        result, captured = self.submit(self.authorization)
        self.assertEqual(result["savedCount"], 1)
        meta = captured["demographic_answers"]
        self.assertEqual(meta["_enterpriseId"], self.enterprise["id"])
        self.assertEqual(meta["_enterpriseSlug"], self.enterprise["slug"])
        self.assertEqual(meta["_personnel"]["id"], self.person.Id)
        self.assertEqual(meta["_personnel"]["username"], "acme00001")
        account = self.db.query(AppAccount).filter(AppAccount.Id == result["accountId"]).one()
        self.assertEqual(
            account.OpenId,
            service.enterprise_visitor_openid(self.enterprise["slug"], "device-a-0001"),
        )

    def test_submission_requires_login_when_personnel_exists(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            self.submit(None)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_learning_event_endpoint(self):
        from fastapi import HTTPException

        body = self.routes.EnterpriseLearningEventPayload(
            visitorKey="device-a-0001",
            contentType="article",
            contentId="sleep-tips",
            contentTitle="睡个好觉",
            action="view",
        )
        with self.assertRaises(HTTPException) as ctx:
            self.routes.record_enterprise_learning_event(
                self.enterprise["slug"], body, authorization=None, db=self.db
            )
        self.assertEqual(ctx.exception.status_code, 401)

        result = self.routes.record_enterprise_learning_event(
            self.enterprise["slug"], body, authorization=self.authorization, db=self.db
        )
        self.assertEqual(result, {"recorded": True})
        event = self.db.query(EnterpriseLearningEvent).one()
        self.assertEqual(event.PersonnelId, self.person.Id)
        self.assertEqual(event.EnterpriseId, self.enterprise["id"])

        self.enterprise["hideLibrary"] = True
        result = self.routes.record_enterprise_learning_event(
            self.enterprise["slug"], body, authorization=self.authorization, db=self.db
        )
        self.assertEqual(result, {"recorded": False})


class TagLibraryTests(unittest.TestCase):
    def test_save_tag_library_persists_into_enterprise_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_path = Path(tmp) / "enterprises.json"
            data_path.write_text(
                json.dumps([{"id": "ent-1", "slug": "acme", "companyName": "示例"}], ensure_ascii=False),
                encoding="utf-8",
            )
            with patch.object(assessment_enterprise_service, "_data_path", return_value=data_path):
                saved = service.save_tag_library(
                    "ent-1",
                    [
                        {"name": "状态", "color": "#c26a0a", "tags": ["失眠", "失眠", "", "焦虑"]},
                        {"name": "状态", "color": "#000000", "tags": ["重复组"]},
                        {"name": "参与", "color": "red", "tags": []},
                    ],
                )
                self.assertEqual(
                    saved,
                    [
                        {"name": "状态", "color": "#C26A0A", "tags": ["失眠", "焦虑"]},
                        {"name": "参与", "color": "#4A5A78", "tags": []},
                    ],
                )
                stored = json.loads(data_path.read_text(encoding="utf-8"))[0]
                self.assertEqual(stored["dataTagGroups"], saved)
                self.assertEqual(service.get_tag_library(stored), saved)
                with self.assertRaises(service.EnterpriseDataError):
                    service.save_tag_library("missing", [])


if __name__ == "__main__":
    unittest.main()
