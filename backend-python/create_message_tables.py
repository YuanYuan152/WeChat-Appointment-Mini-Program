"""创建消息通知体系所需数据库表。"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

ddl_list = [
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppMessage]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppMessage](
        [Id]          BIGINT IDENTITY(1,1) NOT NULL,
        [AccountId]   INT NOT NULL,
        [Type]        NVARCHAR(50) NOT NULL,   -- ORDER / PAYMENT / CONSULTATION / SYSTEM / RISK
        [Title]       NVARCHAR(200) NOT NULL,
        [Content]     NVARCHAR(MAX) NULL,
        [RelatedType] NVARCHAR(50) NULL,
        [RelatedId]   INT NULL,
        [IsRead]      BIT NOT NULL DEFAULT 0,
        [CreatedAt]   DATETIME NOT NULL DEFAULT (getdate()),
        [ReadAt]      DATETIME NULL,
        CONSTRAINT [PK_AppMessage] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppSubscribeTemplate]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppSubscribeTemplate](
        [Id]          INT IDENTITY(1,1) NOT NULL,
        [EventKey]    NVARCHAR(80) NOT NULL,  -- booking_success / payment_success / consultation_remind 等
        [TemplateId]  NVARCHAR(120) NOT NULL,
        [Description] NVARCHAR(200) NULL,
        [IsActive]    BIT NOT NULL DEFAULT 1,
        [CreatedAt]   DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]   DATETIME NULL,
        CONSTRAINT [PK_AppSubscribeTemplate] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppMessageLog]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppMessageLog](
        [Id]          BIGINT IDENTITY(1,1) NOT NULL,
        [AccountId]   INT NOT NULL,
        [EventKey]    NVARCHAR(80) NOT NULL,
        [TemplateId]  NVARCHAR(120) NULL,
        [Payload]     NVARCHAR(MAX) NULL,
        [Status]      NVARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / SENT / FAILED / MOCK
        [ErrorMessage] NVARCHAR(500) NULL,
        [CreatedAt]   DATETIME NOT NULL DEFAULT (getdate()),
        [SentAt]      DATETIME NULL,
        CONSTRAINT [PK_AppMessageLog] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppRemindTask]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppRemindTask](
        [Id]          BIGINT IDENTITY(1,1) NOT NULL,
        [AccountId]   INT NOT NULL,
        [EventKey]    NVARCHAR(80) NOT NULL,
        [Title]       NVARCHAR(200) NOT NULL,
        [Content]     NVARCHAR(MAX) NULL,
        [RelatedType] NVARCHAR(50) NULL,
        [RelatedId]   INT NULL,
        [ScheduledAt] DATETIME NOT NULL,
        [Status]      NVARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / DONE / CANCELLED / FAILED
        [CreatedAt]   DATETIME NOT NULL DEFAULT (getdate()),
        [ProcessedAt] DATETIME NULL,
        [ErrorMessage] NVARCHAR(500) NULL,
        CONSTRAINT [PK_AppRemindTask] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
]

for ddl in ddl_list:
    cur.execute(ddl)

conn.commit()
conn.close()
print("Message tables created successfully")
