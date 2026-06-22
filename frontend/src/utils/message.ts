export interface MessageItem {
  Id: number
  Type: string
  Title: string
  Content?: string
  RelatedType?: string
  RelatedId?: number
  IsRead: boolean
  CreatedAt: string
}

export interface MessagePayload {
  summary?: string
  detail?: Record<string, unknown>
}

export function parseMessageContent(content?: string): MessagePayload {
  if (!content) return {}
  try {
    const parsed = JSON.parse(content) as MessagePayload
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // 兼容旧版纯文本消息
  }
  return { summary: content }
}

export function isExemptionPendingMessage(item: MessageItem): boolean {
  const rt = item.RelatedType || ''
  if (rt === 'REFUND_EXEMPTION_PENDING') return true
  if (rt !== 'REFUND_EXEMPTION') return false
  const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined
  if (detail?.status === 'PENDING') return true
  if ((item.Title || '').includes('待审核')) return true
  return false
}

export function messageDisplayTitle(item: MessageItem): string {
  const rt = item.RelatedType || ''
  if (rt === 'REFUND_EXEMPTION_PENDING' || isExemptionPendingMessage(item)) {
    return '豁免申请待审核'
  }
  if (rt === 'REFUND_EXEMPTION') {
    const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined
    if (detail?.status === 'APPROVED' || detail?.approved === true) return '豁免申请已通过'
    if (detail?.status === 'REJECTED' || detail?.approved === false) return '豁免申请未通过'
    const title = item.Title || ''
    if (title.includes('未通过')) return '豁免申请未通过'
    if (title.includes('已通过')) return '豁免申请已通过'
    if (title.includes('待审核')) return '豁免申请待审核'
  }
  return item.Title || '消息'
}

export function messageSummary(item: MessageItem): string {
  const payload = parseMessageContent(item.Content)
  const detail = (payload.detail || {}) as Record<string, unknown>
  if (
    item.RelatedType === 'PATIENT_APPOINTMENT_SUCCESS'
    || item.RelatedType === 'PATIENT_APPOINTMENT_REMIND'
  ) {
    const center = (detail.centerName || detail.location) as string | undefined
    if (center && payload.summary && typeof payload.summary === 'string' && payload.summary.includes(' · ')) {
      const parts = payload.summary.split(' · ')
      if (parts.length >= 3) {
        parts[parts.length - 1] = center
        return parts.join(' · ')
      }
    }
  }
  return payload.summary || item.Content || '暂无详情'
}

export function getLeaveRequestId(item: MessageItem): number | null {
  if (item.RelatedType !== 'COUNSELOR_LEAVE') return null
  if (item.RelatedId) return item.RelatedId
  const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined
  const id = detail?.leaveRequestId
  return typeof id === 'number' ? id : id ? Number(id) : null
}

export function shouldOpenLeaveApproval(activeRole: string, item: MessageItem): boolean {
  return activeRole === 'Admin' && item.RelatedType === 'COUNSELOR_LEAVE' && !!getLeaveRequestId(item)
}

export const MESSAGE_TYPE_LABELS: Record<string, string> = {
  ORDER: '预约',
  PAYMENT: '支付',
  CONSULTATION: '咨询',
  SYSTEM: '系统',
  RISK: '风险',
  REMIND: '提醒',
}

export const RELATED_TYPE_LABELS: Record<string, string> = {
  APPOINTMENT_NEW: '新增预约',
  APPOINTMENT_CANCEL: '预约取消',
  COUNSELOR_LEAVE: '咨询师请假',
  COUNSELOR_LEAVE_SUBMITTED: '请假提交',
  COUNSELOR_LEAVE_SUCCESS: '请假成功',
  REFUND_EXEMPTION: '退款豁免',
  REFUND_EXEMPTION_PENDING: '豁免待审核',
  COUNSELOR_CONSULTATION_DONE: '咨询完成',
  COUNSELOR_CONSULTATION_REMIND: '咨询提醒',
  COUNSELOR_APPOINTMENT_NEW: '新预约',
  COUNSELOR_APPOINTMENT_CANCEL: '预约取消',
  PATIENT_NEW_ACTIVITY: '新活动',
  PATIENT_APPOINTMENT_SUCCESS: '预约成功',
  PATIENT_APPOINTMENT_REMIND: '预约提醒',
  PATIENT_LEAVE_APPROVED: '请假通知',
}

/** 咨询师消息类型：详情页不展示来访联系方式 */
export const COUNSELOR_MESSAGE_TYPES = new Set([
  'COUNSELOR_APPOINTMENT_NEW',
  'COUNSELOR_CONSULTATION_DONE',
  'COUNSELOR_CONSULTATION_REMIND',
  'COUNSELOR_APPOINTMENT_CANCEL',
  'COUNSELOR_LEAVE_SUBMITTED',
  'COUNSELOR_LEAVE_SUCCESS',
])

export const PATIENT_MESSAGE_TYPES = new Set([
  'PATIENT_NEW_ACTIVITY',
  'PATIENT_APPOINTMENT_SUCCESS',
  'PATIENT_APPOINTMENT_REMIND',
  'PATIENT_LEAVE_APPROVED',
  'REFUND_EXEMPTION',
  'REFUND_EXEMPTION_PENDING',
])

