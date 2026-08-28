import { COUNSELOR_TYPE_OPTIONS, PATIENT_SOURCE_OPTIONS } from '@/constants/userRoleMeta'

export const ROLE_GROUP_OPTIONS = [
  { value: '', label: '全部角色' },
  { value: 'counselor', label: '咨询师' },
  { value: 'patient', label: '来访' },
  { value: 'staff', label: '后台管理者' },
] as const

export type RoleGroupValue = typeof ROLE_GROUP_OPTIONS[number]['value']

export const ROLE_GROUP_SUBTYPE_ALL = ''

export const ROLE_GROUP_SUBTYPE_OPTIONS: Record<
  Exclude<RoleGroupValue, ''>,
  Array<{ value: string; label: string }>
> = {
  counselor: [...COUNSELOR_TYPE_OPTIONS],
  patient: [...PATIENT_SOURCE_OPTIONS],
  staff: [],
}

export function subtypeOptionsForRoleGroup(roleGroup: RoleGroupValue) {
  if (!roleGroup || roleGroup === 'staff') {
    return []
  }
  return ROLE_GROUP_SUBTYPE_OPTIONS[roleGroup] ?? []
}

export function subtypeSelectOptionsForRoleGroup(roleGroup: RoleGroupValue) {
  const options = subtypeOptionsForRoleGroup(roleGroup)
  if (!options.length) {
    return []
  }
  return [{ value: ROLE_GROUP_SUBTYPE_ALL, label: '全部类型' }, ...options]
}
