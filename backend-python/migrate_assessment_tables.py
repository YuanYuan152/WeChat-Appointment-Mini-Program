"""受控创建 EAP 量表数据表。

默认只离线展示迁移计划，不连接数据库。读取目标库使用 ``--preflight``；
真正执行必须同时提供 ``--apply --confirm-database <数据库名>``。
"""

from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine


MIGRATION_FILE = (
    Path(__file__).resolve().parent
    / "migrations"
    / "20260722_create_assessment_tables.sql"
)

TABLE_SPECS: dict[str, dict[str, set[str]]] = {
    "AppAssessmentReport": {
        "columns": {
            "Id",
            "PublicId",
            "AccountId",
            "ClientSubmissionId",
            "AssessmentId",
            "AssessmentVersion",
            "Category",
            "AssessmentTitle",
            "ScoringType",
            "EntrySource",
            "ShareCode",
            "ConsentVersion",
            "ConsentAcceptedAt",
            "DemographicAnswers",
            "Answers",
            "ResultJson",
            "ResultSummary",
            "ReportSnapshot",
            "SnapshotSha256",
            "CompletedAt",
            "DeletedAt",
            "CreatedAt",
        },
        "constraints": {
            "PK_AppAssessmentReport",
            "UQ_AppAssessmentReport_PublicId",
            "UQ_AppAssessmentReport_Account_Submission",
            "CK_AppAssessmentReport_Category",
            "CK_AppAssessmentReport_EntrySource",
            "CK_AppAssessmentReport_AssessmentVersion",
        },
        "default_columns": {"CreatedAt"},
        "indexes": {
            "IX_AppAssessmentReport_Account_Completed",
            "IX_AppAssessmentReport_Assessment_Completed",
            "IX_AppAssessmentReport_Share_Completed",
        },
    },
    "AppAssessmentShareScan": {
        "columns": {
            "Id",
            "ShareCode",
            "AssessmentId",
            "VisitorHash",
            "ScannedAt",
        },
        "constraints": {
            "PK_AppAssessmentShareScan",
        },
        "default_columns": {"ScannedAt"},
        "indexes": {
            "IX_AppAssessmentShareScan_Share_Time",
            "IX_AppAssessmentShareScan_Assessment_Time",
            "IX_AppAssessmentShareScan_Visitor_Time",
        },
    },
    "AppAssessmentAuditLog": {
        "columns": {
            "Id",
            "RequestId",
            "ActorAccountId",
            "ActorRole",
            "Action",
            "TargetType",
            "TargetPublicId",
            "AssessmentId",
            "AssessmentVersion",
            "Outcome",
            "MetadataJson",
            "CreatedAt",
        },
        "constraints": {
            "PK_AppAssessmentAuditLog",
            "CK_AppAssessmentAuditLog_TargetType",
            "CK_AppAssessmentAuditLog_Outcome",
            "CK_AppAssessmentAuditLog_AssessmentVersion",
        },
        "default_columns": {"CreatedAt"},
        "indexes": {
            "IX_AppAssessmentAuditLog_Actor_Time",
            "IX_AppAssessmentAuditLog_Target_Time",
            "IX_AppAssessmentAuditLog_Assessment_Time",
        },
    },
}


def load_migration_sql() -> str:
    return MIGRATION_FILE.read_text(encoding="utf-8")


def split_sql_batches(script: str) -> list[str]:
    """按 SQL Server 的独立 GO 行拆分批次。"""
    batches: list[str] = []
    current: list[str] = []
    for line in script.splitlines():
        if re.fullmatch(r"\s*GO\s*;?\s*", line, flags=re.IGNORECASE):
            batch = "\n".join(current).strip()
            if batch:
                batches.append(batch)
            current = []
            continue
        current.append(line)
    batch = "\n".join(current).strip()
    if batch:
        batches.append(batch)
    return batches


def _configured_engine() -> Engine:
    # 延迟导入，保证默认 dry-run 不初始化数据库驱动或连接配置。
    from database import engine

    return engine


