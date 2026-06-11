"""创建咨询师取消挂课沟通截图表 AppScheduleCancelLog（如不存在）。"""
import pyodbc

conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;"
    "DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()
cursor.execute(
    """
IF NOT EXISTS (
    SELECT * FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[AppScheduleCancelLog]') AND type = 'U'
)
BEGIN
CREATE TABLE [dbo].[AppScheduleCancelLog](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [ScheduleId] [int] NOT NULL,
    [CounselorId] [int] NOT NULL,
    [ConsultationId] [int] NULL,
    [ScreenshotUrl] [nvarchar](500) NOT NULL,
    [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
    CONSTRAINT [PK_AppScheduleCancelLog] PRIMARY KEY CLUSTERED ([Id] ASC)
)
END
"""
)
conn.commit()
print("AppScheduleCancelLog table ready")
conn.close()
