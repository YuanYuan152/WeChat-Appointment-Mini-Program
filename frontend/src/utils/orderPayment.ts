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

export const useRealWechatPay = () => import.meta.env.VITE_ENABLE_REAL_PAY === 'true'

export async function executeOrderPayment(orderId: number): Promise<{ ok: boolean; msg?: string }> {
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
    if (!payParams?.appId) {
      return { ok: false, msg: '未获取到支付参数' }
    }
    return await new Promise(resolve => {
      uni.requestPayment({
        provider: 'wxpay',
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType,
        paySign: payParams.paySign,
        success: () => resolve({ ok: true }),
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
