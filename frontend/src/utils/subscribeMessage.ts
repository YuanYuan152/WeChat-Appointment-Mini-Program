/**
 * 微信服务通知（订阅消息）封装
 * 必须在用户点击手势回调中同步调用 uni.requestSubscribeMessage（不可先 await 网络）
 */

import { MessageApi } from '@/apis/message'

/** 与后端 wechat_subscribe_service.ROLE_EVENT_KEYS 保持一致 */
export const ROLE_EVENT_KEYS: Record<string, string[]> = {
  // 注册保存昵称时一次授权：咨询提醒 + 预约成功（最多 3 个）
  Patient: ['APPOINTMENT_REMIND', 'APPOINTMENT_OK'],
  Tester: ['APPOINTMENT_REMIND', 'APPOINTMENT_OK'],
  Counselor: ['APPOINTMENT_REMIND'],
  Assistant: ['STAFF_APPROVAL_PENDING'],
  Ops: ['STAFF_APPROVAL_PENDING'],
  Admin: ['STAFF_APPROVAL_PENDING'],
}

export const DEFAULT_ONBOARDING_EVENT_KEYS = ROLE_EVENT_KEYS.Patient

/** 支付成功页可再次拉预约成功（一次性订阅用完后需在支付确认点击时重授） */
export const BOOKING_SUCCESS_EVENT_KEYS = ['APPOINTMENT_OK']

/**
 * 公众平台真实模板 ID（与 seed_subscribe_templates.py 一致）
 * 用于预取失败时仍能立刻调起官方授权框，避免依赖网络后再弹窗。
 */
export const FALLBACK_TEMPLATE_BY_EVENT: Record<string, string> = {
  APPOINTMENT_OK: 'eywQth4gdVTtfS1nlH8Do6IfsPizWlnWSN4jk6p4KjQ',
  APPOINTMENT_REMIND: '_F8vuT9qgssNOC3Bq0x5Dg9--TKO7znDJFe99m_aeSM',
  STAFF_APPROVAL_PENDING: 'LlsSPQqaMgrySH-Hh7Q3JtshNLPzD5etdEKEO822QlI',
}

export type SubscribeResultMap = Record<string, string>

function isRealTmplId(id: string): boolean {
  return !!id && !id.startsWith('mock_') && !id.includes('_MOCK') && !id.includes('MOCK')
}

function tmplIdsForKeys(eventKeys: string[], fromApi: string[] = []): string[] {
  const fromFallback = eventKeys
    .map((k) => FALLBACK_TEMPLATE_BY_EVENT[k])
    .filter((id): id is string => !!id && isRealTmplId(id))
  const merged = [...fromApi.filter(isRealTmplId), ...fromFallback]
  return [...new Set(merged)].slice(0, 3)
}

/** 页面 onMounted 预取，保证点击时无需再等网络 */
export async function prefetchSubscribeTmplIds(eventKeys: string[]): Promise<string[]> {
  const keys = (eventKeys || []).filter(Boolean)
  try {
    const { tmplIds } = await MessageApi.getTemplates(keys)
    return tmplIdsForKeys(keys, tmplIds)
  } catch {
    return tmplIdsForKeys(keys)
  }
}

export function requestSubscribe(tmplIds: string[]): Promise<SubscribeResultMap> {
  return new Promise((resolve, reject) => {
    if (!tmplIds.length) {
      resolve({})
      return
    }
    const ids = tmplIds.slice(0, 3)
    uni.requestSubscribeMessage({
      tmplIds: ids,
      success: (res: any) => {
        const out: SubscribeResultMap = {}
        ids.forEach((id) => {
          out[id] = String(res?.[id] || 'reject')
        })
        resolve(out)
      },
      fail: (err) => reject(err),
    })
  })
}

function hasAccepted(results: SubscribeResultMap): boolean {
  return Object.values(results).some((v) => v === 'accept')
}

