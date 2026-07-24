# EAP 量表协议

本目录是 EAP 量表、测评报告和后台管理功能的协议基线。后续实现必须先遵循这里的字段、接口和权限约定，再修改业务代码。

## 文件说明

- `assessment-schema-v1.json`：单份量表定义的 JSON Schema。
- `assessment-api.md`：EAP、管理后台、分享统计的 HTTP API 协议。
- `assessment-permissions.md`：角色权限、敏感数据和审计要求。
- `assessment-db-design.md`：报告、扫码统计和审计日志的已批准数据库设计及受控迁移说明。
- `validate_examples.py`：不依赖第三方包的示例结构与引用校验。
- `examples/professional-dimension.json`：专业多维度量表示例。
- `examples/fun-match.json`：趣味匹配型量表示例。
- `examples/report-submit.json`：报告提交请求示例。

## 版本原则

1. `schemaVersion` 表示 JSON 结构版本；当前固定为 `1`。
2. `version` 表示同一量表内容的发布版本，从 `1` 递增。
3. 已发布版本不可原地覆盖；修改后产生新版本。
4. 历史报告按提交时的量表版本和报告快照展示，不能读取最新文案覆盖历史结果。
5. 现有小程序 PHQ-9/GAD-7 接口与 `AppPsychScaleResult` 不属于本协议，不做字段替换。

## 存储原则

- 每个量表使用一个 JSON 对象，不再把多份量表写入同一个数组文件。
- `questionCount` 不写入量表定义，由 `questions.length` 计算。
- 草稿、已发布版本和备份分目录存储；EAP 用户端只读取已发布版本。
- 人口学问题放在 `demographicQuestions`，默认不参与计分。
- 量表 JSON 只保存声明式配置，不允许保存可执行脚本或表达式。

## 校验层次

`assessment-schema-v1.json` 是协议与离线结构校验基线。当前运行时没有直接调用 Draft 2020-12
validator，而是由服务端自定义校验器执行字段结构与以下语义校验：

- 量表、题目、选项、维度、结果 ID 唯一。
- `questionIds`、`reverseQuestionIds` 引用的题目必须存在。
- 分数区间不得重叠；`sum`、`dimension` 和 `psqi` 的每个实际可达分值都必须命中一个区间。
- `matchTags` 必须能对应到 `matchResults`。
- 通用匹配量表至少有一道必答题；每个选项至少有一个结果权重，每个 `matchResult`
  至少被一个选项引用，避免空答案回退为任意结果。
- 固定计分模板必须满足其规定的题目 ID、数量、必答状态、反向题，以及精确的选项
  ID 到分值映射；只调整展示文案不能改变计分结构。
- `cover`、`matchResults[].image`、`reportProfiles[].image` 只允许 EAP 内置图片、
  受控静态示例或量表图片上传接口返回的站内路径；拒绝外链、base64、查询参数和路径穿越。
- 已发布量表的 `id` 不可修改。

可达分值使用精确枚举校验：非必答题未填写按 `0` 分计入，反向计分按实际选项上下界换算，
维度求和与平均分都和运行时一致保留两位小数。新建总分量表使用 `generic-sum-v2`，应用顶层
`reverseQuestionIds`，并在区间匹配前把最终总分统一保留两位小数；历史
`generic-sum-v1` 继续按原始值求和且忽略顶层反向题，只有管理员显式升级后才改变口径。
单个结果域超过 100,000 个状态时会拒绝保存，避免
用近似结果放行无法验证的配置。定义校验还会把首选项和末选项样例交给真实服务端计分器执行；
固定计分模板另有不写入公开 JSON 的端点答案回归样例。

新增、保存、发布和首次种子转换执行完整计分及图片路径校验；历史已发布版本读取和恢复来源
执行兼容校验，仍检查字段结构、有限数值、ID 和引用，但不会用后续新增的计分覆盖策略或
图片路径白名单阻断历史报告。历史版本恢复成草稿后，如仍使用旧外链图片，必须改为受控路径
才能再次发布。

## 当前实现边界

- 已实现文件存储的草稿、发布版本、备份、归档和版本恢复。
- 首次启动会把旧 EAP 数组 JSON 转换为六份 v1 定义；原 JSON 不会被改写。
- EAP 量表列表和详情已使用独立 HTTP 客户端读取已发布定义，站内其他模块仍使用原数据源。
- 专业指导语、功能说明和 PBI/CBCL/黑暗人格报告文案已进入运行时定义。
- 报告提交、历史报告、内容删除、后台聚合查询和敏感字段分级已经实现。
- 量表入口和即时结果页都可生成不含个人报告内容的邀请海报；静态签名二维码、扫码事件、
  近似独立访客和同周期完成统计已经实现。
- 管理后台已经支持新增、编辑、发布、归档、版本恢复、报告总入口、来访者报告入口，
  以及扫码/近似独立访问/分享归因完成/同周期完成比统计页。
- 量表编辑权限用户可上传受控 JPEG、PNG、WebP 图片；上传内容按真实文件格式、大小、
  尺寸和像素数校验，以内容哈希命名并写入环境独立的不可变图片目录。
- 报告、分享扫码和审计表使用受控迁移；普通启动不会自动建表，每个目标环境都必须单独
  `--preflight` 并经确认后 `--apply`。
- 第一版采用系统图片分享或保存海报后手工发送，不包含微信 JSSDK 指定好友/朋友圈的一键分享；
  分享扫码写库失败不会阻断量表访问，同一匿名访客 30 秒内重复打开同一量表只记录一次。

## 运行时目录

通过 `ASSESSMENT_DATA_DIR` 指定持久化目录。未配置时使用
`backend-python/runtime/assessment-data`（仅适合本地开发，已加入 `.gitignore`）。

```text
assessment-data/
├── index.json
├── drafts/{assessmentId}.json
├── published/{assessmentId}/v{version}.json
└── backups/{assessmentId}/{timestamp}-{revision}.json
```

生产部署必须把该目录指向可持久化、可备份的绝对路径。已发布版本不可原地修改；
回滚操作只会生成新草稿。也可通过 `ASSESSMENT_SEED_DATA_DIR` 覆盖首次初始化的旧 EAP JSON 目录。

量表上传图片使用独立的 `ASSESSMENT_ASSET_DIR`。本地未配置时写入
`backend-python/runtime/assessment-assets`；测试和生产必须分别指向发布目录外的持久化目录。
图片通过 `/static/assessment-assets/{sha256}.{ext}` 公开读取，定义中只保存该站内相对路径。
图片可能被历史发布版本和报告快照引用，因此第一版不提供删除和覆盖能力，目录必须与量表
JSON 一起备份。

## 本地校验

```bash
python3 docs/assessment/validate_examples.py
```

该脚本验证 JSON 语法、必填字段、ID/引用、完整可达分值、示例提交内容，并调用真实服务端
计分器核对专业量表与趣味量表示例。运行时尚未直接接入 Draft 2020-12 JSON Schema
validator；协议 Schema 目前仍作为字段约定和独立校验基线。