def database_identity(conn: Connection) -> tuple[str, str]:
    row = conn.execute(
        text(
            "SELECT "
            "CAST(SERVERPROPERTY('ServerName') AS NVARCHAR(128)) AS server_name, "
            "DB_NAME() AS database_name"
        )
    ).one()
    return str(row.server_name or ""), str(row.database_name or "")


def collect_schema_state(conn: Connection) -> dict[str, dict[str, Any]]:
    state: dict[str, dict[str, Any]] = {}
    for table_name, expected in TABLE_SPECS.items():
        qualified_name = f"[dbo].[{table_name}]"
        object_id = conn.execute(
            text("SELECT OBJECT_ID(:qualified_name, 'U')"),
            {"qualified_name": qualified_name},
        ).scalar()
        if object_id is None:
            state[table_name] = {
                "exists": False,
                "missing_columns": sorted(expected["columns"]),
                "missing_constraints": sorted(expected["constraints"]),
                "missing_defaults": sorted(expected["default_columns"]),
                "missing_indexes": sorted(expected["indexes"]),
            }
            continue

        columns = set(
            conn.execute(
                text("SELECT [name] FROM [sys].[columns] WHERE [object_id] = :object_id"),
                {"object_id": object_id},
            ).scalars()
        )
        constraints = set(
            conn.execute(
                text(
                    "SELECT [name] FROM [sys].[objects] "
                    "WHERE [parent_object_id] = :object_id "
                    "AND [type] IN ('PK', 'UQ', 'C', 'D')"
                ),
                {"object_id": object_id},
            ).scalars()
        )
        indexes = set(
            conn.execute(
                text(
                    "SELECT [name] FROM [sys].[indexes] "
                    "WHERE [object_id] = :object_id AND [name] IS NOT NULL"
                ),
                {"object_id": object_id},
            ).scalars()
        )
        default_columns = set(
            conn.execute(
                text(
                    "SELECT [column].[name] "
                    "FROM [sys].[default_constraints] AS [default] "
                    "INNER JOIN [sys].[columns] AS [column] "
                    "ON [column].[object_id] = [default].[parent_object_id] "
                    "AND [column].[column_id] = [default].[parent_column_id] "
                    "WHERE [default].[parent_object_id] = :object_id"
                ),
                {"object_id": object_id},
            ).scalars()
        )
        state[table_name] = {
            "exists": True,
            "missing_columns": sorted(expected["columns"] - columns),
            "missing_constraints": sorted(expected["constraints"] - constraints),
            "missing_defaults": sorted(expected["default_columns"] - default_columns),
            "missing_indexes": sorted(expected["indexes"] - indexes),
        }
    return state


def blocking_schema_drift(state: dict[str, dict[str, Any]]) -> list[str]:
    """已有目标表缺列或约束时，幂等脚本不能安全自动修复。"""
    problems: list[str] = []
    for table_name, table_state in state.items():
        if not table_state["exists"]:
            continue
        if table_state["missing_columns"]:
            problems.append(
                f"{table_name} 缺少列: {', '.join(table_state['missing_columns'])}"
            )
        if table_state["missing_constraints"]:
            problems.append(
                f"{table_name} 缺少约束: {', '.join(table_state['missing_constraints'])}"
            )
        if table_state["missing_defaults"]:
            problems.append(
                f"{table_name} 缺少默认值: {', '.join(table_state['missing_defaults'])}"
            )
    return problems


def incomplete_schema(state: dict[str, dict[str, Any]]) -> list[str]:
    problems: list[str] = []
    for table_name, table_state in state.items():
        if not table_state["exists"]:
            problems.append(f"{table_name} 不存在")
            continue
        for kind, label in (
            ("missing_columns", "列"),
            ("missing_constraints", "约束"),
            ("missing_defaults", "默认值"),
            ("missing_indexes", "索引"),
        ):
            if table_state[kind]:
                problems.append(
                    f"{table_name} 缺少{label}: {', '.join(table_state[kind])}"
                )
    return problems


