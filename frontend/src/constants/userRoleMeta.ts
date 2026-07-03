/** 来访来源（添加来访角色时必选；小程序自主注册默认为 MINI_PROGRAM） */
export const PATIENT_SOURCE_OPTIONS = [
  { value: 'MINI_PROGRAM', label: '小程序注册' },
  { value: 'CHARITY_VISITOR', label: '公益来访' },
  { value: 'CHARITY_PROJECT_1', label: '公益项目1' },
  { value: 'CHARITY_PROJECT_2', label: '公益项目2' },
  { value: 'HOSPITAL', label: '医院' },
] as const

/** 可查看公益咨询师的来访来源 */
export const CHARITY_PATIENT_SOURCES = new Set([
  'CHARITY_VISITOR',
  'CHARITY_PROJECT_1',
  'CHARITY_PROJECT_2',
])

/** 咨询师类型（添加咨询师角色时必选） */
export const COUNSELOR_TYPE_OPTIONS = [
  { value: 'CHARITY', label: '公益咨询师' },
  { value: 'PROFESSIONAL', label: '专业咨询师' },
] as const

export type PatientSource = typeof PATIENT_SOURCE_OPTIONS[number]['value']
export type CounselorType = typeof COUNSELOR_TYPE_OPTIONS[number]['value']

export function patientSourceLabel(code?: string | null): string {
  if (!code) return ''
  return PATIENT_SOURCE_OPTIONS.find(o => o.value === code)?.label || code
}

export function counselorTypeLabel(code?: string | null): string {
  if (!code) return ''
  return COUNSELOR_TYPE_OPTIONS.find(o => o.value === code)?.label || code
}

export function isCharityPatientSource(code?: string | null): boolean {
  return !!code && CHARITY_PATIENT_SOURCES.has(code as typeof PATIENT_SOURCE_OPTIONS[number]['value'])
}
