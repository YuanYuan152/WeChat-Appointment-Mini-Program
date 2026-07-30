"""Provision the least-privilege SQL Server identity used by the Backend.

The default action is an offline plan: it imports no application configuration,
opens no database connection and changes nothing.  Applying the plan requires
both ``--apply`` and an exact ``--confirm-database`` value.

The runtime password is intentionally accepted only through
``RUNTIME_DB_PASSWORD``.  It is bound as an ODBC parameter while the server
constructs ``CREATE LOGIN`` with ``QUOTENAME``; it is never accepted in argv or
printed by this process.
"""

from __future__ import annotations

import argparse
import os
import re
from typing import Any, Iterable


RUNTIME_ROLE = "mini_app_runtime"
SAFE_IDENTIFIER = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,127}\Z")
REQUIRED_TABLES = (
    "AppAccount",
    "AppOrder",
    "AppAssessmentReport",
    "AppAssessmentShareScan",
    "AppAssessmentAuditLog",
)

CREATE_LOGIN_SQL = """
DECLARE @login sysname = ?;
DECLARE @password nvarchar(128) = ?;
DECLARE @database sysname = ?;
DECLARE @statement nvarchar(max) =
    N'CREATE LOGIN ' + QUOTENAME(@login)
    + N' WITH PASSWORD = ' + QUOTENAME(@password, '''')
    + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = '
    + QUOTENAME(@database)
    + N', DEFAULT_LANGUAGE = [us_english]';
EXEC sys.sp_executesql @statement;
"""

CREATE_USER_SQL = """
DECLARE @username sysname = ?;
DECLARE @statement nvarchar(max) =
    N'CREATE USER ' + QUOTENAME(@username)
    + N' FOR LOGIN ' + QUOTENAME(@username)
    + N' WITH DEFAULT_SCHEMA = [dbo]';
EXEC sys.sp_executesql @statement;
"""

ADD_ROLE_MEMBER_SQL = """
DECLARE @username sysname = ?;
DECLARE @statement nvarchar(max) =
    N'ALTER ROLE [mini_app_runtime] ADD MEMBER ' + QUOTENAME(@username);
EXEC sys.sp_executesql @statement;
"""

DROP_USER_SQL = """
DECLARE @username sysname = ?;
IF DATABASE_PRINCIPAL_ID(@username) IS NOT NULL
BEGIN
    DECLARE @statement nvarchar(max) = N'';
    IF IS_ROLEMEMBER(N'mini_app_runtime', @username) = 1
        SET @statement =
            N'ALTER ROLE [mini_app_runtime] DROP MEMBER '
            + QUOTENAME(@username) + N';';
    SET @statement = @statement + N'DROP USER ' + QUOTENAME(@username);
    EXEC sys.sp_executesql @statement;
END
"""

DROP_LOGIN_SQL = """
DECLARE @login sysname = ?;
IF SUSER_ID(@login) IS NOT NULL
BEGIN
    DECLARE @statement nvarchar(max) =
        N'DROP LOGIN ' + QUOTENAME(@login);
    EXEC sys.sp_executesql @statement;
END
"""


class ProvisioningError(RuntimeError):
    """A safe-to-display provisioning failure."""


def _safe_identifier(value: str, label: str) -> str:
    normalized = (value or "").strip()
    if not SAFE_IDENTIFIER.fullmatch(normalized):
        raise ProvisioningError(
            f"{label} must start with a letter and contain only letters, digits or underscore"
        )
    return normalized


def validate_runtime_credentials(
    runtime_user: str,
    runtime_password: str,
    migration_user: str,
    migration_password: str,
) -> tuple[str, str]:
    runtime_user = _safe_identifier(runtime_user, "RUNTIME_DB_USER")
    if runtime_user.casefold() == "sa":
        raise ProvisioningError("RUNTIME_DB_USER must not be sa")
    if runtime_user.casefold() == (migration_user or "").strip().casefold():
        raise ProvisioningError(
            "runtime and migration database identities must be different"
        )

    if len(runtime_password) < 20 or len(runtime_password) > 128:
        raise ProvisioningError(
            "RUNTIME_DB_PASSWORD must contain between 20 and 128 characters"
        )
    if runtime_password != runtime_password.strip():
        raise ProvisioningError(
            "RUNTIME_DB_PASSWORD must not start or end with whitespace"
        )
    if any(character in runtime_password for character in (";", "\r", "\n", "\0")):
        raise ProvisioningError(
            "RUNTIME_DB_PASSWORD contains a character unsafe for the application ODBC configuration"
        )
    if runtime_password == migration_password:
        raise ProvisioningError(
            "runtime and migration database passwords must be different"
        )
    if not (
        re.search(r"[A-Z]", runtime_password)
        and re.search(r"[a-z]", runtime_password)
        and re.search(r"[0-9]", runtime_password)
        and re.search(r"[^A-Za-z0-9]", runtime_password)
    ):
        raise ProvisioningError(
            "RUNTIME_DB_PASSWORD must include upper, lower, digit and symbol characters"
        )
    return runtime_user, runtime_password