def print_schema_plan(state: dict[str, dict[str, Any]]) -> None:
    for table_name, table_state in state.items():
        if not table_state["exists"]:
            print(f"[CREATE] {table_name}")
            continue
        pending = []
        if table_state["missing_columns"]:
            pending.append(f"缺列 {len(table_state['missing_columns'])}")
        if table_state["missing_constraints"]:
            pending.append(f"缺约束 {len(table_state['missing_constraints'])}")
        if table_state["missing_defaults"]:
            pending.append(f"缺默认值 {len(table_state['missing_defaults'])}")
        if table_state["missing_indexes"]:
            pending.append(f"待建索引 {len(table_state['missing_indexes'])}")
        if pending:
            print(f"[CHECK]  {table_name}: {'，'.join(pending)}")
        else:
            print(f"[OK]     {table_name}: 结构完整")


def print_offline_plan() -> None:
    script = load_migration_sql()
    digest = hashlib.sha256(script.encode("utf-8")).hexdigest()
    print("[DRY-RUN] 未连接数据库，也不会执行 SQL")
    print(f"[INFO] migration: {MIGRATION_FILE}")
    print(f"[INFO] sha256: {digest}")
    print(f"[INFO] batches: {len(split_sql_batches(script))}")
    for table_name in TABLE_SPECS:
        print(f"[PLAN] create/verify dbo.{table_name}")


def run_preflight(engine: Engine) -> tuple[str, dict[str, dict[str, Any]]]:
    with engine.connect() as conn:
        server_name, database_name = database_identity(conn)
        state = collect_schema_state(conn)
    print(f"[INFO] server: {server_name}")
    print(f"[INFO] database: {database_name}")
    print_schema_plan(state)
    drift = blocking_schema_drift(state)
    if drift:
        print("[BLOCKED] 已有目标表结构与设计不一致：")
        for problem in drift:
            print(f" - {problem}")
    else:
        print("[OK] 未发现阻止幂等迁移的已有表结构漂移")
    return database_name, state


def apply_migration(engine: Engine, confirmed_database: str) -> None:
    if not confirmed_database.strip():
        raise RuntimeError("--apply 必须提供 --confirm-database <数据库名>")

    with engine.connect() as conn:
        server_name, database_name = database_identity(conn)
        state = collect_schema_state(conn)
    print(f"[INFO] server: {server_name}")
    print(f"[INFO] database: {database_name}")
    print_schema_plan(state)

    if database_name.casefold() != confirmed_database.strip().casefold():
        raise RuntimeError(
            "数据库确认失败："
            f"当前连接为 {database_name!r}，确认值为 {confirmed_database!r}"
        )
    drift = blocking_schema_drift(state)
    if drift:
        raise RuntimeError("已有目标表结构漂移，拒绝自动执行：" + "；".join(drift))

    batches = split_sql_batches(load_migration_sql())
    with engine.begin() as conn:
        for batch in batches:
            conn.execute(text(batch))
        final_state = collect_schema_state(conn)
        problems = incomplete_schema(final_state)
        if problems:
            raise RuntimeError("迁移后结构校验失败：" + "；".join(problems))

    print(f"[OK] 已在 {database_name} 执行 {len(batches)} 个迁移批次并通过结构校验")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="受控创建 EAP 量表数据表")
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--dry-run", action="store_true", help="离线展示迁移计划（默认）")
    actions.add_argument("--preflight", action="store_true", help="只读检查当前配置的目标库")
    actions.add_argument("--apply", action="store_true", help="执行迁移")
    parser.add_argument(
        "--confirm-database",
        default="",
        help="执行迁移时必须与 DB_NAME() 完全一致的数据库名",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.apply:
        apply_migration(_configured_engine(), args.confirm_database)
        return 0
    if args.preflight:
        _, state = run_preflight(_configured_engine())
        return 2 if blocking_schema_drift(state) else 0
    if args.confirm_database:
        raise RuntimeError("--confirm-database 仅能与 --apply 一起使用")
    print_offline_plan()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
