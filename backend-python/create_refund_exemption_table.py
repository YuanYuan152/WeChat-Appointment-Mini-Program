"""创建退款豁免申请表 AppRefundExemption（如不存在）。"""
import pyodbc

conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;"
    "DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

sql = """
IF NOT EXISTS (
    SELECT * FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[AppRefundExemption]') AND type = 'U'
)
BEGIN
CREATE TABLE [dbo].[AppRefundExemption](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [ConsultationId] [int] NOT NULL,
    [AccountId] [int] NOT NULL,
    [Amount] [int] NOT NULL,
    [Reason] [nvarchar](max) NOT NULL,
    [ScreenshotUrl] [nvarchar](500) NULL,
    [Status] [nvarchar](20) NOT NULL DEFAULT 'PENDING',
    [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
    [UpdatedAt] [datetime] NULL,
    CONSTRAINT [PK_AppRefundExemption] PRIMARY KEY CLUSTERED ([Id] ASC)
)
END
"""
cursor.execute(sql)
conn.commit()
print("AppRefundExemption table ready")
conn.close()
