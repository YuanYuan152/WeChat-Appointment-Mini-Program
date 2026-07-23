# EAP 量表 API 协议 v1

状态：量表定义与文件版本、报告读写、管理后台聚合、分享扫码及统计接口均已实现。

本协议只定义 EAP 新量表体系。现有小程序 `/api/mini/patient/scales`、PHQ-9/GAD-7 响应字段和 `AppPsychScaleResult` 保持不变。

## 1. 通用约定

### 1.1 路径与认证

- EAP 公开量表：`/api/web/assessments/*`。
- EAP 当前用户报告：`/api/web/assessment-reports/*`，使用 Bearer Token。
- 管理后台：`/api/mini/admin/assessments/*`，使用现有管理工作台 Bearer Token。
- 时间统一使用带时区的 ISO 8601 字符串。
- 对外报告 ID 使用不可枚举的 `publicId`，不暴露数据库自增 ID。

### 1.2 JSON 响应封装

除文件、图片和 `302` 跳转外，所有接口统一返回：

```json
{
  "code": 0,
  "msg": "请求成功",
  "data": {}
}
```

错误响应保留 HTTP 状态码，并使用相同数值作为 `code`：

```json
{
  "code": 409,
  "msg": "量表已被其他管理员修改，请刷新后重试",
  "data": null,
  "detail": "量表版本冲突"
}
```

常用错误：

| HTTP / code | 含义 |
| --- | --- |
| `400` | 业务参数错误 |
| `401` | 未登录或登录已失效 |
| `403` | 角色无权执行操作 |
| `404` | 量表或报告不存在 |
| `409` | ID 重复、幂等冲突或编辑版本冲突 |
| `422` | 量表结构/语义、答案或计分配置校验失败 |
| `500` | 服务端异常 |

### 1.3 分页结构

请求参数使用 `page`、`page_size`，响应统一为：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

## 2. EAP 公开量表

### 2.1 获取已发布量表列表

`GET /api/web/assessments`

查询参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `category` | 否 | `professional` / `fun` |
| `keyword` | 否 | 名称关键词 |

仅返回当前已发布且未停用的版本。列表项结构：

```json
{
  "id": "bsi-18",
  "version": 1,
  "category": "professional",
  "title": "简明症状量表（BSI-18）",
  "subtitle": "评估躯体化、抑郁与焦虑症状",
  "description": "",
  "cover": "/static/assessments/bsi-18.jpg",
  "questionCount": 18,
  "duration": 8,
  "scoringType": "dimension"
}
```

`questionCount` 由服务端根据 `questions.length` 计算。

### 2.2 获取量表详情

`GET /api/web/assessments/{assessmentId}`

返回当前已发布量表定义，`definition` 必须通过 `assessment-schema-v1.json` 校验：

```json
{
  "definition": {},
  "questionCount": 18,
  "shareCode": "as1.YnNpLTE4.iH2jZAyrrpsLCnnE66nMKWCLL-j-DApViPMrKFklqo4",
  "shareUrl": "https://example.com/api/web/assessment-shares/as1.YnNpLTE4.iH2jZAyrrpsLCnnE66nMKWCLL-j-DApViPMrKFklqo4/scan"
}
```

未发布、已归档或不存在的量表统一返回 `404`。
环境未配置 `ASSESSMENT_SHARE_SECRET` 时，量表浏览仍可用，但 `shareCode`、`shareUrl` 返回 `null`，前端禁用分享入口。
量表稳定 ID 最长 54 个 ASCII 字符，以保证完整 SHA-256 HMAC 分享码可以写入既有 `VARCHAR(120)` 字段；数据库结构不需要调整。

## 3. EAP 用户报告

### 3.1 提交测评报告

`POST /api/web/assessment-reports`

认证：当前 EAP 登录用户。

请求：

```json
{
  "clientSubmissionId": "4fb5ec40-2f36-4c9b-b338-115807308d42",
  "assessmentId": "bsi-18",
  "assessmentVersion": 1,
  "demographicAnswers": {
    "gender": "female",
    "age": 30
  },
  "answers": {
    "q1": "q1-a",
    "q2": "q2-b"
  },
  "entrySource": "web",
  "shareCode": null,
  "consentVersion": "2026-01"
}
```

字段约定：

