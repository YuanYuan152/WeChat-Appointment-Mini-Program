"""创建患者资料与完整版登记表。"""
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
)
cur = conn.cursor()

cur.execute(
    """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppRegistrationForm]') AND type = 'U')
    BEGIN
    CREATE TABLE [dbo].[AppRegistrationForm](
        [Id] BIGINT IDENTITY(1,1) NOT NULL,
        [AccountId] INT NOT NULL,

        -- 基础信息
        [RealName] NVARCHAR(50) NULL,
        [Gender] NVARCHAR(10) NULL,
        [Birthday] DATETIME NULL,
        [Occupation] NVARCHAR(100) NULL,
        [Education] NVARCHAR(100) NULL,
        [MaritalStatus] NVARCHAR(50) NULL,
        [Phone] NVARCHAR(20) NULL,
        [EmergencyContact] NVARCHAR(100) NULL,
        [EmergencyPhone] NVARCHAR(20) NULL,
        [ChiefComplaint] NVARCHAR(MAX) NULL,

        -- PHQ-9
        [Phq1] INT NULL, [Phq2] INT NULL, [Phq3] INT NULL,
        [Phq4] INT NULL, [Phq5] INT NULL, [Phq6] INT NULL,
        [Phq7] INT NULL, [Phq8] INT NULL, [Phq9] INT NULL,
        [PhqTotal] INT NULL,

        -- GAD-7
        [Gad1] INT NULL, [Gad2] INT NULL, [Gad3] INT NULL,
        [Gad4] INT NULL, [Gad5] INT NULL, [Gad6] INT NULL,
        [Gad7] INT NULL, [GadTotal] INT NULL,

        -- 完整版补充
        [PastDiagnosis] NVARCHAR(MAX) NULL,
        [TreatmentHistory] NVARCHAR(MAX) NULL,
        [MedicationHistory] NVARCHAR(MAX) NULL,
        [FamilyMentalHistory] NVARCHAR(MAX) NULL,
        [FamilyRelationship] NVARCHAR(MAX) NULL,
        [SleepStatus] NVARCHAR(200) NULL,
        [AppetiteStatus] NVARCHAR(200) NULL,
        [SubstanceUse] NVARCHAR(MAX) NULL,
        [SelfHarmRisk] NVARCHAR(MAX) NULL,
        [ConsultationGoal] NVARCHAR(MAX) NULL,

        [CreatedAt] DATETIME NOT NULL DEFAULT (getdate()),
        [UpdatedAt] DATETIME NULL,
        CONSTRAINT [PK_AppRegistrationForm] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
    END
    """
)

conn.commit()
conn.close()
print("Patient tables created successfully")
