import { getStoredToken, getStoredRole, migrateLegacySession } from './session'

const ROLE_ROUTE_MAP: Record<string, string[]> = {
  '/pages/counselor/': ['Counselor'],
  '/pages/assistant/': ['Assistant', 'Ops', 'Admin'],
  '/pages/ops/': ['Assistant', 'Ops', 'Admin'],
  '/pages/admin-webview/': ['Assistant', 'Ops', 'Admin'],
}

function getRequiredRoles(url: string): string[] | null {
  for (const [prefix, roles] of Object.entries(ROLE_ROUTE_MAP)) {
    if (url.startsWith(prefix)) return roles
  }
  return null
}

function getUserRoles(): string[] {
  try {
    migrateLegacySession()
    const role = getStoredRole()
    return role ? [role] : []
  } catch {
    return []
  }
}

export function setupRouteGuard() {
  const intercept = (options: any) => {
    const url: string = options.url || ''
    const requiredRoles = getRequiredRoles(url)
    if (!requiredRoles) return true

    if (!getStoredToken()) {
      try {
        uni.setStorageSync('redirectAfterLogin', url)
      } catch {
        /* ignore */
      }
      uni.navigateTo({
        url: `/pages/auth/login?redirect=${encodeURIComponent(url)}`,
        fail: () => {
          uni.reLaunch({
            url: `/pages/auth/login?redirect=${encodeURIComponent(url)}`,
          })
        },
      })
      return false
    }

    const userRoles = getUserRoles()
    const hasAccess = requiredRoles.some((r) => userRoles.includes(r))
    if (!hasAccess) {
      uni.showToast({ title: '无权限访问该页面', icon: 'none' })
      return false
    }
    return true
  }

  uni.addInterceptor('navigateTo', {
    invoke(args: any) {
      return intercept(args) ? args : false
    },
  })
  uni.addInterceptor('redirectTo', {
    invoke(args: any) {
      return intercept(args) ? args : false
    },
  })
}
