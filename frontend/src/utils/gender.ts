/** 统一账号性别展示/提交（咨询师筛选等场景仅支持男/女） */
export function normalizeCounselorGender(raw?: string | null): '' | '男' | '女' {
  const value = String(raw || '').trim()
  if (value === '男' || value === '女') return value
  const lower = value.toLowerCase()
  if (['male', 'm', 'man', '1'].includes(lower)) return '男'
  if (['female', 'f', 'woman', '2'].includes(lower)) return '女'
  return ''
}

export function normalizeProfileGender(raw?: string | null): string {
  const counselorGender = normalizeCounselorGender(raw)
  if (counselorGender) return counselorGender
  const value = String(raw || '').trim()
  if (value === '其他') return '其他'
  return ''
}
