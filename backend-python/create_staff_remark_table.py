"""创建工作人员内部备注表"""
import pyodbc

conn_str = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

ddl = """
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppStaffAccountRemark]') AND type = 'U')
BEGIN
CREATE TABLE [dbo].[AppStaffAccountRemark](
    [Id]                 INT IDENTITY(1,1) NOT NULL,
    [AccountId]          INT NOT NULL,
    [Remark]             NVARCHAR(MAX) NULL,
    [UpdatedByAccountId] INT NULL,
    [CreatedAt]          DATETIME NOT NULL DEFAULT (getdate()),
    [UpdatedAt]          DATETIME NULL,
    CONSTRAINT [PK_AppStaffAccountRemark] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_AppStaffAccountRemark_Account] UNIQUE ([AccountId])
)
CREATE INDEX [IX_AppStaffAccountRemark_AccountId] ON [dbo].[AppStaffAccountRemark]([AccountId])
END
"""

cursor.execute(ddl)
conn.commit()
print("AppStaffAccountRemark table created successfully")
conn.close()
