# GitHub Actions 测试环境发布

> 本文定义 `dev` 到测试环境的自动发布链路。它只替代测试环境的普通应用
> 发布，不负责生产发布，也不执行建库、迁移、数据库账户变更、数据导入或
> 数据恢复。

## 1. 发布链路

`.github/workflows/deploy-test.yml` 在代码推送到 `dev` 后执行：

1. 校验仓库内部署配置。
2. 使用提交的完整 Git SHA 构建 Backend、Admin、EAP 三个镜像。
3. 把镜像推送到 GHCR；传输 tag 包含 Git SHA、run id 和 attempt，发布身份以
   不可变 digest 为准，重跑不会覆盖上一次构建 tag。
4. deploy job 归属 GitHub `test` Environment，并取得只能由该 job 签发的
   GitHub OIDC 身份证明；SSH 私钥负责连通性，OIDC 负责证明固定仓库、
   `dev`、workflow、Environment、run 和当前 SHA。
5. 只向服务器固定入口传递策略版本、Git SHA、三个镜像 digest、GitHub run
   标识和 actor；短期 GHCR token 与 OIDC JWT 仅通过 SSH stdin 两行传入。
6. 服务器拉取指定 digest，验证固定仓库、RepoDigest 及 OCI
   revision/version/source，再由 root-owned Compose 强制 Backend 使用
   `10001:10001`、两个前端使用 `1000:1000`，只更新
   `backend/admin/eap`。
7. 拉取前保守清理不受保护的测试镜像并要求 Docker 存储至少剩余 10 GiB；
   拉取后再次检查至少剩余 5 GiB，不足时不变更运行容器。
8. 固定网关在提交新 manifest 前，通过本机端口验证两个真实首页标识，并从
   公网验证允许匿名的两个前端 `/health` 和两个入口的后端 `/healthz`；
   失败自动回滚。公网首页可由独立 access gate 保护。
9. GitHub runner 再独立重复公网只读冒烟，作为服务器之外的验收证据。

测试环境入口保持为：

- `https://test.admin.ji-psy.com`
- `https://test.eap.ji-psy.com`

镜像按 digest 部署；每次 run 使用独立 tag，不能用 tag 的重新推送改变一次
已记录发布的内容。
测试服务器也不再从 Git 工作树执行 `deploy.sh`、Compose 或 Dockerfile。

## 2. 信任边界

部署 SSH 用户必须是专用的 `gha-test-deploy`：

- 无密码、无交互登录权限。
- 不属于 `docker` 组，也没有通用 sudo 权限。
- SSH 公钥使用 `restrict` 和 forced command，只能调用：
  `/usr/local/libexec/mini-program-actions/actions-test-gateway.sh`。
- sudoers 只允许执行上述 root-owned 固定入口。

固定部署 bundle 位于 `/etc/mini-program-actions/test/`，其中的 Compose、
冒烟逻辑和真实环境文件由 root 管理。目录及脚本不得由部署用户或应用代码
写入。入口只接受格式严格的 SHA、digest、数字 run 标识和 GitHub actor；
stdin 只接受一行短期 GHCR token 和一行 OIDC JWT。镜像仓库名、Compose
project、服务名、端口、配置路径都固定在服务端。固定网关使用
`actions-test-v1` 协议版本；安装器最后写入包含 gateway、Compose、smoke、
cleanup、restore 和 OIDC verifier SHA-256 的 root-only 完整性清单。安装
中断或 workflow/服务器协议版本不一致时，下一次发布会在 Docker 变更前
fail-closed。

固定测试 Compose 还会把真实商户号/支付密钥强制置空、短信强制为 mock，
syslog 固定写入本机 `/dev/log`；即使误把生产凭据复制进 test.env，也不能由
Actions 测试栈创建真实微信支付订单或把日志转发到外部地址。

固定 bundle 还包含 `cleanup-test-images.sh`。它只枚举 `backend-test`、
`admin-test`、`eap-test` 三个测试 GHCR 仓库的 digest，明确禁止
`docker system prune`、`docker image prune` 和强制删除。清理始终保护
`current.env`、直接上一版本、最近 8 份历史清单、运行中容器，以及本次
即将部署的三个 digest。其他仓库、本地 legacy 镜像和任何生产镜像均不在
候选集内。更早的 manifest 继续作为审计记录保留，但对应本地镜像可能已按
策略回收，不能再假定可以离线回滚。

