"""Ensure mini-program tables exist on the database configured by config.py."""

from sqlalchemy import inspect, text

import models  # noqa: F401 - registers SQLAlchemy models on Base.metadata
from database import Base, engine


APP_ACCOUNT_COLUMNS = {
    "ActiveRole": "NVARCHAR(20) NULL",
    "RealName": "NVARCHAR(50) NULL",
    "Gender": "NVARCHAR(10) NULL",
    "Birthday": "DATETIME NULL",
    "EmergencyContact": "NVARCHAR(100) NULL",
    "EmergencyRelation": "NVARCHAR(50) NULL",
    "EmergencyPhone": "NVARCHAR(20) NULL",
    "IntakeAgreementSignedAt": "DATETIME NULL",
    "IntakeIsAdult": "BIT NULL",
    "IntakeSignatureUrl": "VARCHAR(500) NULL",
    "IsActive": "BIT NOT NULL CONSTRAINT DF_AppAccount_IsActive DEFAULT 1",
    "DeletedAt": "DATETIME NULL",
    "PasswordHash": "VARCHAR(255) NULL",
    "PreferenceTagsCompletedAt": "DATETIME NULL",
    "CharityPricingNegotiatedAt": "DATETIME NULL",
    "IsContractSigned": "BIT NOT NULL CONSTRAINT DF_AppAccount_IsContractSigned DEFAULT 0",
    "BoundCounselorId": "INT NULL",
    "BoundCounselorChangedAt": "DATETIME2 NULL",
}

APP_ORDER_COLUMNS = {
    "IntakeIsAdult": "BIT NULL",
    "IntakeSignatureUrl": "VARCHAR(500) NULL",
    "ExpiresAt": "DATETIME NULL",
    "ProxyCreatedByAccountId": "INT NULL",
    "ProxyAgreementIsAdult": "BIT NULL",
}

APP_REFUND_EXEMPTION_COLUMNS = {
    "RejectReason": "NVARCHAR(MAX) NULL",
    "ReviewedBy": "INT NULL",
    "ReviewedAt": "DATETIME NULL",
}

APP_LEAVE_REQUEST_COLUMNS = {
    "RejectReason": "NVARCHAR(MAX) NULL",
    "ReviewedBy": "INT NULL",
    "ReviewedAt": "DATETIME NULL",
}

APP_SCHEDULE_CANCEL_LOG_COLUMNS = {
    "LeaveRequestId": "INT NULL",
}

APP_CASE_RECORD_COLUMNS = {
    "PhotoUrls": "NVARCHAR(MAX) NULL",
    "RiskAssessment": "NVARCHAR(MAX) NULL",
    "HeaderInfo": "NVARCHAR(MAX) NULL",
}

APP_CASE_RECORD_REVISION_COLUMNS = {
    "RiskAssessment": "NVARCHAR(MAX) NULL",
    "HeaderInfo": "NVARCHAR(MAX) NULL",
}

APP_CASE_RECORD_AMENDMENT_COLUMNS = {
    "RiskAssessment": "NVARCHAR(MAX) NULL",
    "HeaderInfo": "NVARCHAR(MAX) NULL",
}

APP_COUNSELOR_PROFILE_COLUMNS = {
    "TargetGroup": "NVARCHAR(500) NULL",
    "Mode": "NVARCHAR(100) NULL",
    "InfoAuthenticityCommittedAt": "DATETIME NULL",
    "InfoAuthenticitySignerName": "NVARCHAR(100) NULL",
    "FaceBilling": "INT NOT NULL CONSTRAINT DF_AppCounselorProfile_FaceBilling DEFAULT 30000",
    "DefaultShareMode": "NVARCHAR(20) NULL",
    "DefaultRevenueShareCents": "INT NULL",
    "DefaultRevenueSharePercent": "INT NULL",
}

APP_COUNSELOR_PATIENT_PRICING_COLUMNS = {
    "CharityNegotiatedAt": "DATETIME NULL",
}


