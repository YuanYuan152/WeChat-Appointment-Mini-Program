<template>
  <view class="page-case-record-amendments">
    <view class="filter-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ active: activeTab === tab.value }"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="items.length === 0" class="empty">暂无{{ activeTabLabel }}申请</view>
    <view v-else class="list">
      <view v-for="item in items" :key="item.id" class="card" @click="openDetail(item)">
        <view class="card-head">
          <text class="counselor">{{ item.counselorName }}</text>
          <text class="status" :class="item.status.toLowerCase()">{{ statusLabel(item.status) }}</text>
        </view>
        <text class="line">记录编号：#{{ item.caseRecordId }}</text>
        <text class="line">咨询时段：{{ formatTime(item.consultationStartTime) }}</text>
        <text v-if="item.reason" class="reason-preview">说明：{{ item.reason }}</text>
        <text class="time">提交于 {{ formatTime(item.createdAt) }}</text>
      </view>
    </view>

    <view v-if="showDetail && detail" class="overlay" @touchmove.stop.prevent>
      <view class="detail-card" @tap.stop>
        <text class="detail-title">{{ showRejectInput ? '填写驳回理由' : '咨询记录修改审核' }}</text>

        <view v-if="showRejectInput" class="reject-panel">
          <text class="reject-form-hint">驳回理由将通知咨询师，请简要说明不予修改的原因</text>
          <textarea
            :value="rejectReason"
            class="reject-textarea"
            placeholder="请说明不予修改的原因"
            maxlength="500"
            :fixed="true"
            :show-confirm-bar="false"
            @input="onRejectReasonInput"
          />
          <view class="reject-actions">
            <button class="btn ghost" :disabled="processing" @tap.stop="cancelReject">取消</button>
            <button class="btn reject" :loading="processing" @tap.stop="reject">确认驳回</button>
          </view>
        </view>

        <template v-else>
          <scroll-view scroll-y class="detail-scroll">
            <view class="detail-body">
              <view class="detail-row">
                <text class="label">咨询师</text>
                <text class="value">{{ detail.counselorName }}</text>
              </view>
              <view class="detail-row">
                <text class="label">记录编号</text>
                <text class="value">#{{ detail.caseRecordId }}</text>
              </view>
              <view class="detail-row">
                <text class="label">咨询时段</text>
                <text class="value">{{ formatTime(detail.consultationStartTime) }}</text>
              </view>
              <view v-if="detail.reason" class="reason-box">
                <text class="reason-label">修改说明</text>
                <text class="reason-text">{{ detail.reason }}</text>
              </view>

              <view v-for="field in diffFields" :key="field.key" class="diff-section">
                <text class="diff-title">{{ field.label }}</text>
                <view class="diff-block">
                  <text class="diff-label">原内容</text>
                  <text class="diff-text old">{{ field.current || '—' }}</text>
                </view>
                <view class="diff-block proposed">
                  <text class="diff-label">拟修改为</text>
                  <text class="diff-text">{{ field.proposed || '—' }}</text>
                </view>
              </view>

              <view v-if="headerDiffChanged" class="diff-section">
                <text class="diff-title">表头信息</text>
                <view class="diff-block">
                  <text class="diff-label">原内容</text>
                  <text class="diff-text old">{{ headerDiffCurrent }}</text>
                </view>
                <view class="diff-block proposed">
                  <text class="diff-label">拟修改为</text>
                  <text class="diff-text">{{ headerDiffProposed }}</text>
                </view>
              </view>

              <view v-if="riskDiffChanged" class="diff-section">
                <text class="diff-title">个案风险评估表</text>
                <view class="diff-block">
                  <text class="diff-label">原内容</text>
                  <text class="diff-text old">{{ riskDiffCurrent }}</text>
                </view>
                <view class="diff-block proposed">
                  <text class="diff-label">拟修改为</text>
                  <text class="diff-text">{{ riskDiffProposed }}</text>
                </view>
              </view>

              <view v-if="detail.status === 'REJECTED' && detail.rejectReason" class="reject-box">
                <text class="reason-label">驳回理由</text>
                <text class="reason-text">{{ detail.rejectReason }}</text>
              </view>
            </view>
          </scroll-view>

          <view v-if="detail.status === 'PENDING'" class="actions">
            <button class="btn reject" :disabled="processing" @tap.stop="openRejectForm">驳回</button>
            <button class="btn approve" :loading="processing" @tap.stop="approve">同意修改</button>
          </view>
          <button v-else class="btn close" @tap.stop="closeDetail">关闭</button>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import {
  CASE_RECORD_FIELD_LABELS,
  formatRiskAssessmentText,
  normalizeRiskAssessment,
  type RiskAssessmentData,
} from '@/constants/caseRecordRiskAssessment'
import {
  formatHeaderInfoText,
  normalizeHeaderInfo,
  type CaseRecordHeaderInfo,
} from '@/constants/caseRecordHeader'

