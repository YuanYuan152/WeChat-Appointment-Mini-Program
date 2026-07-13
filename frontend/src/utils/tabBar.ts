import { resolveAccountRole } from '@/constants/roles'

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
    const active = uni.getStorageSync('active_role')
    if (active) return active
    const raw = uni.getStorageSync('user_roles')
    if (!raw) return 'Patient'
    const parsed = JSON.parse(raw)
    return resolveAccountRole(Array.isArray(parsed) ? parsed : [])
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
