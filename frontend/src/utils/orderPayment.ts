import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { formatChinaDateTime } from '@/utils/dateTime'

export interface PatientOrder {
  Id: number
  OutTradeNo: string
  Status: string
  Description?: string
  TotalFee: number
  CreatedAt: string
  PaidAt?: string | null
  ExpiresAt?: string
  counselorId?: number
  counselorName?: string
  startTime?: string
  endTime?: string
  centerId?: string
  centerName?: string
  roomName?: string
  needsContractAgreement?: boolean
  contractAgreementSigned?: boolean
  isProxyOrder?: boolean
  proxyAgreementIsAdult?: boolean | null
  proxyAgreementType?: string | null
  proxyAgreementLabel?: string | null
  /** 助理/管理员推送的线下支付单：来访确认即可，不走在线支付 */
  isOfflinePaymentOrder?: boolean
  isConfirmOrder?: boolean
  TransactionId?: string | null
}

/** 列表/详情展示用时间：已支付（含已退款）优先支付时间 */
export function orderDisplayTime(order: Pick<PatientOrder, 'Status' | 'CreatedAt' | 'PaidAt'>) {
  if ((order.Status === 'PAID' || order.Status === 'REFUNDED') && order.PaidAt) {
    return order.PaidAt
  }
  return order.CreatedAt
}

/** 订单付款/创建时间：统一按北京时间展示 */
export function formatOrderClock(value?: string | null) {
  return formatChinaDateTime(value)
}

/** 上线真实支付：在 .env 设置 VITE_ENABLE_REAL_PAY=true */
export const useRealWechatPay = () => import.meta.env.VITE_ENABLE_REAL_PAY === 'true'

export function isFreeOrderFee(cents?: number | null) {
  return cents != null && !Number.isNaN(Number(cents)) && Number(cents) <= 0
}

export function isOfflinePaymentOrder(order?: { isOfflinePaymentOrder?: boolean; TransactionId?: string | null } | null) {
  if (Boolean(order?.isOfflinePaymentOrder)) return true
  // 确认后交易号为 OFFLINE_。远程接口未带回标记时，仍按线下支付单显示「已确认」。
  return String(order?.TransactionId || '').startsWith('OFFLINE_')
}

/** 免费单和线下支付单都是确认预约，不发起微信支付。 */
export function isConfirmInsteadOfPay(order?: { TotalFee?: number | null; isOfflinePaymentOrder?: boolean; isConfirmOrder?: boolean } | null) {
  return Boolean(order?.isConfirmOrder) || isFreeOrderFee(order?.TotalFee) || isOfflinePaymentOrder(order)
}

/** 来访订单状态：免费单、线下支付单确认后显示「已确认」，只有在线付费单显示「已支付」。 */
export function orderStatusLabel(order: Pick<PatientOrder, 'Status' | 'TotalFee' | 'isOfflinePaymentOrder'>) {
  if (order.Status === 'PENDING' && isConfirmInsteadOfPay(order)) return '待确认'
  if (isConfirmInsteadOfPay(order) && (order.Status === 'PAID' || order.Status === 'REFUNDED')) {
    return order.Status === 'REFUNDED' ? '已取消' : '已确认'
  }
  const map: Record<string, string> = {
    PENDING: '待支付',
    PAID: '已支付',
    CANCELLED: '已取消',
    REFUNDED: '已退款',
  }
  return map[order.Status] || order.Status
}

/** 订单金额展示：0 元显示「免费」 */
export function formatOrderFeeCents(cents?: number | null) {
  if (cents == null || Number.isNaN(Number(cents))) return '—'
  if (Number(cents) <= 0) return '免费'
  return `¥${(Number(cents) / 100).toFixed(2)}`
}

function isFreePayParams(payParams: any) {
  return Boolean(payParams?.free || payParams?.already_paid || payParams?.alreadyPaid)
}

function safeShowLoading(title: string) {
  try {
    uni.showLoading({ title })
  } catch (error) {
    // 原生订阅弹窗关闭期间 loading 异常不能阻断支付请求。
    console.warn('[payment] showLoading fail', error)
  }
}

