-- 阶段一：旧数据迁移到新账号体系脚本
-- 注意：在运行此脚本前，请确保已经运行了 01_Create_MiniProgram_Tables.sql 创建了新表

BEGIN TRANSACTION;

-- 1. 迁移患者数据 (T_User -> AppAccount & AppRoleBinding)
INSERT INTO [dbo].[AppAccount] ([UnionId], [OpenId], [Mobile], [Nickname], [AvatarUrl], [CreatedAt], [UpdatedAt])
SELECT 
    [unionid], 
    [OpenID], 
    [Tel], 
    [nickname], 
    [TopUrl], 
    ISNULL([CreateTime], GETDATE()), 
    [ModifyTime]
FROM [dbo].[T_User]
WHERE [IsDelete] = 0;

-- 绑定患者角色
INSERT INTO [dbo].[AppRoleBinding] ([AccountId], [RoleType], [TargetId], [CreatedAt])
SELECT 
    a.[Id], 
    'Patient', 
    u.[ID], 
    GETDATE()
FROM [dbo].[T_User] u
JOIN [dbo].[AppAccount] a ON (u.[OpenID] = a.[OpenId] OR u.[Tel] = a.[Mobile])
WHERE u.[IsDelete] = 0 AND a.[Id] NOT IN (
    SELECT [AccountId] FROM [dbo].[AppRoleBinding] WHERE [RoleType] = 'Patient'
);

-- 2. 迁移咨询师数据 (T_Doctor -> AppAccount & AppRoleBinding)
-- 注意：如果手机号或OpenId已存在，则不重复创建账号，而是直接绑定角色
INSERT INTO [dbo].[AppAccount] ([OpenId], [Mobile], [Nickname], [AvatarUrl], [CreatedAt])
SELECT 
    d.[openid], 
    d.[tel], 
    d.[name], 
    d.[topUrl], 
    ISNULL(d.[CreateTime], GETDATE())
FROM [dbo].[T_Doctor] d
WHERE d.[isDelete] = 0 
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[AppAccount] a 
      WHERE (a.[Mobile] = d.[tel] AND d.[tel] IS NOT NULL AND d.[tel] <> '') 
         OR (a.[OpenId] = d.[openid] AND d.[openid] IS NOT NULL AND d.[openid] <> '')
  );

-- 绑定咨询师角色
INSERT INTO [dbo].[AppRoleBinding] ([AccountId], [RoleType], [TargetId], [CreatedAt])
SELECT 
    a.[Id], 
    'Counselor', 
    d.[ID], 
    GETDATE()
FROM [dbo].[T_Doctor] d
JOIN [dbo].[AppAccount] a ON (d.[openid] = a.[OpenId] OR d.[tel] = a.[Mobile])
WHERE d.[isDelete] = 0 AND a.[Id] NOT IN (
    SELECT [AccountId] FROM [dbo].[AppRoleBinding] WHERE [RoleType] = 'Counselor' AND [TargetId] = d.[ID]
);

-- 3. 迁移管理员数据 (T_Admin -> AppAccount & AppRoleBinding)
INSERT INTO [dbo].[AppAccount] ([Mobile], [Nickname], [CreatedAt])
SELECT 
    ad.[Tel], 
    ad.[Name], 
    ISNULL(ad.[CreateTime], GETDATE())
FROM [dbo].[T_Admin] ad
WHERE ad.[IsDelete] = 0
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[AppAccount] a 
      WHERE (a.[Mobile] = ad.[Tel] AND ad.[Tel] IS NOT NULL AND ad.[Tel] <> '')
  );

-- 绑定管理员角色
INSERT INTO [dbo].[AppRoleBinding] ([AccountId], [RoleType], [TargetId], [CreatedAt])
SELECT 
    a.[Id], 
    'Admin', 
    ad.[ID], 
    GETDATE()
FROM [dbo].[T_Admin] ad
JOIN [dbo].[AppAccount] a ON (ad.[Tel] = a.[Mobile])
WHERE ad.[IsDelete] = 0 AND a.[Id] NOT IN (
    SELECT [AccountId] FROM [dbo].[AppRoleBinding] WHERE [RoleType] = 'Admin' AND [TargetId] = ad.[ID]
);

COMMIT TRANSACTION;
GO
