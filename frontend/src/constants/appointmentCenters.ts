/**
 * 预约中心常量 — 用户端选择与咨询师端排班录入需保持一致。
 * 咨询师工作台后续写入 AppSchedule.centerId 时应使用相同 id。
 */
export interface AppointmentCenter {
  /** 与后端 AppSchedule.Note / centerId 字段对齐 */
  id: string
  name: string
}

export const APPOINTMENT_CENTERS: AppointmentCenter[] = [
  { id: 'yangpu', name: '杨浦预约中心' },
  { id: 'pudong', name: '浦东预约中心' },
]

export const APPOINTMENT_CENTER_MAP = Object.fromEntries(
  APPOINTMENT_CENTERS.map((c) => [c.id, c.name])
) as Record<string, string>
