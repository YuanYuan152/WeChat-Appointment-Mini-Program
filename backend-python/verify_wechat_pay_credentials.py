"""
快速校验微信支付凭证（含 APIv3 密钥）。

原理：
1. 用商户私钥签名请求 GET /v3/certificates（验证 mchid / 证书序列号 / 私钥）
2. 用 APIv3 密钥 AES-GCM 解密返回的证书密文（验证 APIv3 密钥）

用法（在 backend-python 目录）：
  python verify_wechat_pay_credentials.py

不打印任何密钥明文。
"""

from __future__ import annotations

import base64
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from wechat_pay_credentials import reload_pay_credentials
from wechat_pay_v3 import WeChatPayV3Client, WeChatPayV3Error


def main() -> int:
    creds = reload_pay_credentials()
    print("=== 微信支付凭证自检 ===")
    print(f"mch_id        : {creds.mch_id or '(空)'}")
    print(f"appid         : {(creds.appid[:8] + '...') if creds.appid else '(空)'}")
    print(f"api_v3_key_len: {len(creds.api_v3_key)}（必须为 32）")
    print(f"cert_serial   : {(creds.mch_cert_serial[:8] + '...') if creds.mch_cert_serial else '(空)'}")
    print(f"private_key   : {creds.mch_private_key_path}")
    print(f"public_key_id : {creds.wechat_pay_public_key_id or '(空)'}")
    print(f"is_real_ready : {creds.is_real_configured()}")
    print()

    if len(creds.api_v3_key) != 32:
        print("[FAIL] WECHAT_PAY_API_V3_KEY 长度不是 32，请到商户平台重置后原样填入（无空格换行）。")
        return 1

    client = WeChatPayV3Client(creds)
    try:
        _ = client.private_key
    except Exception as exc:
        print(f"[FAIL] 无法加载商户私钥 apiclient_key.pem: {exc}")
        return 1

    # 本机若配置了系统/环境代理，requests 可能走坏代理导致 SSLEOF；
    # 校验脚本对微信 API 强制直连。
    import os

    for key in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        os.environ.pop(key, None)
    os.environ["NO_PROXY"] = "*"
    os.environ["no_proxy"] = "*"

    try:
        # trust_env=False：忽略系统代理设置
        import requests as req_lib

        session = req_lib.Session()
        session.trust_env = False
        # 临时替换 client.request 使用的底层调用
        original_request = req_lib.request

        def _direct_request(*args, **kwargs):
            kwargs.setdefault("proxies", {"http": None, "https": None})
            return session.request(*args, **kwargs)

        req_lib.request = _direct_request  # type: ignore[assignment]
        try:
            status, data = client.request("GET", "/v3/certificates")
        finally:
            req_lib.request = original_request  # type: ignore[assignment]
    except WeChatPayV3Error as exc:
        print(f"[FAIL] 请求 /v3/certificates 失败 HTTP {exc.status_code}: {exc}")
        print("  → 通常是商户号 / API证书序列号 / apiclient_key.pem 问题，不是 APIv3 密钥。")
        return 1
    except Exception as exc:
        print(f"[FAIL] 网络或请求异常: {exc}")
        print("  → 若仍报 ProxyError，请关闭系统代理/VPN 后重试，或检查能否访问 api.mch.weixin.qq.com")
        return 1

    print(f"[OK] 签名请求成功 HTTP {status}（商户私钥 + 证书序列号基本正确）")

    items = (data or {}).get("data") if isinstance(data, dict) else None
    if not items:
        print("[WARN] 返回无平台证书列表。")
        print("  若已启用「微信支付公钥」模式，平台证书接口可能为空；")
        print("  此时请人工确认商户平台 APIv3 密钥与 .env 中 32 位字符串一致。")
        return 0

    enc = items[0].get("encrypt_certificate") or {}
    try:
        plaintext = AESGCM(creds.api_v3_key.encode("utf-8")).decrypt(
            enc["nonce"].encode("utf-8"),
            base64.b64decode(enc["ciphertext"]),
            (enc.get("associated_data") or "").encode("utf-8"),
        )
        text = plaintext.decode("utf-8")
    except Exception as exc:
        print(f"[FAIL] APIv3 密钥解密失败: {exc}")
        print("  → 请核对 WECHAT_PAY_API_V3_KEY 与商户平台「APIv3密钥」完全一致（重置后旧密钥立即失效）。")
        return 1

    if "BEGIN CERTIFICATE" not in text:
        print("[FAIL] 解密结果不像证书内容，APIv3 密钥可能不正确")
        return 1

    print("[OK] APIv3 密钥正确（证书密文解密成功）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