| 字段 | 说明 |
| --- | --- |
| `clientSubmissionId` | 客户端生成 UUID；同一用户下唯一，用于防重复提交 |
| `assessmentVersion` | 用户开始答题时获取的已发布版本 |
| `demographicAnswers` | 人口学答案，不参与计分 |
| `answers` | 正式题目 ID 到选项 ID 的映射 |
| `entrySource` | `web`、`mini-webview`、`qr` 或 `direct` |
| `shareCode` | 从分享二维码进入时携带，用于转化归因 |
| `consentVersion` | 用户同意的隐私协议版本 |

服务端必须：

1. 校验量表版本仍存在且曾发布。
2. 校验必答题、选项和人口学答案。
3. 根据白名单 `scoringPreset` 重新计分，不信任前端计算结果。
4. 生成不可变的报告快照。
5. 按 `AccountId + clientSubmissionId` 幂等保存。

成功响应：

```json
{
  "publicId": "rpt_01K0XJ6Y9V3Q49KFN4YJQF6A5C",
  "assessmentId": "bsi-18",
  "assessmentVersion": 1,
  "completedAt": "2026-07-22T10:00:00+08:00",
  "resultSummary": "躯体化正常，抑郁正常，焦虑轻度",
  "result": {
    "type": "dimension",
    "dimensions": []
  },
  "reportSnapshot": {
    "assessment": {},
    "result": {},
    "reportContent": {}
  }
}
```

`reportSnapshot` 是 EAP 与管理后台共同展示的唯一报告内容来源。历史报告不得重新读取最新量表文案进行覆盖。

### 3.2 获取我的报告列表

`GET /api/web/assessment-reports`

查询参数：`page`、`page_size`、`category`、`assessment_id`。

只返回当前登录用户未删除的报告。

### 3.3 获取我的报告详情

`GET /api/web/assessment-reports/{publicId}`

只能读取当前登录账号自己的报告；否则返回 `404`，避免泄露报告是否存在。

### 3.4 删除我的报告

`DELETE /api/web/assessment-reports/{publicId}`

需要二次确认。业务层删除后，用户端与管理后台都不得继续读取报告内容；只允许保留不含答案和结果的匿名审计事件。

## 4. 管理后台量表配置

### 4.1 获取量表管理列表

`GET /api/mini/admin/assessments`

查询参数：`page`、`page_size`、`category`、`status`、`keyword`。

返回当前生命周期状态、草稿/发布版本号、完成次数和扫码统计摘要。历史版本不在列表响应中，
通过详情的 `versions` 或 4.7 的独立接口读取。

- `completedCount`：该量表所有版本下尚未删除的 EAP 完成报告数，不限进入来源。
- `scanCount`：静态分享二维码的有效扫码事件总数；重复扫码仍按事件计数。

列表只聚合当前分页中的量表，未产生记录的量表返回 `0`。

### 4.2 获取管理详情

`GET /api/mini/admin/assessments/{assessmentId}`

返回：

```json
{
  "definition": {},
  "revision": "sha256:9e6f...",
  "publishedVersion": 1,
  "draftVersion": 2,
  "versions": []
}
```

`revision` 用于并发编辑保护。

### 4.3 新建量表草稿

`POST /api/mini/admin/assessments`

请求：

```json
{
  "definition": {}
}
```

限制：

- `definition` 必须通过服务端 v1 字段结构、ID/引用和计分配置语义校验。
- `status` 必须为 `draft`。
- `id` 不得与现有量表重复。
- 新建量表仅允许 `sum`、`dimension`、`match` 三种通用计分方式。
- 新建 `sum` 默认使用 `generic-sum-v2`：支持反向题，并在匹配报告区间前把最终总分保留两位小数。
  `generic-sum-v1` 只用于兼容历史定义，保持原始求和且忽略顶层反向题，不会自动升级。

### 4.4 保存草稿

`PUT /api/mini/admin/assessments/{assessmentId}/draft`

请求：

```json
{
  "expectedRevision": "sha256:9e6f...",
  "definition": {}
}
```

若当前 revision 已变化，返回 `409`，不得覆盖其他管理员的修改。

### 4.5 发布量表

`POST /api/mini/admin/assessments/{assessmentId}/publish`

请求：

```json
{
  "expectedRevision": "sha256:9e6f..."
}
```

发布前再次执行服务端 v1 字段结构、ID/引用和计分配置语义校验。服务端会精确验证
`sum`、`dimension`、`psqi` 的所有实际可达分值均有报告区间，并用当前定义生成首选项、
末选项样例交给真实计分器执行；固定计分模板还由代码外部的端点答案样例锁定首末选项结果。
这些 QA 样例不会写入公开量表 JSON 或报告快照。当前运行时仍未直接调用 Draft 2020-12
JSON Schema validator。发布成功后：