export interface MessageCategoryOption {
  value: string
  label: string
}

export function getMessageCategoriesForRole(role: string): MessageCategoryOption[] {
  const common: MessageCategoryOption[] = [
    { value: 'ALL', label: '全部' },
    { value: 'UNREAD', label: '未读' },
  ]

  if (role === 'Admin' || role === 'Ops') {
    return [
      ...common,
      { value: 'appointment_new', label: '新增预约' },
      { value: 'appointment_cancel', label: '预约取消' },
      { value: 'counselor_leave', label: '咨询师请假' },
      { value: 'exemption', label: '豁免审核' },
    ]
  }

  if (role === 'Assistant') {
    return [
      ...common,
      { value: 'appointment_new', label: '新增预约' },
      { value: 'appointment_cancel', label: '预约取消' },
      { value: 'counselor_leave', label: '咨询师请假' },
    ]
  }

  if (role === 'Counselor') {
    return [
      ...common,
      { value: 'appointment_new', label: '新预约' },
      { value: 'leave_submitted', label: '请假提交' },
      { value: 'consultation_remind', label: '咨询提醒' },
      { value: 'consultation_done', label: '咨询完成' },
      { value: 'appointment_cancel', label: '预约取消' },
    ]
  }

  return [
    ...common,
    { value: 'appointment_success', label: '预约成功' },
    { value: 'appointment_remind', label: '预约提醒' },
    { value: 'activity', label: '活动' },
    { value: 'leave_notice', label: '请假通知' },
    { value: 'exemption', label: '豁免结果' },
  ]
}

export function canSearchMessages(role: string): boolean {
  return role === 'Admin' || role === 'Assistant' || role === 'Ops'
}

export function messageCategoryLabel(item: MessageItem): string {
  const rt = item.RelatedType || ''
  if (rt === 'REFUND_EXEMPTION_PENDING' || isExemptionPendingMessage(item)) {
    return '豁免待审核'
  }
  if (rt === 'REFUND_EXEMPTION') {
    const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined
    if (detail?.status === 'APPROVED' || detail?.approved === true) return '豁免已通过'
    if (detail?.status === 'REJECTED' || detail?.approved === false) return '豁免未通过'
  }
  if (RELATED_TYPE_LABELS[rt]) return RELATED_TYPE_LABELS[rt]
  if (MESSAGE_TYPE_LABELS[item.Type]) return MESSAGE_TYPE_LABELS[item.Type]
  return item.Type || '消息'
}

export function messageSearchText(item: MessageItem): string {
  const payload = parseMessageContent(item.Content)
  const detail = (payload.detail || {}) as Record<string, unknown>
  const parts = [
    item.Title,
    payload.summary,
    item.Content,
    item.Type,
    item.RelatedType,
    messageCategoryLabel(item),
    detail.patientName,
    detail.counselorName,
    detail.activityTitle,
    detail.location,
    detail.startTime,
  ]
  return parts.filter(Boolean).join(' ')
}

export function shouldOpenExemptionReview(activeRole: string, item: MessageItem): boolean {
  if (activeRole !== 'Admin' && activeRole !== 'Ops') return false
  return isExemptionPendingMessage(item)
}

export function resolveMessageNavigation(
  item: MessageItem,
  activeRole: string,
): string {
  if (shouldOpenLeaveApproval(activeRole, item)) {
    const leaveId = getLeaveRequestId(item)
    return leaveId ? `/pages/ops/leave-requests/index?id=${leaveId}` : `/pages/patient/messages/detail?id=${item.Id}`
  }

  if (shouldOpenExemptionReview(activeRole, item)) {
    return '/pages/ops/refund-exemptions/index'
  }

  const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined

  if (item.RelatedType === 'PATIENT_NEW_ACTIVITY') {
    const activityId = item.RelatedId || detail?.activityId
    if (activityId) {
      return `/pages/activity/list?highlight=${activityId}`
    }
    return '/pages/activity/list'
  }

  if (item.RelatedType === 'PATIENT_APPOINTMENT_SUCCESS' && activeRole === 'Patient') {
    return '/pages/patient/records/list'
  }

  if (item.RelatedType === 'COUNSELOR_CONSULTATION_DONE' && activeRole === 'Counselor') {
    const consultationId = item.RelatedId || detail?.consultationId
    if (consultationId) {
      return `/pages/counselor/case-record/edit?consultationId=${consultationId}`
    }
  }

  if (
    (item.RelatedType === 'COUNSELOR_APPOINTMENT_NEW'
      || item.RelatedType === 'COUNSELOR_CONSULTATION_REMIND'
      || item.RelatedType === 'COUNSELOR_LEAVE_SUBMITTED'
      || item.RelatedType === 'COUNSELOR_LEAVE_SUCCESS')
    && activeRole === 'Counselor'
  ) {
    return '/pages/counselor/workbench/index'
  }

  return `/pages/patient/messages/detail?id=${item.Id}`
}