interface Snapshot {
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  riskAssessment?: RiskAssessmentData | null
  headerInfo?: CaseRecordHeaderInfo | null
  photoUrls?: string[]
}

interface AmendmentItem {
  id: number
  caseRecordId: number
  consultationId: number
  counselorId: number
  counselorName: string
  reason?: string
  status: string
  rejectReason?: string
  consultationStartTime?: string
  createdAt: string
  reviewedAt?: string
  current: Snapshot
  proposed: Snapshot
}

const FIELD_LABELS: { key: keyof Snapshot; label: string }[] = [
  { key: 'subjective', label: CASE_RECORD_FIELD_LABELS.subjective },
  { key: 'objective', label: CASE_RECORD_FIELD_LABELS.objective },
  { key: 'assessment', label: CASE_RECORD_FIELD_LABELS.assessment },
  { key: 'plan', label: CASE_RECORD_FIELD_LABELS.plan },
]

const tabs = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '全部', value: 'ALL' },
]

const activeTab = ref('PENDING')
const items = ref<AmendmentItem[]>([])
const loading = ref(true)
const showDetail = ref(false)
const detail = ref<AmendmentItem | null>(null)
const processing = ref(false)
const showRejectInput = ref(false)
const rejectReason = ref('')

const activeTabLabel = computed(() => tabs.find(t => t.value === activeTab.value)?.label || '')

const diffFields = computed(() => {
  if (!detail.value) return []
  const { current, proposed } = detail.value
  return FIELD_LABELS.map(({ key, label }) => ({
    key,
    label,
    current: (current[key] as string) || '',
    proposed: (proposed[key] as string) || '',
  }))
})

const riskDiffCurrent = computed(() =>
  formatRiskAssessmentText(normalizeRiskAssessment(detail.value?.current.riskAssessment)) || '—',
)
const riskDiffProposed = computed(() =>
  formatRiskAssessmentText(normalizeRiskAssessment(detail.value?.proposed.riskAssessment)) || '—',
)
const riskDiffChanged = computed(() => riskDiffCurrent.value !== riskDiffProposed.value)

const headerDiffCurrent = computed(() =>
  formatHeaderInfoText(normalizeHeaderInfo(detail.value?.current.headerInfo)) || '—',
)
const headerDiffProposed = computed(() =>
  formatHeaderInfoText(normalizeHeaderInfo(detail.value?.proposed.headerInfo)) || '—',
)
const headerDiffChanged = computed(() => headerDiffCurrent.value !== headerDiffProposed.value)

