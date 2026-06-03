"""创建咨询师个人资料表。"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

cur.execute(
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppCounselorProfile]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppCounselorProfile](
        [Id] INT IDENTITY(1,1) NOT NULL,
        [AccountId] INT NOT NULL,
        [Name] NVARCHAR(100) NULL,
        [AvatarUrl] NVARCHAR(500) NULL,
        [Title] NVARCHAR(100) NULL,
        [Specialty] NVARCHAR(MAX) NULL,
        [Field] NVARCHAR(200) NULL,
        [Introduce] NVARCHAR(MAX) NULL,
        [Career] NVARCHAR(MAX) NULL,
        [Qualification] NVARCHAR(MAX) NULL,
        [Billing] INT NOT NULL DEFAULT 0,
        [ConsultHours] INT NOT NULL DEFAULT 0,
        [WorkYears] INT NOT NULL DEFAULT 0,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt] DATETIME NULL,
        CONSTRAINT [PK_AppCounselorProfile] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """
)

conn.commit()
conn.close()
print("Counselor profile tables created successfully")
