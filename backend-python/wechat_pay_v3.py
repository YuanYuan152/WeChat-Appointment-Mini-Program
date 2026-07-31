"""
微信支付 APIv3 客户端（普通商户 / 小程序支付）。

接入的官方接口：
1. JSAPI/小程序下单  POST /v3/pay/transactions/jsapi
   文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791856
2. 商户订单号查询   GET  /v3/pay/transactions/out-trade-no/{out_trade_no}
   文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791857
3. 关闭订单         POST /v3/pay/transactions/out-trade-no/{out_trade_no}/close
   文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791860
4. 申请退款         POST /v3/refund/domestic/refunds
   文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791865
5. 查询单笔退款     GET  /v3/refund/domestic/refunds/{out_refund_no}
6. 支付成功回调通知（JSON + AEAD_AES_256_GCM 解密）
7. 小程序调起支付签名（RSA，signType=RSA）

开发指引总览：https://pay.weixin.qq.com/doc/v3/merchant/4012791911
"""

from __future__ import annotations

import base64
import json
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from wechat_pay_credentials import WeChatPayCredentials, pay_credentials

API_HOST = "https://api.mch.weixin.qq.com"


class WeChatPayV3Error(Exception):
    def __init__(self, message: str, *, status_code: int = 0, body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _load_private_key(path: str):
    data = Path(path).read_bytes()
    # 跳过我们写入的 MOCK 注释行
    if data.startswith(b"#"):
        data = b"\n".join(data.splitlines()[1:])
    return serialization.load_pem_private_key(data, password=None)


def _load_public_key(path: str):
    data = Path(path).read_bytes()
    if data.startswith(b"#"):
        data = b"\n".join(data.splitlines()[1:])
    return serialization.load_pem_public_key(data)


class WeChatPayV3Client:
    def __init__(self, creds: Optional[WeChatPayCredentials] = None):
        self.creds = creds or pay_credentials
        self._private_key = None
        self._public_key = None

    @property
    def private_key(self):
        if self._private_key is None:
            self._private_key = _load_private_key(self.creds.mch_private_key_path)
        return self._private_key

    @property
    def wechat_public_key(self):
        if self._public_key is None:
            self._public_key = _load_public_key(self.creds.wechat_pay_public_key_path)
        return self._public_key

    def _sign_message(self, message: str) -> str:
        signature = self.private_key.sign(
            message.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return base64.b64encode(signature).decode("utf-8")

    def build_authorization(self, method: str, path_with_query: str, body: str = "") -> str:
        timestamp = str(int(time.time()))
        nonce = uuid.uuid4().hex
        message = f"{method}\n{path_with_query}\n{timestamp}\n{nonce}\n{body}\n"
        signature = self._sign_message(message)
        return (
            "WECHATPAY2-SHA256-RSA2048 "
            f'mchid="{self.creds.mch_id}",'
            f'nonce_str="{nonce}",'
            f'signature="{signature}",'
            f'timestamp="{timestamp}",'
            f'serial_no="{self.creds.mch_cert_serial}"'
        )

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: Optional[dict] = None,
        timeout: int = 15,
    ) -> tuple[int, Any]:
        body = "" if json_body is None else json.dumps(json_body, ensure_ascii=False, separators=(",", ":"))
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": self.build_authorization(method, path, body),
            "Wechatpay-Serial": self.creds.wechat_pay_public_key_id,
            "User-Agent": "ji-web-wechat-pay-v3/1.0",
        }
        url = f"{API_HOST}{path}"
        resp = requests.request(
            method,
            url,
            data=body.encode("utf-8") if body else None,
            headers=headers,
            timeout=timeout,
        )
        text = resp.text or ""
        if resp.status_code == 204 or not text.strip():
            return resp.status_code, None
        try:
            data = resp.json()
        except ValueError:
            data = {"raw": text}
        if resp.status_code >= 300:
            message = ""
            if isinstance(data, dict):
                message = data.get("message") or data.get("code") or text
            raise WeChatPayV3Error(
                message or f"微信支付接口错误 HTTP {resp.status_code}",
                status_code=resp.status_code,
                body=text,
            )
        return resp.status_code, data

    # ------------------------------------------------------------------
    # 1) JSAPI / 小程序下单
    # ------------------------------------------------------------------
    def create_jsapi_order(
        self,
        *,
        out_trade_no: str,
        description: str,
        total_fee: int,
        openid: str,
        time_expire: Optional[str] = None,
        attach: Optional[str] = None,
    ) -> dict:
        payload: dict[str, Any] = {
            "appid": self.creds.appid,
            "mchid": self.creds.mch_id,
            "description": (description or "心理咨询预约")[:127],
            "out_trade_no": out_trade_no,
            "notify_url": self.creds.notify_url,
            "amount": {"total": int(total_fee), "currency": "CNY"},
            "payer": {"openid": openid},
        }
        if time_expire:
            payload["time_expire"] = time_expire
        if attach:
            payload["attach"] = attach[:128]
        _, data = self.request("POST", "/v3/pay/transactions/jsapi", json_body=payload)
        if not isinstance(data, dict) or not data.get("prepay_id"):
            raise WeChatPayV3Error("下单成功但未返回 prepay_id", body=str(data))
        return data

    def build_mini_program_pay_params(self, prepay_id: str, *, out_trade_no: str) -> dict:
        """生成小程序 wx.requestPayment / uni.requestPayment 参数（V3 RSA）。"""
        timestamp = str(int(time.time()))
        nonce_str = uuid.uuid4().hex
        package = f"prepay_id={prepay_id}"
        message = f"{self.creds.appid}\n{timestamp}\n{nonce_str}\n{package}\n"
        pay_sign = self._sign_message(message)
        return {
            "appId": self.creds.appid,
            "timeStamp": timestamp,
            "nonceStr": nonce_str,
            "package": package,
            "signType": "RSA",
            "paySign": pay_sign,
            "out_trade_no": out_trade_no,
        }

    def create_and_sign_jsapi_pay(
        self,
        *,
        out_trade_no: str,
        description: str,
        total_fee: int,
        openid: str,
        time_expire: Optional[str] = None,
    ) -> dict:
        order = self.create_jsapi_order(
            out_trade_no=out_trade_no,
            description=description,
            total_fee=total_fee,
            openid=openid,
            time_expire=time_expire,
        )
        return self.build_mini_program_pay_params(order["prepay_id"], out_trade_no=out_trade_no)

    # ------------------------------------------------------------------
    # 2) 查单
    # ------------------------------------------------------------------
    def query_by_out_trade_no(self, out_trade_no: str) -> dict:
        path = f"/v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={self.creds.mch_id}"
        _, data = self.request("GET", path)
        if not isinstance(data, dict):
            raise WeChatPayV3Error("查单返回异常", body=str(data))
        return data

    # ------------------------------------------------------------------
    # 3) 关单
    # ------------------------------------------------------------------
    def close_order(self, out_trade_no: str) -> None:
        path = f"/v3/pay/transactions/out-trade-no/{out_trade_no}/close"
        self.request("POST", path, json_body={"mchid": self.creds.mch_id})

    # ------------------------------------------------------------------
    # 4) 退款
    # ------------------------------------------------------------------
    def refund(
        self,
        *,
        out_trade_no: str,
        out_refund_no: str,
        refund_fee: int,
        total_fee: int,
        reason: str = "用户取消预约",
        transaction_id: Optional[str] = None,
    ) -> dict:
        payload: dict[str, Any] = {
            "out_refund_no": out_refund_no,
            "reason": (reason or "退款")[:80],
            "notify_url": self.creds.refund_notify_url,
            "amount": {
                "refund": int(refund_fee),
                "total": int(total_fee),
                "currency": "CNY",
            },
        }
        if transaction_id:
            payload["transaction_id"] = transaction_id
        else:
            payload["out_trade_no"] = out_trade_no
        _, data = self.request("POST", "/v3/refund/domestic/refunds", json_body=payload)
        if not isinstance(data, dict):
            raise WeChatPayV3Error("退款返回异常", body=str(data))
        return data

    def query_refund(self, out_refund_no: str) -> dict:
        path = f"/v3/refund/domestic/refunds/{out_refund_no}"
        _, data = self.request("GET", path)
        if not isinstance(data, dict):
            raise WeChatPayV3Error("退款查单返回异常", body=str(data))
        return data

    # ------------------------------------------------------------------
    # 5) 回调验签 + 解密
    # ------------------------------------------------------------------
    def verify_notification_signature(
        self,
        *,
        timestamp: str,
        nonce: str,
        body: str,
        signature: str,
        serial: str,
    ) -> bool:
        # 官方签名探测流量：必须以验签失败应答，不可当成功处理
        if (signature or "").startswith("WECHATPAY/SIGNTEST/"):
            return False
        if serial and serial != self.creds.wechat_pay_public_key_id:
            # 当前仅支持微信支付公钥验签；平台证书模式可在此扩展
            pass
        message = f"{timestamp}\n{nonce}\n{body}\n"
        try:
            self.wechat_public_key.verify(
                base64.b64decode(signature),
                message.encode("utf-8"),
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return True
        except Exception:
            return False

    def decrypt_notification_resource(self, resource: dict) -> dict:
        """AEAD_AES_256_GCM 解密回调 resource。"""
        ciphertext = base64.b64decode(resource["ciphertext"])
        nonce = resource["nonce"].encode("utf-8")
        associated_data = (resource.get("associated_data") or "").encode("utf-8")
        key = self.creds.api_v3_key.encode("utf-8")
        if len(key) != 32:
            raise WeChatPayV3Error("APIv3 密钥必须为 32 字节")
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data)
        return json.loads(plaintext.decode("utf-8"))


def get_wechat_pay_client() -> WeChatPayV3Client:
    return WeChatPayV3Client(pay_credentials)
