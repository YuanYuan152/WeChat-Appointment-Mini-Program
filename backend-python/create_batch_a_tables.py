"""
Batch A 数据库建表
- AppRoleSwitchLog：角色切换日志
- AppArticle：小程序自助发布的文章/内容（与旧 T_Content 双源合并）
"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

ddl_list = [
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppRoleSwitchLog]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppRoleSwitchLog](
        [Id]         BIGINT IDENTITY(1,1) NOT NULL,
        [AccountId]  INT NOT NULL,
        [FromRole]   NVARCHAR(20) NULL,
        [ToRole]     NVARCHAR(20) NOT NULL,
        [SwitchedAt] DATETIME NOT NULL DEFAULT (getdate()),
        [Ip]         NVARCHAR(50) NULL,
        [UserAgent]  NVARCHAR(200) NULL,
        CONSTRAINT [PK_AppRoleSwitchLog] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppArticle]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppArticle](
        [Id]         INT IDENTITY(1,1) NOT NULL,
        [Title]      NVARCHAR(200) NOT NULL,
        [Category]   NVARCHAR(50) NULL,        -- 文章 / 知识 / 公告
        [Summary]    NVARCHAR(500) NULL,
        [Content]    NVARCHAR(MAX) NULL,
        [CoverUrl]   NVARCHAR(500) NULL,
        [Author]     NVARCHAR(100) NULL,
        [Source]     NVARCHAR(100) NULL,
        [IsTop]      BIT NOT NULL DEFAULT 0,
        [IsActive]   BIT NOT NULL DEFAULT 1,
        [Views]      INT NOT NULL DEFAULT 0,
        [SortOrder]  INT NOT NULL DEFAULT 0,
        [PublishedAt] DATETIME NULL,
        [CreatedAt]  DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt]  DATETIME NULL,
        CONSTRAINT [PK_AppArticle] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """,
]

for ddl in ddl_list:
    cur.execute(ddl)
conn.commit()
print("Batch A tables created")
conn.close()
