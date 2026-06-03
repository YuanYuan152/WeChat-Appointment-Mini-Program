# 🖼️ 图片URL修复指南

## 🎯 问题描述

后端API返回的图片路径是相对路径（如：`/Public/images/20210131150000.jpg`），但前端需要完整的URL（如：`http://localhost:1611/Public/images/20210131150000.jpg`）。

## ✅ 解决方案

### 1. 图片URL修复工具

**文件位置**: `src/utils/image.ts`

**主要功能**:
- `fixImageUrl()` - 修复单个图片URL
- `fixArrayImageUrls()` - 批量修复数组中的图片URL
- `fixObjectImageUrls()` - 修复对象中的图片URL字段

### 2. 使用方法

#### 在组件中导入
```typescript
import { fixArrayImageUrls } from '@/utils/image'
```

#### 在数据加载后应用
```typescript
// 加载页面数据
const loadPageData = async () => {
  try {
    const res = await homeApi.getIndexData()
    const payload = res.data
    if (payload.code === 0 && payload.data) {
      // 修复图片URL路径
      banners.value = fixArrayImageUrls(payload.data.banners || [], ['image'])
      doctors.value = fixArrayImageUrls(payload.data.doctors || [], ['avatar', 'url'])
      activities.value = fixArrayImageUrls(payload.data.activities || [], ['image', 'imageUrl'])
      liveStreams.value = fixArrayImageUrls(payload.data.liveStreams || [], ['image', 'imageUrl'])
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}
```

### 3. 支持的图片字段

**默认字段**: `['image', 'url', 'avatar', 'banner', 'cover']`

**自定义字段**: 可以传入任意字段名数组

### 4. 修复规则

| 输入路径 | 输出URL | 说明 |
|---------|---------|------|
| `/Public/images/20210131150000.jpg` | `http://localhost:1611/Public/images/20210131150000.jpg` | 绝对路径，自动添加域名 |
| `Public/images/20210131150000.jpg` | `http://localhost:1611/Public/images/20210131150000.jpg` | 相对路径，自动添加域名和斜杠 |
| `http://localhost/Public/images/20210131150000.jpg` | `http://localhost/Public/images/20210131150000.jpg` | 完整URL，保持不变 |
| `https://example.com/image.jpg` | `https://example.com/image.jpg` | HTTPS URL，保持不变 |
| `null` 或 `undefined` | `/static/images/default-placeholder.png` | 空值，使用默认图片 |

## 🚀 配置说明

### 环境配置
**文件**: `src/config/config.ts`

```typescript
export const CONFIG = {
  development: {
    API_BASE_URL: 'http://localhost:1611',  // 开发环境
  },
  production: {
    API_BASE_URL: 'https://www.ji-psy.com', // 生产环境
  }
};
```

### 环境变量
**文件**: `env.local`

```bash
VITE_API_BASE_URL=http://localhost:1611
```

## 📝 使用示例

### 示例1: 修复轮播图数据
```typescript
const banners = [
  { id: 1, image: '/Public/images/banner1.jpg' },
  { id: 2, image: '/Public/images/banner2.jpg' }
];

const fixedBanners = fixArrayImageUrls(banners, ['image']);
// 结果: image 字段自动变成 http://localhost:1611/Public/images/xxx.jpg
```

### 示例2: 修复咨询师数据
```typescript
const doctors = [
  { id: 1, avatar: '/Public/images/doctor1.jpg' },
  { id: 2, url: '/Public/images/doctor2.jpg' }
];

const fixedDoctors = fixArrayImageUrls(doctors, ['avatar', 'url']);
// 结果: avatar 和 url 字段自动修复
```

### 示例3: 修复单个对象
```typescript
const user = { avatar: '/Public/images/user.jpg' };
const fixedUser = fixObjectImageUrls(user, ['avatar']);
// 结果: avatar 字段自动修复
```

## 🔧 技术实现

### 核心逻辑
1. **检查路径类型**: 判断是相对路径、绝对路径还是完整URL
2. **自动拼接**: 根据路径类型自动添加正确的域名和端口
3. **类型安全**: 使用 TypeScript 确保类型安全
4. **批量处理**: 支持数组和对象的批量处理

### 优势
- ✅ **自动化**: 无需手动修改每个图片路径
- ✅ **环境适配**: 自动根据环境选择正确的域名
- ✅ **向后兼容**: 支持各种路径格式
- ✅ **类型安全**: TypeScript 支持
- ✅ **性能优化**: 只在需要时修复，避免重复处理

## 📋 注意事项

1. **重启开发服务器**: 修改配置后需要重启
2. **检查网络请求**: 确保图片URL包含正确的域名和端口
3. **默认图片**: 空值会自动使用默认占位图片
4. **字段映射**: 确保传入的字段名与数据结构匹配

## 🎉 效果展示

**修复前**:
```
image: "/Public/images/20210131150000.jpg"
```

**修复后**:
```
image: "http://localhost:1611/Public/images/20210131150000.jpg"
```

现在图片应该能正常显示了！ 