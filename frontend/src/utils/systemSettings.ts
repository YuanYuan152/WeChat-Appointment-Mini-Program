import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

export interface SystemSettings {
  proxyOrderTtlMinutes: number
  proxyOrderTtlLabel?: string
  proxyOrderTtlMinMinutes?: number
  proxyOrderTtlMaxMinutes?: number
  proxyOrderTtlStepMinutes?: number
}

const DEFAULT_TTL_MINUTES = 120
export const PROXY_ORDER_TTL_MIN_MINUTES = 5
export const PROXY_ORDER_TTL_MAX_MINUTES = 24 * 60
export const PROXY_ORDER_TTL_STEP_MINUTES = 5
export const PROXY_ORDER_TTL_MAX_HOURS = 24

let cachedSettings: SystemSettings | null = null
let loadingPromise: Promise<SystemSettings> | null = null

export function buildProxyOrderTtlHourOptions(): number[] {
  return Array.from({ length: PROXY_ORDER_TTL_MAX_HOURS + 1 }, (_, index) => index)
}

export function buildProxyOrderTtlMinuteOptions(hour: number): number[] {
  if (hour >= PROXY_ORDER_TTL_MAX_HOURS) return [0]
  if (hour <= 0) {
    const options: number[] = []
    for (let minute = PROXY_ORDER_TTL_STEP_MINUTES; minute < 60; minute += PROXY_ORDER_TTL_STEP_MINUTES) {
      options.push(minute)
    }
    return options
  }
  const options: number[] = []
  for (let minute = 0; minute < 60; minute += PROXY_ORDER_TTL_STEP_MINUTES) {
    options.push(minute)
  }
  return options
}

export function normalizeProxyOrderTtlMinutes(
  minutes: number,
  bounds?: Pick<SystemSettings, 'proxyOrderTtlMinMinutes' | 'proxyOrderTtlMaxMinutes' | 'proxyOrderTtlStepMinutes'>,
): number {
  const min = bounds?.proxyOrderTtlMinMinutes ?? PROXY_ORDER_TTL_MIN_MINUTES
  const max = bounds?.proxyOrderTtlMaxMinutes ?? PROXY_ORDER_TTL_MAX_MINUTES
  const step = bounds?.proxyOrderTtlStepMinutes ?? PROXY_ORDER_TTL_STEP_MINUTES
  let value = Number.isFinite(minutes) ? Math.round(minutes) : DEFAULT_TTL_MINUTES
  value = Math.max(min, Math.min(max, value))
  const remainder = value % step
  if (remainder) value -= remainder
  return Math.max(min, value)
}

export function formatProxyOrderTtlDuration(minutes: number): string {
  const ttl = normalizeProxyOrderTtlMinutes(minutes)
  const hours = Math.floor(ttl / 60)
  const mins = ttl % 60
  if (hours && mins) return `${hours} 小时 ${mins} 分钟`
  if (hours) return `${hours} 小时`
  return `${mins} 分钟`
}

export function formatProxyOrderTtlHint(minutes: number, prefix = '请在'): string {
  return `${prefix} ${formatProxyOrderTtlDuration(minutes)} 内完成支付`
}

export function formatProxyOrderPushHint(minutes: number): string {
  return `来访需在 ${formatProxyOrderTtlDuration(minutes)} 内完成支付`
}

export function proxyOrderTtlMinutesToPicker(minutes: number): { hour: number; minute: number } {
  const total = normalizeProxyOrderTtlMinutes(minutes)
  const hour = Math.min(PROXY_ORDER_TTL_MAX_HOURS, Math.floor(total / 60))
  let minute = total % 60
  const minuteOptions = buildProxyOrderTtlMinuteOptions(hour)
  if (!minuteOptions.includes(minute)) {
    minute = minuteOptions.reduce((closest, candidate) =>
      Math.abs(candidate - minute) < Math.abs(closest - minute) ? candidate : closest,
    minuteOptions[0])
  }
  return { hour, minute }
}

export function proxyOrderTtlPickerToMinutes(hour: number, minute: number): number {
  return normalizeProxyOrderTtlMinutes(hour * 60 + minute)
}

function normalizeSettings(data: Partial<SystemSettings> | null | undefined): SystemSettings {
  const bounds = {
    proxyOrderTtlMinMinutes: data?.proxyOrderTtlMinMinutes ?? PROXY_ORDER_TTL_MIN_MINUTES,
    proxyOrderTtlMaxMinutes: data?.proxyOrderTtlMaxMinutes ?? PROXY_ORDER_TTL_MAX_MINUTES,
    proxyOrderTtlStepMinutes: data?.proxyOrderTtlStepMinutes ?? PROXY_ORDER_TTL_STEP_MINUTES,
  }
  const minutes = normalizeProxyOrderTtlMinutes(data?.proxyOrderTtlMinutes ?? DEFAULT_TTL_MINUTES, bounds)
  return {
    proxyOrderTtlMinutes: minutes,
    proxyOrderTtlLabel: data?.proxyOrderTtlLabel || formatProxyOrderTtlDuration(minutes),
    ...bounds,
  }
}

export async function fetchSystemSettings(force = false): Promise<SystemSettings> {
  if (!force && cachedSettings) return cachedSettings
  if (!force && loadingPromise) return loadingPromise

  loadingPromise = httpV2
    .get<SystemSettings>(API_ENDPOINTS.common.systemSettings, undefined, { showLoading: false, showError: false })
    .then(res => {
      cachedSettings = normalizeSettings(res.code === 0 && res.data ? res.data : null)
      return cachedSettings
    })
    .catch(() => {
      cachedSettings = normalizeSettings(null)
      return cachedSettings
    })
    .finally(() => {
      loadingPromise = null
    })

  return loadingPromise
}

export function invalidateSystemSettingsCache() {
  cachedSettings = null
}

export async function fetchAdminSystemSettings(): Promise<SystemSettings> {
  const res = await httpV2.get<SystemSettings>(API_ENDPOINTS.admin.systemSettings)
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '加载系统设置失败')
  }
  cachedSettings = normalizeSettings(res.data)
  return cachedSettings
}

export async function updateProxyOrderTtlMinutes(minutes: number): Promise<SystemSettings> {
  const res = await httpV2.put<SystemSettings>(API_ENDPOINTS.admin.updateProxyOrderTtl, {
    minutes: normalizeProxyOrderTtlMinutes(minutes),
  })
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '保存失败')
  }
  cachedSettings = normalizeSettings(res.data)
  return cachedSettings
}
