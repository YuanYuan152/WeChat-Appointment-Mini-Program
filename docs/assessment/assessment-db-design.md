# EAP 量表数据库变更设计 v1

状态：待审批，尚未修改模型、尚未执行 SQL。

## 1. 设计结论

本次拟新增三张独立表：

1. `AppAssessmentReport`：EAP 用户量表报告和不可变报告快照。
2. `AppAssessmentShareScan`：静态分享二维码扫码事件。
3. `AppAssessmentAuditLog`：报告访问、删除以及量表发布操作的审计记录。

不修改现有 `AppPsychScaleResult`，不迁移小程序 PHQ-9/GAD-7 数据，不建立量表定义表。
量表定义仍使用第 1 阶段的版本化 JSON 文件。

## 2. `AppAssessmentReport`

### 2.1 字段

| 字段 | SQL Server 类型 | 空值 | 用途 |
| --- | --- | --- | --- |
| `Id` | `BIGINT IDENTITY` | 否 | 内部主键，不对外返回 |
| `PublicId` | `VARCHAR(40)` | 否 | 不可枚举的对外报告 ID |
| `AccountId` | `INT` | 否 | EAP 当前登录的 `AppAccount.Id` |
| `ClientSubmissionId` | `VARCHAR(64)` | 否 | 客户端 UUID，防止重复提交 |
| `AssessmentId` | `VARCHAR(80)` | 否 | 量表稳定 ID |
| `AssessmentVersion` | `INT` | 否 | 用户开始答题时的发布版本 |
| `Category` | `VARCHAR(20)` | 否 | `professional` / `fun` |
| `AssessmentTitle` | `NVARCHAR(120)` | 否 | 管理列表使用，避免解析大 JSON |
| `ScoringType` | `VARCHAR(20)` | 否 | 提交时的计分类型 |
| `EntrySource` | `VARCHAR(20)` | 否 | `web` / `mini-webview` / `qr` / `direct` |
| `ShareCode` | `VARCHAR(120)` | 是 | 从分享二维码进入时的归因码 |
| `ConsentVersion` | `VARCHAR(50)` | 否 | 用户同意的隐私协议版本 |
| `ConsentAcceptedAt` | `DATETIME2(0)` | 否 | 同意时间，UTC |
| `DemographicAnswers` | `NVARCHAR(MAX)` | 是 | 人口学答案 JSON；用户删除后清空 |
| `Answers` | `NVARCHAR(MAX)` | 是 | 正式题答案 JSON；用户删除后清空 |
| `ResultJson` | `NVARCHAR(MAX)` | 是 | 服务端重新计分的结果 JSON |
| `ResultSummary` | `NVARCHAR(MAX)` | 是 | 列表摘要 |
| `ReportSnapshot` | `NVARCHAR(MAX)` | 是 | 量表、结果和报告文案的不可变快照 |
| `SnapshotSha256` | `CHAR(64)` | 是 | 快照完整性校验；删除后清空 |
| `CompletedAt` | `DATETIME2(0)` | 否 | 完成时间，UTC |
| `DeletedAt` | `DATETIME2(0)` | 是 | 用户删除时间，UTC |
| `CreatedAt` | `DATETIME2(0)` | 否 | 建档时间，默认 `SYSUTCDATETIME()` |

答案、结果和快照字段设为可空，是为了实现真正的内容删除：
删除后保留不含内容的 ID、量表版本和时间审计边界，不仅是前端隐藏。

### 2.2 约束和索引

- 唯一约束 `UQ_AppAssessmentReport_PublicId (PublicId)`。
- 唯一约束 `UQ_AppAssessmentReport_Account_Submission (AccountId, ClientSubmissionId)`。
- 索引 `IX_AppAssessmentReport_Account_Completed (AccountId, DeletedAt, CompletedAt)`。
- 索引 `IX_AppAssessmentReport_Assessment_Completed (AssessmentId, AssessmentVersion, DeletedAt, CompletedAt)`。
- 索引 `IX_AppAssessmentReport_Share_Completed (ShareCode, CompletedAt)`。
- `Category`、`EntrySource`、`AssessmentVersion` 由服务端和 `CHECK` 约束双重校验。

## 3. `AppAssessmentShareScan`

### 3.1 字段

| 字段 | SQL Server 类型 | 空值 | 用途 |
| --- | --- | --- | --- |
| `Id` | `BIGINT IDENTITY` | 否 | 主键 |
| `ShareCode` | `VARCHAR(120)` | 否 | 静态二维码归因码 |
| `AssessmentId` | `VARCHAR(80)` | 否 | 扫码时对应的量表 |
| `VisitorHash` | `CHAR(64)` | 否 | 匿名访客哈希，用于近似去重 |
| `ScannedAt` | `DATETIME2(0)` | 否 | 扫码时间，UTC |

不保存明文 IP、完整 User-Agent、手机号或微信标识。
`VisitorHash` 优先使用匿名 cookie 与服务端密钥 HMAC 生成；无 cookie 时才使用短周期请求指纹回退。

### 3.2 索引

