import { resolveHighestRole } from '@/constants/roles'

/** tabBar 第三项：来访者=预约记录，其他角色=工作台 */export const TAB_SLOT_INDEX = 2

export function resolveTabSlotIsPatient(roles?: string[]): boolean {
  return resolveHighestRole(roles) === 'Patient'
}

export function readStoredRoles(): string[] {
  try {
    const raw = uni.getStorageSync('user_roles')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function updateTabBarForRole(roles?: string[]) {
  const roleList = roles ?? readStoredRoles()
  const isPatient = resolveTabSlotIsPatient(roleList)

  uni.setTabBarItem({
    index: TAB_SLOT_INDEX,
    text: isPatient ? '预约记录' : '工作台',
  })
}
