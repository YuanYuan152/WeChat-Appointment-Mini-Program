/** 小程序时间展示：统一按中国北京时间（Asia/Shanghai） */

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'

/**
 * 解析接口时间字符串。
 * - 带 Z / 偏移：按绝对时刻解析
 * - 无时区 naive：按北京墙钟解释（排期/预约业务时间）
 */
export function parseChinaDateTime(value?: string | null): Date | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const date = new Date(`${normalized}+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 消息列表/详情：展示到分钟的北京时间 */
export function formatChinaDateTime(value?: string | null): string {
  if (!value) return ''
  const date = parseChinaDateTime(value)
  if (!date) {
    return String(value).replace('T', ' ').slice(0, 16)
  }
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const pick = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
}

/** 仅时分（用于结束时间后缀） */
export function formatChinaClock(value?: string | null): string {
  const full = formatChinaDateTime(value)
  return full.length >= 16 ? full.slice(11, 16) : full
}
