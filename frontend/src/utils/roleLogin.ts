import { AuthApi, type UserInfo } from '@/apis/auth'
import { resolveAccountRole } from '@/constants/roles'
import { updateTabBarForRole } from '@/utils/tabBar'
import { saveSession, getStoredToken } from '@/utils/session'

export const WORKBENCH_ROLE_SET = new Set(['Counselor', 'Assistant', 'Ops', 'Admin'])

const ROLE_HOME: Record<string, string> = {
  Counselor: '/pages/counselor/workbench/index',
}

/** 登录后同步单角色到统一 userInfo + 旧字段，并刷新 Tab */
export async function applyRoleAfterLogin(me: UserInfo): Promise<string> {
  const role = resolveAccountRole(me.roles, me.activeRole)
  const token = getStoredToken()
  if (token) {
    saveSession({
      token,
      openid: me.openId,
      role,
      nickname: me.nickname,
      avatar: me.avatarUrl,
      id: me.id,
      mobile: me.mobile,
    })
  } else {
    uni.setStorageSync('user_roles', JSON.stringify([role]))
    uni.setStorageSync('active_role', role)
  }
  updateTabBarForRole(role)
  return role
}

export function navigateToRoleHome(activeRole: string, redirectUrl?: string) {
  if (redirectUrl) {
    uni.removeStorageSync('redirectAfterLogin')
    uni.redirectTo({ url: redirectUrl })
    return
  }

  const home = ROLE_HOME[activeRole]
  if (home) {
    uni.redirectTo({ url: home })
    return
  }

  uni.switchTab({ url: '/pages/user/profile' })
}

export function resolveWorkbenchRole(roles: string[], activeRole?: string | null): string {
  return resolveAccountRole(roles, activeRole)
}
