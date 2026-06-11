"""创建 AppConsultationRoom 表并写入默认咨询室。"""
import pyodbc

from schedule_meta import CONSULTATION_ROOMS

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
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
                INSERT INTO AppConsultationRoom (CenterId, RoomCode, Name, Status, SortOrder)
                VALUES (?, ?, ?, 'AVAILABLE', ?)
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
