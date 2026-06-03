"""创建咨询助理工作台所需数据库表"""
import pyodbc

conn_str = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

ddl_list = [
    # 待处理任务表
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppTask]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppTask](
        [Id]          INT IDENTITY(1,1) NOT NULL,
        [AssistantId] INT NOT NULL,            -- AppAccount.Id (助理)
        [Type]        NVARCHAR(50) NOT NULL,   -- FOLLOW_UP / RISK_ALERT / SCHEDULE / OTHER
        [Title]       NVARCHAR(200) NOT NULL,
        [Content]     NVARCHAR(MAX) NULL,
        [RelatedId]   INT NULL,                -- 关联 ConsultationId / OrderId 等
        [Priority]    NVARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- HIGH / NORMAL / LOW
        [Status]      NVARCHAR(20) NOT NULL DEFAULT 'OPEN',   -- OPEN / IN_PROGRESS / DONE
        [DueAt]       DATETIME NULL,
        [CreatedAt]   DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]   DATETIME NULL,
        CONSTRAINT [PK_AppTask] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    # 风险提醒表
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppRiskAlert]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppRiskAlert](
        [Id]             INT IDENTITY(1,1) NOT NULL,
        [PatientId]      INT NOT NULL,
        [AssistantId]    INT NOT NULL,
        [Level]          NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW / MEDIUM / HIGH / CRITICAL
        [Description]    NVARCHAR(MAX) NULL,
        [Status]         NVARCHAR(20) NOT NULL DEFAULT 'OPEN',   -- OPEN / HANDLED
        [HandledAt]      DATETIME NULL,
        [HandlerNote]    NVARCHAR(500) NULL,
        [CreatedAt]      DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]      DATETIME NULL,
        CONSTRAINT [PK_AppRiskAlert] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
]

for ddl in ddl_list:
    cursor.execute(ddl)

conn.commit()
print("Assistant tables created successfully")
conn.close()
