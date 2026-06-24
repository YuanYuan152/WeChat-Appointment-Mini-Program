<template>
  <view class="page-case-record">
    <view class="tip-banner">
      <text>{{ isAmendment ? '修改内容需管理员审核通过后才会生效' : '请一次性完整填写并提交，提交后不可修改' }}</text>
    </view>

    <view class="form-section">
      <CaseRecordHeaderForm v-model="headerInfo" />
    </view>

    <view class="form-section">
      <text class="form-section-title">来访者的主观描述<text class="required">*</text></text>
      <text class="form-hint">{{ CASE_RECORD_SECTION_HINTS.subjective }}</text>
      <textarea
        class="form-textarea"
        v-model="form.subjective"
        placeholder="请记录来访者主观陈述..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">对来访者客观描述<text class="required">*</text></text>
      <text class="form-hint">{{ CASE_RECORD_SECTION_HINTS.objective }}</text>
      <textarea
        class="form-textarea"
        v-model="form.objective"
        placeholder="请记录客观观察与测试结果..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">咨询师对个案的风险等级评估、以及对来访者的问题和咨询过程的评估<text class="required">*</text></text>
      <textarea
        class="form-textarea"
        v-model="form.assessment"
        placeholder="请记录风险等级判断、问题分析与咨询过程评估..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">本次咨询要点及处理<text class="required">*</text></text>
      <text class="form-hint">{{ CASE_RECORD_SECTION_HINTS.plan }}</text>
      <textarea
        class="form-textarea"
        v-model="form.plan"
        placeholder="请记录咨询要点与处理措施..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <CaseRecordRiskForm v-model="riskAssessment" />
    </view>

    <view v-if="isAmendment" class="form-section">
      <text class="form-section-title">修改说明</text>
      <text class="form-hint">选填，可向管理员说明修改原因</text>
      <textarea
        class="form-textarea"
        v-model="amendReason"
        placeholder="例如：补充遗漏的观察内容..."
        :auto-height="true"
        :maxlength="500"
      />
    </view>

    <button class="save-btn" :loading="saving" @tap="save">{{ isAmendment ? '提交修改申请' : '提交咨询记录' }}</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { caseRecordHasContent } from '@/utils/case-record'
import CaseRecordRiskForm from '@/components/CaseRecordRiskForm.vue'
import CaseRecordHeaderForm from '@/components/CaseRecordHeaderForm.vue'
import {
  CASE_RECORD_FIELD_LABELS,
  createEmptyRiskAssessment,
  crisisLevelRequiresReport,
  normalizeRiskAssessment,
  riskAssessmentMissingLabel,
  type RiskAssessmentData,
} from '@/constants/caseRecordRiskAssessment'
import {
  CASE_RECORD_SECTION_HINTS,
  createEmptyHeaderInfo,
  headerInfoIsComplete,
  headerInfoMissingLabel,
  normalizeHeaderInfo,
  HEADER_FIELD_KEYS,
  type CaseRecordHeaderInfo,
} from '@/constants/caseRecordHeader'

type FormKey = 'subjective' | 'objective' | 'assessment' | 'plan'

const REQUIRED_FIELDS: { key: FormKey; label: string }[] = [
  { key: 'subjective', label: CASE_RECORD_FIELD_LABELS.subjective },
  { key: 'objective', label: CASE_RECORD_FIELD_LABELS.objective },
  { key: 'assessment', label: CASE_RECORD_FIELD_LABELS.assessment },
  { key: 'plan', label: CASE_RECORD_FIELD_LABELS.plan },
]

const mergeHeaderInfo = (
  saved?: Partial<CaseRecordHeaderInfo> | null,
  defaults?: Partial<CaseRecordHeaderInfo> | null,
): CaseRecordHeaderInfo => {
  const s = normalizeHeaderInfo(saved)
  const d = normalizeHeaderInfo(defaults)
  const out = createEmptyHeaderInfo()
  for (const key of HEADER_FIELD_KEYS) {
    out[key] = s[key] || d[key]
  }
  return out
}

const form = ref({ subjective: '', objective: '', assessment: '', plan: '' })
const headerInfo = ref<CaseRecordHeaderInfo>(createEmptyHeaderInfo())
const riskAssessment = ref<RiskAssessmentData>(createEmptyRiskAssessment())
const saving = ref(false)
const consultationId = ref(0)
const recordId = ref(0)
const isAmendment = ref(false)
const amendReason = ref('')

const loadFormDefaults = async (cid: number) => {
  if (!cid) return createEmptyHeaderInfo()
  const res = await httpV2.get<{ HeaderInfo?: CaseRecordHeaderInfo }>(
    API_ENDPOINTS.counselor.caseRecordFormDefaults(cid),
    undefined,
    { showLoading: false, showError: false },
  )
  if (res.code === 0 && res.data?.HeaderInfo) {
    return normalizeHeaderInfo(res.data.HeaderInfo)
  }
  return createEmptyHeaderInfo()
}

