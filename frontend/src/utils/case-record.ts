/** 咨询记录：内容判定与咨询师端跳转 */
export interface CaseRecordLike {
  Subjective?: string
  Objective?: string
  Assessment?: string
  Plan?: string
  PhotoUrls?: string[]
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  photoUrls?: string[]
}

export const caseRecordHasContent = (data?: CaseRecordLike | null): boolean => {
  if (!data) return false
  const photos = data.PhotoUrls ?? data.photoUrls ?? []
  return Boolean(
    String(data.Subjective ?? data.subjective ?? '').trim()
    || String(data.Objective ?? data.objective ?? '').trim()
    || String(data.Assessment ?? data.assessment ?? '').trim()
    || String(data.Plan ?? data.plan ?? '').trim()
    || photos.length > 0,
  )
}

export const openCounselorCaseRecord = (opts: {
  consultationId: number
  recordId?: number | null
  hasRecord?: boolean
}) => {
  const { consultationId, recordId, hasRecord } = opts
  if (!consultationId && !recordId) return
  if ((hasRecord || recordId) && recordId) {
    uni.navigateTo({ url: `/pages/counselor/case-record/view?recordId=${recordId}` })
    return
  }
  uni.navigateTo({ url: `/pages/counselor/case-record/edit?consultationId=${consultationId}` })
}
