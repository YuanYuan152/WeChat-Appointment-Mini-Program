# 🎯 简化配置指南

## 📍 现在只需要在一个地方配置！

### 🎨 配置文件位置
**`src/config/config.ts`** - 这是唯一需要修改的配置文件！

```typescript
export const CONFIG = {
  // 开发环境配置
  development: {
    API_BASE_URL: 'http://localhost:1611',  // 只改这里！不包含 /api/frontend
    // ... 其他配置
  },
  
  // 生产环境配置  
  production: {
    API_BASE_URL: 'https://www.ji-psy.com', // 只改这里！不包含 /api/frontend
    // ... 其他配置
  }
};
```

## 🚀 使用方法

### 开发环境
```bash
pnpm run dev:h5
```
- 自动使用 `http://localhost:1611/api/frontend`
- 无需任何额外配置！

### 生产环境
```bash
pnpm run build  
```
- 自动使用 `https://www.ji-psy.com/api/frontend`
- 无需任何额外配置！

## 🔄 如果需要自定义环境变量

### 方法1: 创建 .env 文件
```bash
# 开发环境
VITE_API_BASE_URL=http://localhost:1611

# 生产环境
VITE_API_BASE_URL=https://www.ji-psy.com
```

### 方法2: 直接修改 config.ts 文件
在 `src/config/config.ts` 中修改对应的 URL 即可。

## ✨ 优势

- ✅ **统一配置**: 只在一个地方修改基础域名
- ✅ **自动路径**: `/api/frontend` 会自动添加到所有接口
- ✅ **自动切换**: 开发/生产环境自动识别
- ✅ **环境变量支持**: 支持 .env 文件覆盖
- ✅ **实时生效**: 修改后立即生效
- ✅ **类型安全**: TypeScript 支持

## 🔧 技术实现

- **基础配置**: `API_BASE_URL` 只包含域名部分
- **接口路径**: 在 `src/config/api.ts` 中自动拼接 `/api/frontend`
- **代理配置**: Vite 开发服务器自动处理路径重写

## 🧹 已清理的文件

以下重复配置文件已被删除：
- ❌ `env.development`
- ❌ `env.production` 
- ❌ `env.local`
- ❌ `env.config.ts`
- ❌ `prod.config.ts`
- ❌ 各种启动脚本
- ❌ 重复的文档文件

现在配置更加清晰和简单！ 