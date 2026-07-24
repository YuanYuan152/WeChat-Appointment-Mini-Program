import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.dialects import mssql
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import CreateTable

from account_deletion_service import hard_delete_account
from database import Base
from ensure_schema import CONTROLLED_MIGRATION_TABLES, automatically_created_tables
from migrate_assessment_tables import (
    MIGRATION_FILE,
    TABLE_SPECS,
    blocking_schema_drift,
    incomplete_schema,
    load_migration_sql,
    split_sql_batches,
)
from models import (
    AppAccount,
    AppAssessmentAuditLog,
    AppAssessmentReport,
    AppAssessmentShareScan,
)


ASSESSMENT_MODELS = (
    AppAssessmentReport,
    AppAssessmentShareScan,
    AppAssessmentAuditLog,
)


class AssessmentModelSchemaTests(unittest.TestCase):
    def test_models_match_approved_columns_and_nullability(self):
        expected_nullable = {
            "AppAssessmentReport": {
                "ShareCode",
                "DemographicAnswers",
                "Answers",
                "ResultJson",
                "ResultSummary",
                "ReportSnapshot",
                "SnapshotSha256",
                "DeletedAt",
            },
            "AppAssessmentShareScan": set(),
            "AppAssessmentAuditLog": {
                "RequestId",
                "ActorAccountId",
                "ActorRole",
                "TargetPublicId",
                "AssessmentId",
                "AssessmentVersion",
                "MetadataJson",
            },
        }
        for model in ASSESSMENT_MODELS:
            table = model.__table__
            self.assertEqual(set(table.columns.keys()), TABLE_SPECS[table.name]["columns"])
            nullable = {column.name for column in table.columns if column.nullable}
            self.assertEqual(nullable, expected_nullable[table.name])
            self.assertEqual([column.name for column in table.primary_key.columns], ["Id"])

    def test_named_constraints_and_indexes_match_migration_contract(self):
        for model in ASSESSMENT_MODELS:
            table = model.__table__
            constraint_names = {
                constraint.name for constraint in table.constraints if constraint.name
            }
            index_names = {index.name for index in table.indexes}
            self.assertEqual(
                constraint_names,
                TABLE_SPECS[table.name]["constraints"],
                table.name,
            )
            self.assertEqual(index_names, TABLE_SPECS[table.name]["indexes"], table.name)

    def test_mssql_ddl_uses_approved_unicode_and_datetime_types(self):
        report_ddl = str(
            CreateTable(AppAssessmentReport.__table__).compile(dialect=mssql.dialect())
        ).upper()
        scan_ddl = str(
            CreateTable(AppAssessmentShareScan.__table__).compile(dialect=mssql.dialect())
        ).upper()
        audit_ddl = str(
            CreateTable(AppAssessmentAuditLog.__table__).compile(dialect=mssql.dialect())
        ).upper()

        self.assertIn("NVARCHAR(MAX)", report_ddl)
        self.assertNotIn("NTEXT", report_ddl)
        self.assertIn("NVARCHAR(120)", report_ddl)
        self.assertIn("DATETIME2(0)", report_ddl)
        self.assertIn("CHAR(64)", report_ddl)
        self.assertIn("DATETIME2(0)", scan_ddl)
        self.assertIn("NVARCHAR(2000)", audit_ddl)
        self.assertIn("DATETIME2(0)", audit_ddl)
        self.assertIn("SYSUTCDATETIME()", report_ddl)

    def test_assessment_tables_can_be_created_idempotently_in_sqlite(self):
        engine = create_engine("sqlite:///:memory:")
        tables = [model.__table__ for model in ASSESSMENT_MODELS]
        try:
            Base.metadata.create_all(engine, tables=tables)
            Base.metadata.create_all(engine, tables=tables)
        finally:
            engine.dispose()

    def test_generic_startup_schema_creation_excludes_controlled_tables(self):
        self.assertEqual(CONTROLLED_MIGRATION_TABLES, set(TABLE_SPECS))
        automatic_names = {table.name for table in automatically_created_tables()}
        self.assertTrue(CONTROLLED_MIGRATION_TABLES.isdisjoint(automatic_names))


