import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

export interface PatientOrder {
  Id: number
  OutTradeNo: string
  Status: string
  Description?: string
  TotalFee: number
  CreatedAt: string
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
  proxyAgreementLabel?: string | null
}

/** 上线真实支付：在 .env 设置 VITE_ENABLE_REAL_PAY=true */
export const useRealWechatPay = () => import.meta.env.VITE_ENABLE_REAL_PAY === 'true'

export function isFreeOrderFee(cents?: number | null) {
  return cents != null && !Number.isNaN(Number(cents)) && Number(cents) <= 0
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

async function syncOrderAfterPay(orderId: number | string): Promise<void> {
  try {
    await httpV2.post(API_ENDPOINTS.payment.syncOrder, { order_id: Number(orderId) })
  } catch {
    /* 回调与轮询兜底，查单失败不阻断前端 */
  }
}

async function confirmFreeOrder(orderId: number): Promise<{ ok: boolean; msg?: string }> {
  uni.showLoading({ title: '确认中...' })
  try {
    const orderRes = await httpV2.post(API_ENDPOINTS.payment.payOrder, { order_id: orderId })
    uni.hideLoading()
    if (orderRes.code !== 0 || !orderRes.data) {
      return { ok: false, msg: orderRes.msg || '确认失败' }
    }
    const payParams = (orderRes.data as any)?.pay_params || (orderRes.data as any)?.payParams
    if (isFreePayParams(payParams)) {
      return { ok: true }
    }
    return { ok: false, msg: orderRes.msg || '免费单确认失败' }
  } catch (e: any) {
    uni.hideLoading()
    return { ok: false, msg: e?.message || '确认失败' }
  }
}

export async function executeOrderPayment(
  orderId: number,
  options?: { totalFeeCents?: number },
): Promise<{ ok: boolean; msg?: string }> {
  if (isFreeOrderFee(options?.totalFeeCents)) {
    return confirmFreeOrder(orderId)
  }

  if (!useRealWechatPay()) {
    uni.showLoading({ title: '支付中...' })
    try {
      const res = await httpV2.post(API_ENDPOINTS.payment.simulatePayOrder, { order_id: orderId })
      uni.hideLoading()
      if (res.code !== 0) {
        return { ok: false, msg: res.msg || '支付失败' }
      }
      return { ok: true }
    } catch (e: any) {
      uni.hideLoading()
      return { ok: false, msg: e?.message || '支付失败' }
    }
  }

  uni.showLoading({ title: '正在下单...' })
  try {
    const orderRes = await httpV2.post(API_ENDPOINTS.payment.payOrder, { order_id: orderId })
    uni.hideLoading()
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
    uni.hideLoading()
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

export const expireHintText = (expiresAt?: string) => {
  if (!expiresAt) return ''
  const end = new Date(expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T')).getTime()
  const left = Math.max(0, Math.floor((end - Date.now()) / 60000))
  if (left <= 0) return '订单即将过期，请尽快支付'
  return `请在 ${left} 分钟内完成支付，逾期将自动取消`
}
