# 微信支付 APIv3 接入说明（小程序支付）

依据官方开发指引：<https://pay.weixin.qq.com/doc/v3/merchant/4012791911>

## 一、已接入的真实微信接口

| 步骤 | 官方接口 | 本项目位置 |
|------|----------|------------|
| 1. 商户下单 | `POST /v3/pay/transactions/jsapi` | `wechat_pay_v3.py` → `create_jsapi_order`；由 `payment.py` 的 `/create`、`/pay-order` 调用 |
| 2. 小程序调起支付 | `wx.requestPayment` / `uni.requestPayment`（`signType=RSA`） | `frontend/src/utils/orderPayment.ts`、`consultant/detail.vue` |
| 3. 支付后查单 | `GET /v3/pay/transactions/out-trade-no/{out_trade_no}` | `POST /api/payment/wechat/sync-order` |
| 4. 支付成功回调 | 商户 `notify_url`（V3 JSON + AES-GCM） | `POST /api/payment/wechat/callback`（成功应答 **HTTP 204 空包体**） |
| 5. 关闭订单 | `POST .../out-trade-no/{out_trade_no}/close` | 待支付超时取消时 `close_wechat_order_quietly` |
| 6. 申请退款 | `POST /v3/refund/domestic/refunds` | `consultation_cancel` → `request_wechat_refund`（受理后查退款确认） |
| 7. 查询单笔退款 | `GET /v3/refund/domestic/refunds/{out_refund_no}` | 申请后退款查单 + 重复退款兜底 |
| 8. 退款结果回调 | 退款 `notify_url` | `POST /api/payment/wechat/refund-callback`（仅 `SUCCESS` 视为到账终态） |

未填真实商户参数时：支付走 `simulate-pay` / `simulate-pay-order`，退款只改本地订单状态。

## 二、参数配置（仅 .env，禁止写入 .py）

**敏感凭证唯一来源：** `backend-python/.env`（生产用 `.env.production`）

```python
from wechat_pay_credentials import pay_credentials
```

`wechat_pay_credentials.py` / `config.py` 只做读取与空默认，不包含任何密钥明文。

## 三、上线前在 .env 填写

1. `WECHAT_APPID` / `WECHAT_SECRET`
2. `WECHAT_PAY_MCH_ID`
3. `WECHAT_PAY_API_V3_KEY`（32 位）
4. `WECHAT_PAY_MCH_CERT_SERIAL`
5. `WECHAT_PAY_MCH_PRIVATE_KEY_PATH` → 真实私钥（勿提交仓库）
6. `WECHAT_PAY_PUBLIC_KEY_ID` + `WECHAT_PAY_PUBLIC_KEY_PATH`
7. `WECHAT_PAY_NOTIFY_URL` / `WECHAT_PAY_REFUND_NOTIFY_URL`（公网 HTTPS）
8. 前端 `VITE_ENABLE_REAL_PAY=true`

## 四、业务链路（上线后）

```
用户确认支付 → JSAPI 下单 → requestPayment
  → sync-order 查单入账 + 支付回调 204 兜底
超时未支付 → 先查单：确认未支付才本地取消 + 微信关单
取消/请假退款 → 申请退款并查退款受理 → 本地 REFUNDED
  → 退款回调 SUCCESS 确认到账
```

### 支付状态同步原则（不会自动退款）

只有**显式的取消/退款操作**会发起微信退款：来访取消预约（满足 24 小时规则）、退款豁免审核通过、
咨询师请假审核通过（`consultation_cancel.py`）。

支付回调、`sync-order` 查单、订单过期、员工取消待支付单、后台对账（`wechat_pay_service.reconcile_wechat_payments`，
每 10 分钟，多 worker 时同一轮只有一个进程执行）都只做"与微信对齐"，**从不发起退款**：

| 微信查单结果 | 本地处理 |
|------|------|
| `SUCCESS` 且订单待支付 | 照常落单（本地 `ExpiresAt` 已过也落单；只要求咨询尚未开始） |
| `SUCCESS` 但无法落单 / 本地已取消 | 订单记为 `PAID`（不建咨询、不占排期），给助理发「支付待人工处理」消息，给来访发「支付已到账，预约待确认」 |
| `REFUND` | 本地同步为 `REFUNDED`（例如助理在商户平台手动退款后） |
| `NOTPAY` / `CLOSED` 等 | 过期或员工取消时关单并本地取消 |
| `USERPAYING` / 查单失败 / 并发锁超时 | 保持待支付，下次同步再处理 |

员工取消推送、换绑、请假审批、停用咨询师时，若来访已付款或支付状态未知，操作会被拒绝（取消推送返回 409），
不会在取消动作里退款。

**「支付待人工处理」订单怎么处理：** 联系来访协商改约或退款；需要退款时在微信支付商户平台操作，
后台对账会在 10 分钟内把订单同步为已退款。来访订单列表会显示「已支付·待确认」。

## 五、未开发接口取舍

| 接口 | 建议 |
|------|------|
| 微信支付订单号查单 | **可选**：已有商户订单号查单即可；仅在仅有 `transaction_id` 时补 |
| 发起异常退款 | **建议后续**：退款入 `ABNORMAL` 时运营处理用 |
| 申请交易账单 / 资金账单 / 下载账单 | **建议后续**：财务对账用，不影响用户支付主链路 |

## 六、回调规范（已对齐官方）

- 验签失败 / `WECHATPAY/SIGNTEST/` 探测：HTTP 4XX + `{"code":"FAIL","message":"..."}`
- 验签与接收成功：HTTP **204**，无包体
- 支付成功但预约无法落单：如实记录收款并转人工后应答 204，避免无限重推
- 并发锁超时等暂时性失败：应答 5XX，让微信稍后重推（查单与对账也会兜底）
