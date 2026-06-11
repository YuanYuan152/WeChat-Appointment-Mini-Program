"""创建请假申请表 AppLeaveRequest（如不存在）。"""
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
    WHERE object_id = OBJECT_ID(N'[dbo].[AppLeaveRequest]') AND type = 'U'
)
BEGIN
CREATE TABLE [dbo].[AppLeaveRequest](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [ScheduleId] [int] NOT NULL,
    [CounselorId] [int] NOT NULL,
    [Reason] [nvarchar](max) NOT NULL,
    [Status] [nvarchar](20) NOT NULL DEFAULT 'PENDING',
    [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
    [UpdatedAt] [datetime] NULL,
    CONSTRAINT [PK_AppLeaveRequest] PRIMARY KEY CLUSTERED ([Id] ASC)
)
END
"""
)
conn.commit()
print("AppLeaveRequest table ready")
conn.close()
