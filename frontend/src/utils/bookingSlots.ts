/** 用户预约页时间段；centerId 与咨询师排班数据联动 */
export interface BookingTimeSlot {
  ID: number
  gId?: string
  startDate: string
  startHH: string
  endHH: string
  week: string
  Price: number | null
  priceNegotiation?: boolean
  priceLabel?: string
  maxSign: number
  numSign: number
  /** 所属预约中心，来自 API / 咨询师排班 */
  centerId: string
  status?: 'AVAILABLE' | 'BOOKED' | 'EXPIRED' | 'NEGOTIATION' | 'PENDING_PAYMENT' | 'TOO_SOON'
  isBookable?: boolean
  unavailableReason?: string
  needsNegotiation?: boolean
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
  return raw
    .map((slot) => {
      const centerId =
        slot.centerId ||
        slot.center_id ||
        slot.CenterId ||
        ''
      return {
        ID: Number(slot.ID ?? slot.Id ?? slot.id ?? 0),
        gId: slot.gId,
        startDate: slot.startDate || '',
        startHH: slot.startHH || '',
        endHH: slot.endHH || '',
        week: slot.week || '',
        Price: slot.Price == null ? null : Number(slot.Price ?? slot.price ?? 0),
        priceNegotiation: !!slot.priceNegotiation,
        maxSign: Number(slot.maxSign ?? 1),
        numSign: Number(slot.numSign ?? 0),
        centerId: String(centerId),
        status: slot.status || (Number(slot.numSign ?? 0) >= Number(slot.maxSign ?? 1) ? 'BOOKED' : 'AVAILABLE'),
        isBookable:
          slot.isBookable ??
          (
            !Boolean(slot.needsNegotiation) &&
            !Boolean(slot.priceNegotiation) &&
            slot.status !== 'BOOKED' &&
            slot.status !== 'EXPIRED' &&
            slot.status !== 'NEGOTIATION' &&
            Number(slot.numSign ?? 0) < Number(slot.maxSign ?? 1)
          ),
        needsNegotiation: Boolean(slot.needsNegotiation ?? slot.needs_negotiation),
        priceLabel: slot.priceLabel || slot.price_label,
        unavailableReason: slot.unavailableReason || slot.unavailable_reason,
        startTime: slot.startTime,
        endTime: slot.endTime,
        createTime: slot.createTime,
        time: slot.time,
      }
    })
    .filter((slot) => Boolean(slot.centerId) && Boolean(slot.ID))
}

/** 咨询师在哪些预约中心有可约时段（供用户端展示与禁用逻辑） */
export function getCounselorAvailableCenterIds(slots: BookingTimeSlot[]): string[] {
  return Array.from(new Set(slots.map((s) => s.centerId).filter(Boolean)))
}

export function filterSlotsByCenter(slots: BookingTimeSlot[], centerId: string | null): BookingTimeSlot[] {
  if (!centerId) return []
  return slots.filter((s) => s.centerId === centerId)
}

export function counselorWorksAtCenter(slots: BookingTimeSlot[], centerId: string): boolean {
  return slots.some((s) => s.centerId === centerId)
}

export function isSlotExpired(slot: BookingTimeSlot): boolean {
  return slot.status === 'EXPIRED'
}

/** 不可预约时段的展示文案 */
export function slotUnavailableLabel(slot: BookingTimeSlot): string {
  if (slot.unavailableReason) return slot.unavailableReason
  if (slot.needsNegotiation || slot.status === 'NEGOTIATION') return slot.priceLabel || '需议价'
  if (slot.priceNegotiation) return slot.priceLabel || '议价'
  if (isSlotExpired(slot)) return '已过期'
  if (slot.status === 'BOOKED') return '已约满'
  return '已约满'
}

export function isSlotBookable(slot: BookingTimeSlot): boolean {
  if (slot.needsNegotiation || slot.priceNegotiation || slot.status === 'NEGOTIATION') return false
  if (slot.isBookable === false) return false
  if (isSlotExpired(slot)) return false
  if (slot.status === 'BOOKED') return false
  return (slot.numSign ?? 0) < (slot.maxSign ?? 1)
}

export function hasBookableSlotsInCenter(slots: BookingTimeSlot[], centerId: string | null): boolean {
  if (!centerId) return false
  return slots.some((s) => s.centerId === centerId && isSlotBookable(s))
}
