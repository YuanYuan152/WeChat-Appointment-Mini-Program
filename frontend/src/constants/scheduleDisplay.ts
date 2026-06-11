/** 咨询师工作台时段展示（与后端 schedule_display 对齐） */
export type ScheduleDisplayStatus = 'OPEN' | 'BOOKED' | 'ON_LEAVE' | 'DONE' | 'EXPIRED' | 'CANCELLED'

export const SCHEDULE_DISPLAY_META: Record<
  ScheduleDisplayStatus,
  { label: string; icon: string; color: string; bg: string }
> = {
  OPEN: { label: '已挂课', icon: '🟢', color: '#065F46', bg: '#D1FAE5' },
  BOOKED: { label: '已预约', icon: '🔵', color: '#1E40AF', bg: '#DBEAFE' },
  ON_LEAVE: { label: '已请假', icon: '🟠', color: '#C2410C', bg: '#FFEDD5' },
  DONE: { label: '已完成', icon: '✅', color: '#6B7280', bg: '#F3F4F6' },
  EXPIRED: { label: '已过期', icon: '⏱️', color: '#9CA3AF', bg: '#F3F4F6' },
  CANCELLED: { label: '已取消', icon: '⚪', color: '#9CA3AF', bg: '#F9FAFB' },
}

export const SCHEDULE_LEGEND = [
  { key: 'OPEN', hint: '已挂课：来访者可见并可预约' },
  { key: 'BOOKED', hint: '已预约：来访者已支付' },
  { key: 'DONE', hint: '已完成：咨询已结束' },
  { key: 'EMPTY', hint: '未挂课：该时段未开放（来访者不可见）' },
] as const