安装器只会写入 root-owned `0644`
`/etc/mini-program-actions/test-actions-ready`，表示固定主机策略已准备，
但此时不会阻断首次接管前的手工恢复路径。固定网关首次执行时临时创建
`/etc/mini-program-actions/test-actions-deploying`，退出时总会移除；完成
本机检查、服务器侧公网检查和 manifest 提交后，才创建并保留
`/etc/mini-program-actions/test-actions-only`。仓库里的 `deploy.sh` 和
`rollback.sh` 看到 deploying 或 only 任一标记都会 fail-closed，避免手工
发布、回滚或迁移与 Actions 固定网关争用不同的锁。这里的“完成”指固定网关
内的端到端检查；GitHub runner 随后仍会从服务器外部独立复验并记录 workflow
结果。
父目录 `/etc/mini-program-actions` 固定为 `root:root 0755`，使非 root
操作者只能判断标记是否存在；真实 bundle 仍为 `root:root 0700`，标记为
`root:root 0644`，不会暴露环境配置。

这条边界很重要：服务器上的 Docker 等同于 root 权限。如果 forced command
再去执行 `dev` 提交里的脚本、Compose 或 Dockerfile，那么能写入 `dev` 的
账号也能通过恶意挂载访问同宿主上的生产数据，SSH 限制将失去意义。

## 3. GitHub 配置

当前仓库已创建 `TEST_DEPLOY_SSH_KEY` repository secret，但当前协作者没有
仓库 Admin 权限，无法创建受保护的 Environment secret、deployment branch
policy 或 reviewer。为避免把 repository secret 单独当成发布授权，服务器
固定入口必须同时验证 GitHub OIDC；证明必须精确匹配：

- repository/owner 及其不可变数字 ID；
- `refs/heads/dev`、push event、`test` Environment；
- 固定 workflow 路径、workflow SHA、release SHA、run id/attempt/actor；
- GitHub-hosted runner、短生命周期、未重放的 `jti`；
- GitHub API 返回的远程 `dev` 当前 SHA。

因此单独取得 SSH 私钥、从其他分支运行 workflow、重放旧 JWT 或重跑已经不是
当前 `dev` 的旧 run，均不能通过服务器入口。这个 OIDC 第二因子是当前实际
边界，但它不等价于 code review 或部署审批。

仓库 owner 仍需在 Settings → Environments 完成：

1. 创建/确认 `test` Environment，并把 deployment branches 限制为仅 `dev`。
2. 配置至少一名 required reviewer。
3. 把 `TEST_DEPLOY_SSH_KEY` 从 repository secret 迁移为 `test` Environment
   secret，确认新位置生效后删除 repository secret。
4. 为 `dev` 开启 branch protection，要求 review、状态检查并禁止 force-push。

在 owner 完成以上治理前，可以验证技术链路，但不能宣称已经具备“受审批保护
的自动发布”。

测试服务器地址 `124.221.56.121`、端口 `22`、用户 `gha-test-deploy` 和已经
核验的 ED25519 host public key 固定在 workflow 中。host key 变化时必须先从
独立可信渠道复核指纹，再通过代码 review 更新；工作流不得运行
`ssh-keyscan` 临时信任网络返回。

不要把现有 `ubuntu`/`root` 密码、个人 SSH 私钥或服务器 Docker 登录凭据
保存到 GitHub。工作流使用 GitHub 自动提供的短期 `GITHUB_TOKEN` 推送和
拉取 GHCR，三个 package 保持 private：

- `backend-test`
- `admin-test`
- `eap-test`

deploy job 只获得 `packages: read`，把该次 run 的短期 token 通过 SSH stdin
交给固定 gateway。gateway 使用 root-only 临时 `DOCKER_CONFIG` 登录 GHCR，
无论发布成功或失败，gateway 退出时都会删除临时目录。token 不进入命令行、
manifest、应用 env、磁盘长期配置或日志；服务器不保存个人 PAT 或长期 GHCR
凭据。

生产另建 Environment、用户、密钥和固定入口；不得复用测试发布密钥。

## 4. 服务器一次性初始化

初始化由服务器管理员在可信会话中执行，并在启用工作流前 review：

1. 先轮换任何曾经通过聊天、工单或文档明文传递的服务器密码；确认密钥登录
   可用后禁用 SSH 密码认证和 root 密码登录。该动作会改变服务器访问方式，
   必须由服务器管理员单独批准并保留可用的应急密钥会话。
