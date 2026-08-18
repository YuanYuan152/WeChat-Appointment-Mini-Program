/** 对外统一的来访类型；历史值仅用于兼容显示与公益判断。 */
export const PATIENT_SOURCE_OPTIONS = [
  { value: 'CHARITY', label: '公益' },
  { value: 'PROFESSIONAL', label: '正价' },
  { value: 'HOSPITAL', label: '医院' },
] as const

export const PATIENT_SOURCE_DETAIL_OPTIONS = [
  '小红书',
  '大众点评',
  '公众号',
  '医院转出',
  '来访推荐',
  '老来访',
  '医生推荐',
  '其他',
] as const

export const CHARITY_PATIENT_SOURCES = new Set<string>([
  'CHARITY',
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
  if (code === 'MINI_PROGRAM') return '正价'
  if (CHARITY_PATIENT_SOURCES.has(code)) return '公益'
  return PATIENT_SOURCE_OPTIONS.find(o => o.value === code)?.label || code
}

export function counselorTypeLabel(code?: string | null): string {
  if (!code) return ''
  return COUNSELOR_TYPE_OPTIONS.find(o => o.value === code)?.label || code
}

export function isCharityPatientSource(code?: string | null): boolean {
  return !!code && CHARITY_PATIENT_SOURCES.has(code)
}