- 生成新的不可变发布版本。
- 原发布版本继续用于历史报告。
- EAP 新请求读取新版本。
- 不需要重新构建 EAP 前端。

### 4.6 归档量表

`POST /api/mini/admin/assessments/{assessmentId}/archive`

归档后不再出现在 EAP 量表列表；历史报告仍可查看。

### 4.7 查看与恢复历史版本

- `GET /api/mini/admin/assessments/{assessmentId}/versions`
- `POST /api/mini/admin/assessments/{assessmentId}/versions/{version}/restore`

恢复操作只把历史版本复制成新的草稿，不直接覆盖当前发布版本。

## 5. 管理后台报告

### 5.1 获取报告列表

`GET /api/mini/admin/assessment-reports`

查询参数：

- `page`、`page_size`
- `keyword`：来访者姓名或手机号
- `assessment_id`
- `category`
- `source`：`eap` / `mini-legacy`
- `start_at`、`end_at`

EAP 报告与历史小程序 PHQ-9/GAD-7 可以在列表聚合，但必须返回 `source` 并使用不同详情转换器，不合并底层数据表。

### 5.2 获取报告详情

`GET /api/mini/admin/assessment-reports/{source}/{reportId}`

EAP 报告直接返回提交时的 `reportSnapshot`。管理后台不得重新计分。

### 5.3 获取指定来访者报告

`GET /api/mini/admin/boards/patients/{accountId}/assessment-reports`

用于按来访者筛选报告。当前管理端从来访者详情点击“量表记录”后会关闭详情抽屉，并跳转到
带 `accountId` 筛选条件的“量表结果”页面，不在抽屉中嵌套第二层详情。

## 6. 分享与扫码统计

### 6.1 扫码跳转

`GET /api/web/assessment-shares/{shareCode}/scan`

行为：记录访问后返回 `302`，跳转到对应量表介绍页。该接口不是 JSON，因此不套 `{code,msg,data}`。

记录内容遵循最小化原则：仅保存量表、时间和匿名访客哈希。不保存明文 IP、完整 User-Agent、手机号或微信标识。
无有效匿名 cookie 时服务端生成随机 token，并设置 180 天 HttpOnly、SameSite=Lax cookie；
`VisitorHash` 由该 token 和独立密钥做 HMAC 得到，不使用 IP/User-Agent 请求指纹，因此独立扫码数是近似值。

### 6.2 获取分享统计

`GET /api/mini/admin/assessment-share-stats`

查询参数：`assessment_id`、`start_at`、`end_at`。

返回：

```json
{
  "scanCount": 120,
  "uniqueScanCount": 86,
  "completedReportCount": 24,
  "conversionRate": 0.2,
  "items": [
    {
      "assessmentId": "bsi-18",
      "assessmentTitle": "BSI-18 简版症状量表",
      "scanCount": 120,
      "uniqueScanCount": 86,
      "completedReportCount": 24,
      "conversionRate": 0.2
    }
  ]
}
```

`uniqueScanCount` 是匿名标识下的近似独立访问量，不声明为真实自然人数；清除或禁用 cookie
可能把同一浏览器重复计数。`completedReportCount` 只统计携带有效 `shareCode` 归因的完成报告，
不同于量表管理列表中包含所有进入来源的 `completedCount`。
`conversionRate` 统一使用 `completedReportCount / scanCount`，时间筛选分别作用于扫码时间和报告完成时间。

管理端“量表结果”页面提供“填写记录 / 分享统计”两个页签；量表管理列表可按量表 ID
直接进入分享统计页。统计页每次查询只发起一次聚合请求，不按量表逐行请求。

## 7. 媒体上传

当前量表编辑器只提供图片地址输入框，尚未接入上传控件；服务端目前只校验该字段为字符串，
尚未实现 URL scheme、站内路径白名单或 base64 拦截。上线录入时只能填写可信站内图片 URL；
上传接入和服务端 URL 安全校验仍是待办，不能把任意外部内容地址作为已受控上传处理。

## 8. 兼容性要求

1. 新接口只新增路由，不改小程序旧接口。
2. 所有 JSON 接口保持 `{code,msg,data}`。
3. EAP 量表模块使用独立 HTTP 客户端；不能把全站数据源直接切换到尚未实现完整的 `HttpAdapter`。
4. 小程序当前主入口打开 EAP WebView，因此 EAP 发布后自动生效；本协议不包含小程序免登录 SSO。
5. 若后续要求小程序 WebView 免登录，需要另行设计一次性登录票据，并单独评审。
