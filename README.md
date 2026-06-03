# 连心心理 - 心理咨询平台

## 项目概述

这是一个心理咨询平台，提供咨询师信息展示、预约咨询等功能。

#### 后端接口

新增了 `frontendController.GetDoctorDetail()` 接口：

- 路径：`/api/frontend/GetDoctorDetail/{id}`
- 功能：获取医生详细信息和可预约时间
- 返回：医生信息、时间段列表、是否有可约时间等

#### 使用方法

1. 访问医生详情页面：`/pages/consultant/detail?id={医生ID}`
2. 通过 Tab 切换查看不同内容
3. 在"可约时间"Tab 中选择时间段
4. 点击底部"预约"按钮进行预约

## 技术栈

- **前端**：Vue 3 + TypeScript + uni-app
- **后端**：ASP.NET MVC + C#
- **数据库**：SQL Server
- **样式**：CSS3 + 响应式设计

## 开发环境

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 后端开发

- 使用 Visual Studio 2022 打开 `lxxl.sln`
- 配置数据库连接字符串
- 运行项目

### API 测试

访问 `/pages/test/api-test` 页面可以测试各种接口功能，包括新添加的医生详情接口。

## 项目结构

```
├── frontend/                 # 前端代码
│   ├── src/
│   │   ├── pages/           # 页面文件
│   │   │   └── consultant/  # 咨询师相关页面
│   │   │       └── detail.vue  # 医生详情页面
│   │   └── apis/            # API 接口
├── lxxl/                    # 后端代码
│   ├── Areas/
│   │   └── Api/
│   │       └── Controllers/
│   │           └── frontendController.cs  # 前端API控制器
│   ├── Models/              # 数据模型
│   └── Views/               # 视图文件
└── README.md                # 项目说明
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证。
