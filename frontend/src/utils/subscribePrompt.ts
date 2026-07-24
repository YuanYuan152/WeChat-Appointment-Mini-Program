/**
 * 咨询师 / 管理工作台订阅授权：
 * 必须弹出微信官方 requestSubscribeMessage（与完善资料页相同形式），
 * 禁止 uni.showModal「开启服务通知」等自定义中间层。
 *
 * 用法：在业务按钮 @tap 回调开头同步调用 tryOfficialRoleSubscribeInGesture，
 * 页面 onMounted/onShow 里 refreshSubscribeHint 预取（排期场景即使 hint 未就绪也会强制弹）。
 */

import { MessageApi, type SubscribeHint } from '@/apis/message'
import {
  requestOfficialSubscribeInGesture,
  ROLE_EVENT_KEYS,
} from '@/utils/subscribeMessage'
import { getStoredRole } from '@/utils/session'

export type SubscribePromptKind = 'schedule' | 'workbench'

let cachedHint: SubscribeHint | null = null
let prompting = false

export async function refreshSubscribeHint(): Promise<SubscribeHint> {
  cachedHint = await MessageApi.getSubscribeHint()
  return cachedHint
}

export function shouldPromptSubscribe(kind: SubscribePromptKind): boolean {
  if (!cachedHint) return false
  if (kind === 'schedule') {
    return !!(
      cachedHint.showScheduleSubscribe ||
      cachedHint.needRoleSubscribeGuide ||
      cachedHint.showLoginSubscribe
    )
  }
  return !!(
    cachedHint.showWorkbenchSubscribe ||
    cachedHint.needRoleSubscribeGuide ||
    cachedHint.showLoginSubscribe
  )
}

function eventKeysForKind(kind: SubscribePromptKind): string[] {
  const role = cachedHint?.role || getStoredRole() || 'Patient'
  if (kind === 'schedule') {
    return ROLE_EVENT_KEYS.Counselor || ['APPOINTMENT_REMIND']
  }
  if (kind === 'workbench') {
    const staffKeys = ROLE_EVENT_KEYS[role]
    if (staffKeys?.length) return staffKeys
    return ROLE_EVENT_KEYS.Assistant
  }
  const fromRole = ROLE_EVENT_KEYS[role]
  if (fromRole?.length) return fromRole
  if (cachedHint?.eventKeys?.length) return cachedHint.eventKeys
  return ROLE_EVENT_KEYS.Patient
}

/**
 * 必须在用户点击手势内同步调用（不可先 await 网络）。
 *
 * 排期（schedule）：始终调起官方框（与来访支付续额度一致），
 * 避免真机 trigger=login、hint 未返回时漏弹。
 * 工作台（workbench）：hint 需要时再弹。
 */
export function tryOfficialRoleSubscribeInGesture(kind: SubscribePromptKind): Promise<void> {
  if (prompting) return Promise.resolve()

  const forceSchedule = kind === 'schedule'
  if (!forceSchedule && !shouldPromptSubscribe(kind)) {
    return Promise.resolve()
  }

  prompting = true
  const keys = eventKeysForKind(kind)

  return requestOfficialSubscribeInGesture(keys)
    .then(async () => {
      try {
        await refreshSubscribeHint()
      } catch {
        /* ignore */
      }
    })
    .finally(() => {
      prompting = false
    })
}

/**
 * @deprecated 业务成功后异步弹自定义 Modal 已废弃。
 */
export async function maybePromptRoleSubscribe(_kind: SubscribePromptKind): Promise<void> {
  return
}
