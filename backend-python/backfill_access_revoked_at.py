"""回填 AccessRevokedAt：将上线该字段前已删除的用户写入删除时间。"""
from sqlalchemy import text

from database import engine

SQL = """
UPDATE a
SET a.AccessRevokedAt = l.SwitchedAt,
    a.UpdatedAt = COALESCE(a.UpdatedAt, l.SwitchedAt)
FROM AppAccount a
INNER JOIN (
    SELECT AccountId, MAX(SwitchedAt) AS SwitchedAt
    FROM AppRoleSwitchLog
    WHERE ToRole = 'REVOKED'
    GROUP BY AccountId
) l ON l.AccountId = a.Id
WHERE a.IsActive = 1
  AND a.AccessRevokedAt IS NULL
"""

with engine.begin() as conn:
    result = conn.execute(text(SQL))
    print(f"backfilled AccessRevokedAt rows: {result.rowcount}")
