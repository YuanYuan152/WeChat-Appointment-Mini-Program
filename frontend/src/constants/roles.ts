/** 系统角色中文名（与角色管理、登录选择一致） */
export const ROLE_LABELS: Record<string, string> = {
  Patient: '来访',
  ContentOps: '内容运营',
  Marketing: '市场',
  Research: '科研',
  Tester: '测试员',
  Counselor: '咨询师',
  Assistant: '咨询助理',
  Ops: '咨询主任',
  Admin: '管理员',
}

/** 使用运营管理工作台（/pages/ops）的角色 */
export const STAFF_OPS_WORKBENCH_ROLES = ['Assistant', 'Ops', 'Admin'] as const

/** 小程序展示来访端界面；可登录 Web 受限工作台 */
export const CONTENT_OPS_ROLES = ['ContentOps', 'Marketing'] as const
export const RESEARCH_ROLES = ['Research'] as const
export const VISITOR_UI_ROLES = ['Patient', 'ContentOps', 'Marketing', 'Research'] as const

/** 管理工作台内部层级：数值越大权限越高 */
export const STAFF_ROLE_RANK: Record<string, number> = {
  Assistant: 1,
  Ops: 2,
  Admin: 3,
}

export const STAFF_MANAGEMENT_ROLES = ['Assistant', 'Ops', 'Admin'] as const

/** 仅管理员可赋权 */
export const ADMIN_ONLY_ASSIGNABLE_ROLES = [
  'Tester',
  'ContentOps',
  'Research',
  'Marketing',
] as const

/** 与后端 staff_roles.KEY_LOGIN_ADMIN_OPENID 对齐 */
export const KEY_LOGIN_ADMIN_OPENID = 'demo-openid-admin'

export function isKeyLoginAdminOpenId(openId?: string | null): boolean {
  return (openId || '').trim() === KEY_LOGIN_ADMIN_OPENID
}

export function isStaffManagementRole(role: string): boolean {
  return (STAFF_MANAGEMENT_ROLES as readonly string[]).includes(role)
}

export function isVisitorUiRole(role: string): boolean {
  return (VISITOR_UI_ROLES as readonly string[]).includes(role)
}

export function staffRoleRank(role: string): number {
  return STAFF_ROLE_RANK[role] ?? 0
}

export interface RolePermissionOptions {
  actorIsKeyLoginAdmin?: boolean
  targetIsKeyLoginAdmin?: boolean
}

/** 操作者是否可将 targetRole 赋给其他账号 */
export function canActorAssignRole(
  actorRole: string,
  targetRole: string,
  options: RolePermissionOptions = {},
): boolean {
  if (!(STAFF_OPS_WORKBENCH_ROLES as readonly string[]).includes(actorRole)) return false
  if ((ADMIN_ONLY_ASSIGNABLE_ROLES as readonly string[]).includes(targetRole)) {
    return actorRole === 'Admin'
  }
  if (!isStaffManagementRole(targetRole)) return true
  // 仅密钥登录管理员可新建/赋权其他管理员
  if (targetRole === 'Admin') return actorRole === 'Admin' && !!options.actorIsKeyLoginAdmin
  return staffRoleRank(actorRole) > staffRoleRank(targetRole)
}

/** 操作者是否可删除或更换 userRole 对应账号 */
export function canActorManageUser(
  actorRole: string,
  userRole: string,
  options: RolePermissionOptions = {},
): boolean {
  if (options.targetIsKeyLoginAdmin) return false
  if (!(STAFF_OPS_WORKBENCH_ROLES as readonly string[]).includes(actorRole)) return false
  if (!isStaffManagementRole(userRole)) return true
  // 仅密钥登录管理员可修改/删除其他管理员
  if (userRole === 'Admin') return actorRole === 'Admin' && !!options.actorIsKeyLoginAdmin
  return staffRoleRank(actorRole) > staffRoleRank(userRole)
}

export function assignableRolesForActor(
  actorRole: string,
  bindableRoles: readonly string[] = ROLE_OPTIONS.map(r => r.value),
  options: RolePermissionOptions = {},
): string[] {
  return bindableRoles.filter(role => canActorAssignRole(actorRole, role, options))
}

export const OPS_WORKBENCH_PATH = '/pages/ops/index/index'

/** 角色管理可选项（顺序与登录角色类型一致） */
export const ROLE_OPTIONS = [
  { value: 'Counselor', label: '咨询师' },
  { value: 'Assistant', label: '咨询助理' },
  { value: 'Ops', label: '咨询主任' },
  { value: 'Patient', label: '来访' },
  { value: 'ContentOps', label: '内容运营' },
  { value: 'Marketing', label: '市场' },
  { value: 'Research', label: '科研' },
  { value: 'Tester', label: '测试员' },
  { value: 'Admin', label: '管理员' },
] as const

/** @deprecated 单账号单角色，请使用 resolveAccountRole */
export const ROLE_PRIORITY_LOW_TO_HIGH = [
  'Patient',
  'ContentOps',
  'Marketing',
  'Research',
  'Tester',
  'Counselor',
  'Assistant',
  'Ops',
  'Admin',
] as const

/** 测试员：仅管理员可赋权；可被管理员强制物理删除（含咨询/订单等业务数据） */
export const TESTER_ROLE = 'Tester'

/** 单账号唯一角色：优先 activeRole，否则取 roles[0] */
export function resolveAccountRole(roles?: string[], activeRole?: string | null): string {
  if (activeRole) return activeRole
  if (roles?.length) return roles[0]
  return 'Patient'
}

/** @deprecated 请使用 resolveAccountRole */
export function resolveHighestRole(roles?: string[]): string {
  return resolveAccountRole(roles)
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

export function usesOpsWorkbench(role: string): boolean {
  return (STAFF_OPS_WORKBENCH_ROLES as readonly string[]).includes(role)
}

/** 可编辑咨询师介绍页、调整代理预约待支付时限等一线运营设置 */
export function canManageStaffOperationalSettings(role: string): boolean {
  return usesOpsWorkbench(role)
}