const loadExistingDraft = async (rid: number) => {
  const res = await httpV2.get(`${API_ENDPOINTS.counselor.caseRecords}/${rid}`, undefined, {
    showLoading: false,
  })
  if (res.code !== 0 || !res.data) return
  if (caseRecordHasContent(res.data) && !isAmendment.value) {
    uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${rid}` })
    return
  }
  if (isAmendment.value && res.data.AmendmentStatus === 'PENDING') {
    uni.showToast({ title: '已有待审核的修改申请', icon: 'none' })
    setTimeout(() => uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${rid}` }), 1200)
    return
  }
  form.value = {
    subjective: res.data.Subjective ?? '',
    objective: res.data.Objective ?? '',
    assessment: res.data.Assessment ?? '',
    plan: res.data.Plan ?? '',
  }
  riskAssessment.value = normalizeRiskAssessment(res.data.RiskAssessment)
  if (res.data.ConsultationId) consultationId.value = res.data.ConsultationId
  if (headerInfoIsComplete(res.data.HeaderInfo)) {
    headerInfo.value = normalizeHeaderInfo(res.data.HeaderInfo)
  } else if (res.data.ConsultationId) {
    const defaults = await loadFormDefaults(res.data.ConsultationId)
    headerInfo.value = mergeHeaderInfo(res.data.HeaderInfo, defaults)
  } else {
    headerInfo.value = normalizeHeaderInfo(res.data.HeaderInfo)
  }
}

onLoad(async (opts) => {
  consultationId.value = Number(opts?.consultationId || 0)
  recordId.value = Number(opts?.recordId || 0)
  isAmendment.value = opts?.mode === 'amendment'
  if (recordId.value) {
    await loadExistingDraft(recordId.value)
  } else if (consultationId.value) {
    headerInfo.value = await loadFormDefaults(consultationId.value)
  }
})

const validateForm = () => {
  const headerMissing = headerInfoMissingLabel(headerInfo.value)
  if (headerMissing) {
    uni.showToast({ title: `请填写：${headerMissing}`, icon: 'none' })
    return false
  }
  const missing = REQUIRED_FIELDS.filter(({ key }) => !form.value[key].trim()).map(({ label }) => label)
  if (missing.length) {
    uni.showToast({ title: `请填写：${missing[0]}`, icon: 'none' })
    return false
  }
  const riskMissing = riskAssessmentMissingLabel(riskAssessment.value)
  if (riskMissing) {
    uni.showToast({ title: `请完成：${riskMissing}`, icon: 'none' })
    return false
  }
  return true
}

const buildPayload = () => ({
  ...form.value,
  risk_assessment: riskAssessment.value,
  header_info: headerInfo.value,
  photo_urls: [],
})

const save = async () => {
  if (!validateForm()) return
  if (isAmendment.value) {
    if (!recordId.value) {
      uni.showToast({ title: '缺少记录编号', icon: 'none' })
      return
    }
    saving.value = true
    try {
      const res = await httpV2.post(
        API_ENDPOINTS.counselor.caseRecordAmendmentRequest(recordId.value),
        { ...buildPayload(), reason: amendReason.value.trim() || undefined },
      )
      if (res.code === 0) {
        uni.showToast({ title: '修改申请已提交', icon: 'success' })
        setTimeout(() => {
          uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${recordId.value}` })
        }, 1200)
      } else {
        uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
      }
    } finally {
      saving.value = false
    }
    return
  }
  if (!consultationId.value) {
    uni.showToast({ title: '缺少咨询参数，请返回重试', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.counselor.caseRecords, {
      consultation_id: consultationId.value,
      ...buildPayload(),
    })
    if (res.code === 0) {
      const needReport = crisisLevelRequiresReport(riskAssessment.value)
      uni.showToast({
        title: needReport ? '提交成功，请完成上报' : '提交成功',
        icon: 'success',
      })
      const newId = res.data?.Id
      setTimeout(() => {
        if (newId) {
          uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${newId}` })
        } else {
          uni.navigateBack()
        }
      }, 1200)
    } else {
      uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page-case-record { padding: 32rpx; background: #F4F6F8; min-height: 100vh; padding-bottom: 48rpx; }
.tip-banner {
  background: #EFF6FF;
  border: 1rpx solid #BFDBFE;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 24rpx;
  font-size: 24rpx;
  color: #1D4ED8;
  text-align: center;
}
.form-section {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.form-section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 16rpx;
  line-height: 1.5;
}
.sub-block-title {
  display: block;
  margin-top: 28rpx;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
}
.required { color: #DC2626; margin-left: 4rpx; }
.form-hint {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-bottom: 16rpx;
  line-height: 1.5;
}
.form-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.6;
}
.save-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  margin-top: 8rpx;
}
</style>
