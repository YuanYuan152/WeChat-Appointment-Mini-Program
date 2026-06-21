import { API_ENDPOINTS } from '@/config/api'
import { httpV2 } from '@/utils/http'
import {
  getDevWorkbenchRole,
  isLoggedIn,
  isMockLoginEnabled,
} from '@/utils/auth'

type RoleName = 'Patient' | 'Counselor' | 'Assistant' | 'Ops' | 'Admin' | string

interface RoleSnapshot {
  roles?: string[]
  activeRole?: string
}

const TAB_INDEX_ROLE_ENTRY = 2
const ACTIVE_ROLE_STORAGE_KEY = 'active_role'
const USER_ROLES_STORAGE_KEY = 'user_roles'
const INTERNAL_ROLES = new Set(['Counselor', 'Assistant', 'Ops', 'Admin'])

const silentRequest = { showLoading: false, showError: false }

export const isInternalRole = (role?: string | null): boolean =>
  !!role && INTERNAL_ROLES.has(role)

const setTabBarItem = (item: {
  index: number
  text: string
  iconPath?: string
  selectedIconPath?: string
}) => {
  try {
    uni.setTabBarItem(item)
  } catch {
    // 非 tabBar 页面调用时可能失败，忽略即可，下一次进入 tab 页会再同步。
  }
}

const resolvePrimaryRole = (snapshot?: RoleSnapshot): RoleName => {
  const roles = snapshot?.roles || []
  const activeRole = snapshot?.activeRole || ''

  if (activeRole === 'Patient') return 'Patient'
  if (isInternalRole(activeRole)) return activeRole

  return ['Counselor', 'Assistant', 'Ops', 'Admin'].find(role => roles.includes(role)) || 'Patient'
}

export const cacheRoleSnapshot = (snapshot?: RoleSnapshot): void => {
  if (snapshot?.roles?.length) {
    uni.setStorageSync(USER_ROLES_STORAGE_KEY, JSON.stringify(snapshot.roles))
  }
  if (snapshot?.activeRole) {
    uni.setStorageSync(ACTIVE_ROLE_STORAGE_KEY, snapshot.activeRole)
  }
}

export const clearRoleSnapshot = (): void => {
  uni.removeStorageSync(USER_ROLES_STORAGE_KEY)
  uni.removeStorageSync(ACTIVE_ROLE_STORAGE_KEY)
}

const getCachedRole = (): string => {
  const activeRole = String(uni.getStorageSync(ACTIVE_ROLE_STORAGE_KEY) || '')
  if (activeRole) return activeRole

  try {
    const roles = JSON.parse(String(uni.getStorageSync(USER_ROLES_STORAGE_KEY) || '[]'))
    return resolvePrimaryRole({ roles: Array.isArray(roles) ? roles : [] })
  } catch {
    return 'Patient'
  }
}

export const applyRoleTabBar = (role?: string | null): void => {
  const internal = isInternalRole(role)

  setTabBarItem({
    index: TAB_INDEX_ROLE_ENTRY,
    text: internal ? '工作台' : '预约记录',
    iconPath: 'static/images/bottom3.png',
    selectedIconPath: 'static/images/bottom3.png',
  })
}

export const syncTabBarByAuth = async (snapshot?: RoleSnapshot): Promise<void> => {
  if (!isLoggedIn()) {
    applyRoleTabBar('Patient')
    return
  }

  const cachedRole = snapshot ? resolvePrimaryRole(snapshot) : getCachedRole()
  applyRoleTabBar(cachedRole)

  if (snapshot) {
    cacheRoleSnapshot(snapshot)
    return
  }

  if (isMockLoginEnabled()) {
    const devRole = getDevWorkbenchRole()
    if (devRole) {
      cacheRoleSnapshot({ roles: [devRole], activeRole: devRole })
      applyRoleTabBar(devRole)
      return
    }
  }

  try {
    const res = await httpV2.get<RoleSnapshot>(API_ENDPOINTS.auth.me, undefined, silentRequest)
    if (res.code !== 0 || !res.data) return
    cacheRoleSnapshot(res.data)
    applyRoleTabBar(resolvePrimaryRole(res.data))
  } catch {
    // 网络异常时保留缓存态，避免 tabBar 闪烁。
  }
}
