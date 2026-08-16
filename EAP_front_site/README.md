# 连心心理 · 心理咨询机构前端网站

温暖专业的心理咨询机构官网，包含心理图文、心理问答、我们的故事、心理音画、电话咨询、心理测评等模块。

## 技术栈

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** — 自定义设计令牌（暖色调）
- **Framer Motion** — 页面动效、光碟旋转
- **Zustand** — 音频播放器、测评答题状态
- **React Hook Form + Zod** — 预约表单校验

## 快速开始

```bash
npm install
npm run dev
```

默认使用 **Webpack** 开发模式（避免 Windows 上 Turbopack 偶发 `Next.js package not found` 崩溃）。若要试用 Turbopack：

```bash
npm run dev:turbo
```

访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
src/
├── app/                  # 页面路由
├── components/           # UI 与业务组件
├── data/                 # JSON 内容数据（CMS 就绪）
├── lib/
│   ├── api/              # 数据抽象层（Mock / HTTP）
│   ├── assessment/       # 计分引擎
│   └── stores/           # Zustand 状态
```

## 功能模块

| 模块 | 路由 | 说明 |
|------|------|------|
| 心理图文 | `/stories` | 故事化章节阅读 |
| 心理问答 | `/qa` | 来访者困惑与咨询师专业解答 |
| 我们的故事 | `/our-stories` | 来访故事 + 学员故事 + 咨询师手记 |
| 心理音画 | `/audio` | 播客列表 + 光碟旋转播放 |
| 电话咨询 | `/consultation` | 咨询师列表 + 预约表单 |
| 专业测评 | `/assessment/professional` | BSI-18、AAS、PSQI、PBI、CBCL 等量表 |
| 心理测评 | `/assessment` | 专业量表 + 趣味测评 |
| 登录 / 注册 | `/login` `/register` | 手机号 + 短信验证码，与小程序共用账号 |

## 注册登录（共用后端）

官网登录注册**不单独部署后端**，与微信小程序共用：

仓库内的 `backend-python` 服务。

用户数据存储在同一张 `AppAccount` 表中，小程序微信登录与官网手机号登录可识别为同一用户（手机号一致时）。

### 启动后端

```bash
cd ../backend-python
pip install -r requirements.txt
python ensure_schema.py
# 使用报告、扫码和后台统计前，对当前目标库只读预检：
python migrate_assessment_tables.py --preflight
# 确认输出并取得该环境数据库变更批准后，再单独执行：
# python migrate_assessment_tables.py --apply --confirm-database <当前数据库名>
uvicorn main:app --reload --port 8000
```

开发环境默认 `SMS_MOCK=true`，接口响应会返回 `mockCode` 供本地联调；测试/生产关闭
mock 后由后端调用腾讯云短信，密钥不会进入浏览器包。完整配置和验收步骤见
[Web 短信验证码认证](../docs/sms-auth.md)。
`ensure_schema.py` 不会创建三张受控量表表，不能替代上述量表迁移。

部署环境还必须配置：

- `ASSESSMENT_DATA_DIR`：发布目录之外、按测试/生产隔离且服务用户可写的持久化目录。
- `ASSESSMENT_SHARE_SECRET`：至少 32 个随机字符；留空时浏览仍可用，但分享入口会禁用。
- `ASSESSMENT_FRONTEND_BASE_URL`：扫码后进入 EAP 的公网 HTTPS 根地址。

完整迁移、目录权限和备份顺序见仓库根目录的
[`测试与生产环境要求.md`](../测试与生产环境要求.md)。

### 前端配置

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
# API_INTERNAL_BASE_URL=http://127.0.0.1:8000
# NEXT_PUBLIC_DATA_SOURCE=mock
```

浏览器使用 `NEXT_PUBLIC_API_BASE_URL`，SSR 使用 `API_INTERNAL_BASE_URL`。生产构建必须把
公开地址设置为用户可访问的 HTTPS API，不能保留 `localhost` 或 `127.0.0.1`。

### Web Auth API

| 接口 | 说明 |
|------|------|
| `POST /api/web/auth/send-code` | 发送验证码（purpose: login \| register） |
| `POST /api/web/auth/register` | 验证码注册 |
| `POST /api/web/auth/login` | 验证码登录 |
| `POST /api/web/auth/staff/send-code` | 后台员工获取登录验证码 |
| `POST /api/web/auth/staff/login` | 后台员工验证码登录 |
| `GET /api/web/auth/me` | 当前用户（Bearer Token） |


通用展示内容仍可编辑 `src/data/` 下的 JSON 文件：

- `stories.json` — 心理图文
- `qa.json` — 心理问答
- `our-stories.json` — 我们的故事（来访/学员）
- `audio-episodes.json` — 音频节目
- `consultants.json` — 咨询师

字段结构参见 `src/lib/api/types.ts`。

`assessments-professional.json` 和 `assessments-fun.json` 仅用于空运行目录的首次初始化。
量表初始化后应在 admin-web 的“量表管理”新增、编辑和发布；直接改这两个 seed 文件不会覆盖
已经发布的运行时版本。

## 切换数据源

通用图文、问答、音频等内容当前默认使用 Mock 数据。量表、登录和预约模块已经通过各自的
HTTP 客户端连接真实后端，不受该开关影响。

在 `src/lib/api/adapters/http.ts` 完成全部通用内容接口之前，必须保持：

```bash
NEXT_PUBLIC_DATA_SOURCE=mock
```

当前若设置为 `http`，通用内容页面会主动抛出 `HTTP adapter not implemented`，不能用于部署。

## 构建部署

```bash
npm run build
npm start
```
