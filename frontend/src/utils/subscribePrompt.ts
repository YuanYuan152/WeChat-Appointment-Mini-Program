/**
 * 按角色场景弹出服务通知订阅：
 * - schedule：咨询师排期成功后
 * - workbench：助理/主任/管理员工作台首次操作成功后
 * - login：中途改角色后下次登录（由登录页跳转订阅设置页处理）
 *
 * 微信要求 requestSubscribeMessage 必须由用户点击触发，故用 Modal 确认按钮承接。
 */

import { MessageApi } from '@/apis/message'
import { requestAndSaveSubscribe, ROLE_EVENT_KEYS } from '@/utils/subscribeMessage'

export type SubscribePromptKind = 'schedule' | 'workbench'

let prompting = false

function promptCopy(kind: SubscribePromptKind): { title: string; content: string } {
  if (kind === 'schedule') {
    return {
      title: '开启服务通知',
      content: '排期已保存。开启后可及时收到新预约、取消预约等服务通知。',
    }
  }
  return {
    title: '开启服务通知',
    content: '操作已成功。开启后可及时收到待审批等服务通知。',
  }
}

/**
 * 业务成功后调用：若后端标记需要本场景订阅，则弹出确认框再拉起微信订阅。
 */
export async function maybePromptRoleSubscribe(kind: SubscribePromptKind): Promise<void> {
  if (prompting) return
  prompting = true
  try {
    const hint = await MessageApi.getSubscribeHint()
    const shouldShow =
      kind === 'schedule' ? hint.showScheduleSubscribe : hint.showWorkbenchSubscribe
    if (!shouldShow) return

    const { title, content } = promptCopy(kind)
    await new Promise<void>((resolve) => {
      uni.showModal({
        title,
        content,
        confirmText: '去开启',
        cancelText: '暂不',
        success: async (res) => {
          try {
            if (res.confirm) {
              const role = hint.role || 'Patient'
              const keys = ROLE_EVENT_KEYS[role] || hint.eventKeys
              await requestAndSaveSubscribe(keys)
            } else {
              await MessageApi.ackSubscribePrompt()
            }
          } catch (e) {
            console.warn('[subscribePrompt]', e)
            try {
              await MessageApi.ackSubscribePrompt()
            } catch {
              /* ignore */
            }
          } finally {
            resolve()
          }
        },
        fail: () => resolve(),
      })
    })
  } catch (e) {
    console.warn('[subscribePrompt] hint fail', e)
  } finally {
    prompting = false
  }
}
