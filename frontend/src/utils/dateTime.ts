/** 小程序时间展示：统一按中国北京时间（Asia/Shanghai） */

// 当前预约/订单业务使用北京时间 UTC+8，不依赖宿主时区或 Intl。
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000

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
  // 部分安卓微信没有 Intl；渲染中调用会抛错，导致页面停留在旧的加载视图。
  // 偏移后只读 UTC 字段，避免再叠加手机本地时区。
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS)
  const pad = (part: number) => part < 10 ? `0${part}` : String(part)
  return `${chinaDate.getUTCFullYear()}-${pad(chinaDate.getUTCMonth() + 1)}-${pad(chinaDate.getUTCDate())} ${pad(chinaDate.getUTCHours())}:${pad(chinaDate.getUTCMinutes())}`
}

/** 仅时分（用于结束时间后缀） */
export function formatChinaClock(value?: string | null): string {
  const full = formatChinaDateTime(value)
  return full.length >= 16 ? full.slice(11, 16) : full
}
