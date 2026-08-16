# 部署架构评审与上线门禁

> 本文记录仓库内 Docker 双环境方案的边界、已完成验证和仍需产品或运维
> 决策的事项。它不是“已经上线”的证明。截至 2026-07-31，测试 Docker
> 环境已经部署并完成日志验收，生产 Docker 环境尚未启动。测试环境的
> GitHub Actions 发布替代方案正在接入，首次 workflow 全链路成功前不视为
> 已接管。当前服务器实况见
> [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)。

## 1. 目标架构与已提交配置

- 测试和生产分别使用 `mini-test`、`mini-production` Compose project。
- 两个环境使用不同 network、SQL Server volume、数据库名、宿主持久目录、
  loopback 端口和密钥。
- Nginx 是唯一公网入口，分别承载：
  `test.eap.ji-psy.com`、`test.admin.ji-psy.com`、
  `eap.ji-psy.com`、`admin.ji-psy.com`。
- 应用容器不以 root 运行，默认删除 Linux capabilities，开启
  `no-new-privileges`，并设置健康检查和资源上限。
- 普通应用启动、发布和回滚不执行建库或迁移。建库、通用 schema 迁移和
  量表受控迁移必须分别显式执行并单独批准。
- 测试和生产日志使用独立 syslog tag，并由宿主 rsyslog 按环境和服务落盘，
  logrotate 按日轮转并保留 30 天。
- 发布镜像使用 Git SHA 标签和 OCI revision label，不使用 `latest`。
- 测试环境目标发布链路由 GitHub-hosted runner 构建三类镜像、推送 GHCR，
  再按不可变 digest 调用服务器 root-owned 固定入口。入口不执行 release
  提交里的脚本、Compose 或 Dockerfile。
- 固定入口在拉取前后执行 Docker 存储 fail-closed 水位检查（10 GiB/5 GiB）；
  保守清理器仅操作三个测试 GHCR 仓库，并保护 current、上一版本、最近历史
  和运行中容器，不使用任何全局 prune。

## 2. 本地验证结论

本地已验证以下能力：

- Admin、EAP、Backend、SQL Server 均可构建并通过健康检查。
- `mini-test` 和 `mini-production` 可同时运行，网络、volume、数据库名和
  宿主端口互不复用。
- 停止测试后端时，生产后端健康检查仍为 `200`。
- 生产配置关闭 API 文档、开发登录、模拟支付和自动 schema 迁移。
- EAP 构建不再依赖构建机实时访问 Google Fonts。
- 本地开发栈完成浏览器验收：EAP 量表页、Admin 登录及来访管理页面可访问，
  相关 API 返回 `200`。

可复现命令和验收口径见 [OPERATIONS.md](./OPERATIONS.md)。

### 2.1 服务器验证边界

服务器已经验证 `mini-test` 的 Backend、Admin、EAP 和 SQL Server 健康，
测试域名与测试日志链路正常。生产 Compose、生产日志路由和轮转规则已经具备，
但 `mini-production` 尚未启动，正式域名仍由旧 systemd 服务承载。因此生产
运行与生产日志不能标记为已验收。

### 2.2 GitHub Actions 接管边界

仓库侧已增加测试发布 workflow、digest 镜像引用、固定 gateway 约束和静态
校验。它们只有在以下事项全部完成后才能标记为“已接管”：

1. 当前 repository secret + 固定 `test` Environment OIDC 双因子链路完成
   技术验收；仓库 owner 再把私钥迁至 Environment secret，并配置仅 `dev`、
   reviewer 和 `dev` branch protection。
2. 专用、无 Docker/sudo 组权限的 SSH 用户和 forced command 完成安装。
3. root-owned 固定 bundle、测试 `.env`、GHCR 拉取身份及首个回滚 manifest
   完成初始化。
4. 从 `dev` 完成一次 build、push、deploy、public smoke 全绿运行。
5. 现场确认三个容器 revision 与 workflow SHA 一致，且数据库容器、volume、
   数据和生产服务均未发生变化。
6. 现场确认 Docker 空间水位门禁及测试镜像清理 dry-run 不包含生产镜像。
7. 公网测试域名已启用 VPN/IP allowlist/Cloudflare Access/独立 Cookie gate
   等不覆盖应用 Bearer `Authorization` 的外层访问控制，且曾明文传递的
   服务器密码已轮换、密码 SSH/root 密码登录已停用。

详细接入和验收口径见
[ACTIONS_DEPLOYMENT.md](./ACTIONS_DEPLOYMENT.md)。

## 3. 生产上线阻断项

以下问题不影响本地双环境结构验证，但在生产流量切换前必须关闭：

### 3.1 腾讯云短信代码已接入，云资源与真实发送仍需验收

