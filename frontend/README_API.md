# API架构说明文档

## 概述

本项目已经重构了API架构，将所有硬编码的URL统一管理，并提供了完整的HTTP请求封装和API服务类。

## 架构特点

### 1. 统一配置管理
- **配置文件**: `src/config/api.ts`
- **环境配置**: 支持开发和生产环境
- **接口地址**: 统一管理所有API端点

### 2. HTTP请求封装
- **封装类**: `src/utils/http.ts`
- **功能特性**:
  - 自动添加认证token
  - 统一的错误处理
  - 加载状态管理
  - 响应数据标准化

### 3. API服务类
- **用户服务**: `src/apis/user.ts`
- **认证服务**: `src/apis/auth.ts`
- **类型安全**: 完整的TypeScript类型定义

## 文件结构

```
src/
├── config/
│   └── api.ts              # API配置文件
├── utils/
│   └── http.ts             # HTTP请求封装
├── apis/
│   ├── user.ts             # 用户相关API
│   └── auth.ts             # 认证相关API
└── components/
    └── LoginModal.vue      # 登录模态框
```

## 配置说明

### 1. API配置文件 (`src/config/api.ts`)

```typescript
// 环境配置
const ENV = {
  development: {
    baseURL: 'http://localhost:1611',
    timeout: 10000
  },
  production: {
    baseURL: 'https://your-production-domain.com',
    timeout: 15000
  }
}

// 接口地址配置
export const API_ENDPOINTS = {
  user: {
    getUserInfo: '/Api/userCenter/GetUserInfo',
    updateUserInfo: '/Api/userCenter/UpdateUserInfo'
  },
  auth: {
    login: '/Api/login/Login',
    register: '/Api/login/Register',
    sendVerificationCode: '/Api/login/SendVerificationCode'
  }
}
```

### 2. HTTP请求封装 (`src/utils/http.ts`)

```typescript
// 创建HTTP实例
export const http = new HttpRequest()

// 导出常用方法
export const { get, post, put, delete: del } = http

// 使用示例
const response = await http.get('/api/users', { page: 1 })
const result = await http.post('/api/users', userData)
```

### 3. API服务类 (`src/apis/user.ts`)

```typescript
export class UserApi {
  // 获取用户信息
  static async getUserInfo(): Promise<UserInfo> {
    const response = await http.get<UserInfo>(API_ENDPOINTS.user.getUserInfo)
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || '获取用户信息失败')
  }
}
```

## 使用方法

### 1. 在组件中使用API服务

```vue
<script setup>
import { UserApi } from '@/apis/user'
import { AuthApi } from '@/apis/auth'

// 获取用户信息
const loadUserInfo = async () => {
  try {
    const userData = await UserApi.getUserInfo()
    userInfo.value = userData
  } catch (error) {
    console.error('加载失败:', error)
  }
}

// 用户登录
const handleLogin = async () => {
  try {
    const result = await AuthApi.login({
      phone: form.phone,
      code: form.code
    })
    // 处理登录成功
  } catch (error) {
    // 处理错误
  }
}
</script>
```

### 2. 直接使用HTTP封装

```typescript
import { http } from '@/utils/http'

// GET请求
const response = await http.get('/api/data', { id: 1 })

// POST请求
const result = await http.post('/api/create', { name: 'test' })

// 自定义配置
const customResponse = await http.get('/api/data', null, {
  showLoading: false,
  showError: false
})
```

### 3. 添加新的API接口

#### 步骤1: 在配置文件中添加接口地址

```typescript
// src/config/api.ts
export const API_ENDPOINTS = {
  // ... 现有配置
  newFeature: {
    getList: '/Api/newFeature/GetList',
    create: '/Api/newFeature/Create',
    update: '/Api/newFeature/Update',
    delete: '/Api/newFeature/Delete'
  }
}
```

#### 步骤2: 创建API服务类

```typescript
// src/apis/newFeature.ts
import { http } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

export interface NewFeatureData {
  id: string
  name: string
  description: string
}

export class NewFeatureApi {
  static async getList(params?: any): Promise<NewFeatureData[]> {
    const response = await http.get<NewFeatureData[]>(
      API_ENDPOINTS.newFeature.getList,
      params
    )
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || '获取列表失败')
  }

  static async create(data: Partial<NewFeatureData>): Promise<boolean> {
    const response = await http.post<boolean>(
      API_ENDPOINTS.newFeature.create,
      data
    )
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || '创建失败')
  }
}
```

#### 步骤3: 在组件中使用

```vue
<script setup>
import { NewFeatureApi } from '@/apis/newFeature'

const loadData = async () => {
  try {
    const list = await NewFeatureApi.getList()
    dataList.value = list
  } catch (error) {
    console.error('加载失败:', error)
  }
}
</script>
```

## 环境配置

### 开发环境
- 基础URL: `http://localhost:1611`
- 超时时间: 10秒
- 调试模式: 启用

### 生产环境
- 基础URL: `https://your-production-domain.com`
- 超时时间: 15秒
- 调试模式: 禁用

### 切换环境
```bash
# 开发环境
npm run dev

# 生产环境
npm run build
```

## 错误处理

### 1. 网络错误
- 请求超时
- 网络连接失败
- 服务器无响应

### 2. HTTP错误
- 4xx: 客户端错误
- 5xx: 服务器错误

### 3. 业务错误
- 参数验证失败
- 权限不足
- 业务逻辑错误

### 4. 错误处理示例

```typescript
try {
  const result = await UserApi.getUserInfo()
  // 处理成功响应
} catch (error) {
  if (error instanceof Error) {
    // 业务错误
    uni.showToast({
      title: error.message,
      icon: 'none'
    })
  } else {
    // 网络错误
    uni.showToast({
      title: '网络错误，请重试',
      icon: 'none'
    })
  }
}
```

## 最佳实践

### 1. 错误处理
- 始终使用try-catch包装API调用
- 提供用户友好的错误提示
- 记录详细的错误日志

### 2. 类型安全
- 为所有API响应定义接口
- 使用泛型确保类型安全
- 避免使用any类型

### 3. 性能优化
- 合理设置超时时间
- 避免重复请求
- 使用缓存减少API调用

### 4. 安全性
- 自动添加认证token
- 验证API响应数据
- 防止敏感信息泄露

## 迁移指南

### 从旧代码迁移

#### 旧代码示例
```typescript
// 硬编码URL
const response = await uni.request({
  url: 'http://localhost:1611/Api/userCenter/GetUserInfo',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${token}`
  }
})
```

#### 新代码示例
```typescript
// 使用API服务
const userData = await UserApi.getUserInfo()
```

### 迁移步骤
1. 导入相应的API服务类
2. 替换硬编码的URL调用
3. 使用标准的错误处理
4. 更新类型定义

## 注意事项

1. **不要硬编码URL**: 所有API地址都应该在配置文件中定义
2. **统一错误处理**: 使用try-catch和统一的错误提示
3. **类型安全**: 为所有API定义完整的类型接口
4. **环境配置**: 确保开发和生产环境使用正确的配置
5. **版本管理**: API版本变更时及时更新配置文件

## 技术支持

如有问题，请检查：
1. 配置文件是否正确
2. API服务类是否正确导入
3. 网络连接是否正常
4. 服务器是否可用
5. 认证token是否有效 