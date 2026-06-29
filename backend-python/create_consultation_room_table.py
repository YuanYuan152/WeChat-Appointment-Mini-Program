"""创建 AppConsultationRoom 表并写入默认咨询室。"""
import pyodbc

from config import settings
from schedule_meta import CONSULTATION_ROOMS


def _conn_str() -> str:
    server = settings.DB_SERVER
    if not settings.DB_TRUSTED_CONNECTION and settings.DB_PORT:
        server = f"{settings.DB_SERVER},{settings.DB_PORT}"
    conn = (
        f"DRIVER={{{settings.DB_DRIVER}}};"
        f"SERVER={server};"
        f"DATABASE={settings.DB_NAME};"
    )
    if settings.DB_TRUSTED_CONNECTION:
        conn += "Trusted_Connection=yes;"
    else:
        conn += f"UID={settings.DB_USER};PWD={settings.DB_PASSWORD};"
    if settings.DB_TRUST_SERVER_CERTIFICATE:
        conn += "TrustServerCertificate=yes;"
    return conn


conn = pyodbc.connect(_conn_str())
cur = conn.cursor()

ddl = """
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppConsultationRoom]') AND type = 'U')
BEGIN
CREATE TABLE [dbo].[AppConsultationRoom](
    [Id]        INT IDENTITY(1,1) NOT NULL,
    [CenterId]  NVARCHAR(50) NOT NULL,
    [RoomCode]  NVARCHAR(50) NOT NULL,
    [Name]      NVARCHAR(100) NOT NULL,
    [Status]    NVARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    [SortOrder] INT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
    [UpdatedAt] DATETIME NULL,
    CONSTRAINT [PK_AppConsultationRoom] PRIMARY KEY CLUSTERED ([Id] ASC)
)
END
"""

cur.execute(ddl)
conn.commit()

sort = 0
for center_id, rooms in CONSULTATION_ROOMS.items():
    for room in rooms:
        cur.execute(
            "SELECT COUNT(1) FROM AppConsultationRoom WHERE CenterId=? AND RoomCode=?",
            center_id,
            room["id"],
        )
        if cur.fetchone()[0] == 0:
            cur.execute(
                """
                INSERT INTO AppConsultationRoom
                    (CenterId, RoomCode, Name, Status, SortOrder, CreatedAt)
                VALUES (?, ?, ?, 'AVAILABLE', ?, GETDATE())
                """,
                center_id,
                room["id"],
                room["name"],
                sort,
            )
            sort += 1

conn.commit()
print("AppConsultationRoom table ready, default rooms seeded")
conn.close()