class AssessmentMigrationTests(unittest.TestCase):
    def test_sql_script_is_create_only_and_contains_every_contract_object(self):
        self.assertTrue(MIGRATION_FILE.is_file())
        script = load_migration_sql()
        upper = script.upper()

        self.assertEqual(upper.count("CREATE TABLE"), 3)
        self.assertNotIn("ALTER TABLE", upper)
        self.assertNotIn("DROP TABLE", upper)
        for table_name, spec in TABLE_SPECS.items():
            self.assertIn(f"[DBO].[{table_name.upper()}]", upper)
            for object_name in spec["constraints"] | spec["indexes"]:
                self.assertIn(object_name.upper(), upper)
        self.assertIn("DATETIME2(0)", upper)
        self.assertIn("NVARCHAR(MAX)", upper)
        self.assertIn("SYSUTCDATETIME()", upper)

    def test_go_batch_parser_only_splits_standalone_go_lines(self):
        batches = split_sql_batches(
            "SELECT 'GO inside text';\n go \nSELECT 2;\nGO;\nSELECT 3;"
        )
        self.assertEqual(
            batches,
            ["SELECT 'GO inside text';", "SELECT 2;", "SELECT 3;"],
        )
        self.assertEqual(len(split_sql_batches(load_migration_sql())), 13)

    def test_preflight_classifies_missing_tables_and_unsafe_existing_drift(self):
        missing_state = {
            table_name: {
                "exists": False,
                "missing_columns": sorted(spec["columns"]),
                "missing_constraints": sorted(spec["constraints"]),
                "missing_defaults": sorted(spec["default_columns"]),
                "missing_indexes": sorted(spec["indexes"]),
            }
            for table_name, spec in TABLE_SPECS.items()
        }
        self.assertEqual(blocking_schema_drift(missing_state), [])
        self.assertEqual(len(incomplete_schema(missing_state)), 3)

        drift_state = dict(missing_state)
        drift_state["AppAssessmentReport"] = {
            "exists": True,
            "missing_columns": ["ReportSnapshot"],
            "missing_constraints": ["CK_AppAssessmentReport_Category"],
            "missing_defaults": ["CreatedAt"],
            "missing_indexes": ["IX_AppAssessmentReport_Share_Completed"],
        }
        problems = blocking_schema_drift(drift_state)
        self.assertEqual(len(problems), 3)
        self.assertTrue(any("ReportSnapshot" in problem for problem in problems))
        self.assertTrue(any("Category" in problem for problem in problems))
        self.assertTrue(any("CreatedAt" in problem for problem in problems))


class AssessmentAccountDeletionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_hard_delete_removes_report_content_and_anonymizes_audit_actor(self):
        now = datetime(2026, 7, 22, 12, 0, 0)
        account = AppAccount(
            Id=701,
            Mobile="13800000701",
            ActiveRole="Patient",
            IsActive=True,
        )
        report = AppAssessmentReport(
            Id=801,
            PublicId="report-public-801",
            AccountId=account.Id,
            ClientSubmissionId="submission-801",
            AssessmentId="sds",
            AssessmentVersion=1,
            Category="professional",
            AssessmentTitle="抑郁自评量表",
            ScoringType="sum",
            EntrySource="web",
            ConsentVersion="privacy-v1",
            ConsentAcceptedAt=now,
            Answers="{}",
            CompletedAt=now,
            CreatedAt=now,
        )
        audit = AppAssessmentAuditLog(
            Id=901,
            ActorAccountId=account.Id,
            ActorRole="Patient",
            Action="REPORT_VIEW",
            TargetType="REPORT",
            TargetPublicId=report.PublicId,
            AssessmentId=report.AssessmentId,
            AssessmentVersion=report.AssessmentVersion,
            Outcome="SUCCEEDED",
            CreatedAt=now,
        )
        self.db.add_all([account, report, audit])
        self.db.commit()
        report_id = report.Id
        audit_id = audit.Id

        hard_delete_account(self.db, account.Id)
        self.db.commit()

        self.assertIsNone(self.db.query(AppAssessmentReport).filter_by(Id=report_id).first())
        preserved_audit = self.db.query(AppAssessmentAuditLog).filter_by(Id=audit_id).one()
        self.assertIsNone(preserved_audit.ActorAccountId)
        self.assertIsNone(preserved_audit.ActorRole)


if __name__ == "__main__":
    unittest.main()