2. 先保护公网测试域名。当前测试配置启用了开发管理员登录、短信 mock code
   和模拟支付，不能继续裸露在互联网。优先使用 VPN、固定 IP allowlist、
   Cloudflare Access 或不占用 `Authorization` 头的独立 Cookie access gate，
   仅 `/health`、`/healthz` 可匿名。不能未经验证直接把标准 Nginx Basic Auth
   套在 `/api/`：应用的 Bearer JWT 同样使用 `Authorization`，会被覆盖并导致
   登录后 API 失败。访问策略由管理员确认，并必须确认测试库不含生产真实数据，
   才能启用自动发布公钥。
3. 创建 `gha-test-deploy`，确保它不在 `sudo`/`docker` 组。
4. 把仓库提供的 gateway 和固定 bundle 安装到上述 root-owned 路径，
   owner 为 `root:root`，普通用户不可写；bundle 包含固定 Compose、健康
   检查、保守测试镜像清理脚本、OIDC verifier 和完整性清单。安装器与发布、
   恢复和清理共用同一把锁，完整性清单最后写入；中断升级不会留下可运行的
   新旧混合策略。
5. 把现有测试环境真实配置迁入
   `/etc/mini-program-actions/test/test.env`，权限设为 `0600`。
   安装器不会 `source` 或输出该文件，而是只解析非秘密固定项，并要求每项
   恰好出现一次且与测试环境完全一致：`DB_NAME=lxxlBuild_test`、运行账户
   `mini_test_app`、所有公开 URL 使用 `test.eap.ji-psy.com` /
   `test.admin.ji-psy.com`，三个应用 bind 目录严格位于
   `/data/mini_program/shared/test/`。重复键、生产数据库名、生产域名或生产
   目录都会在写入主机配置前被拒绝。`--apply` 还会确认三个固定目录真实
   存在、路径中没有符号链接、由容器 UID `10001` 持有并且不允许 other
   写入；源 `test.env` 本身必须是无符号链接的绝对路径、`root:root 0600`，
   父目录也必须由 root 持有且不可被 group/other 写入。
6. 为部署公钥写入
   `restrict,command="/usr/local/libexec/mini-program-actions/actions-test-gateway.sh"`
   的 `authorized_keys` 条目；gateway 校验原始请求后再进入受限 sudo 阶段。
7. 安装仅允许该 gateway 的 sudoers 规则，并用 `visudo -cf` 检查。
8. 确认当前三个应用容器使用同一个 40 位 revision；gateway 首次运行会在
   更新容器前把它们记录为首个回滚基线，无法建立基线时会安全终止。
9. 确认三个 GHCR package 保持 private，服务器不存在长期 GHCR credential。
10. 使用与网关完全相同的最小环境验证服务器可以直连 GitHub OIDC JWKS 和
    GitHub API；代理配置不得从 SSH 调用者环境继承。
11. 在不更新容器的情况下验证无参数、错误策略版本、畸形 SHA/digest/actor、
    单行或三行 stdin、无效/重放/其他分支 OIDC 和数据库参数均被拒绝，再进行
    首次 Actions 发布。
12. 安装后确认 `/etc/mini-program-actions/test-actions-ready` 为
   `root:root 0644`，且首次 Actions 成功前不存在
   `/etc/mini-program-actions/test-actions-only`。首次端到端发布成功后，
   再确认 only 标记被保留并验证仓库手工 `deploy.sh`/`rollback.sh` 对测试
   环境硬阻断；首次发布失败时应确认 only 标记已被移除。

真实环境文件、Docker credential、私钥和 sudoers 不得提交到 Git。
初始化不创建或修改数据库；现有 `mini-test` SQL Server 容器、network、
volume 和数据目录保持不变。

## 5. 正常发布与重新执行

合入 `dev` 会自动发布。只有该 SHA 仍是远程 `dev` 当前提交时，才可在原
GitHub Actions run 使用 Re-run jobs；服务器会拒绝已经落后于 `dev` 的旧
run。workflow 不接受从任意功能分支指定未审核 SHA。

在 GitHub Actions 页面验收：

