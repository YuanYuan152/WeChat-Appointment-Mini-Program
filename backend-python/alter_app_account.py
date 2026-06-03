"""为 AppAccount 表追加新字段：ActiveRole / RealName / Gender / Birthday / EmergencyContact / EmergencyPhone"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

ALTERS = [
    ("ActiveRole", "NVARCHAR(20) NULL"),
    ("RealName", "NVARCHAR(50) NULL"),
    ("Gender", "NVARCHAR(10) NULL"),
    ("Birthday", "DATETIME NULL"),
    ("EmergencyContact", "NVARCHAR(100) NULL"),
    ("EmergencyPhone", "NVARCHAR(20) NULL"),
]

for col, ddl in ALTERS:
    cur.execute(f"""
        IF NOT EXISTS (
            SELECT 1 FROM sys.columns
            WHERE Name = N'{col}'
              AND Object_ID = Object_ID(N'[dbo].[AppAccount]')
        )
        ALTER TABLE [dbo].[AppAccount] ADD [{col}] {ddl}
    """)
    print(f"+ {col}")

conn.commit()
conn.close()
print("AppAccount columns ensured")
