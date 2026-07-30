# 双环境部署与运维手册

> 当前阶段仅完成仓库内配置、脚本和本地静态验证。本文中的任何服务器安装、
> 容器启动、Nginx reload、证书签发、数据库备份或迁移都尚未执行。

## 1. 环境与域名

| 环境 | EAP | 管理后台 | Compose project |
|---|---|---|---|
| 测试 | `test.eap.ji-psy.com` | `test.admin.ji-psy.com` | `mini-test` |
| 生产 | `eap.ji-psy.com` | `admin.ji-psy.com` | `mini-production` |

宿主 Nginx 是唯一公网入口。容器只发布到 loopback：

| 环境 | EAP | Admin | Backend |
|---|---:|---:|---:|
| 测试 | `127.0.0.1:13000` | `127.0.0.1:13001` | `127.0.0.1:18000` |
| 生产 | `127.0.0.1:23000` | `127.0.0.1:23001` | `127.0.0.1:28000` |

SQL Server 不发布宿主端口。测试和生产必须使用不同 Compose network、
named volume、数据库名、密钥、上传目录和量表目录。

## 2. 文件说明

- `compose.yml`：公共服务定义。
- `compose.test.yml` / `compose.production.yml`：端口、目录和环境覆盖。
- `env/test.env.example` / `env/production.env.example`：只含占位符的配置模板。
- `nginx/mini-program-http-bootstrap.conf`：证书签发前的纯 HTTP 配置。
- `nginx/mini-program.conf`：四域 HTTPS 反代配置。
- `nginx/mini-program-test-only-http-bootstrap.conf`：保留服务器现有生产
  vhost 时，仅为两个测试域名签发证书的过渡配置。
- `nginx/mini-program-test-only.conf`：与现有生产/legacy vhost 共存、仅接管
  两个测试域名的 HTTPS 反代配置。
- `rsyslog/30-mini-program.conf`：按环境和服务拆分应用日志。
- `logrotate/mini-program`：日志按日轮转、日期后缀、压缩、保留 30 天。
- `scripts/`：预检、部署、冒烟、回滚和 SQL Server 备份校验脚本。
- `ARCHITECTURE_REVIEW.md`：架构边界、生产阻断项和后续加固建议。

真实 `.env` 不得提交到 Git，服务器权限必须为 `0600`。

### 2.1 分支与发布基线

- 功能和部署配置都先在当前功能分支形成可审查提交，再合入 `dev`。
- 服务器只部署已经合入的 `dev` 精确 Git SHA，不直接部署未合并的功能分支。
- `linux_dev` 是历史上承载过服务器专用改动的分支，已经与 `dev` 分叉；
  它不再作为发布基线，也不得整分支反向合入 `dev`。仍有价值的历史改动应逐项
  审查后在当前配置中重新实现。
- 镜像标签使用该次 `dev` 提交 SHA，禁止 `latest`，以便定位和回滚。

## 3. 本地验证

### 3.1 静态检查与安全 dry-run

以下命令不访问远程服务器或远程数据库：

```bash
./deploy/scripts/validate-local.sh
./deploy/scripts/preflight.sh --environment test
./deploy/scripts/preflight.sh --environment production

./deploy/scripts/deploy.sh --environment test --build
./deploy/scripts/smoke.sh --environment all
./deploy/scripts/rollback.sh --environment test \
  --target 0123456789abcdef0123456789abcdef01234567
./deploy/scripts/backup-mssql.sh \
  --environment test --database lxxlBuild_test
./deploy/scripts/restore-check.sh \
  --environment test --backup test-lxxlBuild_test-20260101T000000Z.bak
```

上述命令没有 `--apply`、`--run` 或 `--execute` 时只输出计划，不连接
Docker daemon、不请求公网，也不访问数据库。

### 3.2 Apple Silicon 本地全栈

本地覆盖层使用 Azure SQL Edge arm64、loopback 端口、`/tmp` 持久化目录
和 Docker `json-file` 轮转日志；它只用于开发验收，不得用于服务器部署：

```bash
mkdir -p /tmp/mini-program/local/{backups,uploads,assessment-data,assessment-assets}

docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  build backend admin eap

docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  up -d --wait mssql

# 仅首次创建本地库时显式执行
docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  --profile database-init run --rm --no-deps db-init

# 仅在确认允许修改本地数据库后显式执行
docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  --profile database-init run --rm --no-deps migrate

# 普通 up 不会运行 db-init/migrate
docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  up -d --wait

curl -fsS http://127.0.0.1:8000/health/ready
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3000/health
```

首次需要验收量表报告和扫码统计时，仅对本地隔离数据库显式执行受控迁移。
DDL 必须继续使用 `migrate` 服务中的迁移身份，不能借用长驻 Backend 运行账户：

