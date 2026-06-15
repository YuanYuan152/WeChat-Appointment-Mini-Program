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

/** 当前时刻所属标准时段（50 分钟/节） */
export const currentStandardSlot = (d: Date = new Date()) => {
  const date = formatDateLocal(d)
  const minutes = d.getHours() * 60 + d.getMinutes()
  for (const hour of SLOT_START_HOURS) {
    const startMin = hour * 60
    const endMin = startMin + SLOT_DURATION_MINUTES
    if (minutes >= startMin && minutes < endMin) {
      return { date, timeSlot: `${String(hour).padStart(2, '0')}:00` }
    }
  }
  const hour = d.getHours()
  const upcoming = SLOT_START_HOURS.find(h => h > hour)
  if (upcoming !== undefined) {
    return { date, timeSlot: `${String(upcoming).padStart(2, '0')}:00` }
  }
  return { date, timeSlot: `${String(SLOT_START_HOURS[0]).padStart(2, '0')}:00` }
}