# 这些表只能通过 migrate_assessment_tables.py 的目标库确认流程创建，不能在
# FastAPI 启动或通用 init_db 中静默落库。
CONTROLLED_MIGRATION_TABLES = frozenset(
    {
        "AppAssessmentReport",
        "AppAssessmentShareScan",
        "AppAssessmentAuditLog",
    }
)


def automatically_created_tables():
    return [
        table
        for table in Base.metadata.sorted_tables
        if table.name not in CONTROLLED_MIGRATION_TABLES
    ]


def ensure_tables():
    Base.metadata.create_all(bind=engine, tables=automatically_created_tables())


def ensure_app_account_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppAccount"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppAccount")}
    missing = [(name, ddl) for name, ddl in APP_ACCOUNT_COLUMNS.items() if name not in existing]
    with engine.begin() as conn:
        if not missing:
            print("[OK] AppAccount columns already complete")
        else:
            for name, ddl in missing:
                conn.execute(text(f"ALTER TABLE [dbo].[AppAccount] ADD [{name}] {ddl}"))
                print(f"[OK] Added AppAccount.{name}")

        # Preserve the current signed/unsigned state for existing accounts, but
        # establish a boundary so paid orders from before this deployment can
        # never re-sign an account after its counselor binding changes.
        initialized = conn.execute(
            text(
                "UPDATE [dbo].[AppAccount] "
                "SET [BoundCounselorChangedAt] = SYSUTCDATETIME() "
                "WHERE [BoundCounselorId] IS NOT NULL "
                "AND [BoundCounselorChangedAt] IS NULL"
            )
        ).rowcount
        if initialized:
            print(f"[OK] Initialized binding timestamps for {initialized} AppAccount rows")


def ensure_app_order_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppOrder"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppOrder")}
    missing = [(name, ddl) for name, ddl in APP_ORDER_COLUMNS.items() if name not in existing]
    if not missing:
        print("[OK] AppOrder columns already complete")
        return

    with engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE [dbo].[AppOrder] ADD [{name}] {ddl}"))
            print(f"[OK] Added AppOrder.{name}")


def ensure_case_record_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppCaseRecord"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppCaseRecord")}
    missing = [(name, ddl) for name, ddl in APP_CASE_RECORD_COLUMNS.items() if name not in existing]
    if not missing:
        print("[OK] AppCaseRecord columns already complete")
    else:
        with engine.begin() as conn:
            for name, ddl in missing:
                conn.execute(text(f"ALTER TABLE [dbo].[AppCaseRecord] ADD [{name}] {ddl}"))
                print(f"[OK] Added AppCaseRecord.{name}")

    if inspector.has_table("AppCaseRecordRevision"):
        existing_rev = {column["name"] for column in inspector.get_columns("AppCaseRecordRevision")}
        missing_rev = [
            (name, ddl)
            for name, ddl in APP_CASE_RECORD_REVISION_COLUMNS.items()
            if name not in existing_rev
        ]
        if not missing_rev:
            print("[OK] AppCaseRecordRevision columns already complete")
        else:
            with engine.begin() as conn:
                for name, ddl in missing_rev:
                    conn.execute(
                        text(f"ALTER TABLE [dbo].[AppCaseRecordRevision] ADD [{name}] {ddl}")
                    )
                    print(f"[OK] Added AppCaseRecordRevision.{name}")

    if inspector.has_table("AppCaseRecordAmendmentRequest"):
        existing_amd = {
            column["name"] for column in inspector.get_columns("AppCaseRecordAmendmentRequest")
        }
        missing_amd = [
            (name, ddl)
            for name, ddl in APP_CASE_RECORD_AMENDMENT_COLUMNS.items()
            if name not in existing_amd
        ]
        if not missing_amd:
            print("[OK] AppCaseRecordAmendmentRequest columns already complete")
        else:
            with engine.begin() as conn:
                for name, ddl in missing_amd:
                    conn.execute(
                        text(
                            f"ALTER TABLE [dbo].[AppCaseRecordAmendmentRequest] ADD [{name}] {ddl}"
                        )
                    )
                    print(f"[OK] Added AppCaseRecordAmendmentRequest.{name}")


