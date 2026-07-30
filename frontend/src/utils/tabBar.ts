import { resolveAccountRole } from '@/constants/roles'
import { getStoredRole, migrateLegacySession } from '@/utils/session'

/** tabBar 第三项：来访者=预约记录，其他角色=工作台 */
export const TAB_SLOT_INDEX = 2

export function resolveTabSlotIsPatient(roleOrRoles?: string | string[]): boolean {
  if (typeof roleOrRoles === 'string') {
    return roleOrRoles === 'Patient'
  }
  return resolveAccountRole(roleOrRoles) === 'Patient'
}

export function readStoredRole(): string {
  try {
    migrateLegacySession()
    const role = getStoredRole()
    if (role) return role
    return 'Patient'
  } catch {
    return 'Patient'
  }
}


export function updateTabBarForRole(roleOrRoles?: string | string[]) {
  let role = 'Patient'
  if (typeof roleOrRoles === 'string') {
    role = roleOrRoles
  } else if (Array.isArray(roleOrRoles)) {
    role = resolveAccountRole(roleOrRoles)
  } else {
    role = readStoredRole()
  }

  uni.setTabBarItem({
    index: TAB_SLOT_INDEX,
    text: role === 'Patient' ? '预约记录' : '工作台',
  })
}
