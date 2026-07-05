import { AuthApi, type UserInfo } from '@/apis/auth'
import { resolveHighestRole } from '@/constants/roles'
import { updateTabBarForRole } from '@/utils/tabBar'

export const WORKBENCH_ROLE_SET = new Set(['Counselor', 'Assistant', 'Ops', 'Admin'])

const ROLE_HOME: Record<string, string> = {
  Counselor: '/pages/counselor/workbench/index',
}

/** 登录后自动使用最高等级角色，并同步 switchRole / storage / tabBar */
export async function applyRoleAfterLogin(me: UserInfo): Promise<string> {
  const roles = me.roles || []
  const target = resolveHighestRole(roles)

  if (target !== me.activeRole) {
    const switched = await AuthApi.switchRole(target)
    const finalRole = switched.activeRole || target
    uni.setStorageSync('user_roles', JSON.stringify(roles))
    uni.setStorageSync('active_role', finalRole)
    updateTabBarForRole(roles)
    return finalRole
  }

  uni.setStorageSync('user_roles', JSON.stringify(roles))
  uni.setStorageSync('active_role', target)
  updateTabBarForRole(roles)
  return target
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

export function resolveWorkbenchRole(roles: string[]): string {
  return resolveHighestRole(roles)
}