def _odbc_value(value: str) -> str:
    """Quote an ODBC connection-string value without exposing it."""

    return "{" + value.replace("}", "}}") + "}"


def _connection_string(settings: Any, database_name: str, *, password: str) -> str:
    server = settings.DB_SERVER
    if not settings.DB_TRUSTED_CONNECTION and settings.DB_PORT:
        server = f"{settings.DB_SERVER},{settings.DB_PORT}"
    parts = [
        f"DRIVER={_odbc_value(settings.DB_DRIVER)}",
        f"SERVER={_odbc_value(server)}",
        f"DATABASE={_odbc_value(database_name)}",
    ]
    if settings.DB_TRUSTED_CONNECTION:
        parts.append("Trusted_Connection=yes")
    else:
        parts.extend(
            (
                f"UID={_odbc_value(settings.DB_USER)}",
                f"PWD={_odbc_value(password)}",
            )
        )
    if settings.DB_TRUST_SERVER_CERTIFICATE:
        parts.append("TrustServerCertificate=yes")
    parts.append(f"Connection Timeout={int(settings.DB_CONNECT_TIMEOUT)}")
    return ";".join(parts) + ";"


def _runtime_connection_string(
    settings: Any,
    database_name: str,
    runtime_user: str,
    runtime_password: str,
) -> str:
    server = settings.DB_SERVER
    if settings.DB_PORT:
        server = f"{settings.DB_SERVER},{settings.DB_PORT}"
    parts = [
        f"DRIVER={_odbc_value(settings.DB_DRIVER)}",
        f"SERVER={_odbc_value(server)}",
        f"DATABASE={_odbc_value(database_name)}",
        f"UID={_odbc_value(runtime_user)}",
        f"PWD={_odbc_value(runtime_password)}",
    ]
    if settings.DB_TRUST_SERVER_CERTIFICATE:
        parts.append("TrustServerCertificate=yes")
    parts.append(f"Connection Timeout={int(settings.DB_CONNECT_TIMEOUT)}")
    return ";".join(parts) + ";"


def _missing_tables(cursor: Any, table_names: Iterable[str]) -> list[str]:
    missing: list[str] = []
    for table_name in table_names:
        row = cursor.execute(
            "SELECT OBJECT_ID(?, 'U')",
            f"[dbo].[{table_name}]",
        ).fetchone()
        if not row or row[0] is None:
            missing.append(table_name)
    return missing


def _verify_runtime_identity(
    pyodbc: Any,
    settings: Any,
    database_name: str,
    runtime_user: str,
    runtime_password: str,
) -> None:
    connection = pyodbc.connect(
        _runtime_connection_string(
            settings,
            database_name,
            runtime_user,
            runtime_password,
        ),
        autocommit=False,
    )
    try:
        cursor = connection.cursor()
        identity = cursor.execute(
            "SELECT DB_NAME(), SUSER_SNAME(), USER_NAME()"
        ).fetchone()
        if not identity or str(identity[0]).casefold() != database_name.casefold():
            raise ProvisioningError("runtime identity connected to the wrong database")

        permission_row = cursor.execute(
            """
            SELECT
                HAS_PERMS_BY_NAME(N'dbo', N'SCHEMA', N'SELECT'),
                HAS_PERMS_BY_NAME(N'dbo', N'SCHEMA', N'INSERT'),
                HAS_PERMS_BY_NAME(N'dbo', N'SCHEMA', N'UPDATE'),
                HAS_PERMS_BY_NAME(N'dbo', N'SCHEMA', N'DELETE'),
                HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'ALTER'),
                HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CONTROL'),
                HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'VIEW DEFINITION')
            """
        ).fetchone()
        if tuple(int(value or 0) for value in permission_row[:4]) != (1, 1, 1, 1):
            raise ProvisioningError("runtime identity is missing required DML permissions")
        if any(int(value or 0) != 0 for value in permission_row[4:]):
            raise ProvisioningError("runtime identity received elevated database permissions")

        missing = _missing_tables(cursor, REQUIRED_TABLES)
        if missing:
            raise ProvisioningError(
                "runtime identity cannot see required tables: " + ", ".join(missing)
            )

        lock_result = cursor.execute(
            """
            SET NOCOUNT ON;
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock
                @Resource=N'mini-runtime-provision-smoke',
                @LockMode='Exclusive',
                @LockOwner='Transaction',
                @LockTimeout=0;
            SELECT @result;
            """
        ).fetchone()
        if not lock_result or int(lock_result[0]) < 0:
            raise ProvisioningError("runtime identity cannot acquire application locks")
        connection.rollback()
    finally:
        connection.close()


