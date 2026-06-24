/** 心理咨询个案记录表表头（与后端 case_record_header_config.py 保持一致） */

export interface CaseRecordHeaderInfo {
  code: string
  gender: string
  consult_method: string
  session_number: string
  start_year: string
  start_month: string
  start_day: string
  start_hour: string
  start_minute: string
  end_hour: string
  end_minute: string
  counselor_signature: string
}

export const HEADER_FIELD_KEYS: (keyof CaseRecordHeaderInfo)[] = [
  'code',
  'gender',
  'consult_method',
  'session_number',
  'start_year',
  'start_month',
  'start_day',
  'start_hour',
  'start_minute',
  'end_hour',
  'end_minute',
  'counselor_signature',
]

export const HEADER_FIELD_LABELS: Record<keyof CaseRecordHeaderInfo, string> = {
  code: '代码',
  gender: '性别',
  consult_method: '咨询方式',
  session_number: '咨询次数',
  start_year: '咨询开始年份',
  start_month: '咨询开始月份',
  start_day: '咨询开始日期',
  start_hour: '咨询开始小时',
  start_minute: '咨询开始分钟',
  end_hour: '咨询结束小时',
  end_minute: '咨询结束分钟',
  counselor_signature: '咨询师签名',
}

export const createEmptyHeaderInfo = (): CaseRecordHeaderInfo => ({
  code: '',
  gender: '',
  consult_method: '',
  session_number: '',
  start_year: '',
  start_month: '',
  start_day: '',
  start_hour: '',
  start_minute: '',
  end_hour: '',
  end_minute: '',
  counselor_signature: '',
})

export const normalizeHeaderInfo = (raw?: Partial<CaseRecordHeaderInfo> | null): CaseRecordHeaderInfo => {
  const base = createEmptyHeaderInfo()
  if (!raw) return base
  for (const key of HEADER_FIELD_KEYS) {
    const val = raw[key]
    if (val != null) base[key] = String(val).trim()
  }
  return base
}

export const headerInfoIsComplete = (data?: CaseRecordHeaderInfo | null): boolean =>
  HEADER_FIELD_KEYS.every(key => Boolean(String(data?.[key] ?? '').trim()))

export const headerInfoMissingLabel = (data?: CaseRecordHeaderInfo | null): string | null => {
  const normalized = normalizeHeaderInfo(data)
  for (const key of HEADER_FIELD_KEYS) {
    if (!normalized[key]) return HEADER_FIELD_LABELS[key]
  }
  return null
}

export const formatHeaderInfoText = (data?: CaseRecordHeaderInfo | null): string => {
  const h = normalizeHeaderInfo(data)
  const lines = [
    `代码：${h.code || '—'}`,
    `性别：${h.gender || '—'}`,
    `咨询方式：${h.consult_method || '—'}`,
    `咨询次数：第${h.session_number || '—'}次`,
    `咨询时间：${h.start_year || '—'}年${h.start_month || '—'}月${h.start_day || '—'}日 ${h.start_hour || '—'}时${h.start_minute || '—'}分 — ${h.end_hour || '—'}时${h.end_minute || '—'}分`,
    `咨询师签名：${h.counselor_signature || '—'}`,
  ]
  return lines.join('\n')
}

export const CASE_RECORD_FORM_TITLE = '心理咨询个案记录表'

export const CASE_RECORD_SECTION_HINTS = {
  subjective: '本周来访者主诉变化情况、与咨询师约定的任务完成情况、自身学业、生活情况及其它来访者主动报告的情况等',
  objective: '咨询师的观察、测试结果、医院就诊结果等',
  plan: '本次咨询目标、方案、及当前会谈的效果，包括使用主要咨询方法及技术、作业、以及对风险的处理措施',
} as const
