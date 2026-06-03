"""
将已存在的 App* 表中所有 "用户可见文本列" 由 VARCHAR / TEXT 升级为 NVARCHAR / NVARCHAR(MAX)。

背景：
    SQLAlchemy 默认 String 在 SQL Server 上映射成 VARCHAR，无法存储非 GBK / 非系统排序集字符，
    导致 seed 数据中的中文显示成 ???。models.py 中我们已经把这些字段改为 Unicode / UnicodeText，
    但旧表已经被 create_all 创建为 VARCHAR，需要 ALTER 才能匹配新模型。

策略：
    - 显式枚举需要升级的 (table, column, target_type) 三元组。
    - 仅在当前列类型不是目标 NVARCHAR 时执行 ALTER，避免重复迁移。
    - 不会迁移 ASCII 列（Status / Token / OpenId 等），节省数据库空间。

运行：
    .\venv\Scripts\python.exe migrate_to_nvarchar.py
"""

from typing import List, Tuple

from sqlalchemy import inspect, text

from database import engine

# (table_name, column_name, target_type)
# target_type:
#   - "NVARCHAR(N)"     长度有限的中文字段
#   - "NVARCHAR(MAX)"   富文本 / 长正文
TARGETS: List[Tuple[str, str, str]] = [
    # AppAccount
    ("AppAccount", "Nickname", "NVARCHAR(100)"),
    ("AppAccount", "RealName", "NVARCHAR(50)"),
    ("AppAccount", "EmergencyContact", "NVARCHAR(100)"),

    # AppOrder
    ("AppOrder", "Description", "NVARCHAR(200)"),

    # AppSchedule
    ("AppSchedule", "Note", "NVARCHAR(200)"),

    # AppConsultation
    ("AppConsultation", "Note", "NVARCHAR(500)"),

    # AppCaseRecord
    ("AppCaseRecord", "Subjective", "NVARCHAR(MAX)"),
    ("AppCaseRecord", "Objective", "NVARCHAR(MAX)"),
    ("AppCaseRecord", "Assessment", "NVARCHAR(MAX)"),
    ("AppCaseRecord", "Plan", "NVARCHAR(MAX)"),

    # AppTask
    ("AppTask", "Title", "NVARCHAR(200)"),
    ("AppTask", "Content", "NVARCHAR(MAX)"),

    # AppRiskAlert
    ("AppRiskAlert", "Description", "NVARCHAR(MAX)"),
    ("AppRiskAlert", "HandlerNote", "NVARCHAR(500)"),

    # AppBanner
    ("AppBanner", "Title", "NVARCHAR(200)"),

    # AppActivity
    ("AppActivity", "Title", "NVARCHAR(200)"),
    ("AppActivity", "Content", "NVARCHAR(MAX)"),

    # AppArticle
    ("AppArticle", "Title", "NVARCHAR(200)"),
    ("AppArticle", "Category", "NVARCHAR(50)"),
    ("AppArticle", "Summary", "NVARCHAR(500)"),
    ("AppArticle", "Content", "NVARCHAR(MAX)"),
    ("AppArticle", "Author", "NVARCHAR(100)"),
    ("AppArticle", "Source", "NVARCHAR(100)"),

    # AppMessage
    ("AppMessage", "Title", "NVARCHAR(200)"),
    ("AppMessage", "Content", "NVARCHAR(MAX)"),

    # AppSubscribeTemplate
    ("AppSubscribeTemplate", "Description", "NVARCHAR(200)"),

    # AppMessageLog
    ("AppMessageLog", "Payload", "NVARCHAR(MAX)"),
    ("AppMessageLog", "ErrorMessage", "NVARCHAR(500)"),

    # AppRemindTask
    ("AppRemindTask", "Title", "NVARCHAR(200)"),
    ("AppRemindTask", "Content", "NVARCHAR(MAX)"),
    ("AppRemindTask", "ErrorMessage", "NVARCHAR(500)"),

    # AppRegistrationForm
    ("AppRegistrationForm", "RealName", "NVARCHAR(50)"),
    ("AppRegistrationForm", "Occupation", "NVARCHAR(100)"),
    ("AppRegistrationForm", "Education", "NVARCHAR(100)"),
    ("AppRegistrationForm", "MaritalStatus", "NVARCHAR(50)"),
    ("AppRegistrationForm", "EmergencyContact", "NVARCHAR(100)"),
    ("AppRegistrationForm", "ChiefComplaint", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "PastDiagnosis", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "TreatmentHistory", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "MedicationHistory", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "FamilyMentalHistory", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "FamilyRelationship", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "SleepStatus", "NVARCHAR(200)"),
    ("AppRegistrationForm", "AppetiteStatus", "NVARCHAR(200)"),
    ("AppRegistrationForm", "SubstanceUse", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "SelfHarmRisk", "NVARCHAR(MAX)"),
    ("AppRegistrationForm", "ConsultationGoal", "NVARCHAR(MAX)"),

    # AppCounselorProfile
    ("AppCounselorProfile", "Name", "NVARCHAR(100)"),
    ("AppCounselorProfile", "Title", "NVARCHAR(100)"),
    ("AppCounselorProfile", "Specialty", "NVARCHAR(MAX)"),
    ("AppCounselorProfile", "Field", "NVARCHAR(200)"),
    ("AppCounselorProfile", "Introduce", "NVARCHAR(MAX)"),
    ("AppCounselorProfile", "Career", "NVARCHAR(MAX)"),
    ("AppCounselorProfile", "Qualification", "NVARCHAR(MAX)"),

    # AppContactRecord
    ("AppContactRecord", "Content", "NVARCHAR(MAX)"),
]


def _current_type(conn, table: str, column: str) -> str | None:
    """读取当前列类型（数据类型 + 长度），用于判断是否需要迁移。"""
    row = conn.execute(
        text(
            """
            SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = :t AND COLUMN_NAME = :c
            """
        ),
        {"t": table, "c": column},
    ).fetchone()
    if not row:
        return None
    data_type, max_len = row
    if data_type is None:
        return None
    if max_len is None:
        return data_type.upper()
    if int(max_len) == -1:
        return f"{data_type.upper()}(MAX)"
    return f"{data_type.upper()}({max_len})"


def _is_already_target(actual: str | None, target: str) -> bool:
    if not actual:
        return False
    a = actual.replace(" ", "").upper()
    t = target.replace(" ", "").upper()
    return a == t


def migrate() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    altered = 0
    skipped = 0
    missing = 0

    with engine.begin() as conn:
        for table, column, target in TARGETS:
            if table not in existing_tables:
                missing += 1
                print(f"[SKIP] 表不存在: {table}")
                continue

            cur = _current_type(conn, table, column)
            if cur is None:
                missing += 1
                print(f"[SKIP] 列不存在: {table}.{column}")
                continue
            if _is_already_target(cur, target):
                skipped += 1
                continue

            sql = f'ALTER TABLE [{table}] ALTER COLUMN [{column}] {target} NULL'
            try:
                conn.execute(text(sql))
                altered += 1
                print(f"[OK]   {table}.{column} : {cur} -> {target}")
            except Exception as e:
                print(f"[FAIL] {table}.{column} : {cur} -> {target} ({e})")

    print()
    print(f"完成。已迁移 {altered}，跳过 {skipped}（已是目标类型），缺失 {missing}。")


if __name__ == "__main__":
    migrate()