/**
 * 打开微信「通知管理 / 订阅消息」设置页
 */
export function openSubscribeSetting(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    uni.openSetting({
      withSubscriptions: true,
      success: (res) => resolve(res),
      fail: (err) => reject(err),
    } as any)
  })
}

/**
 * 在用户点击回调里立刻调起官方授权框（图二），再把结果存后端。
 * @param eventKeys 业务事件
 * @param prefetchedTmplIds 建议 onMounted 预取后传入，避免点击时再请求接口
 */
export async function requestAndSaveSubscribe(
  eventKeys: string[],
  prefetchedTmplIds?: string[],
): Promise<{
  accepted: boolean
  results: SubscribeResultMap
  tmplIds: string[]
}> {
  const keys = (eventKeys || []).filter(Boolean)
  let realIds = (prefetchedTmplIds || []).filter(isRealTmplId).slice(0, 3)

  // 无预取时尽量用兜底真实 ID 立刻弹窗（禁止先 await 接口，否则会丢失点击手势）
  if (!realIds.length) {
    realIds = tmplIdsForKeys(keys)
  }

  let results: SubscribeResultMap = {}
  if (realIds.length) {
    try {
      results = await requestSubscribe(realIds)
    } catch (e: any) {
      console.warn('[subscribe] requestSubscribeMessage fail', e)
      const msg = String(e?.errMsg || e?.message || '')
      if (msg.includes('cancel') || msg.includes('deny')) {
        results = Object.fromEntries(realIds.map((id) => [id, 'reject']))
      } else {
        // 手势失效等：仍尝试一次（部分基础库在短 await 后仍可用）
        try {
          const { tmplIds } = await MessageApi.getTemplates(keys)
          realIds = tmplIdsForKeys(keys, tmplIds)
          if (realIds.length) {
            results = await requestSubscribe(realIds)
          }
        } catch (e2) {
          console.warn('[subscribe] retry fail', e2)
          results = Object.fromEntries(realIds.map((id) => [id, 'reject']))
        }
      }
    }
  } else {
    uni.showToast({ title: '暂无可用通知模板', icon: 'none' })
  }

  const accepted = hasAccepted(results)
  await MessageApi.saveSubscribePreference({
    accepted,
    results,
    event_keys: keys,
  })

  return { accepted, results, tmplIds: realIds }
}

/**
 * 在用户点击手势内同步调用微信官方订阅授权（与完善资料页相同弹窗）。
 * 一次性模板发完后，必须在下一次业务点击（如确认支付）再次调用才能再获额度。
 * 禁止先 await 网络再调用，否则官方窗可能出不来。
 */
export function requestOfficialSubscribeInGesture(
  eventKeys: string[] = DEFAULT_ONBOARDING_EVENT_KEYS,
): Promise<{ accepted: boolean; results: SubscribeResultMap; tmplIds: string[] }> {
  const keys = (eventKeys || []).filter(Boolean)
  const tmplIds = tmplIdsForKeys(keys)

  return new Promise((resolve) => {
    if (!tmplIds.length) {
      resolve({ accepted: false, results: {}, tmplIds: [] })
      return
    }

    uni.requestSubscribeMessage({
      tmplIds,
      success: async (res: any) => {
        const results: SubscribeResultMap = {}
        tmplIds.forEach((id) => {
          results[id] = String(res?.[id] || 'reject')
        })
        const accepted = hasAccepted(results)
        try {
          await MessageApi.saveSubscribePreference({
            accepted,
            results,
            event_keys: keys,
          })
        } catch (e) {
          console.warn('[subscribe] save preference fail', e)
        }
        resolve({ accepted, results, tmplIds })
      },
      fail: (err) => {
        console.warn('[subscribe] requestSubscribeMessage fail', err)
        resolve({
          accepted: false,
          results: Object.fromEntries(tmplIds.map((id) => [id, 'reject'])),
          tmplIds,
        })
      },
    })
  })
}