- validate/build/push/deploy/public smoke 全部成功。
- 三个构建结果均有 digest，且 digest 被传给固定入口。
- Admin、EAP `/health` 及 Backend `/healthz` 返回同一个完整 Git SHA。
- 部署记录包含 GitHub run id/attempt、前一版本和当前三个 digest。
- 日志显示拉取前 Docker 可用空间不少于 10 GiB、拉取后不少于 5 GiB。
- 未出现 `database-init`、迁移或数据库账户相关步骤。

第一次成功运行之前，只能表述为“Actions 发布代码和配置已准备”，不能表述为
“测试环境已经由 GitHub Actions 接管”。

## 6. 失败与回滚

固定入口使用互斥锁避免两次发布并发修改同一测试栈。更新失败、本机冒烟失败
或服务器发起的公网冒烟失败时，自动恢复前一份已经验证的三个 digest；回滚
同样只更新应用容器，不触碰 SQL Server、volume、上传文件或量表数据。
服务器前向阶段最长 20 分钟，收到超时信号后另外保留最多 8 分钟用于回滚；
runner 的 SSH 外层为 31 分钟、deploy job 为 35 分钟，不能把外层超时设置得
短于服务器的前向加回滚预算。
网关提交成功后，GitHub runner 还会独立复验公网入口；此复验失败会把 workflow
标记失败并要求人工核对，但不会再次远程执行回滚。

管理员可先只读预览清理候选：

```bash
sudo /etc/mini-program-actions/test/cleanup-test-images.sh
```

确认候选后才追加 `--apply`。该命令与发布共用互斥锁，并保留最近 8 份历史
清单引用的镜像；不得用全局 Docker prune 替代。

若自动回滚也失败：

1. 停止新的 workflow rerun，保留失败 run、部署 manifest 和容器日志。
2. 由服务器管理员使用 root-owned 固定恢复脚本恢复 current 或上一份
   manifest。它只接受 `--current` / `--previous`，只使用本地已有且 OCI
   标签、digest 均与严格解析后的 manifest 一致的镜像，不登录、不拉取。
3. 验证三个健康端点和两个测试域名。
4. 查明原因并生成新提交，禁止覆盖或重推旧 digest。

```bash
# current manifest 正确但容器漂移或损坏时，重建 current
sudo /etc/mini-program-actions/test/restore-test-release.sh --current

# 恢复 history 中最新的 previous-*.env
sudo /etc/mini-program-actions/test/restore-test-release.sh --previous
```

恢复脚本与 Actions 网关共用
`/run/lock/mini-program-actions/test.lock`，固定使用 root-owned
Compose、test.env 和 smoke。目标版本通过本机与公网检查后，原 current 会写成
新的 `previous-*.env`，再原子更新 current；失败则尝试恢复原 current。
它的 Compose 命令只包含 `backend/admin/eap`，不会登录 GHCR、拉取镜像或操作
SQL Server、network、volume 和数据目录。若 previous 对应镜像已被清理，脚本
会在变更容器前拒绝。旧 SHA 已不是当前 `dev` 时，服务器也会拒绝重跑旧
Actions run；此时只能在审批过的维护窗口中按记录的固定 digest 执行独立
root break-glass 拉取与完整核验，或把目标代码形成一个新的 `dev` 提交后由
新 run 发布，不能用可变 tag 或未记录镜像冒充旧版本。
失败 Actions run 可能留下与 current 完全相同的最新 baseline；`--previous`
会严格解析历史清单并跳过这类记录，选择最新一份真正不同的版本。

主机存在 `/etc/mini-program-actions/test-actions-only` 后，仓库内
`deploy.sh --environment test --apply`
（包括迁移/数据库参数）和 `rollback.sh --environment test --apply` 都会硬
拒绝执行，避免与固定网关并发替换容器。break-glass 必须先停用测试 workflow
和服务器部署公钥，再由 root 在持有同一个部署锁的维护窗口内操作；同时记录
精确 SHA、镜像 digest、操作者、原因、结果和回滚点。生产环境不受该测试
接管标记影响。

## 7. 明确不包含的操作

GitHub Actions 测试发布不得：

- 启用 `database-init` profile。
- 使用 `--include-database`、`--initialize-database`、`--migrate` 或
  `--provision-runtime-db-user`。
- 执行 Git release 目录中的脚本、Compose 或 Dockerfile。
- 修改生产域名、生产容器、生产日志、生产配置或生产数据。
- 把密码、token、真实 `.env`、SSH 私钥或用户数据写入 artifact/日志。

任何数据库变更继续执行现有的人工审批流程；任何生产发布需要单独方案和批准。
