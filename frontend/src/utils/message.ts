import { getDevWorkbenchRole, isMockLoginEnabled } from '@/utils/auth'
import { resolveAccountRole, STAFF_OPS_WORKBENCH_ROLES, usesOpsWorkbench } from '@/constants/roles'

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

export function isCaseRecordAmendmentPendingMessage(item: MessageItem): boolean {
  const rt = item.RelatedType || ''
  if (rt === 'CASE_RECORD_AMENDMENT_PENDING') return true
  if (rt !== 'CASE_RECORD_AMENDMENT') return false
  const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined
  if (detail?.status === 'PENDING') return true
  if ((item.Title || '').includes('待审核')) return true
  return false
}

export function canReviewAsOpsAdmin(activeRole: string): boolean {
  if (usesOpsWorkbench(activeRole)) return true
  try {
    const roles = JSON.parse(uni.getStorageSync('user_roles') || '[]') as string[]
    return STAFF_OPS_WORKBENCH_ROLES.some(r => roles.includes(r))
  } catch {
    return false
  }
}

export function messageDisplayTitle(item: MessageItem): string {
  const rt = item.RelatedType || ''
  if (rt === 'REFUND_EXEMPTION_PENDING' || isExemptionPendingMessage(item)) {
    return '豁免申请待审核'
  }
  if (rt === 'CASE_RECORD_AMENDMENT_PENDING' || isCaseRecordAmendmentPendingMessage(item)) {
    return '咨询记录修改待审核'
  }
  if (rt === 'CASE_RECORD_AMENDMENT_SUBMITTED') {
    return '咨询记录修改已提交待审核'
  }
  if (rt === 'CASE_RECORD_CRISIS_REPORT') {
    return '个案风险需上报'
  }
  if (rt === 'CASE_RECORD_AMENDMENT') {
    const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined
    if (detail?.status === 'APPROVED' || detail?.approved === true) return '咨询记录修改已通过'
    if (detail?.status === 'REJECTED' || detail?.approved === false) return '咨询记录修改已驳回'
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
    || item.RelatedType === 'PATIENT_PROXY_ORDER_PENDING'
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
  return canReviewAsOpsAdmin(activeRole) && item.RelatedType === 'COUNSELOR_LEAVE' && !!getLeaveRequestId(item)
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
  CASE_RECORD_AMENDMENT: '记录修改',
  CASE_RECORD_AMENDMENT_PENDING: '记录修改待审核',
  CASE_RECORD_AMENDMENT_SUBMITTED: '记录修改已提交',
  CASE_RECORD_CRISIS_REPORT: '风险需上报',
  COUNSELOR_CONSULTATION_DONE: '咨询完成',
  COUNSELOR_CONSULTATION_REMIND: '咨询提醒',
  COUNSELOR_APPOINTMENT_NEW: '新预约',
  COUNSELOR_APPOINTMENT_CANCEL: '预约取消',
  PATIENT_NEW_ACTIVITY: '新活动',
  PATIENT_APPOINTMENT_SUCCESS: '预约成功',
  PATIENT_APPOINTMENT_CANCEL: '预约取消',
  PATIENT_APPOINTMENT_REMIND: '预约提醒',
  PATIENT_PROXY_ORDER_PENDING: '待支付预约',
  PATIENT_LEAVE_APPROVED: '请假通知',
  CHARITY_CONSULTATION_30_BOOKING: '公益咨询第30次预约',
  CHARITY_CONSULTATION_30_DONE: '公益咨询第30次完成',
  PATIENT_CHARITY_NEGOTIATION_TIP: '公益咨询议价提示',
  PROFESSIONAL_PAIR_CONSULTATION_30_BOOKING: '正价咨询第30次预约',
  PRICING_COUNSELOR_BASE_UPDATED: '基础价格调整',
  PRICING_PATIENT_PRICE_UPDATED: '来访调价成功',
  PRICING_PATIENT_SHARE_UPDATED: '抽成调整成功',
  STAFF_PROXY_ORDER_PUSHED: '代理预约已推送',
}

/** 咨询师消息类型：详情页不展示来访联系方式 */
export const COUNSELOR_MESSAGE_TYPES = new Set([
  'COUNSELOR_APPOINTMENT_NEW',
  'COUNSELOR_CONSULTATION_DONE',
  'COUNSELOR_CONSULTATION_REMIND',
  'COUNSELOR_APPOINTMENT_CANCEL',
  'COUNSELOR_LEAVE_SUBMITTED',
  'COUNSELOR_LEAVE_SUCCESS',
  'CASE_RECORD_AMENDMENT',
  'CASE_RECORD_AMENDMENT_SUBMITTED',
])

export const PATIENT_MESSAGE_TYPES = new Set([
  'PATIENT_NEW_ACTIVITY',
  'PATIENT_APPOINTMENT_SUCCESS',
  'PATIENT_APPOINTMENT_CANCEL',
  'PATIENT_APPOINTMENT_REMIND',
  'PATIENT_PROXY_ORDER_PENDING',
  'PATIENT_LEAVE_APPROVED',
  'REFUND_EXEMPTION',
  'REFUND_EXEMPTION_PENDING',
  'PATIENT_CHARITY_NEGOTIATION_TIP',
])

export interface MessageCategoryOption {
  value: string
  label: string
}

/** 管理员/Ops 我的消息可用筛选项（不含预约类） */
export const ADMIN_OPS_MESSAGE_CATEGORIES: MessageCategoryOption[] = [
  { value: 'exemption', label: '豁免审核' },
  { value: 'counselor_leave', label: '咨询师请假' },
  { value: 'case_record_amendment', label: '记录修改审核' },
  { value: 'case_record_crisis', label: '风险上报' },
  { value: 'charity_milestone', label: '公益咨询里程碑' },
  { value: 'professional_pair_milestone', label: '正价咨询里程碑' },
  { value: 'pricing', label: '定价与抽成' },
]

const ADMIN_OPS_FORBIDDEN_FILTER_VALUES = new Set(['appointment_new', 'appointment_cancel'])

export function isAdminOpsMessageInbox(role: string): boolean {
  return role === 'Ops' || role === 'Admin'
}

export function getStoredUserRoles(): string[] {
  try {
    return JSON.parse(uni.getStorageSync('user_roles') || '[]') as string[]
  } catch {
    return []
  }
}

/** 当前账号是否使用管理员/Ops 消息收件箱 */
export function hasAdminOpsMessageInbox(activeRole: string, roles?: string[]): boolean {
  const role = resolveAccountRole(roles, activeRole)
  if (isAdminOpsMessageInbox(role)) return true
  if (isMockLoginEnabled()) {
    const devRole = getDevWorkbenchRole()
    return !!devRole && usesOpsWorkbench(devRole)
  }
  return false
}

export function resolveMessageInboxRole(activeRole: string, roles?: string[]): string {
  if (isMockLoginEnabled()) {
    const devRole = getDevWorkbenchRole()
    if (devRole && usesOpsWorkbench(devRole)) return devRole
  }
  return resolveAccountRole(roles, activeRole)
}

export function isCrisisReportMessage(item: MessageItem): boolean {
  if (item.RelatedType === 'CASE_RECORD_CRISIS_REPORT') return true
  const title = item.Title || ''
  if (title.includes('个案风险需上报')) return true
  if (title.includes('风险需上报')) return true
  if (item.Type === 'RISK' && title.includes('风险')) return true
  return false
}

export function sanitizeMessageCategoryForRole(role: string, category: string): string {
  if (!isAdminOpsMessageInbox(role)) return category
  if (ADMIN_OPS_FORBIDDEN_FILTER_VALUES.has(category)) return 'ALL'
  return category
}

export function getMessageCategoriesForRole(role: string): MessageCategoryOption[] {
  const common: MessageCategoryOption[] = [
    { value: 'ALL', label: '全部' },
    { value: 'UNREAD', label: '未读' },
  ]

  if (isAdminOpsMessageInbox(role)) {
    return [...common, ...ADMIN_OPS_MESSAGE_CATEGORIES]
  }

  if (role === 'Assistant') {
    return [
      ...common,
      { value: 'appointment_new', label: '新增预约' },
      { value: 'appointment_cancel', label: '预约取消' },
      { value: 'counselor_leave', label: '咨询师请假' },
      { value: 'charity_milestone', label: '公益咨询里程碑' },
      { value: 'professional_pair_milestone', label: '正价咨询里程碑' },
      { value: 'pricing', label: '定价与抽成' },
    ]
  }

  if (role === 'Counselor') {
    return [
      ...common,
      { value: 'appointment_new', label: '新预约' },
      { value: 'leave_submitted', label: '请假提交' },
      { value: 'consultation_remind', label: '咨询提醒' },
      { value: 'consultation_done', label: '咨询完成' },
      { value: 'case_record_amendment', label: '记录修改' },
      { value: 'appointment_cancel', label: '预约取消' },
    ]
  }

  return [
    ...common,
    { value: 'appointment_success', label: '预约成功' },
    { value: 'appointment_cancel', label: '预约取消' },
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
  if (rt === 'CASE_RECORD_AMENDMENT_PENDING' || isCaseRecordAmendmentPendingMessage(item)) {
    return '记录修改待审核'
  }
  if (rt === 'CASE_RECORD_AMENDMENT_SUBMITTED') {
    return '记录修改已提交'
  }
  if (rt === 'CASE_RECORD_CRISIS_REPORT') {
    return '风险需上报'
  }
  if (rt === 'CASE_RECORD_AMENDMENT') {
    const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined
    if (detail?.status === 'APPROVED' || detail?.approved === true) return '记录修改已通过'
    if (detail?.status === 'REJECTED' || detail?.approved === false) return '记录修改已驳回'
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
    detail.patientPhone,
    detail.counselorPhone,
    detail.recentCounselorsText,
    detail.messageText,
    detail.activityTitle,
    detail.location,
    detail.startTime,
  ]
  return parts.filter(Boolean).join(' ')
}

export function shouldOpenExemptionReview(activeRole: string, item: MessageItem): boolean {
  if (!canReviewAsOpsAdmin(activeRole)) return false
  return isExemptionPendingMessage(item)
}

export function shouldOpenCaseRecordAmendmentReview(activeRole: string, item: MessageItem): boolean {
  if (!canReviewAsOpsAdmin(activeRole)) return false
  return isCaseRecordAmendmentPendingMessage(item)
}

export function shouldOpenCaseRecordCrisisReport(activeRole: string, item: MessageItem): boolean {
  if (!canReviewAsOpsAdmin(activeRole)) return false
  return isCrisisReportMessage(item)
}

export const CASE_RECORD_AMENDMENT_REVIEW_PATH = '/pages/ops/case-record-amendments/index'

export function caseRecordCrisisReportViewPath(caseRecordId: number | string): string {
  return `/pages/ops/case-records/view?recordId=${caseRecordId}`
}

export function resolveMessageNavigation(
  item: MessageItem,
  activeRole: string,
): string {
  const detail = parseMessageContent(item.Content).detail as Record<string, unknown> | undefined

  if (shouldOpenLeaveApproval(activeRole, item)) {
    const leaveId = getLeaveRequestId(item)
    return leaveId
      ? `/pages/ops/approvals/index?category=LEAVE&leaveId=${leaveId}`
      : `/pages/ops/approvals/index?category=LEAVE`
  }

  if (shouldOpenExemptionReview(activeRole, item)) {
    return '/pages/ops/approvals/index?category=EXEMPTION'
  }

  if (shouldOpenCaseRecordAmendmentReview(activeRole, item)) {
    return CASE_RECORD_AMENDMENT_REVIEW_PATH
  }

  if (shouldOpenCaseRecordCrisisReport(activeRole, item)) {
    return `/pages/patient/messages/detail?id=${item.Id}`
  }

  if (item.RelatedType === 'CASE_RECORD_AMENDMENT_SUBMITTED' && activeRole === 'Counselor') {
    return `/pages/patient/messages/detail?id=${item.Id}`
  }

  if (item.RelatedType === 'CASE_RECORD_AMENDMENT' && activeRole === 'Counselor') {
    return `/pages/patient/messages/detail?id=${item.Id}`
  }

  if (item.RelatedType === 'PATIENT_NEW_ACTIVITY') {
    const activityId = item.RelatedId || detail?.activityId
    if (activityId) {
      return `/pages/activity/list?highlight=${activityId}`
    }
    return '/pages/activity/list'
  }

  if (item.RelatedType === 'PATIENT_PROXY_ORDER_PENDING' && activeRole === 'Patient') {
    const orderId = detail?.orderId || item.RelatedId
    if (orderId) {
      return `/pages/patient/orders/detail?id=${orderId}`
    }
    return '/pages/patient/orders/list'
  }

  if (item.RelatedType === 'PATIENT_APPOINTMENT_SUCCESS' && activeRole === 'Patient') {
    return '/pages/patient/records/list'
  }

  if (item.RelatedType === 'PATIENT_APPOINTMENT_CANCEL' && activeRole === 'Patient') {
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
    const scheduleId = detail?.scheduleId
    if (scheduleId) {
      return `/pages/counselor/workbench/index?scheduleId=${scheduleId}`
    }
    return '/pages/counselor/workbench/index'
  }

  return `/pages/patient/messages/detail?id=${item.Id}`
}