def ensure_refund_exemption_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppRefundExemption"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppRefundExemption")}
    missing = [
        (name, ddl) for name, ddl in APP_REFUND_EXEMPTION_COLUMNS.items() if name not in existing
    ]
    if not missing:
        print("[OK] AppRefundExemption columns already complete")
        return

    with engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE [dbo].[AppRefundExemption] ADD [{name}] {ddl}"))
            print(f"[OK] Added AppRefundExemption.{name}")


def ensure_leave_request_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppLeaveRequest"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppLeaveRequest")}
    missing = [
        (name, ddl) for name, ddl in APP_LEAVE_REQUEST_COLUMNS.items() if name not in existing
    ]
    if not missing:
        print("[OK] AppLeaveRequest columns already complete")
        return

    with engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE [dbo].[AppLeaveRequest] ADD [{name}] {ddl}"))
            print(f"[OK] Added AppLeaveRequest.{name}")


def ensure_schedule_cancel_log_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppScheduleCancelLog"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppScheduleCancelLog")}
    missing = [
        (name, ddl)
        for name, ddl in APP_SCHEDULE_CANCEL_LOG_COLUMNS.items()
        if name not in existing
    ]
    if not missing:
        print("[OK] AppScheduleCancelLog columns already complete")
        return

    with engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE [dbo].[AppScheduleCancelLog] ADD [{name}] {ddl}"))
            print(f"[OK] Added AppScheduleCancelLog.{name}")


def ensure_counselor_profile_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppCounselorProfile"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppCounselorProfile")}
    missing = [
        (name, ddl) for name, ddl in APP_COUNSELOR_PROFILE_COLUMNS.items() if name not in existing
    ]
    if not missing:
        print("[OK] AppCounselorProfile columns already complete")
        return

    with engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE [dbo].[AppCounselorProfile] ADD [{name}] {ddl}"))
            print(f"[OK] Added AppCounselorProfile.{name}")


def ensure_counselor_patient_pricing_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppCounselorPatientPricing"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppCounselorPatientPricing")}
    missing = [
        (name, ddl) for name, ddl in APP_COUNSELOR_PATIENT_PRICING_COLUMNS.items() if name not in existing
    ]
    if not missing:
        print("[OK] AppCounselorPatientPricing columns already complete")
        return

    with engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE [dbo].[AppCounselorPatientPricing] ADD [{name}] {ddl}"))
            print(f"[OK] Added AppCounselorPatientPricing.{name}")


def print_summary():
    inspector = inspect(engine)
    tables = [name for name in inspector.get_table_names() if name.startswith("App")]
    print(f"[OK] App table count: {len(tables)}")
    for name in sorted(tables):
        print(f" - {name}")


def main():
    with engine.connect() as conn:
        print("[INFO] server:", conn.execute(text("SELECT @@SERVERNAME")).scalar())
        print("[INFO] database:", conn.execute(text("SELECT DB_NAME()")).scalar())
        print("[INFO] schema:", conn.execute(text("SELECT SCHEMA_NAME()")).scalar())

    ensure_tables()
    ensure_app_account_columns()
    ensure_app_order_columns()
    ensure_case_record_columns()
    ensure_refund_exemption_columns()
    ensure_leave_request_columns()
    ensure_schedule_cancel_log_columns()
    ensure_counselor_profile_columns()
    ensure_counselor_patient_pricing_columns()
    from database import SessionLocal
    from charity_milestone_service import backfill_charity_negotiation_state
    db = SessionLocal()
    try:
        n = backfill_charity_negotiation_state(db)
        db.commit()
        if n:
            print(f"[OK] Backfilled charity negotiation timestamps: {n}")
    finally:
        db.close()
    print_summary()


if __name__ == "__main__":
    main()