```bash
docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  --profile database-init run --rm --no-deps migrate \
  python migrate_assessment_tables.py --preflight

docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  --profile database-init run --rm --no-deps migrate \
  python migrate_assessment_tables.py \
    --apply --confirm-database lxxlBuild_local
```

停止本地栈但保留数据库卷：

```bash
docker compose \
  --env-file deploy/env/local.env.example \
  -f deploy/compose.yml \
  -f deploy/compose.local.yml \
  down
```

只有需要主动丢弃本地测试数据库时才允许人工追加 `--volumes`；测试和生产
服务器运维脚本不会执行该参数。

### 3.3 本地双环境隔离验收

先 review 计划，再显式运行。脚本只创建 `mini-verify-test` 和
`mini-verify-production` 两个一次性本地 project，默认验收后连同其 volume
一起清理，不连接远程：

```bash
./deploy/scripts/verify-dual-local.sh
./deploy/scripts/verify-dual-local.sh --run
```

它会验证双环境镜像构建、显式建库、通用及三张受控量表表迁移、独立最小
权限运行账户、8 个健康端点、生产安全开关、数据库名、network、volume、
OCI revision，以及停止测试后端不影响生产。`--run` 是允许脚本修改其两个
一次性本地数据库的显式开关；默认 dry-run 不连接数据库。

## 4. 环境配置硬约束

每个真实环境文件至少配置：

- `APP_ENV=test|production`
- `APP_VERSION`、`VCS_REF`、`IMAGE_TAG`，三者必须等于当前 `dev` 完整 SHA
- `AUTO_MIGRATE_SCHEMA=false`
- `DB_NAME`、最小权限运行账户 `DB_USER`、`DB_PASSWORD`
- `MIGRATION_DB_USER`、`MIGRATION_DB_PASSWORD`
- `MSSQL_SA_PASSWORD`，不得与运行时 `DB_PASSWORD` 复用
- `JWT_SECRET`
- `BASE_URL`
- `ASSESSMENT_FRONTEND_BASE_URL`
- `ASSESSMENT_SHARE_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `ALLOW_DEV_LOGIN`
- `ALLOW_SIMULATED_PAYMENT`
- `ENABLE_API_DOCS`

测试 URL：

```text
BASE_URL=https://test.eap.ji-psy.com
ASSESSMENT_FRONTEND_BASE_URL=https://test.eap.ji-psy.com
CORS_ALLOWED_ORIGINS=https://test.eap.ji-psy.com,https://test.admin.ji-psy.com
```

生产 URL：

```text
BASE_URL=https://eap.ji-psy.com
ASSESSMENT_FRONTEND_BASE_URL=https://eap.ji-psy.com
CORS_ALLOWED_ORIGINS=https://eap.ji-psy.com,https://admin.ji-psy.com
```

生产的 `ALLOW_DEV_LOGIN`、`ALLOW_SIMULATED_PAYMENT`、`ENABLE_API_DOCS`
必须为 `false`。`MSSQL_IMAGE` 必须固定到已审核的 digest。两个环境不得复用
数据库、JWT、量表分享或支付/微信密钥。

创建最小权限数据库 login/user 属于数据库变更，必须先单独批准；在批准并
执行前，真实环境运行时预检应保持失败，不得退回让 Backend 使用 `sa`。
`compose.yml` 只在一次性 `migrate` 服务中把 `DB_USER`、`DB_PASSWORD`
映射为 `RUNTIME_DB_USER`、`RUNTIME_DB_PASSWORD`。运行账户创建脚本不接受
密码命令行参数，也不会打印密码；真实 env 必须保持 `0600`。

## 5. TLS 与 Nginx

### 5.1 证书路径约定

完整配置预期以下证书：

- 生产 SAN 证书：
  `/etc/letsencrypt/live/eap.ji-psy.com/{fullchain.pem,privkey.pem}`，
  必须包含 `eap.ji-psy.com` 和 `admin.ji-psy.com`。
- 测试 SAN 证书：
  `/etc/letsencrypt/live/test.eap.ji-psy.com/{fullchain.pem,privkey.pem}`，
  必须包含 `test.eap.ji-psy.com` 和 `test.admin.ji-psy.com`。

测试、生产使用独立证书，避免续期和变更相互耦合。

### 5.2 首次签发顺序

1. 确认四个 A 记录指向目标服务器，80/443 已在云安全组开放。
2. 创建 `/var/www/certbot`，安装
   `mini-program-http-bootstrap.conf`，禁用发行版 default site。
3. 运行 `nginx -t`；bootstrap 不引用任何证书，因此证书尚不存在时也可验证。
4. 使用 Certbot webroot 分别签发生产、测试 SAN 证书。
5. 创建 test、production、system 三类日志目录。先运行
   `./deploy/scripts/validate-nginx-candidate.sh` 隔离验证仓库候选配置，
   再安装 `mini-program.conf` 并运行系统 `nginx -t`。
6. 仅在测试通过后 reload Nginx，随后运行四域冒烟。

四个域名的 HTTP 均永久 `301` 到同主机 HTTPS。未知 Host、直接 IP 的
80/443 默认入口返回 `444`，不会回落到 EAP。HTTPS 默认 server 为完成
TLS 握手需要引用生产证书，但只用于立即拒绝未知 SNI，不参与业务路由。

Nginx access log 不记录 query string；分享码、上传文件标识、数字/UUID
路径会被模板化，IPv4 只保留 `/24`，IPv6 和 User-Agent 不持久化。应用日志
也不得输出 Authorization、Cookie、密码、支付密钥、微信密钥、问卷答案或
咨询内容。

### 5.3 保留现有生产 vhost，仅接入测试环境

服务器现有生产/legacy Nginx 配置仍在运行时，不安装四域配置，也不删除或
禁用任何现有站点。按下面的替换顺序只接管测试域名：

1. 安装 `mini-program-test-only-http-bootstrap.conf`。它不声明
   `default_server`、生产域名、生产 upstream 或全局 `server_tokens`。
2. 在完整宿主配置中执行 `nginx -t`，确认没有重复的 `server_name`、
   `log_format`、`map` 或 upstream 名称，再 reload。
3. 以 `/var/www/certbot` 为 webroot，签发同时包含
   `test.eap.ji-psy.com`、`test.admin.ji-psy.com` 的测试 SAN 证书。
4. 禁用 bootstrap 文件并安装 `mini-program-test-only.conf`；两个文件不可
   同时启用。
5. 再次执行完整宿主 `nginx -t`，确认通过后 reload，验证 HTTP 301、证书
   SAN、`/healthz`、EAP 和 Admin 页面。

`validate-nginx-candidate.sh` 会在本地生成带 production/default server 的
legacy fixture，与两个 test-only 候选分别组合执行隔离 `nginx -t`。该检查
用于提前发现 listener 和 http-context 冲突，但不能替代目标机完整配置的
`nginx -t`。

## 6. 日志

目录布局：

```text
/data/mini_program/logs/
├── test/
│   ├── backend/application.log
│   ├── admin/application.log
│   ├── eap/application.log
│   ├── mssql/application.log
│   ├── db-init/application.log
│   ├── migrate/application.log
│   └── nginx/{api,eap,admin}.{access,error}.log
├── production/
    ├── backend/application.log
    ├── admin/application.log
    ├── eap/application.log
    ├── mssql/application.log
    ├── db-init/application.log
    ├── migrate/application.log
    └── nginx/{api,eap,admin}.{access,error}.log