后端已经通过腾讯云短信 API 3.0 接入 EAP 注册/登录和 Web 管理端员工登录，
`SMS_MOCK=false` 时会检查腾讯云配置并真实调用供应商；配置或发送失败会返回
`503`。现有表已实现按手机号/用途的重发与小时上限、错误验证码次数限制和一次性
使用。

生产切流前仍必须完成：

1. 审核通过签名与双变量验证码模板，并准备后端专用腾讯云 API 密钥。
2. 密钥通过 secret file 或密钥管理服务注入，不写入仓库和 Compose 明文模板。
3. 使用专用测试手机号完成发送、错误码、超时和供应商不可用演练。
4. 在网关层补充来源 IP/设备维度限流与告警，防止攻击者轮换手机号消耗短信额度。

生产预检会检查代码侧必需参数，但不能用“预检/健康检查为绿”代替短信 E2E。
完整配置见 [Web 短信验证码认证](../docs/sms-auth.md)。

### 3.2 协议签名和沟通截图仍通过公开静态 URL 读取

上传接口要求登录，但生成的 `/static/uploads/<uuid>` 可匿名读取。协议签名、
请假沟通截图属于敏感文件，不能仅依赖不可猜 UUID。由于小程序当前也消费
这些 URL，不能在没有兼容方案时直接关闭静态路由。

上线前应先确定并实施其中一种兼容方案：

- 后端鉴权下载接口 + 短期签名 URL；或
- 私有对象存储 + 短期签名 URL。

量表封面等公开素材应与受保护文件分目录、分权限存储；历史敏感文件需要迁移。

### 3.3 生产运行时数据库账户尚未验收

当前测试环境已经以 `mini_test_app` 作为 Backend 运行账户并保持健康；本次
Actions 变更不会创建 login/user、改授权或接触数据库服务。生产 Docker
环境尚未启动，生产运行账户仍需在上线前独立验收。建库和迁移可使用高权限
账户，但 Backend 运行时不得长期使用 SQL Server sysadmin。若生产仍需创建
环境独立账户或调整 grant，属于数据库变更，必须先取得单独批准，并保持
`MSSQL_SA_PASSWORD` 与 `DB_PASSWORD` 分离。

### 3.4 历史凭据必须轮换

从当前版本删除 `.env.production` 只能阻止继续提交，不能清除 Git 历史。
所有曾经进入 Git 的数据库、JWT、微信和支付凭据都必须在对应平台轮换。
是否重写 Git 历史需单独评估协作者同步成本；无论是否重写，轮换都是必须项。

### 3.5 镜像和依赖供应链门禁

- 基础镜像应由 CI 固定 digest，并保存 SBOM、漏洞扫描和镜像 digest。
- Python 依赖应生成可复现锁文件；Node 构建需处理审计出的高危依赖。
- 服务器只拉取 CI 产物并按 digest 部署，不应在生产机临时联网重建。

## 4. 高优先级改进

- 将 JWT、数据库、微信、支付、短信和内部 token 从普通环境变量迁移到
  Docker secrets 或宿主只读 secret files，避免通过 `docker inspect` 暴露。
- 为验证码、登录、上传和支付接口增加应用层与 Nginx 双层限流；增加上传配额、
  孤儿文件清理和磁盘水位告警。
- SQL Server 设置最大内存，宿主机增加 CPU、内存、磁盘、容器重启和证书到期
  告警。业务量增长后将测试与生产拆分到不同宿主机。
- 日志只记录路由模板和必要状态；敏感静态、扫码和账户标识路由关闭 access
  log 或使用脱敏日志。日志目录最小权限并保留访问审计。
- 为 syslog driver 增加 non-blocking 缓冲和容量上限，避免 rsyslog 短暂异常
  反向阻塞应用日志写入。
- 每月执行一次隔离恢复演练；`RESTORE VERIFYONLY` 不能替代真实恢复。
- 冒烟后继续使用专用测试账户验收登录、量表分享、上传、代理预约和支付，
  不把只读 `/health` 当作业务可用性证明。
- 为 `dev` 配置 branch protection，并为 GitHub `test` Environment 配置
  reviewer；Actions 接管后定期轮换部署密钥，并审计 build/deploy job 的
  `packages: write/read` 最小权限。服务器不保存长期 GHCR token。
- 测试与生产目前同宿主，root-owned gateway 只能降低发布密钥和仓库代码的
  权限面，不能消除宿主内核、Docker daemon、磁盘耗尽等共同故障域。生产上线
  前仍建议拆分宿主或至少拆分独立节点。

## 5. 发布分支约定

部署改动先在功能分支逐步提交并 review，再合入 `dev`。服务器只部署已合入
`dev` 的精确 SHA。`linux_dev` 是历史分叉分支，不作为当前发布源；其中仍有
价值的改动只能逐项审查后重新引入，禁止把整个分支反向覆盖 `dev`。
