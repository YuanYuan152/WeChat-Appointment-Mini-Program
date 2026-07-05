/** 系统角色中文名（与角色管理、登录选择一致） */
export const ROLE_LABELS: Record<string, string> = {
  Patient: '来访',
  Counselor: '咨询师',
  Assistant: '咨询助理',
  Ops: '咨询主任',
  Admin: '管理员',
}

/** 使用运营管理工作台（/pages/ops）的角色 */
export const STAFF_OPS_WORKBENCH_ROLES = ['Assistant', 'Ops', 'Admin'] as const

export const OPS_WORKBENCH_PATH = '/pages/ops/index/index'

/** 角色管理可绑定选项（顺序与登录角色类型一致） */
export const ROLE_OPTIONS = [
  { value: 'Counselor', label: '咨询师' },
  { value: 'Assistant', label: '咨询助理' },
  { value: 'Ops', label: '咨询主任' },
  { value: 'Patient', label: '来访' },
  { value: 'Admin', label: '管理员' },
] as const

/** 角色等级由低到高；登录与界面展示取已绑定角色中的最高等级 */
export const ROLE_PRIORITY_LOW_TO_HIGH = [
  'Patient',
  'Counselor',
  'Assistant',
  'Ops',
  'Admin',
] as const

export function resolveHighestRole(roles?: string[]): string {
  const set = new Set(roles || [])
  for (let i = ROLE_PRIORITY_LOW_TO_HIGH.length - 1; i >= 0; i--) {
    const role = ROLE_PRIORITY_LOW_TO_HIGH[i]
    if (set.has(role)) return role
  }
  return 'Patient'
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

export function usesOpsWorkbench(role: string): boolean {
  return (STAFF_OPS_WORKBENCH_ROLES as readonly string[]).includes(role)
}
