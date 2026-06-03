"""创建咨询师工作台所需数据库表"""
import pyodbc

conn_str = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

ddl_list = [
    # 排班表
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppSchedule]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppSchedule](
        [Id]          INT IDENTITY(1,1) NOT NULL,
        [CounselorId] INT NOT NULL,           -- AppAccount.Id
        [StartTime]   DATETIME NOT NULL,
        [EndTime]     DATETIME NOT NULL,
        [Status]      NVARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE / BOOKED / CANCELLED
        [Note]        NVARCHAR(200) NULL,
        [CreatedAt]   DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]   DATETIME NULL,
        CONSTRAINT [PK_AppSchedule] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    # 咨询单（与订单分离，记录每次咨询的业务状态）
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppConsultation]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppConsultation](
        [Id]           INT IDENTITY(1,1) NOT NULL,
        [OrderId]      INT NULL,              -- AppOrder.Id
        [PatientId]    INT NOT NULL,          -- AppAccount.Id
        [CounselorId]  INT NOT NULL,
        [ScheduleId]   INT NULL,
        [Status]       NVARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING/CONFIRMED/ONGOING/DONE/CANCELLED
        [StartTime]    DATETIME NULL,
        [EndTime]      DATETIME NULL,
        [Note]         NVARCHAR(500) NULL,
        [CreatedAt]    DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]    DATETIME NULL,
        CONSTRAINT [PK_AppConsultation] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    # 个案记录（SOAP 格式）
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppCaseRecord]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppCaseRecord](
        [Id]              INT IDENTITY(1,1) NOT NULL,
        [ConsultationId]  INT NOT NULL,
        [CounselorId]     INT NOT NULL,
        [Subjective]      NVARCHAR(MAX) NULL,  -- S: 主观（来访者陈述）
        [Objective]       NVARCHAR(MAX) NULL,  -- O: 客观（观察/评估）
        [Assessment]      NVARCHAR(MAX) NULL,  -- A: 评估（诊断印象）
        [Plan]            NVARCHAR(MAX) NULL,  -- P: 计划（下次方向）
        [CreatedAt]       DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]       DATETIME NULL,
        CONSTRAINT [PK_AppCaseRecord] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
]

for ddl in ddl_list:
    cursor.execute(ddl)

conn.commit()
print("Counselor tables created successfully")
conn.close()
