# 连心心理前端项目

基于 Vue 3 + TypeScript + UniApp 的移动端前端项目

## 🚀 技术栈

- **Vue 3** - 核心框架，使用组合式API
- **TypeScript** - 类型安全的JavaScript超集
- **UniApp** - 跨平台移动应用开发框架
- **Vite** - 现代化构建工具
- **UnoCSS** - 原子化CSS框架
- **Sass/SCSS** - CSS预处理器
- **Pinia** - 状态管理
- **Axios** - HTTP请求库

## 📁 项目结构

```
frontend/
├── src/
│   ├── pages/              # 页面文件
│   │   ├── index/          # 首页
│   │   ├── xy/             # 咨询协议
│   │   ├── consultant/     # 咨询师相关
│   │   └── user/           # 用户相关
│   ├── components/         # 公共组件
│   ├── composables/        # 组合式函数
│   ├── apis/               # API接口
│   ├── types/              # 类型定义
│   ├── utils/              # 工具函数
│   ├── store/              # 状态管理
│   ├── styles/             # 样式文件
│   └── static/             # 静态资源
├── package.json            # 项目依赖
├── tsconfig.json           # TypeScript配置
├── vite.config.ts          # Vite配置
├── uno.config.ts           # UnoCSS配置
└── uni.config.ts           # UniApp配置
```

## 🛠️ 开发环境

### 环境要求
- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 推荐使用pnpm（更快、更节省空间）

#### 安装pnpm
```bash
# 全局安装pnpm
npm install pnpm -g

# 或者使用corepack（Node.js 16.13+）
corepack enable
```

#### 安装依赖
```bash
# 使用pnpm安装依赖
pnpm install

# 或者使用npm
npm install
```

### 开发命令

#### 使用pnpm
```bash
# 启动H5开发服务器
pnpm run dev:h5

# 启动微信小程序开发
pnpm run dev:mp-weixin

# 启动APP开发
pnpm run dev:app

# 构建生产版本
pnpm run build

# 类型检查
pnpm run type-check

# 代码格式化
pnpm run format

# 清理构建文件
pnpm run clean
```

### 登录入口开关（环境变量）

`VITE_ENABLE_MOCK_LOGIN` 控制是否显示「开发者入口」和模拟登录。Vite 会在编译时打进小程序包，**改完必须重新编译**（开发模式重启 `dev:mp-weixin`，生产重新 `build`）。

| 场景 | 怎么设 |
|------|--------|
| 本地开发（默认） | `.env.development` 或 `.env.development.local` 设 `VITE_ENABLE_MOCK_LOGIN=true` |
| 本地测正式登录 | 在 `.env.development.local` 设 `VITE_ENABLE_MOCK_LOGIN=false` 后重启编译 |
| 生产构建 | 不写或设 `false`（`npm run build` 不会读 `.env.development*`） |

生产包登录页只保留：勾选《用户服务协议》+《隐私政策》→ 微信手机号一键登录。

#### 使用npm
```bash
# 启动H5开发服务器
npm run dev:h5

# 启动微信小程序开发
npm run dev:mp-weixin

# 启动APP开发
npm run dev:app

# 构建生产版本
npm run build

# 类型检查
npm run type-check

# 代码格式化
npm run format

# 清理构建文件
npm run clean
```

## 📱 页面说明

### 首页 (pages/index/index.vue)
- 轮播图展示
- 功能导航
- 推荐咨询师列表
- 底部导航栏

### 咨询师列表 (pages/consultant/list.vue)
- 咨询师列表展示
- 搜索和筛选功能
- 分页加载

### 咨询师详情 (pages/consultant/detail.vue)
- 咨询师详细信息
- 可预约时间
- 预约功能

### 咨询协议 (pages/xy/xy1.vue, xy2.vue)
- 咨询协议内容
- 表单填写
- 协议确认

### 个人中心 (pages/user/profile.vue)
- 用户信息展示
- 预约记录
- 设置选项

## 🔧 开发规范

### 代码规范
- 使用 TypeScript 严格模式
- 遵循 Vue 3 组合式API规范
- 使用 ESLint + Prettier 进行代码格式化

### 组件规范
- 组件名使用 PascalCase
- 文件名使用 kebab-case
- 使用 `<script setup>` 语法

### 样式规范
- 使用 SCSS 预处理器
- 优先使用 UnoCSS 原子类
- 遵循 BEM 命名规范

## 📡 API接口

### 基础配置
- 开发环境: `/api` 代理到后端
- 生产环境: 直接请求后端地址

### 主要接口
- 首页数据: `GET /we/Index`
- 咨询师列表: `GET /we/ConsultantLst`
- 咨询师详情: `GET /we/ConsultantView`
- 用户信息: `GET /we/getPatient`
- 创建预约: `POST /we/appointment`

## 🚀 部署说明

### 构建输出
- H5版本: 输出到 `../lxxl/static/frontend`
- 微信小程序: 输出到 `unpackage/dist/build/mp-weixin`
- APP版本: 输出到 `unpackage/dist/build/app-plus`

### 部署步骤
1. 执行构建命令: `pnpm run build` 或 `npm run build`
2. 将构建产物部署到对应平台
3. 配置后端API地址

## 📝 注意事项

1. **类型安全**: 所有API调用都需要类型定义
2. **错误处理**: 统一使用HTTP拦截器处理错误
3. **状态管理**: 使用Pinia管理全局状态
4. **响应式设计**: 确保在不同设备上的良好体验
5. **性能优化**: 合理使用懒加载和代码分割

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 Pull Request

## �� 许可证

MIT License 