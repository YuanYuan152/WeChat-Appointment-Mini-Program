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
| 专业测评 | `/assessment/professional` | PHQ-9、GAD-7 量表 |
| 心理测评 | `/assessment` | 专业量表 + 趣味测评 |
| 登录 / 注册 | `/login` `/register` | 手机号 + 验证码或密码，与小程序共用账号 |

## 注册登录（共用后端）

官网登录注册**不单独部署后端**，与微信小程序共用：

`D:\Code\VScode_File\Syapp\WeChat-Appointment-Mini-Program\backend-python`

用户数据存储在同一张 `AppAccount` 表中，小程序微信登录与官网手机号登录可识别为同一用户（手机号一致时）。

### 启动后端

```bash
cd ../WeChat-Appointment-Mini-Program/backend-python
pip install -r requirements.txt
python ensure_schema.py   # 首次或升级后执行，创建 PasswordHash 列与 AppSmsVerification 表
uvicorn main:app --reload --port 8000
```

开发环境默认 `SMS_MOCK=true`，验证码会打印在后端控制台，并在接口响应中返回 `mockCode`。

### 前端配置

```bash
cp .env.local.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Web Auth API

| 接口 | 说明 |
|------|------|
| `POST /api/web/auth/send-code` | 发送验证码（purpose: login \| register） |
| `POST /api/web/auth/register` | 注册（验证码或密码） |
| `POST /api/web/auth/login` | 登录（验证码或密码） |
| `GET /api/web/auth/me` | 当前用户（Bearer Token） |


新增内容只需编辑 `src/data/` 下的 JSON 文件：

- `stories.json` — 心理图文
- `qa.json` — 心理问答
- `our-stories.json` — 我们的故事（来访/学员）
- `audio-episodes.json` — 音频节目
- `consultants.json` — 咨询师
- `assessments-professional.json` — 专业量表
- `assessments-fun.json` — 趣味测评

字段结构参见 `src/lib/api/types.ts`。

## 切换数据源

默认使用 Mock 数据。对接真实 API 时：

1. 复制 `.env.local.example` 为 `.env.local`
2. 设置 `NEXT_PUBLIC_DATA_SOURCE=http`
3. 在 `src/lib/api/adapters/http.ts` 中实现接口

## 构建部署

```bash
npm run build
npm start
```
