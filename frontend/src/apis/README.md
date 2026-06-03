# API数据对接说明

## 概述

本项目已实现与后端API的完整对接，后端地址为 `http://localhost:1611`。所有模拟数据已替换为真实的API调用，并实现了完善的错误处理和备用方案。

## 后端接口结构

### 基础配置
- **后端地址**: `http://localhost:1611`
- **API前缀**: `/api`
- **请求超时**: 10秒
- **数据格式**: JSON

### 主要接口

#### 1. 首页数据接口
```
GET /api/home/index
响应: {
  code: 0,
  msg: "success",
  data: {
    banners: Banner[],
    doctors: Doctor[],
    activities: Activity[],
    liveStreams: LiveStream[]
  }
}
```

#### 2. 咨询师相关接口
```
GET /api/doctors - 获取咨询师列表
GET /api/doctors/:id - 获取咨询师详情
GET /api/doctors/search - 搜索咨询师
```

#### 3. 活动相关接口
```
GET /api/activities - 获取活动列表
GET /api/activities/:id - 获取活动详情
POST /api/activities/:id/join - 加入活动
```

#### 4. 直播相关接口
```
GET /api/live-streams - 获取直播列表
GET /api/live-streams/:id - 获取直播详情
POST /api/live-streams/:id/reserve - 预约直播
```

#### 5. 搜索相关接口
```
GET /api/search - 全局搜索
GET /api/search/hot - 热门搜索
GET /api/search/suggestions - 搜索建议
```

#### 6. 用户相关接口
```
POST /api/auth/login - 用户登录
GET /api/user/info - 获取用户信息
PUT /api/user/info - 更新用户信息
```

## 前端实现

### 1. HTTP客户端配置
- 使用Axios作为HTTP客户端
- 配置了请求和响应拦截器
- 统一的错误处理和loading状态管理

### 2. API服务层
- 按功能模块组织API调用
- 统一的类型定义和错误处理
- 支持参数传递和响应类型推断

### 3. 数据状态管理
- 使用Vue 3 Composition API管理状态
- 实现了数据加载、错误处理、备用方案
- 支持搜索、分页等高级功能

## 错误处理机制

### 1. 网络错误处理
- 连接超时处理
- 网络异常处理
- 服务器错误处理

### 2. 业务错误处理
- 统一的错误码处理
- 用户友好的错误提示
- 自动重试和备用方案

### 3. 备用数据方案
- API失败时自动加载本地模拟数据
- 确保应用在异常情况下仍能正常运行
- 提供用户友好的错误提示

## 使用示例

### 1. 调用API获取数据
```typescript
import { homeApi } from '@/apis'

// 获取首页数据
const loadPageData = async () => {
  try {
    const result = await homeApi.getIndexData()
    if (result.code === 0 && result.data) {
      banners.value = result.data.banners || []
      doctors.value = result.data.doctors || []
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    // 加载备用数据
    loadMockData()
  }
}
```

### 2. 搜索功能实现
```typescript
import { searchApi } from '@/apis'

// 执行搜索
const performSearch = async (keyword: string) => {
  try {
    const result = await searchApi.globalSearch(keyword)
    if (result.code === 0 && result.data) {
      const { doctors: searchResults } = result.data
      showSearchResults(searchResults, keyword)
    }
  } catch (error) {
    // 使用本地搜索作为备用
    const filteredDoctors = doctors.value.filter(/* ... */)
    showSearchResults(filteredDoctors, keyword)
  }
}
```

## 环境配置

### 开发环境
- 后端地址: `http://localhost:1611`
- 超时时间: 10秒
- 调试模式: 开启

### 生产环境
- 后端地址: 生产服务器地址
- 超时时间: 15秒
- 调试模式: 关闭

## 测试建议

### 1. 接口连通性测试
- 测试所有API接口是否可访问
- 验证响应数据格式是否正确
- 检查错误处理是否正常工作

### 2. 功能完整性测试
- 测试数据加载是否正常
- 验证搜索功能是否有效
- 检查错误情况下的备用方案

### 3. 性能测试
- 测试大量数据下的加载性能
- 验证搜索响应时间
- 检查内存使用情况

## 注意事项

### 1. 跨域问题
- 确保后端已配置CORS
- 前端请求头设置正确
- 开发环境可能需要代理配置

### 2. 数据格式
- 确保后端返回的数据格式与前端类型定义一致
- 注意字段名称和数据类型
- 处理空值和异常情况

### 3. 错误处理
- 所有API调用都要有错误处理
- 提供用户友好的错误提示
- 实现合理的备用方案

## 扩展功能

### 1. 缓存机制
- 实现数据缓存减少重复请求
- 支持离线数据访问
- 智能缓存更新策略

### 2. 实时数据
- 支持WebSocket实时数据推送
- 实现数据自动刷新
- 用户操作实时同步

### 3. 数据同步
- 实现多端数据同步
- 支持离线操作和在线同步
- 冲突解决机制

## 部署说明

### 1. 环境变量配置
```bash
# 开发环境
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:1611

# 生产环境
NODE_ENV=production
VITE_API_BASE_URL=https://your-domain.com
```

### 2. 构建配置
```bash
# 开发环境
npm run dev

# 生产环境
npm run build
```

### 3. 部署检查
- 确认API地址配置正确
- 验证CORS配置
- 测试所有功能是否正常 