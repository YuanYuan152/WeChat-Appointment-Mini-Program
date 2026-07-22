/**
 * 登录态统一存储：userInfo
 * 同时回写 token / active_role / user_roles，兼容旧读取逻辑。
 */

export const USER_INFO_STORAGE_KEY = 'userInfo'

/** 后端角色（全站权限判断以此为准） */
export type BackendRole = 'Patient' | 'Counselor' | 'Assistant' | 'Ops' | 'Admin' | string

/**
 * 对外别名（需求文档命名）
 * visitor→来访 director→咨询主任
 */
export type PublicRole = 'visitor' | 'counselor' | 'assistant' | 'director' | 'admin'

export interface StoredUserInfo {
  token: string
  openid?: string
  /** 后端角色：Patient | Counselor | Assistant | Ops | Admin */
  role: BackendRole
  /** 对外别名：visitor | counselor | assistant | director | admin */
  roleKey?: PublicRole
  nickname?: string
  avatar?: string
  id?: number
  mobile?: string
}

const PUBLIC_TO_BACKEND: Record<PublicRole, BackendRole> = {
  visitor: 'Patient',
  counselor: 'Counselor',
  assistant: 'Assistant',
  director: 'Ops',
  admin: 'Admin',
}

const BACKEND_TO_PUBLIC: Record<string, PublicRole> = {
  Patient: 'visitor',
  Counselor: 'counselor',
  Assistant: 'assistant',
  Ops: 'director',
  Admin: 'admin',
}

export function toBackendRole(role?: string | null): BackendRole {
  if (!role) return 'Patient'
  if (role in PUBLIC_TO_BACKEND) return PUBLIC_TO_BACKEND[role as PublicRole]
  return role
}

export function toPublicRole(role?: string | null): PublicRole {
  if (!role) return 'visitor'
  if (role in BACKEND_TO_PUBLIC) return BACKEND_TO_PUBLIC[role]
  if (role in PUBLIC_TO_BACKEND) return role as PublicRole
  return 'visitor'
}

function syncLegacyKeys(info: StoredUserInfo | null) {
  if (!info?.token) {
    uni.removeStorageSync('token')
    uni.removeStorageSync('active_role')
    uni.removeStorageSync('user_roles')
    uni.removeStorageSync(USER_INFO_STORAGE_KEY)
    return
  }
  const role = toBackendRole(info.role)
  uni.setStorageSync('token', info.token)
  uni.setStorageSync('active_role', role)
  uni.setStorageSync('user_roles', JSON.stringify([role]))
  uni.setStorageSync(USER_INFO_STORAGE_KEY, {
    ...info,
    role,
    roleKey: toPublicRole(role),
  })
}

/** 从旧字段迁移/组装登录态 */
export function migrateLegacySession(): StoredUserInfo | null {
  try {
    const raw = uni.getStorageSync(USER_INFO_STORAGE_KEY)
    if (raw && typeof raw === 'object' && raw.token) {
      const role = toBackendRole(raw.role || uni.getStorageSync('active_role') || 'Patient')
      const normalized: StoredUserInfo = {
        token: String(raw.token),
        openid: raw.openid || raw.openId,
        role,
        roleKey: toPublicRole(role),
        nickname: raw.nickname,
        avatar: raw.avatar || raw.avatarUrl,
        id: raw.id,
        mobile: raw.mobile,
      }
      syncLegacyKeys(normalized)
      return normalized
    }

    const token = uni.getStorageSync('token')
    if (!token) return null

    const active = uni.getStorageSync('active_role')
    let role = toBackendRole(active || 'Patient')
    try {
      const rolesRaw = uni.getStorageSync('user_roles')
      if (rolesRaw) {
        const parsed = JSON.parse(rolesRaw)
        if (Array.isArray(parsed) && parsed[0]) role = toBackendRole(parsed[0])
      }
    } catch {
      /* ignore */
    }

    const migrated: StoredUserInfo = {
      token: String(token),
      role,
      roleKey: toPublicRole(role),
    }
    syncLegacyKeys(migrated)
    return migrated
  } catch {
    return null
  }
}

export function getStoredUserInfo(): StoredUserInfo | null {
  return migrateLegacySession()
}

export function getStoredRole(): BackendRole {
  const info = getStoredUserInfo()
  if (info?.role) return toBackendRole(info.role)
  return 'Patient'
}

export function getStoredToken(): string {
  const info = getStoredUserInfo()
  if (info?.token) return info.token
  return String(uni.getStorageSync('token') || '')
}

export function saveSession(partial: Partial<StoredUserInfo> & { token: string; role?: string }) {
  const prev = getStoredUserInfo()
  const role = toBackendRole(partial.role || prev?.role || 'Patient')
  const next: StoredUserInfo = {
    token: partial.token,
    openid: partial.openid ?? prev?.openid,
    role,
    roleKey: toPublicRole(role),
    nickname: partial.nickname ?? prev?.nickname,
    avatar: partial.avatar ?? prev?.avatar,
    id: partial.id ?? prev?.id,
    mobile: partial.mobile ?? prev?.mobile,
  }
  syncLegacyKeys(next)
  return next
}

export function clearSession() {
  syncLegacyKeys(null)
}
