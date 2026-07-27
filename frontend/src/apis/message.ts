/**
 * 站内消息 / 微信服务通知（订阅消息）API
 */

import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

export interface SubscribeTemplateItem {
  eventKey: string
  templateId: string
  description?: string
}

export interface SubscribeTemplatesResult {
  tmplIds: string[]
  items: SubscribeTemplateItem[]
}

export interface SubscribeHint {
  trigger?: string | null
  showLoginSubscribe: boolean
  showScheduleSubscribe: boolean
  showWorkbenchSubscribe: boolean
  needRoleSubscribeGuide?: boolean
  eventKeys: string[]
  role?: string
}

export interface SubscribeStatusItem {
  eventKey: string
  label: string
  enabled: boolean
  isMock: boolean
  templateId?: string
}

export class MessageApi {
  static async getTemplates(eventKeys?: string[]): Promise<SubscribeTemplatesResult> {
    const res = await httpV2.get<SubscribeTemplatesResult>(
      API_ENDPOINTS.message.templates,
      eventKeys?.length ? { event_keys: eventKeys.join(',') } : undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      return {
        tmplIds: res.data.tmplIds || [],
        items: res.data.items || [],
      }
    }
    return { tmplIds: [], items: [] }
  }

  static async subscribe(eventKey: string, templateId?: string, payload?: Record<string, unknown>) {
    const res = await httpV2.post(
      API_ENDPOINTS.message.subscribe,
      { event_key: eventKey, template_id: templateId, payload },
      { showLoading: false, showError: false },
    )
    if (res.code === 0) return res.data
    throw new Error(res.msg || '记录订阅失败')
  }

  static async saveSubscribePreference(payload: {
    accepted: boolean
    results?: Record<string, string>
    event_keys?: string[]
  }) {
    const res = await httpV2.post(
      API_ENDPOINTS.message.subscribePreference,
      payload,
      { showLoading: false, showError: false },
    )
    if (res.code === 0) return res.data
    throw new Error(res.msg || '保存服务通知偏好失败')
  }

  /** 业务场景是否需要弹出订阅引导 */
  static async getSubscribeHint(): Promise<SubscribeHint> {
    const res = await httpV2.get<SubscribeHint>(
      API_ENDPOINTS.message.subscribeHint,
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      return {
        trigger: res.data.trigger,
        showLoginSubscribe: !!res.data.showLoginSubscribe,
        showScheduleSubscribe: !!res.data.showScheduleSubscribe,
        showWorkbenchSubscribe: !!res.data.showWorkbenchSubscribe,
        needRoleSubscribeGuide: !!res.data.needRoleSubscribeGuide,
        eventKeys: res.data.eventKeys || ['APPOINTMENT_OK', 'APPOINTMENT_REMIND', 'ORDER_STATUS'],
        role: res.data.role,
      }
    }
    return {
      showLoginSubscribe: false,
      showScheduleSubscribe: false,
      showWorkbenchSubscribe: false,
      needRoleSubscribeGuide: false,
      eventKeys: ['APPOINTMENT_OK', 'APPOINTMENT_REMIND', 'ORDER_STATUS'],
    }
  }

  /** 用户点「暂不」后清除弹窗标记 */
  static async ackSubscribePrompt(): Promise<void> {
    await httpV2.post(
      API_ENDPOINTS.message.subscribeAck,
      {},
      { showLoading: false, showError: false },
    )
  }

  /** 订阅管理页：当前角色各事件授权状态 */
  static async getSubscribeStatus(): Promise<{ items: SubscribeStatusItem[]; hint?: string }> {
    const res = await httpV2.get<{ items: SubscribeStatusItem[]; hint?: string }>(
      API_ENDPOINTS.message.subscribeStatus,
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      return {
        items: res.data.items || [],
        hint: res.data.hint || '',
      }
    }
    return { items: [], hint: '' }
  }

  /** 关闭某事件本端推送（不影响微信侧开关，仅后端不再推） */
  static async toggleSubscribe(eventKey: string, enabled: boolean): Promise<void> {
    const res = await httpV2.post(
      API_ENDPOINTS.message.subscribeToggle,
      { event_key: eventKey, enabled },
      { showLoading: false, showError: false },
    )
    if (res.code !== 0) {
      throw new Error(res.msg || '更新订阅状态失败')
    }
  }

  /** 授权后补发服务通知到微信「服务通知」 */
  static async pushSubscribe(eventKey: string, orderId?: number) {
    const res = await httpV2.post<{ ok?: boolean; reason?: string; message?: string }>(
      API_ENDPOINTS.message.subscribePush,
      { event_key: eventKey, order_id: orderId },
      { showLoading: false, showError: false },
    )
    if (res.code === 0) return res.data
    throw new Error(res.msg || '补发服务通知失败')
  }
}
