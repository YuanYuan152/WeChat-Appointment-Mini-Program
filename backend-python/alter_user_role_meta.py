"""为 AppAccount / App check CounselorProfile 追加来访来源与咨询师类型字段。"""
from sqlalchemy import text

from database import engine

ALTERS = [
    ("AppAccount", "PatientSource", "NVARCHAR(50) NULL"),
    ("AppAccount", "AccessRevokedAt", "DATETIME NULL"),
    ("AppCounselorProfile", "CounselorType", "NVARCHAR(50) NULL"),
]

with engine.begin() as conn:
    for table, col, ddl in ALTERS:
        conn.execute(
            text(
                f"""
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE Name = N'{col}'
                      AND Object_ID = Object_ID(N'[dbo].[{table}]')
                )
                ALTER TABLE [dbo].[{table}] ADD [{col}] {ddl}
                """
            )
        )
        print(f"+ {table}.{col}")

print("user role meta columns ensured")
