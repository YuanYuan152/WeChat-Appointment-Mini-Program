/*
EAP 量表报告、分享扫码与审计表。

本脚本仅创建不存在的表和普通索引，不修改 AppPsychScaleResult 或其他现有业务表。
执行前请使用 migrate_assessment_tables.py --preflight，并通过 --confirm-database
显式确认目标数据库。
*/

SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentReport]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AppAssessmentReport]
    (
        [Id] BIGINT IDENTITY(1, 1) NOT NULL,
        [PublicId] VARCHAR(40) NOT NULL,
        [AccountId] INT NOT NULL,
        [ClientSubmissionId] VARCHAR(64) NOT NULL,
        [AssessmentId] VARCHAR(80) NOT NULL,
        [AssessmentVersion] INT NOT NULL,
        [Category] VARCHAR(20) NOT NULL,
        [AssessmentTitle] NVARCHAR(120) NOT NULL,
        [ScoringType] VARCHAR(20) NOT NULL,
        [EntrySource] VARCHAR(20) NOT NULL,
        [ShareCode] VARCHAR(120) NULL,
        [ConsentVersion] VARCHAR(50) NOT NULL,
        [ConsentAcceptedAt] DATETIME2(0) NOT NULL,
        [DemographicAnswers] NVARCHAR(MAX) NULL,
        [Answers] NVARCHAR(MAX) NULL,
        [ResultJson] NVARCHAR(MAX) NULL,
        [ResultSummary] NVARCHAR(MAX) NULL,
        [ReportSnapshot] NVARCHAR(MAX) NULL,
        [SnapshotSha256] CHAR(64) NULL,
        [CompletedAt] DATETIME2(0) NOT NULL,
        [DeletedAt] DATETIME2(0) NULL,
        [CreatedAt] DATETIME2(0) NOT NULL
            CONSTRAINT [DF_AppAssessmentReport_CreatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_AppAssessmentReport] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [UQ_AppAssessmentReport_PublicId] UNIQUE ([PublicId]),
        CONSTRAINT [UQ_AppAssessmentReport_Account_Submission]
            UNIQUE ([AccountId], [ClientSubmissionId]),
        CONSTRAINT [CK_AppAssessmentReport_Category]
            CHECK ([Category] IN ('professional', 'fun')),
        CONSTRAINT [CK_AppAssessmentReport_EntrySource]
            CHECK ([EntrySource] IN ('web', 'mini-webview', 'qr', 'direct')),
        CONSTRAINT [CK_AppAssessmentReport_AssessmentVersion]
            CHECK ([AssessmentVersion] >= 1)
    );
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentReport]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentReport]')
         AND [name] = N'IX_AppAssessmentReport_Account_Completed'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentReport_Account_Completed]
        ON [dbo].[AppAssessmentReport] ([AccountId], [DeletedAt], [CompletedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentReport]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentReport]')
         AND [name] = N'IX_AppAssessmentReport_Assessment_Completed'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentReport_Assessment_Completed]
        ON [dbo].[AppAssessmentReport]
            ([AssessmentId], [AssessmentVersion], [DeletedAt], [CompletedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentReport]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentReport]')
         AND [name] = N'IX_AppAssessmentReport_Share_Completed'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentReport_Share_Completed]
        ON [dbo].[AppAssessmentReport] ([ShareCode], [CompletedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentShareScan]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AppAssessmentShareScan]
    (
        [Id] BIGINT IDENTITY(1, 1) NOT NULL,
        [ShareCode] VARCHAR(120) NOT NULL,
        [AssessmentId] VARCHAR(80) NOT NULL,
        [VisitorHash] CHAR(64) NOT NULL,
        [ScannedAt] DATETIME2(0) NOT NULL
            CONSTRAINT [DF_AppAssessmentShareScan_ScannedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_AppAssessmentShareScan] PRIMARY KEY CLUSTERED ([Id])
    );
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentShareScan]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentShareScan]')
         AND [name] = N'IX_AppAssessmentShareScan_Share_Time'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentShareScan_Share_Time]
        ON [dbo].[AppAssessmentShareScan] ([ShareCode], [ScannedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentShareScan]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentShareScan]')
         AND [name] = N'IX_AppAssessmentShareScan_Assessment_Time'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentShareScan_Assessment_Time]
        ON [dbo].[AppAssessmentShareScan] ([AssessmentId], [ScannedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentShareScan]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentShareScan]')
         AND [name] = N'IX_AppAssessmentShareScan_Visitor_Time'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentShareScan_Visitor_Time]
        ON [dbo].[AppAssessmentShareScan] ([VisitorHash], [ScannedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentAuditLog]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AppAssessmentAuditLog]
    (
        [Id] BIGINT IDENTITY(1, 1) NOT NULL,
        [RequestId] VARCHAR(64) NULL,
        [ActorAccountId] INT NULL,
        [ActorRole] VARCHAR(20) NULL,
        [Action] VARCHAR(50) NOT NULL,
        [TargetType] VARCHAR(30) NOT NULL,
        [TargetPublicId] VARCHAR(40) NULL,
        [AssessmentId] VARCHAR(80) NULL,
        [AssessmentVersion] INT NULL,
        [Outcome] VARCHAR(20) NOT NULL,
        [MetadataJson] NVARCHAR(2000) NULL,
        [CreatedAt] DATETIME2(0) NOT NULL
            CONSTRAINT [DF_AppAssessmentAuditLog_CreatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_AppAssessmentAuditLog] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [CK_AppAssessmentAuditLog_TargetType]
            CHECK ([TargetType] IN ('REPORT', 'ASSESSMENT')),
        CONSTRAINT [CK_AppAssessmentAuditLog_Outcome]
            CHECK ([Outcome] IN ('PENDING', 'SUCCEEDED', 'FAILED')),
        CONSTRAINT [CK_AppAssessmentAuditLog_AssessmentVersion]
            CHECK ([AssessmentVersion] IS NULL OR [AssessmentVersion] >= 1)
    );
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentAuditLog]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentAuditLog]')
         AND [name] = N'IX_AppAssessmentAuditLog_Actor_Time'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentAuditLog_Actor_Time]
        ON [dbo].[AppAssessmentAuditLog] ([ActorAccountId], [CreatedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentAuditLog]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentAuditLog]')
         AND [name] = N'IX_AppAssessmentAuditLog_Target_Time'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentAuditLog_Target_Time]
        ON [dbo].[AppAssessmentAuditLog] ([TargetType], [TargetPublicId], [CreatedAt]);
END;
GO

IF OBJECT_ID(N'[dbo].[AppAssessmentAuditLog]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[indexes]
       WHERE [object_id] = OBJECT_ID(N'[dbo].[AppAssessmentAuditLog]')
         AND [name] = N'IX_AppAssessmentAuditLog_Assessment_Time'
   )
BEGIN
    CREATE INDEX [IX_AppAssessmentAuditLog_Assessment_Time]
        ON [dbo].[AppAssessmentAuditLog] ([AssessmentId], [CreatedAt]);
END;
GO
