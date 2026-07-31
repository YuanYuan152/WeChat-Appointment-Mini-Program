# 服务器部署与日志状态

> 状态快照：2026-07-31（Asia/Shanghai）
>
> 目标服务器：`124.221.56.121`
>
> 本文只记录已经核实的服务器实况；部署方法和执行命令见
> [OPERATIONS.md](./OPERATIONS.md)。

## 1. 结论

| 项目 | 状态 | 说明 |
|---|---|---|
| Docker 双环境代码 | 已完成 | `mini-test`、`mini-production` 的网络、端口、数据库卷、数据目录和日志标签相互隔离 |
| 测试环境 Docker | 已部署并验收 | Backend、Admin、EAP、SQL Server 共 4 个容器健康 |
| 生产环境 Docker | 未部署 | 服务器上不存在运行中的 `mini-production` |
| 测试环境日志 | 已接入并验收 | 应用、SQL Server 与 Nginx 均有实际日志 |
| 生产环境日志 | 配置已安装，未产生 | 生产容器尚未启动，因此不能宣称生产日志已经验收 |
| 架构与运维文档 | 已完成 | 包含部署、预检、备份、回滚、日志和生产阻断项 |

仓库远程 `dev` 在本次核实时为
`1d22af8f876bf5225bac11e4d56062d42ad13583`。测试环境运行镜像版本为
`24a95af56676b08bb8430709f5e8014f5aa2f8b6`；两者之间仅有部署预检脚本的
`mawk` 兼容修复，不包含应用业务代码变更。

## 2. 环境实况

### 2.1 测试环境

- Compose project：`mini-test`
- EAP：`https://test.eap.ji-psy.com` → `127.0.0.1:13000`
- Admin：`https://test.admin.ji-psy.com` → `127.0.0.1:13001`
- Backend：Nginx 代理到 `127.0.0.1:18000`
- SQL Server：使用独立 Docker network 和 named volume，不发布公网端口
- 健康检查：两个前端 `/health` 与 Backend `/healthz` 均已返回 `200`

测试入口采用独立子域名，不是 `/test` URL 路径。这与后续确认的
`test.eap.ji-psy.com`、`test.admin.ji-psy.com` 口径一致。

### 2.2 生产环境

生产 Compose 规划为：

- Compose project：`mini-production`
- EAP：`127.0.0.1:23000`
- Admin：`127.0.0.1:23001`
- Backend：`127.0.0.1:28000`

但截至本快照，服务器尚未启动 `mini-production`。正式域名
`eap.ji-psy.com`、`admin.ji-psy.com` 仍由旧 systemd 服务
`3000/3001/8000` 承载，不能视为 Docker 生产环境。旧 Backend 当前连接
测试命名数据库，现有 production 环境文件仍包含占位配置，不具备直接启动
生产栈的条件。

## 3. 日志接入实况

日志链路为：

```text
应用 stdout/stderr
  → Docker syslog driver（按环境和服务设置 tag）
  → rsyslog 分类写入 /data/mini_program/logs
  → logrotate 每日轮转、压缩和清理
```

服务器已确认：

- `rsyslog` 已安装、启用且配置语法检查通过。
- `logrotate.timer` 已启用，每日零点执行。
- 轮转策略为 `daily + dateext + compress + rotate 30 + maxage 30`。
- 日志文件权限为 `0640`，目录权限为 `0750`。
- Backend 使用结构化 JSON 日志，包含环境、版本、请求 ID、路由模板、
  HTTP 状态和耗时，不记录请求体、查询参数、Cookie 或 Token。
- Nginx 使用 JSON 日志，查询参数不落日志，IP、UUID、数字 ID、分享码和上传
  文件标识经过脱敏。

### 3.1 已实际产生的测试日志

```text
/data/mini_program/logs/test/backend/application.log
/data/mini_program/logs/test/admin/application.log
/data/mini_program/logs/test/eap/application.log
/data/mini_program/logs/test/mssql/application.log
/data/mini_program/logs/test/db-init/application.log
/data/mini_program/logs/test/migrate/application.log
/data/mini_program/logs/test/nginx/*.log
```

这些文件已有健康检查、API 请求、应用输出和 Nginx 访问记录。日志于
2026-07-31 当日首次生成，因此没有立即出现日期归档文件是正常现象；首次实际
日轮转应在下一次零点任务后核验。

### 3.2 生产日志边界

生产日志路由和轮转规则已经安装，目标目录为：

```text
/data/mini_program/logs/production/backend/
/data/mini_program/logs/production/admin/
/data/mini_program/logs/production/eap/
/data/mini_program/logs/production/mssql/
/data/mini_program/logs/production/db-init/
/data/mini_program/logs/production/migrate/
/data/mini_program/logs/production/nginx/
```

由于生产容器尚未启动，目前没有生产应用日志。这是“配置完成、运行未接入”，
不是日志故障。生产部署后必须实际验证日志写入、日期轮转、压缩和保留策略。

## 4. 已进入 `dev` 的部署能力

- 测试/生产独立 Compose project、network、volume、数据库名、端口和目录。
- 容器非 root 运行、删除多余 capabilities、`no-new-privileges`、健康检查、
  重启策略和资源限制。
- 发布镜像使用精确 Git SHA，不使用 `latest`。
- 生产配置预检、部署 dry-run、独立数据库确认、备份、恢复校验、回滚和烟测。
- Nginx 四域 HTTPS、安全响应头、默认拒绝未知 Host/SNI 和日志脱敏。
- 后端结构化请求日志和 `X-Request-ID` 关联。

## 5. 未完成与生产阻断项

生产切流前仍需处理：

1. 真实短信供应商尚未接入，`SMS_MOCK=false` 时验证码接口会安全返回 `503`。
2. 协议签名和沟通截图仍可能通过 `/static/uploads/<uuid>` 匿名读取。
3. 生产 Admin 尚无可用的正式登录方式，开发角色登录在生产配置中被禁用。
4. 正式微信支付配置和回调需要真实凭据与端到端验收。
5. 生产数据库需要确认“迁移现有数据”或“建立空库”，并单独批准建库、迁移和
   最小权限运行账户变更。
6. Secrets 尚未迁移到 Docker secrets 或宿主只读 secret files。
7. 登录、验证码、上传和支付的限流、宿主资源告警、自动异机备份及真实恢复
   演练尚未完成。
8. syslog driver 尚未配置 non-blocking 缓冲；rsyslog 异常时的日志写入韧性
   仍需加强。
9. 旧部署部分环境文件权限仍为 `0664`，生产部署前必须收紧为 `0600`、核对
   属主，并评估其中历史凭据是否需要轮换。

完整风险分析见 [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md)。

## 6. 状态更新规则

- 服务器只部署已经合入 `dev` 的精确 SHA。
- 每次部署后记录 Git SHA、镜像版本、环境、数据库操作、冒烟结果和回滚点。
- “配置存在”与“服务器实际运行并验收”必须分开表述。
- 生产日志只有在 `mini-production` 启动并完成写入、轮转检查后才能标记为
  “已接入并验收”。
- 本文是时间点快照；后续实况以 `/data/mini_program/deployments/` 下的部署
  记录和现场检查结果为准。
