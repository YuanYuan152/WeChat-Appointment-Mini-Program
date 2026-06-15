"""创建 AppConsultationRoomSlot 表（咨询室单时段状态）。"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

ddl = """
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppConsultationRoomSlot]') AND type = 'U')
BEGIN
CREATE TABLE [dbo].[AppConsultationRoomSlot](
    [Id]        INT IDENTITY(1,1) NOT NULL,
    [RoomId]    INT NOT NULL,
    [StartTime] DATETIME NOT NULL,
    [Status]    NVARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
    [UpdatedAt] DATETIME NULL,
    CONSTRAINT [PK_AppConsultationRoomSlot] PRIMARY KEY CLUSTERED ([Id] ASC)
)
CREATE UNIQUE INDEX [UX_AppConsultationRoomSlot_Room_Start]
    ON [dbo].[AppConsultationRoomSlot]([RoomId], [StartTime])
END
"""

cur.execute(ddl)
conn.commit()
print("AppConsultationRoomSlot table ready")
conn.close()
