"""预约/支付流程里需要被区别对待的业务异常。

两者都继承 ValueError，现有 ``except ValueError`` 的接口行为（HTTP 400 + 文案）不变；
支付同步逻辑据此区分"稍后重试"与"确实无法履约"，避免把暂时性失败当成要退款。
"""


class BookingBusyError(ValueError):
    """并发锁等待超时等暂时性失败：稍后重试即可，不代表订单无法履约。"""


class OrderPaymentConflictError(ValueError):
    """取消待支付订单时发现微信侧已收款或仍在支付中：拒绝取消，交给支付同步处理。"""
