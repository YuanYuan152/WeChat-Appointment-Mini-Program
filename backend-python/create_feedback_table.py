"""创建 AppFeedback 意见反馈表。"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

ddl = """
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppFeedback]') AND type = 'U')
BEGIN
CREATE TABLE [dbo].[AppFeedback](
    [Id]        BIGINT IDENTITY(1,1) NOT NULL,
    [AccountId] INT NOT NULL,
    [Category]  NVARCHAR(50) NULL,
    [Content]   NVARCHAR(MAX) NOT NULL,
    [Contact]   NVARCHAR(50) NULL,
    [Status]    NVARCHAR(20) NOT NULL DEFAULT 'OPEN',
    [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
    CONSTRAINT [PK_AppFeedback] PRIMARY KEY CLUSTERED ([Id] ASC)
)
END
"""

cur.execute(ddl)
conn.commit()
print("AppFeedback table created")
conn.close()
