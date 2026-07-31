"""
微信支付凭证加载器 —— 只从 .env / 环境变量读取，不在代码中存放任何密钥明文。

用法：
    from wechat_pay_credentials import pay_credentials

真实值请只写在 backend-python/.env（或 .env.production），经 config.Settings 加载。

官方开发指引：https://pay.weixin.qq.com/doc/v3/merchant/4012791911
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent

# 仅用于识别「未配置 / 占位」——不含真实密钥内容
_PLACEHOLDER_RE = re.compile(
    r"(?i)^(your[_-].*|.*your-domain\.com.*|.*x{4,}.*|wx_mock.*|1900000001)$"
)


def _looks_like_placeholder(value: str) -> bool:
    text = (value or "").strip()
    if not text:
        return True
    if "your-domain.com" in text.lower():
        return True
    return bool(_PLACEHOLDER_RE.match(text))


@dataclass(frozen=True)
class WeChatPayCredentials:
    """运行时凭证快照（全部来自环境配置）。"""

    appid: str
    mch_id: str
    api_v3_key: str
    mch_cert_serial: str
    mch_private_key_path: str
    wechat_pay_public_key_id: str
    wechat_pay_public_key_path: str
    notify_url: str
    refund_notify_url: str
    api_v2_key: str  # 旧 V2 兼容字段，V3 不使用

    def is_real_configured(self) -> bool:
        """全部关键项已配置且证书可用时，才走官方 V3 接口。"""
        for value in (
            self.appid,
            self.mch_id,
            self.api_v3_key,
            self.mch_cert_serial,
            self.wechat_pay_public_key_id,
            self.notify_url,
            self.mch_private_key_path,
            self.wechat_pay_public_key_path,
        ):
            if _looks_like_placeholder(value):
                return False
        if len(self.api_v3_key) < 32:
            return False

        private_key = Path(self.mch_private_key_path)
        public_key = Path(self.wechat_pay_public_key_path)
        if not private_key.is_file() or private_key.stat().st_size < 100:
            return False
        if not public_key.is_file() or public_key.stat().st_size < 100:
            return False
        # 仓库占位 PEM 带此标记，视为未配置真实证书
        try:
            if b"MOCK_WECHAT_PAY" in private_key.read_bytes():
                return False
        except OSError:
            return False
        return True


def _from_settings(name: str) -> str:
    """优先进程环境变量，其次 pydantic Settings（读取 .env）。默认空字符串，不写死密钥。"""
    env_val = os.getenv(name)
    if env_val is not None and env_val.strip():
        return env_val.strip()
    from config import settings

    value = getattr(settings, name, None)
    if value is None:
        return ""
    return str(value).strip()


def _resolve_path(raw: str) -> str:
    if not raw:
        return ""
    path = Path(raw)
    if path.is_absolute():
        return str(path)
    return str((_BASE_DIR / path).resolve())


def load_pay_credentials() -> WeChatPayCredentials:
    """从 .env / 环境变量加载支付凭证。"""
    return WeChatPayCredentials(
        appid=_from_settings("WECHAT_APPID"),
        mch_id=_from_settings("WECHAT_PAY_MCH_ID"),
        api_v3_key=_from_settings("WECHAT_PAY_API_V3_KEY"),
        mch_cert_serial=_from_settings("WECHAT_PAY_MCH_CERT_SERIAL"),
        mch_private_key_path=_resolve_path(
            _from_settings("WECHAT_PAY_MCH_PRIVATE_KEY_PATH")
        ),
        wechat_pay_public_key_id=_from_settings("WECHAT_PAY_PUBLIC_KEY_ID"),
        wechat_pay_public_key_path=_resolve_path(
            _from_settings("WECHAT_PAY_PUBLIC_KEY_PATH")
        ),
        notify_url=_from_settings("WECHAT_PAY_NOTIFY_URL"),
        refund_notify_url=_from_settings("WECHAT_PAY_REFUND_NOTIFY_URL"),
        api_v2_key=_from_settings("WECHAT_PAY_KEY"),
    )


pay_credentials = load_pay_credentials()


def reload_pay_credentials() -> WeChatPayCredentials:
    """测试或热更新 env 后刷新单例。"""
    global pay_credentials
    pay_credentials = load_pay_credentials()
    return pay_credentials
