# 底部导航配置说明

## 概述
底部导航现在使用uni-app的原生tabBar配置，替换了之前的自定义底部导航组件。

## 配置详情

### pages.json 配置
```json
{
  "tabBar": {
    "color": "#434A76",
    "selectedColor": "#8B56C0",
    "borderStyle": "white",
    "backgroundColor": "#ffffff",
    "height": "70px",
    "list": [
      {
        "pagePath": "pages/index/index",
        "iconPath": "static/images/bottom1.png",
        "selectedIconPath": "static/images/bottom1.png",
        "text": "首页"
      },
      {
        "pagePath": "pages/activity/list",
        "iconPath": "static/images/bottom2.png",
        "selectedIconPath": "static/images/bottom2.png",
        "text": "活动招募"
      },
      {
        "pagePath": "pages/consultant/list",
        "iconPath": "static/images/bottom10.png",
        "selectedIconPath": "static/images/bottom10.png",
        "text": "心理咨询"
      },
      {
        "pagePath": "pages/theme/index",
        "iconPath": "static/images/bottom3.png",
        "selectedIconPath": "static/images/bottom3.png",
        "text": "主题月"
      },
      {
        "pagePath": "pages/user/profile",
        "iconPath": "static/images/bottom4.png",
        "selectedIconPath": "static/images/bottom4.png",
        "text": "我的"
      }
    ]
  }
}
```

## 页面结构

### 1. 首页 (pages/index/index)
- 轮播图
- 功能卡片
- 图标导航
- 专业咨询师
- 活动招募/直播预告

### 2. 活动招募 (pages/activity/list)
- 活动列表
- 活动详情
- 加入功能

### 3. 心理咨询 (pages/consultant/list)
- 咨询师列表
- 咨询师详情
- 预约功能

### 4. 主题月 (pages/theme/index)
- 主题列表
- 主题详情
- 活动安排

### 5. 我的 (pages/user/profile)
- 用户信息
- 个人设置
- 我的咨询

## 图标文件

所有底部导航图标都位于 `static/images/` 目录：
- `bottom1.png` - 首页图标
- `bottom2.png` - 活动招募图标
- `bottom10.png` - 心理咨询图标（特殊样式）
- `bottom3.png` - 主题月图标
- `bottom4.png` - 我的图标

## 样式特点

- **颜色主题**：深蓝色 (#434A76) 和紫色 (#8B56C0)
- **高度**：70px，符合设计规范
- **边框样式**：白色边框，保持简洁
- **背景色**：白色背景，突出内容

## 优势

1. **原生性能**：使用uni-app原生tabBar，性能更好
2. **统一体验**：与系统原生导航保持一致
3. **易于维护**：配置集中，修改方便
4. **响应式**：自动适配不同设备尺寸

## 注意事项

- 确保所有页面路径正确配置
- 图标文件必须存在于指定路径
- 页面组件需要正确导出
- 导航跳转使用uni-app的API 