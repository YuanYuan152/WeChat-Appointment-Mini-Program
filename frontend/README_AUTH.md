# 认证系统使用说明

## 概述

本项目已经实现了完整的用户认证系统，包括登录、注册、登录状态管理等功能。

## 主要功能

### 1. 登录注册模态框 (LoginModal.vue)

- **位置**: `src/components/LoginModal.vue`
- **功能**: 提供美观的登录注册界面
- **特性**:
  - 支持手机号+验证码登录
  - 支持新用户注册
  - 美观的UI设计，包含动画效果
  - 表单验证和错误提示
  - 验证码倒计时功能

### 2. 独立登录页面 (login.vue)

- **位置**: `src/pages/auth/login.vue`
- **功能**: 独立的登录注册页面
- **特性**:
  - 全屏登录界面
  - 支持登录后跳转到指定页面
  - 美观的渐变背景和装饰元素
  - 响应式设计

### 3. 认证工具函数 (auth.ts)

- **位置**: `src/utils/auth.ts`
- **功能**: 提供认证相关的工具函数
- **主要函数**:
  - `isLoggedIn()`: 检查登录状态
  - `getToken()`: 获取用户token
  - `setToken()`: 设置用户token
  - `clearToken()`: 清除用户token
  - `handleRequireLogin()`: 处理需要登录的功能
  - `goToLogin()`: 跳转到登录页面
  - `logout()`: 退出登录

## 使用方法

### 1. 在页面中使用登录模态框

```vue
<template>
  <view>
    <!-- 其他内容 -->
    
    <!-- 登录模态框 -->
    <LoginModal 
      :visible="showModal" 
      :mode="loginMode"
      @close="hideModal"
      @success="handleLoginSuccess"
    />
  </view>
</template>

<script setup>
import LoginModal from '@/components/LoginModal.vue'

const showModal = ref(false)
const loginMode = ref('login')

const showLoginModal = () => {
  showModal.value = true
}

const hideModal = () => {
  showModal.value = false
}

const handleLoginSuccess = (data) => {
  // 处理登录成功
  console.log('登录成功:', data)
}
</script>
```

### 2. 处理需要登录的功能

```vue
<script setup>
import { handleRequireLogin } from '@/utils/auth'

const handleFeedbackClick = () => {
  handleRequireLogin(
    () => {
      // 已登录时执行的操作
      navigateTo('/pages/feedback/index')
    },
    '/pages/feedback/index' // 登录成功后跳转的页面
  )
}
</script>
```

### 3. 检查登录状态

```vue
<script setup>
import { isLoggedIn, goToLogin } from '@/utils/auth'

const checkLogin = () => {
  if (!isLoggedIn()) {
    goToLogin()
    return
  }
  
  // 继续执行需要登录的操作
}
</script>
```

### 4. 退出登录

```vue
<script setup>
import { logout } from '@/utils/auth'

const handleLogout = () => {
  logout()
}
</script>
```

## 页面配置

### 1. 添加登录页面到 pages.json

```json
{
  "path": "pages/auth/login",
  "style": {
    "navigationBarTitleText": "登录注册",
    "navigationBarBackgroundColor": "#667eea",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#667eea",
    "navigationStyle": "custom"
  }
}
```

### 2. 设置页面跳转

```javascript
// 跳转到登录页面
uni.navigateTo({ url: '/pages/auth/login' })

// 跳转到登录页面并指定登录后跳转地址
uni.navigateTo({ 
  url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/feedback/index') 
})
```

## 样式定制

### 1. 登录模态框样式

可以通过修改 `LoginModal.vue` 中的 CSS 来自定义样式：

- 颜色主题
- 字体大小
- 间距和布局
- 动画效果

### 2. 登录页面样式

可以通过修改 `login.vue` 中的 CSS 来自定义样式：

- 背景颜色和渐变
- 装饰元素
- 响应式布局

## 注意事项

1. **Token 管理**: 登录成功后会自动保存 token 到本地存储
2. **登录状态检查**: 页面刷新后会自动检查登录状态
3. **跳转逻辑**: 登录成功后会自动跳转到指定页面或返回上一页
4. **错误处理**: 网络错误和验证失败都有相应的提示
5. **响应式设计**: 支持不同屏幕尺寸的设备

## 扩展功能

### 1. 添加更多登录方式

可以在 `LoginModal.vue` 中添加：
- 微信登录
- QQ登录
- 邮箱登录

### 2. 增强表单验证

可以添加：
- 密码强度检查
- 手机号格式验证
- 验证码重试限制

### 3. 记住登录状态

可以实现：
- 自动登录
- 登录状态持久化
- 多设备登录管理

## 技术支持

如有问题，请检查：
1. 网络连接是否正常
2. API 接口是否可用
3. 本地存储是否正常
4. 页面路由配置是否正确 