"""创建助理患者联系记录表。"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

cur.execute(
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppContactRecord]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppContactRecord](
        [Id] INT IDENTITY(1,1) NOT NULL,
        [AssistantId] INT NOT NULL,
        [PatientId] INT NOT NULL,
        [ContactMethod] NVARCHAR(50) NOT NULL DEFAULT 'PHONE',
        [Content] NVARCHAR(MAX) NULL,
        [NextFollowAt] DATETIME NULL,
        [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt] DATETIME NULL,
        CONSTRAINT [PK_AppContactRecord] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """
)

conn.commit()
conn.close()
print("Contact record tables created successfully")
