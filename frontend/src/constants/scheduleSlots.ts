/** 与后端 schedule_slots.py 对齐的标准咨询时间槽 */
export const ROLLING_WINDOW_DAYS = 7
export const SLOT_DURATION_MINUTES = 50
export const SLOT_START_HOURS = [9, 10, 11, 13, 14, 15, 16, 17, 18] as const

export const formatSlotLabel = (hour: number) => {
  const start = `${String(hour).padStart(2, '0')}:00`
  const endMin = SLOT_DURATION_MINUTES
  const endHour = hour + Math.floor(endMin / 60)
  const endMinute = endMin % 60
  const end = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
  return `${start} – ${end}`
}

export const addDays = (dateStr: string, days: number) => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const formatDateLocal = (d: Date = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayStr = () => formatDateLocal()

export const rollingMaxDate = () => addDays(formatDateLocal(), ROLLING_WINDOW_DAYS - 1)
