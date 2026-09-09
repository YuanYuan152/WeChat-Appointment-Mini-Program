/** 真机无法访问电脑局域网 HTTP 时，自动改走 HTTPS 远程后端。 */

const PRIVATE_LAN_RE =
  /^https?:\/\/(127\.0\.0\.1|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i

let loggedResolvedBase = false

export function isWechatDevtoolsRuntime(): boolean {
  try {
    const info = uni.getSystemInfoSync() as UniApp.GetSystemInfoResult & { platform?: string }
    return String(info?.platform || '').toLowerCase() === 'devtools'
  } catch {
    return false
  }
}

export function isPrivateLanApiBase(url: string): boolean {
  return PRIVATE_LAN_RE.test(String(url || '').trim())
}

/** 真机是否强制使用局域网 HTTP（需手机与电脑同一 Wi‑Fi，且开发者工具关闭域名校验） */
export function allowDeviceLanApi(): boolean {
  return String(import.meta.env.VITE_ALLOW_DEVICE_LAN_API || '').trim() === 'true'
}

/**
 * 解析 V2 后端 baseURL：
 * - 开发者工具：使用 .env 配置的局域网/本机地址
 * - 真机 + 局域网 HTTP：默认切到 VITE_API_V2_REMOTE_FALLBACK（默认 dev）
 * - 若 VITE_ALLOW_DEVICE_LAN_API=true：真机也继续用局域网地址
 */
export function resolveApiV2BaseUrl(): string {
  const configured = String(import.meta.env.VITE_API_V2_BASE_URL || 'http://localhost:8000').trim()
  const remoteFallback = String(
    import.meta.env.VITE_API_V2_REMOTE_FALLBACK || 'https://dev.eap.ji-psy.com',
  ).trim()

  const useConfigured =
    isWechatDevtoolsRuntime() || !isPrivateLanApiBase(configured) || allowDeviceLanApi()
  const resolved = (useConfigured ? configured : remoteFallback).replace(/\/$/, '')

  if (!loggedResolvedBase) {
    loggedResolvedBase = true
    try {
      const platform = String((uni.getSystemInfoSync() as any)?.platform || 'unknown')
      console.warn('[API_V2]', {
        platform,
        allowDeviceLanApi: allowDeviceLanApi(),
        configured,
        resolved,
      })
    } catch {
      console.warn('[API_V2] resolved=', resolved)
    }
  }

  return resolved
}
