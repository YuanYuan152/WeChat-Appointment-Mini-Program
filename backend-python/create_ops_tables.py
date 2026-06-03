"""创建运营轻后台所需数据库表"""
import pyodbc

conn_str = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

ddl_list = [
    # Banner 表
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppBanner]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppBanner](
        [Id]        INT IDENTITY(1,1) NOT NULL,
        [Title]     NVARCHAR(200) NOT NULL,
        [ImageUrl]  NVARCHAR(500) NOT NULL,
        [LinkType]  NVARCHAR(50) NOT NULL DEFAULT 'PAGE',   -- PAGE / URL / NONE
        [LinkValue] NVARCHAR(500) NULL,                     -- 页面路径或外链
        [SortOrder] INT NOT NULL DEFAULT 0,
        [IsActive]  BIT NOT NULL DEFAULT 1,
        [StartAt]   DATETIME NULL,
        [EndAt]     DATETIME NULL,
        [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt] DATETIME NULL,
        CONSTRAINT [PK_AppBanner] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    # 活动/公告表
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppActivity]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppActivity](
        [Id]          INT IDENTITY(1,1) NOT NULL,
        [Type]        NVARCHAR(50) NOT NULL DEFAULT 'NOTICE',  -- NOTICE / PROMOTION / EVENT
        [Title]       NVARCHAR(200) NOT NULL,
        [Content]     NVARCHAR(MAX) NULL,
        [CoverUrl]    NVARCHAR(500) NULL,
        [IsActive]    BIT NOT NULL DEFAULT 1,
        [StartAt]     DATETIME NULL,
        [EndAt]       DATETIME NULL,
        [SortOrder]   INT NOT NULL DEFAULT 0,
        [CreatedAt]   DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]   DATETIME NULL,
        CONSTRAINT [PK_AppActivity] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
]

for ddl in ddl_list:
    cursor.execute(ddl)

conn.commit()
print("Ops tables created successfully")
conn.close()