└── system/
    └── nginx/{unknown-host,bootstrap-unknown-host}.{access,error}.log
```

Compose 的 syslog tag 必须精确为：

- `mini-test-backend`、`mini-test-admin`、`mini-test-eap`
- `mini-test-mssql`、`mini-test-db-init`、`mini-test-migrate`
- `mini-production-backend`、`mini-production-admin`、`mini-production-eap`
- `mini-production-mssql`、`mini-production-db-init`、`mini-production-migrate`

安装 rsyslog 和 logrotate 片段前应创建上述目录，目录 `0750`，日志
`0640`。轮转策略为 `daily + dateext + compress + rotate 30 + maxage 30`。
Docker 自身还应配置有限大小的本地日志缓存，避免 rsyslog 异常时占满根盘。

首次启动前先 review 再准备 bind mount 目录：

```bash
sudo ./deploy/scripts/prepare-data-dirs.sh \
  --env-file deploy/env/test.env --apply
```

## 7. 部署

普通应用发布默认不触碰数据库：

```bash
./deploy/scripts/deploy.sh --environment test --build
# review dry-run 后：
./deploy/scripts/deploy.sh --environment test --build --apply
```

`--apply` 需要输入 `DEPLOY test` 或 `DEPLOY production`。脚本使用
`up --no-deps --no-build backend admin eap`，防止普通应用发版隐式创建、
替换或初始化数据库，也防止回滚时拿当前源码伪造旧标签。

数据库相关选项都有第二次独立确认：

- `--include-database`：`START DATABASE <environment>`
- `--initialize-database`：`INITIALIZE DATABASE <environment>`
- `--migrate`：`MIGRATE DATABASE <environment>`。依次执行受控量表只读
  preflight、通用 schema 迁移及三张量表表的受控迁移；后者仍使用精确
  `DB_NAME` 作为二次目标库校验。
- `--provision-runtime-db-user`：
  `PROVISION DATABASE USER <environment>`。仅用于首次创建运行账户；
  默认先展示离线计划，执行时还必须把精确 `DB_NAME` 传给
  `--confirm-database`。发现同名 server login 或 database user 时立即
  拒绝，绝不静默复用或改密。

首次测试环境建库的 review 顺序：

```bash
# 1. 先展示完整计划，不连接数据库
./deploy/scripts/deploy.sh \
  --environment test \
  --include-database --initialize-database --migrate \
  --provision-runtime-db-user