function safeHideLoading() {
  try {
    uni.hideLoading()
  } catch (error) {
    console.warn('[payment] hideLoading fail', error)
  }
}

async function syncOrderAfterPay(orderId: number | string): Promise<void> {
  try {
    await httpV2.post(API_ENDPOINTS.payment.syncOrder, { order_id: Number(orderId) })
  } catch {
    /* 回调与轮询兜底，查单失败不阻断前端 */
  }
}

async function confirmFreeOrder(orderId: number): Promise<{ ok: boolean; msg?: string }> {
  safeShowLoading('确认中...')
  try {
    const orderRes = await httpV2.post(API_ENDPOINTS.payment.confirmOrder, { order_id: orderId })
    safeHideLoading()
    if (orderRes.code !== 0 || !orderRes.data) {
      return { ok: false, msg: orderRes.msg || '确认失败' }
    }
    const payParams = (orderRes.data as any)?.pay_params || (orderRes.data as any)?.payParams
    if (isFreePayParams(payParams)) {
      return { ok: true }
    }
    return { ok: false, msg: orderRes.msg || '免费单确认失败' }
  } catch (e: any) {
    safeHideLoading()
    return { ok: false, msg: e?.message || '确认失败' }
  }
}

export async function executeOrderPayment(
  orderId: number,
  options?: { totalFeeCents?: number; offlinePayment?: boolean },
): Promise<{ ok: boolean; msg?: string }> {
  if (isFreeOrderFee(options?.totalFeeCents) || options?.offlinePayment) {
    return confirmFreeOrder(orderId)
  }

  if (!useRealWechatPay()) {
    safeShowLoading('支付中...')
    try {
      const res = await httpV2.post(API_ENDPOINTS.payment.simulatePayOrder, { order_id: orderId })
      safeHideLoading()
      if (res.code !== 0) {
        return { ok: false, msg: res.msg || '支付失败' }
      }
      return { ok: true }
    } catch (e: any) {
      safeHideLoading()
      return { ok: false, msg: e?.message || '支付失败' }
    }
  }

  safeShowLoading('正在下单...')
  try {
    const orderRes = await httpV2.post(API_ENDPOINTS.payment.payOrder, { order_id: orderId })
    safeHideLoading()
    if (orderRes.code !== 0 || !orderRes.data) {
      return { ok: false, msg: orderRes.msg || '下单失败' }
    }
    const payParams = (orderRes.data as any)?.pay_params || (orderRes.data as any)?.payParams
    if (isFreePayParams(payParams)) {
      return { ok: true }
    }
    if (!payParams?.appId) {
      return { ok: false, msg: '未获取到支付参数' }
    }
    return await new Promise(resolve => {
      uni.requestPayment({
        provider: 'wxpay',
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType || 'RSA',
        paySign: payParams.paySign,
        success: async () => {
          // 官方指引：收银台返回后应查单确认
          await syncOrderAfterPay(orderId)
          resolve({ ok: true })
        },
        fail: () => resolve({ ok: false, msg: '支付取消或失败' }),
      } as any)
    })
  } catch (e: any) {
    safeHideLoading()
    return { ok: false, msg: e?.message || '支付异常' }
  }
}

export const formatOrderTime = (start?: string, end?: string) => {
  if (!start) return '—'
  const s = start.replace('T', ' ').slice(0, 16)
  if (!end) return s
  const endClock = end.replace('T', ' ').slice(11, 16)
  return `${s} – ${endClock}`
}

export const expireHintText = (expiresAt?: string, action: '支付' | '确认' = '支付') => {
  if (!expiresAt) return ''
  const end = new Date(expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T')).getTime()
  const left = Math.max(0, Math.floor((end - Date.now()) / 60000))
  if (left <= 0) return `订单即将过期，请尽快${action}`
  return `请在 ${left} 分钟内完成${action}，逾期将自动取消`
}
