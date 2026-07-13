/** 来访者签约状态展示 */

export interface PatientContractFields {
  name?: string
  contractTag?: string | null
  isContractSigned?: boolean
  boundCounselorId?: number | null
  boundCounselorName?: string | null
}

export function patientContractTag(item?: PatientContractFields | null): string {
  if (!item?.contractTag) return ''
  return String(item.contractTag)
}

export function isContractSignedLabel(signed?: boolean): string {
  return signed ? '是' : '否'
}

export function boundCounselorLabel(name?: string | null): string {
  return name?.trim() || '未绑定'
}

export function formatPatientInline(name?: string, contractTag?: string | null): string {
  if (!name) return ''
  const tag = contractTag?.trim()
  return tag ? `${name} ${tag}` : name
}

/** 消息/详情 JSON 中的来访者展示名（兼容多种字段名） */
export function patientNameFromDetail(detail?: Record<string, unknown> | null): string {
  if (!detail) return ''
  const name = String(detail.patientName || detail.name || '')
  const tag = (detail.patientContractTag || detail.contractTag) as string | null | undefined
  return formatPatientInline(name, tag)
}
