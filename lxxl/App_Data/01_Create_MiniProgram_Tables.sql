-- 阶段一：创建小程序统一账号与认证相关表

-- 1. 统一账号表 (AppAccount)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppAccount]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[AppAccount](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UnionId] [nvarchar](100) NULL,
	[OpenId] [nvarchar](100) NULL,
	[Mobile] [nvarchar](20) NULL,
	[Nickname] [nvarchar](100) NULL,
	[AvatarUrl] [nvarchar](500) NULL,
	[CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
	[UpdatedAt] [datetime] NULL,
 CONSTRAINT [PK_AppAccount] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)
)
END
GO

-- 2. 角色绑定表 (AppRoleBinding)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppRoleBinding]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[AppRoleBinding](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NOT NULL,
	[RoleType] [nvarchar](50) NOT NULL, -- 'Patient', 'Counselor', 'Assistant', 'Admin'
	[TargetId] [int] NULL, -- 关联到 T_User.ID, T_Doctor.ID, T_Admin.ID
	[CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
 CONSTRAINT [PK_AppRoleBinding] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)
)
END
GO

-- 3. 登录会话表 (AppLoginSession)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppLoginSession]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[AppLoginSession](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NOT NULL,
	[Token] [nvarchar](500) NOT NULL,
	[SessionKey] [nvarchar](100) NULL,
	[CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
	[ExpiresAt] [datetime] NOT NULL,
 CONSTRAINT [PK_AppLoginSession] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)
)
END
GO