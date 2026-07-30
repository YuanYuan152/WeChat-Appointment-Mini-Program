# 连心心理 Python 后端 — 生产启动说明

## 1. 环境准备

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## 2. 配置环境变量

```bash
# 将安全模板复制为 .env 并填写真实值；.env 不得提交
copy .env.example .env
# 编辑 .env 填写 WECHAT_APPID / WECHAT_SECRET / WECHAT_PAY_* / JWT_SECRET / BASE_URL 等
```

## 3. 创建数据库表

运行所有建表脚本（首次部署时执行）：

```bash
python create_counselor_tables.py
python create_assistant_tables.py
python create_ops_tables.py
```

也可直接执行 `lxxl/App_Data/01_Create_MiniProgram_Tables.sql`

## 4. 启动服务

**开发模式（热重载）**

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**生产模式（多 worker）**

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

> 推荐使用 Nginx 做反向代理，将 HTTPS 流量转发到 8000 端口。

## 5. 核心链路测试

```bash
python test_core_flow.py
# 预期：15/15 passed
```

## 6. API 文档

启动后访问 `http://localhost:8000/docs` 查看 Swagger 交互文档。

## API 路由概览

| 模块 | 路由前缀 | 说明 |
|------|---------|------|
| 认证 | `/api/mini/auth` | 登录、绑定手机、当前用户 |
| 支付 | `/api/payment/wechat` | 统一下单、支付回调 |
| 上传 | `/api/upload` | 文件上传 |
| 患者 | `/api/mini/patient` | 订单列表 |
| 咨询师 | `/api/mini/counselor` | 排期、咨询单、个案记录 |
| 助理 | `/api/mini/assistant` | 任务、风险提醒、排期总览 |
| 运营 | `/api/mini/ops` | Banner、活动/公告、用户管理 |