def apply_provisioning(confirmed_database: str) -> None:
    # Delayed imports keep the default dry-run offline and dependency-free.
    import pyodbc

    from config import settings

    database_name = _safe_identifier(settings.DB_NAME, "DB_NAME")
    if confirmed_database != database_name:
        raise ProvisioningError(
            "database confirmation failed: --confirm-database must exactly match DB_NAME"
        )

    runtime_user, runtime_password = validate_runtime_credentials(
        os.environ.get("RUNTIME_DB_USER", ""),
        os.environ.get("RUNTIME_DB_PASSWORD", ""),
        settings.DB_USER,
        settings.DB_PASSWORD,
    )

    master_connection = pyodbc.connect(
        _connection_string(settings, "master", password=settings.DB_PASSWORD),
        autocommit=True,
    )
    database_connection = None
    login_created = False
    user_created = False
    try:
        master_cursor = master_connection.cursor()
        database_row = master_cursor.execute(
            "SELECT DB_ID(?)",
            database_name,
        ).fetchone()
        if not database_row or database_row[0] is None:
            raise ProvisioningError("confirmed database does not exist")
        if master_cursor.execute(
            "SELECT SUSER_ID(?)",
            runtime_user,
        ).fetchone()[0] is not None:
            raise ProvisioningError(
                "runtime login already exists; refusing silent reuse or password rotation"
            )

        database_connection = pyodbc.connect(
            _connection_string(
                settings,
                database_name,
                password=settings.DB_PASSWORD,
            ),
            autocommit=True,
        )
        database_cursor = database_connection.cursor()
        actual_database = database_cursor.execute("SELECT DB_NAME()").fetchone()[0]
        if str(actual_database) != database_name:
            raise ProvisioningError("migration identity connected to the wrong database")
        if database_cursor.execute(
            "SELECT DATABASE_PRINCIPAL_ID(?)",
            runtime_user,
        ).fetchone()[0] is not None:
            raise ProvisioningError(
                "runtime database user already exists; refusing silent reuse"
            )
        missing = _missing_tables(database_cursor, REQUIRED_TABLES)
        if missing:
            raise ProvisioningError(
                "required migrations are incomplete: " + ", ".join(missing)
            )

        master_cursor.execute(
            CREATE_LOGIN_SQL,
            runtime_user,
            runtime_password,
            database_name,
        )
        login_created = True
        database_cursor.execute(CREATE_USER_SQL, runtime_user)
        user_created = True
        database_cursor.execute(
            """
            IF DATABASE_PRINCIPAL_ID(N'mini_app_runtime') IS NULL
                CREATE ROLE [mini_app_runtime] AUTHORIZATION [dbo]
            """
        )
        database_cursor.execute(
            """
            GRANT SELECT, INSERT, UPDATE, DELETE
                ON SCHEMA::[dbo] TO [mini_app_runtime]
            """
        )
        database_cursor.execute(ADD_ROLE_MEMBER_SQL, runtime_user)
        _verify_runtime_identity(
            pyodbc,
            settings,
            database_name,
            runtime_user,
            runtime_password,
        )
    except Exception:
        # A failed first-time provision must not leave an apparently usable
        # half-created identity.  Existing principals were rejected above, so
        # cleanup can only affect objects created by this invocation.
        if database_connection is not None and user_created:
            try:
                database_connection.cursor().execute(DROP_USER_SQL, runtime_user)
            except Exception:
                pass
        if login_created:
            try:
                master_connection.cursor().execute(DROP_LOGIN_SQL, runtime_user)
            except Exception:
                pass
        raise
    finally:
        if database_connection is not None:
            database_connection.close()
        master_connection.close()

    print(f"[OK] provisioned least-privilege runtime identity for {database_name}")
    print("[OK] DML permissions and sys.sp_getapplock verification passed")


def print_offline_plan() -> None:
    print("[DRY-RUN] no database connection was opened and no SQL was executed")
    print("[PLAN] require exact --confirm-database matching DB_NAME")
    print("[PLAN] reject any existing server login or database user")
    print("[PLAN] read the runtime password only from RUNTIME_DB_PASSWORD")
    print("[PLAN] grant SELECT/INSERT/UPDATE/DELETE on schema dbo via mini_app_runtime")
    print("[PLAN] verify no ALTER/CONTROL/VIEW DEFINITION and test sys.sp_getapplock")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Provision the Backend runtime SQL Server identity"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="execute provisioning; default is an offline dry-run",
    )
    parser.add_argument(
        "--confirm-database",
        default="",
        help="required with --apply and must exactly match DB_NAME",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.apply:
        if args.confirm_database:
            raise ProvisioningError("--confirm-database is only valid with --apply")
        print_offline_plan()
        return 0
    if not args.confirm_database:
        raise ProvisioningError("--apply requires --confirm-database")
    apply_provisioning(args.confirm_database)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ProvisioningError as exc:
        raise SystemExit(f"[BLOCKED] {exc}") from None
    except Exception as exc:
        # Do not echo pyodbc/config exception messages: some drivers include
        # connection details.  The exception class is enough for operator
        # triage without risking a credential leak.
        raise SystemExit(
            f"[ERROR] runtime database provisioning failed ({type(exc).__name__})"
        ) from None