const formatTime = (value?: string) => {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

const statusLabel = (s: string) => {
  if (s === 'PENDING') return '待审核'
  if (s === 'APPROVED') return '已通过'
  if (s === 'REJECTED') return '已驳回'
  return s
}

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<AmendmentItem[]>(
      API_ENDPOINTS.admin.caseRecordAmendments,
      { status: activeTab.value },
      { showLoading: false },
    )
    if (res.code === 0 && Array.isArray(res.data)) {
      items.value = res.data
    } else {
      items.value = []
      const msg = res.msg || (res.code === 403 ? '请使用管理员或运营账号登录' : '加载失败')
      uni.showToast({ title: msg, icon: 'none', duration: 2500 })
    }
  } catch (err: any) {
    items.value = []
    uni.showToast({ title: err?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const switchTab = (value: string) => {
  if (activeTab.value === value) return
  activeTab.value = value
  load()
}

const openDetail = (item: AmendmentItem) => {
  detail.value = item
  showRejectInput.value = false
  rejectReason.value = ''
  showDetail.value = true
}

const openRejectForm = () => {
  rejectReason.value = ''
  showRejectInput.value = true
}

const cancelReject = () => {
  showRejectInput.value = false
  rejectReason.value = ''
}

const onRejectReasonInput = (e: { detail?: { value?: string } }) => {
  rejectReason.value = e.detail?.value ?? ''
}

const closeDetail = () => {
  showDetail.value = false
  detail.value = null
  showRejectInput.value = false
  rejectReason.value = ''
}

const approve = async () => {
  if (!detail.value || processing.value) return
  processing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.admin.caseRecordAmendmentApprove(detail.value.id))
    if (res.code === 0) {
      uni.showToast({ title: res.data?.message || '已同意修改', icon: 'success' })
      closeDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
  } finally {
    processing.value = false
  }
}

const reject = async () => {
  if (!detail.value || processing.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    uni.showToast({ title: '请填写驳回理由', icon: 'none' })
    return
  }
  processing.value = true
  try {
    const res = await httpV2.post(
      API_ENDPOINTS.admin.caseRecordAmendmentReject(detail.value.id),
      { reject_reason: reason },
    )
    if (res.code === 0) {
      uni.showToast({ title: '已驳回，原记录维持不变', icon: 'success' })
      closeDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
  } finally {
    processing.value = false
  }
}

onShow(load)
</script>

<style scoped>
.page-case-record-amendments { min-height: 100vh; background: #F7F5F2; padding: 24rpx; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 24rpx; }
.filter-tab {
  padding: 12rpx 24rpx; border-radius: 999rpx; font-size: 24rpx;
  background: #fff; color: #6B6560; border: 1rpx solid #E8E4DE;
}
.filter-tab.active { background: #3D5A4E; color: #fff; border-color: #3D5A4E; }
.empty { text-align: center; color: #8A8A8A; padding: 80rpx 0; font-size: 28rpx; }
.list { display: flex; flex-direction: column; gap: 20rpx; }
.card {
  background: #fff; border-radius: 20rpx; padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.counselor { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.status { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 999rpx; }
.status.pending { background: #FEF3C7; color: #B45309; }
.status.approved { background: #D1FAE5; color: #047857; }
.status.rejected { background: #FEE2E2; color: #B91C1C; }
.line { display: block; font-size: 24rpx; color: #6B6560; line-height: 1.7; }
.reason-preview {
  display: block; margin-top: 12rpx; font-size: 24rpx; color: #4B5563;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.time { display: block; margin-top: 12rpx; font-size: 22rpx; color: #9CA3AF; }
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; padding: 32rpx; z-index: 1000;
}
.detail-card {
  width: 100%; max-width: 680rpx; max-height: 85vh; background: #fff; border-radius: 24rpx; padding: 32rpx;
  display: flex; flex-direction: column;
}
.detail-title { display: block; text-align: center; font-size: 34rpx; font-weight: 700; margin-bottom: 16rpx; flex-shrink: 0; }
.detail-scroll { flex: 1; max-height: 55vh; }
.detail-row { display: flex; justify-content: space-between; gap: 20rpx; margin-bottom: 16rpx; }
.label { font-size: 26rpx; color: #8A8A8A; flex-shrink: 0; }
.value { font-size: 26rpx; color: #2C2C2C; text-align: right; }
.reason-box, .reject-box {
  margin-top: 16rpx; background: #F9FAFB; border-radius: 16rpx; padding: 20rpx;
}
.reject-box { background: #FEF2F2; border: 1rpx solid #FECACA; }
.reason-label { display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 8rpx; }
.reason-text { display: block; font-size: 26rpx; color: #374151; line-height: 1.6; }
.diff-section { margin-top: 20rpx; }
.diff-title { display: block; font-size: 26rpx; font-weight: 600; color: #374151; margin-bottom: 10rpx; }
.diff-block { background: #F9FAFB; border-radius: 12rpx; padding: 16rpx; margin-bottom: 8rpx; }
.diff-block.proposed { background: #EFF6FF; border: 1rpx solid #BFDBFE; }
.diff-label { display: block; font-size: 22rpx; color: #9CA3AF; margin-bottom: 6rpx; }
.diff-text { display: block; font-size: 24rpx; color: #374151; line-height: 1.6; white-space: pre-wrap; }
.diff-text.old { color: #6B7280; }
.actions { display: flex; gap: 16rpx; margin-top: 20rpx; flex-shrink: 0; }
.reject-panel { flex-shrink: 0; }
.reject-form-hint {
  display: block;
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.6;
  margin-bottom: 16rpx;
}
.reject-textarea {
  width: 100%;
  height: 160rpx;
  box-sizing: border-box;
  background: #F9FAFB;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
  line-height: 1.5;
}
.reject-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.btn {
  flex: 1; height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; border: none;
}
.btn::after { border: none; }
.btn.approve { background: #3D5A4E; color: #fff; }
.btn.reject { background: #FEE2E2; color: #B91C1C; }
.btn.close { width: 100%; margin-top: 20rpx; background: #F0EDE8; color: #3D5A4E; flex: none; }
.btn.ghost { background: #fff; color: #6B6560; border: 1rpx solid #E8E4DE; }
</style>
