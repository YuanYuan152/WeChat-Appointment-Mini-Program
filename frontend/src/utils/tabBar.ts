import { getDevWorkbenchRole, isMockLoginEnabled } from '@/utils/auth'

const WORKBENCH_ROLES = new Set(['Counselor', 'Assistant', 'Ops', 'Admin'])
/** tabBar 第三项：来访者=预约记录，其他角色=工作台 */
export const TAB_SLOT_INDEX = 2

export function resolveTabSlotIsPatient(roles?: string[], activeRole?: string): boolean {
  if (!roles?.length) return true

  if (isMockLoginEnabled()) {
    const devRole = getDevWorkbenchRole()
    if (devRole) return devRole === 'Patient'
  }

  if (activeRole === 'Patient') return true
  if (activeRole && WORKBENCH_ROLES.has(activeRole)) return false

  return !roles.some((role) => WORKBENCH_ROLES.has(role))
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

export function updateTabBarForRole(roles?: string[], activeRole?: string) {
  const roleList = roles ?? readStoredRoles()
  const currentRole = activeRole ?? ((uni.getStorageSync('active_role') as string) || '')
  const isPatient = resolveTabSlotIsPatient(roleList, currentRole || undefined)

  uni.setTabBarItem({
    index: TAB_SLOT_INDEX,
    text: isPatient ? '预约记录' : '工作台',
  })
}
