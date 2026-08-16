# Web 短信验证码认证

本方案只改 Web 管理端和 EAP 官网，不修改微信小程序的 `wx.login` 链路。

## 1. 登录与注册边界

| 入口 | 行为 | 接口 |
|---|---|---|
| EAP 登录 | 已注册手机号获取验证码后登录 | `POST /api/web/auth/send-code`（`purpose=login`）+ `POST /api/web/auth/login` |
| EAP 注册 | 新手机号获取验证码后创建来访账号 | `POST /api/web/auth/send-code`（`purpose=register`）+ `POST /api/web/auth/register` |
| Web 管理端 | 已存在且角色为咨询师、咨询助理、咨询主任或管理员的手机号登录 | `POST /api/web/auth/staff/send-code` + `POST /api/web/auth/staff/login` |

管理端不开放自助注册，避免通过公开页面创建高权限账号。员工账号仍由管理员在用户/角色管理中预先创建，之后本人使用已登记手机号登录。

本次复用已有 `AppSmsVerification` 表，没有新增或修改数据库表。验证码新记录保存 10 位 HMAC 摘要，不保存明文；升级前尚未过期的旧明文记录仍可完成一次验证。

## 2. 腾讯云需要准备的资源

正式发送前需要在腾讯云完成以下工作：

1. 开通短信服务，完成账号实名认证，并购买中国大陆短信套餐包。
2. 创建并审核通过短信签名。
3. 创建并审核通过验证码模板。当前代码约定模板有两个变量，示例：

   ```text
   您的验证码为{1}，{2}分钟内有效。请勿泄露给他人。
   ```

   `{1}` 是 6 位验证码，`{2}` 是有效分钟数。若最终模板变量数量或顺序不同，需要同步调整 `backend-python/sms_service.py` 的 `TemplateParamSet`。
4. 获取短信应用的 `SmsSdkAppId`、签名名称和模板 ID。
5. 创建仅供后端使用的腾讯云 API 密钥。SecretId/SecretKey 只能写入服务器私密环境文件或密钥管理服务，不能写入前端、仓库或日志。

腾讯云参考：

- [国内短信快速入门](https://cloud.tencent.com/document/product/382/37745)
- [短信签名管理](https://cloud.tencent.com/document/product/382/37794)
- [短信正文模板管理](https://cloud.tencent.com/document/product/382/37795)
- [Python SDK](https://cloud.tencent.com/document/product/382/56059)

## 3. 后端环境变量

开发环境可使用：

```dotenv
SMS_MOCK=true
SMS_PROVIDER=tencent
SMS_CODE_LENGTH=6
SMS_CODE_TTL_MINUTES=5
SMS_RESEND_INTERVAL_SECONDS=60
SMS_MAX_SENDS_PER_HOUR=10
SMS_MAX_VERIFY_ATTEMPTS=5
SMS_CODE_HASH_SECRET=local-only-random-secret-at-least-32-characters
```

`SMS_MOCK=true` 时不会调用腾讯云，接口响应会额外返回 `mockCode` 供本地联调。测试环境若面向真实验收，应关闭 mock 并使用独立的测试签名、模板和密钥。

正式发送还必须配置：

```dotenv
SMS_MOCK=false
SMS_PROVIDER=tencent
SMS_CODE_HASH_SECRET=<独立随机字符串，至少 32 个字符，不复用 JWT_SECRET>
TENCENTCLOUD_SECRET_ID=<后端专用 SecretId>
TENCENTCLOUD_SECRET_KEY=<后端专用 SecretKey>
TENCENT_SMS_REGION=ap-guangzhou
TENCENT_SMS_SDK_APP_ID=<短信应用 SDK AppID>
TENCENT_SMS_SIGN_NAME=<审核通过的签名名称，不带方括号>
TENCENT_SMS_TEMPLATE_ID=<审核通过的模板 ID>
```

配置模板位于：

- `deploy/env/local.env.example`
- `deploy/env/test.env.example`
- `deploy/env/production.env.example`

## 4. 安全与失败行为

- 单手机号、单用途 60 秒内不可重复发送，每小时默认最多 10 次。
- 单个验证码默认最多尝试 5 次，成功后立即失效。
- 管理端发送接口使用模糊响应，避免公开枚举员工手机号；登录接口仍会校验后台角色。
- 腾讯云配置缺失、SDK 异常或供应商拒绝时返回 `503`，不会伪装成发送成功。
- 日志不记录手机号、验证码、SecretId 或 SecretKey。
- 生产预检要求关闭 mock，并检查腾讯云参数和独立验证码摘要密钥。

## 5. 上线验收

在开启真实短信前后分别完成：

1. 本地 mock 验证 EAP 注册、EAP 登录和四类后台角色登录。
2. 使用腾讯云专用测试手机号验证发送成功、模板变量顺序和 5 分钟过期。
3. 验证 60 秒重发限制、每小时发送上限、错误验证码次数上限和验证码一次性使用。
4. 验证普通来访手机号无法进入 Web 管理端，高权限账号无法从公开页面自助注册。
5. 在测试环境观察腾讯云错误码和后端脱敏日志，再批准生产配置切换。
