"""微信支付回调与对账计数。日志行带指标名，便于检索。"""

from __future__ import annotations

import logging
import threading

logger = logging.getLogger(__name__)

METRIC_NAMES = (
    "callback_401",
    "callback_204",
    "signtest",
    "close_already_paid",
    "pay_desync",
    # 微信已收款但预约未能生效，已转人工处理（不会自动退款）
    "pay_needs_review",
)

_lock = threading.Lock()
_counts = {name: 0 for name in METRIC_NAMES}


def inc(name: str) -> int:
    if name not in _counts:
        return 0
    with _lock:
        _counts[name] += 1
        value = _counts[name]
    logger.info("%s count=%s", name, value)
    return value


def snapshot() -> dict[str, int]:
    with _lock:
        return dict(_counts)


def reset() -> None:
    with _lock:
        for name in _counts:
            _counts[name] = 0
