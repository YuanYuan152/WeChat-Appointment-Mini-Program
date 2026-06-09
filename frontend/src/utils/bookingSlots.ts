import { APPOINTMENT_CENTERS } from '@/constants/appointmentCenters'

/** 用户预约页时间段；centerId 与咨询师排班数据联动 */
export interface BookingTimeSlot {
  ID: number
  gId?: string
  startDate: string
  startHH: string
  endHH: string
  week: string
  Price: number
  maxSign: number
  numSign: number
  /** 所属预约中心，来自 API / 咨询师排班 */
  centerId: string
  startTime?: string
  endTime?: string
  createTime?: string
  time?: string
}

/**
 * 将接口返回的 timeSlots 规范为带 centerId 的结构。
 * 后端未下发 centerId 时，演示环境按序号分配到各中心，便于联调。
 */
export function normalizeBookingTimeSlots(raw: any[] = []): BookingTimeSlot[] {
  const centerIds = APPOINTMENT_CENTERS.map((c) => c.id)
  return raw.map((slot, index) => {
    const centerId =
      slot.centerId ||
      slot.center_id ||
      slot.CenterId ||
      centerIds[index % centerIds.length]
    return {
      ID: Number(slot.ID ?? slot.Id ?? slot.id ?? 0),
      gId: slot.gId,
      startDate: slot.startDate || '',
      startHH: slot.startHH || '',
      endHH: slot.endHH || '',
      week: slot.week || '',
      Price: Number(slot.Price ?? slot.price ?? 0),
      maxSign: Number(slot.maxSign ?? 1),
      numSign: Number(slot.numSign ?? 0),
      centerId: String(centerId),
      startTime: slot.startTime,
      endTime: slot.endTime,
      createTime: slot.createTime,
      time: slot.time,
    }
  })
}

/** 咨询师在哪些预约中心有可约时段（供用户端展示与禁用逻辑） */
export function getCounselorAvailableCenterIds(slots: BookingTimeSlot[]): string[] {
  return [...new Set(slots.map((s) => s.centerId).filter(Boolean))]
}

export function filterSlotsByCenter(slots: BookingTimeSlot[], centerId: string | null): BookingTimeSlot[] {
  if (!centerId) return []
  return slots.filter((s) => s.centerId === centerId)
}

export function counselorWorksAtCenter(slots: BookingTimeSlot[], centerId: string): boolean {
  return slots.some((s) => s.centerId === centerId)
}