# 2. 获得数据库变更批准后才追加 --apply，并逐项输入精确确认短语
./deploy/scripts/deploy.sh \
  --environment test --apply \
  --include-database --initialize-database --migrate \
  --provision-runtime-db-user
```

运行账户最终只通过 `mini_app_runtime` 角色获得 `dbo` schema 的
`SELECT/INSERT/UPDATE/DELETE`。不得添加 `db_owner`、`db_ddladmin`、
数据库级 `EXECUTE` 或 `VIEW DEFINITION`。业务使用的
`sys.sp_getapplock` 默认以 `public` database principal 执行，不需要扩大
授权。账户脚本会验证四项 DML、拒绝 DDL/CONTROL/VIEW DEFINITION，并在
事务回滚中验证应用锁。

生产迁移必须先取得用户批准并完成备份。`AUTO_MIGRATE_SCHEMA` 始终为
`false`；不得利用容器启动自动改表。

## 8. 冒烟与验收

```bash
./deploy/scripts/smoke.sh \
  --environment all \
  --public-ip 124.221.56.121 \
  --run
```

冒烟只做未认证、只读检查：

- 四域 HTTP 是否 `301` 到 HTTPS。
- 四域 HTTPS 首页是否可访问。
- `/healthz` 是否通过 Nginx 到后端 `/health/ready` 并返回 `200`。
- TLS SAN 是否包含当前域名。
- IP 默认入口是否拒绝请求而不是返回 EAP/Admin。

业务验收还必须覆盖登录、上传、量表分享、代理预约等，但应使用专用测试
账号并另行执行，不放入通用 smoke 脚本。

## 9. 回滚

```bash
./deploy/scripts/rollback.sh \
  --environment test \
  --target <上一版本Git-SHA>
```

review 后追加 `--apply`，输入
`ROLLBACK test TO <上一版本Git-SHA>`。回滚只切换 backend/admin/eap
镜像，绝不自动回滚数据库、上传或量表数据。若旧代码不兼容当前 schema，
必须停止并走人工恢复方案。

禁止使用 `latest`；发版前需保留当前和上一版本的不可变 SHA 镜像。回滚前
脚本会验证精确 RepoTag、本地 image ID 和 OCI revision，缺少镜像时终止。

## 10. SQL Server 备份与恢复校验

Compose 的 `mssql` 服务必须把本环境独立宿主备份目录挂载为
`/var/opt/mssql/backup`。脚本检测不到该 mount 时会拒绝执行，防止备份写入
容器临时层。

```bash
./deploy/scripts/backup-mssql.sh \
  --environment test \
  --database lxxlBuild_test \
  --execute

./deploy/scripts/restore-check.sh \
  --environment test \
  --backup <备份文件名.bak> \
  --execute
```

备份使用 `COPY_ONLY + CHECKSUM + COMPRESSION`。恢复检查执行
`RESTORE VERIFYONLY WITH CHECKSUM`，不会覆盖数据库，但仍要求显式确认。
密码由容器环境或 Docker secret 提供，不出现在命令行和日志中。

`VERIFYONLY` 不能替代真实恢复演练。至少每月把备份恢复到隔离实例，核对
表结构、关键只读查询和应用启动；备份还应复制到异机或对象存储。

## 11. 上线前阻断条件

- Git 工作树不干净，或无法从 SHA 重建当前运行版本。
- 任一真实 `.env` 被 Git 跟踪，或权限不是 `0600`。
- test/production 的数据库、持久卷、密钥、上传目录有任何复用。
- MSSQL 没有持久卷或独立备份 mount。
- 1433、3000/3001、8000 等应用端口暴露到公网。
- Nginx 配置、TLS SAN、HTTP 跳转或 IP 默认拒绝未通过验证。
- 生产启用开发登录、模拟支付、API 文档或自动 schema 迁移。
- 生产真实短信供应商尚未接入或未完成真实发送 E2E。
- Backend 仍使用 `sa`，或运行时密码与 `MSSQL_SA_PASSWORD` 复用。
- 协议签名、请假沟通截图等敏感文件仍只能通过匿名静态 URL 读取。
- 曾进入 Git 历史的数据库、JWT、微信或支付凭据尚未轮换。
- MSSQL 使用可变 tag，或三个应用镜像的 OCI revision 与发布 SHA 不一致。
- 无可验证备份、上一版本镜像或回滚记录。

完整原因和建议顺序见 [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md)。
