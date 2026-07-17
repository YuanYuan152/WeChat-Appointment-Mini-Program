# 连心心理 Web 管理端

本目录用于承载管理员和运营角色的 Web 端后台。当前已开始第一阶段迁移：先复用 `backend-python` 现有接口，不修改数据库表，提供管理员/运营开发登录、Web 后台外壳和核心模块入口。

## 技术栈

- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS v4

## 定位

Web 管理端用于迁移小程序中除来访者以外的管理类功能，优先覆盖管理员和运营能力。后续可逐步承载助理、咨询师等非来访角色的高频后台操作。

## 目录

```text
admin-web/
├── docs/                 # 产品、架构、接口、测试文档
├── src/app/              # Next.js App Router
├── src/components/       # 通用 UI 组件
├── src/config/           # 导航、权限、环境配置
├── src/features/         # 按业务域拆分的功能模块
├── src/lib/              # 请求、鉴权、格式化等通用库
├── src/server/           # Server Actions / 服务端适配层
├── src/styles/           # 样式补充
└── src/types/            # 共享类型
```

## 第一版范围

见 [docs/requirements-v1.md](./docs/requirements-v1.md)。

## 本地启动

先启动后端 `backend-python`，再启动 Web 管理端：

```bash
cd admin-web
pnpm install
pnpm dev -p 3001 -H 127.0.0.1
```

默认后端地址是 `http://127.0.0.1:8000`。如需修改，复制 [.env.example](./.env.example) 并设置：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

开发登录入口：

- 管理员：复用后端 `dev_admin` mock code。
- 运营：复用后端 `dev_ops` mock code。

正式 Web 登录后续应补 `/api/web/auth/*`，不直接依赖小程序 `wx.login`。

## 与现有系统的关系

- 后端继续复用 `backend-python`。
- 小程序继续保留在 `frontend`。
- Web 端可以新增后端接口，但不要破坏小程序原接口。
- 当前迁移不改数据库表；来访/咨询师看板已并入 `/api/mini/admin/boards/patients|counselors`，与小程序管理端同一前缀。操作记录、数据导入若仍走 `/api/web/admin/*`，需单独落地实现。
