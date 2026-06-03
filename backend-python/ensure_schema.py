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
    "EmergencyPhone": "NVARCHAR(20) NULL",
    "IsActive": "BIT NOT NULL CONSTRAINT DF_AppAccount_IsActive DEFAULT 1",
    "DeletedAt": "DATETIME NULL",
}


def ensure_tables():
    Base.metadata.create_all(bind=engine)


def ensure_app_account_columns():
    inspector = inspect(engine)
    if not inspector.has_table("AppAccount"):
        return

    existing = {column["name"] for column in inspector.get_columns("AppAccount")}
    missing = [(name, ddl) for name, ddl in APP_ACCOUNT_COLUMNS.items() if name not in existing]
    if not missing:
        print("[OK] AppAccount columns already complete")
        return

    with engine.begin() as conn:
        for name, ddl in missing:
            conn.execute(text(f"ALTER TABLE [dbo].[AppAccount] ADD [{name}] {ddl}"))
            print(f"[OK] Added AppAccount.{name}")


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
    print_summary()


if __name__ == "__main__":
    main()
