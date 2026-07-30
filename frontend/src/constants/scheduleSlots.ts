/** 与后端 schedule_slots.py 对齐的标准咨询时间槽 */
export const ROLLING_WINDOW_DAYS = 30
/** 普通模式列表向前追溯天数（已完成咨询、咨询记录筛选） */
export const PAST_WINDOW_DAYS = 30
/** 普通模式总展示天数：过去 PAST + 未来 ROLLING */
export const LIST_WINDOW_DAYS = ROLLING_WINDOW_DAYS + PAST_WINDOW_DAYS
export const SLOT_DURATION_MINUTES = 50
export const CLEANING_DURATION_MINUTES = 10
export const SLOT_START_HOURS = [9, 10, 11, 13, 14, 15, 16, 17, 18] as const
export const SLOT_START_TIMES = SLOT_START_HOURS.flatMap(hour =>
  [0, 30].map(minute => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
)

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

/** 当前时刻所属半小时时段。 */
export const currentStandardSlot = (d: Date = new Date()) => {
  const date = formatDateLocal(d)
  const minutes = d.getHours() * 60 + d.getMinutes()
  const starts = SLOT_START_TIMES.map(value => {
    const [hour, minute] = value.split(':').map(Number)
    return { value, minutes: hour * 60 + minute }
  })
  for (const start of starts) {
    if (minutes >= start.minutes && minutes < start.minutes + 30) {
      return { date, timeSlot: start.value }
    }
  }
  const upcoming = starts.find(item => item.minutes > minutes)
  if (upcoming) {
    return { date, timeSlot: upcoming.value }
  }
  return { date, timeSlot: SLOT_START_TIMES[0] }
}