- `IX_AppAssessmentShareScan_Share_Time (ShareCode, ScannedAt)`。
- `IX_AppAssessmentShareScan_Assessment_Time (AssessmentId, ScannedAt)`。
- `IX_AppAssessmentShareScan_Visitor_Time (VisitorHash, ScannedAt)`。

扫码总数使用事件行数，独立扫码数使用 `COUNT(DISTINCT VisitorHash)` 近似计算。
完成转化通过 `AppAssessmentReport.ShareCode` 联系，不在扫码表复制报告内容。

## 4. `AppAssessmentAuditLog`

### 4.1 字段

| 字段 | SQL Server 类型 | 空值 | 用途 |
| --- | --- | --- | --- |
| `Id` | `BIGINT IDENTITY` | 否 | 主键 |
| `RequestId` | `VARCHAR(64)` | 是 | 与请求日志关联 |
| `ActorAccountId` | `INT` | 是 | 操作者；匿名扫码不写此表 |
| `ActorRole` | `VARCHAR(20)` | 是 | 操作时角色快照 |
| `Action` | `VARCHAR(50)` | 否 | 如 `REPORT_VIEW`、`DEFINITION_PUBLISH` |
| `TargetType` | `VARCHAR(30)` | 否 | `REPORT` / `ASSESSMENT` |
| `TargetPublicId` | `VARCHAR(40)` | 是 | 报告对外 ID |
| `AssessmentId` | `VARCHAR(80)` | 是 | 量表 ID |
| `AssessmentVersion` | `INT` | 是 | 量表版本 |
| `Outcome` | `VARCHAR(20)` | 否 | `PENDING` / `SUCCEEDED` / `FAILED` |
| `MetadataJson` | `NVARCHAR(2000)` | 是 | 不含答案和报告正文的最小元数据 |
| `CreatedAt` | `DATETIME2(0)` | 否 | 操作时间，UTC |

### 4.2 索引

- `IX_AppAssessmentAuditLog_Actor_Time (ActorAccountId, CreatedAt)`。
- `IX_AppAssessmentAuditLog_Target_Time (TargetType, TargetPublicId, CreatedAt)`。
- `IX_AppAssessmentAuditLog_Assessment_Time (AssessmentId, CreatedAt)`。

审计日志不存储逐题答案、人口学答案、计分结果或报告快照。
管理员量表文件操作采用“先写 `PENDING` 审计、再修改文件、最后更新结果”的方式，
避免文件已变更但完全没有审计轨迹。

## 5. 静态分享码方案

第一版不新增“分享码”配置表。每份量表使用稳定静态码：

```text
as1.<assessmentId-base64url>.<hmac-signature>
```

- 签名使用独立的 `ASSESSMENT_SHARE_SECRET`。
- 扫码接口校验签名和量表发布状态后才记录扫码。
- 分享码不包含用户 ID、报告 ID、答案或结果。
- 每个量表使用一张可重复分享的静态二维码，满足当前需求。

## 6. 与旧数据的兼容

- `AppPsychScaleResult` 仍只表示小程序旧 PHQ-9/GAD-7 记录。
- EAP 列表只写入 `AppAssessmentReport`。
- 管理后台聚合展示时分别读取两张表，返回 `source=eap` 或 `source=mini-legacy`。
- 历史小程序数据不补写、不重新计分、不改字段。
- 用户账号仍通过 `AppAccount.Id` 与 EAP Web 登录共用。

## 7. 删除与权限边界

1. Patient 只能读取和删除 `AccountId` 等于当前 token 的报告。
2. 用户删除报告时，在同一事务内清空答案、结果、快照和摘要，并写入 `DeletedAt`。
3. 管理后台所有列表和详情查询都强制 `DeletedAt IS NULL`。
4. Assistant 只能查看与用户端一致的报告快照；Ops/Admin 才能查看原始答案和人口学答案。
5. Counselor 无此后台访问权限。
6. 查看报告详情、原始答案、删除和量表配置变更均写审计。

## 8. 迁移、验证和回滚

### 8.1 批准后的实施顺序

1. 在 SQLAlchemy 中增加三个模型和约束。
2. 增加独立、幂等的 SQL Server 迁移脚本；脚本只创建不存在的表/索引。
3. 在测试数据库执行前先输出库名、现有表和待执行 DDL，不在本地/生产共用库上盲执行。
4. 执行后校验三张表的字段、唯一约束和索引，不写入演示数据。
5. 先部署后端兼容读取，再切换 EAP 提交与报告列表。

### 8.2 回滚原则

- 未产生业务数据前，可按 `AuditLog -> ShareScan -> Report` 顺序删除新表。
- 一旦已有真实报告，应只回滚应用开关，保留新表和数据，不自动 `DROP TABLE`。
- 回滚不会恢复已被用户删除的答案和报告内容。

## 9. 本次审批边界

请求批准的变更仅包含：

- 新建 `AppAssessmentReport`、`AppAssessmentShareScan`、`AppAssessmentAuditLog` 三张表。
- 创建本文列出的唯一约束、`CHECK` 约束和索引。
- 后续将 EAP 新报告写入新表。

不包含：

- 修改或清理现有业务表。
- 迁移小程序旧量表数据。
- 直接在生产库执行 DDL。
- 修改小程序端字段和解析逻辑。
