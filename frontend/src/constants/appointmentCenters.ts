/**
 * 预约中心常量 — 用户端选择与咨询师端排班录入需保持一致。
 * 咨询师工作台写入 AppSchedule.Note 的 center: 字段应使用相同 id。
 */
export interface AppointmentCenter {
  /** 与后端 AppSchedule.Note / centerId 字段对齐 */
  id: string
  name: string
  /** 线上视频咨询：不占咨询室、排期不可选咨询室偏好 */
  virtual?: boolean
}

export const VIDEO_CENTER_ID = 'video'

export const isVideoCenter = (centerId?: string | null): boolean =>
  (centerId || '').trim() === VIDEO_CENTER_ID

export const APPOINTMENT_CENTERS: AppointmentCenter[] = [
  { id: 'yangpu', name: '杨浦预约中心' },
  { id: 'pudong', name: '浦东预约中心' },
  { id: VIDEO_CENTER_ID, name: '视频咨询', virtual: true },
]

export const APPOINTMENT_CENTER_MAP = Object.fromEntries(
  APPOINTMENT_CENTERS.map((c) => [c.id, c.name])
) as Record<string, string>
