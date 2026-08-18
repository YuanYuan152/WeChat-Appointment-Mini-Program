<template>
  <view class="page-detail">
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="!detail" class="empty">来访者不存在</view>
    <view v-else class="content-wrap">
      <view class="profile-card">
        <view class="profile-title-row">
          <text class="profile-name">{{ detail.name }}</text>
          <PatientContractBadge :item="detail" />
          <text v-if="detail.typeLabel" class="type-badge">{{ detail.typeLabel }}</text>
        </view>
        <StaffRemarkEditor
          :account-id="patientIdRef"
          v-model="staffRemark"
        />
        <view class="info-row">
          <text class="label">手机号</text>
          <text class="value">{{ detail.mobile || '未填写' }}</text>
        </view>
        <view v-if="detail.gender" class="info-row">
          <text class="label">性别</text>
          <text class="value">{{ genderLabel(detail.gender) }}</text>
        </view>
        <view class="info-row">
          <text class="label">来访类型</text>
          <picker
            class="value"
            :disabled="sourceSaving"
            :range="patientSourceLabels"
            :value="patientSourceIndex"
            @change="changePatientSource"
          >
            <view class="picker-value">
              {{ patientSourceLabel || '请选择来访类型' }} <text class="picker-arrow">▾</text>
            </view>
          </picker>
        </view>
        <view class="info-row">
          <text class="label">来访来源</text>
          <picker
            class="value"
            :disabled="sourceSaving"
            :range="patientSourceDetailOptions"
            :value="patientSourceDetailIndex"
            @change="changePatientSourceDetail"
          >
            <view class="picker-value">
              {{ patientSourceDetail || '请选择来访来源' }} <text class="picker-arrow">▾</text>
            </view>
          </picker>
        </view>
        <view class="info-row">
          <text class="label">是否签约</text>
          <text class="value">{{ isContractSignedLabel(detail.isContractSigned) }}</text>
        </view>
        <view class="info-row">
          <text class="label">绑定咨询师</text>
          <text class="value">{{ boundCounselorLabel(detail.boundCounselorName) }}</text>
        </view>
        <view v-if="detail.emergencyContact || detail.emergencyPhone" class="info-row">
          <text class="label">紧急联系人</text>
          <text class="value">
            {{ detail.emergencyContact || '—' }}
            {{ detail.emergencyPhone ? ` ${detail.emergencyPhone}` : '' }}
          </text>
        </view>
        <view v-if="detail.feedbackCount > 0" class="feedback-entry" @tap="activeTab = 'feedback'">
          <text class="feedback-entry-label">已评价</text>
          <text class="feedback-entry-count">{{ detail.feedbackCount }} 条</text>
          <text class="feedback-entry-arrow">查看 ›</text>
        </view>
        <button class="proxy-btn" @tap="goProxyBooking">代理预约</button>
        <button class="bind-btn" @tap="openBindCounselor">
          {{ detail.boundCounselorId ? '更换签约咨询师' : '绑定签约咨询师' }}
        </button>
      </view>

      <view class="filter-bar">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeTab === tab.value }"
          @tap="activeTab = tab.value"
        >
          {{ tab.label }}
        </view>
      </view>

      <template v-if="activeTab === 'feedback'">
        <view v-if="!detail.feedbacks.length" class="empty-list">暂无评价记录</view>
        <view v-else class="feedback-list">
          <view
            v-for="item in detail.feedbacks"
            :key="item.id"
            class="feedback-card"
            @tap="openFeedbackDetail(item)"
          >
            <view class="cons-head">
              <text class="counselor">{{ item.counselorName }}</text>
              <text class="feedback-badge">已评价</text>
            </view>
            <text class="line">咨询时段：{{ formatRange(item.startTime, item.endTime) }}</text>
            <text class="line muted">提交于 {{ formatDT(item.createdAt) }}</text>
            <ConsultationFeedbackDisplay
              class="feedback-preview"
              :goal-score="item.goalScore"
              :rhythm-score="item.rhythmScore"
              :improvements="item.improvements"
              :summary="item.summary"
            />
          </view>
        </view>
      </template>

      <template v-else>
        <view v-if="filteredConsultations.length === 0" class="empty-list">暂无{{ activeTabLabel }}预约记录</view>
        <view v-else class="cons-list">
          <view v-for="item in filteredConsultations" :key="item.consultationId" class="cons-card">
            <view class="cons-head">
              <text class="counselor">{{ item.counselorName }}</text>
              <view class="status-wrap">
                <text v-if="item.hasFeedback" class="feedback-tag">已评价</text>
                <text class="status" :class="item.phase">{{ item.statusLabel }}</text>
              </view>
            </view>
            <text class="line">时间：{{ formatRange(item.startTime, item.endTime) }}</text>
            <text v-if="item.location" class="line">地点：{{ item.location }}</text>
            <text class="line muted">预约编号 #{{ item.consultationId }}</text>
            <view class="cons-actions">
              <text class="rebook-btn" @tap.stop="goRebook(item)">再约一单</text>
            </view>
          </view>
        </view>
      </template>
    </view>

    <view v-if="showFeedbackModal && feedbackDetail" class="overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop>
        <text class="modal-title">评价详情</text>
        <text class="modal-sub">{{ feedbackDetail.counselorName }} · {{ formatRange(feedbackDetail.startTime, feedbackDetail.endTime) }}</text>
        <ConsultationFeedbackDisplay
          :goal-score="feedbackDetail.goalScore"
          :rhythm-score="feedbackDetail.rhythmScore"
          :improvements="feedbackDetail.improvements"
          :summary="feedbackDetail.summary"
        />
        <button class="modal-btn" @click="showFeedbackModal = false">关闭</button>
      </view>
    </view>
    <view v-if="showBindModal" class="overlay" @touchmove.stop.prevent @tap="closeBindCounselor">
      <view class="modal-card bind-modal" @tap.stop>
        <text class="modal-title">选择签约咨询师</text>
        <text class="modal-sub">更换绑定后签约状态将变为「否」，须由咨询助理推送预约订单并选择《同心理咨询协议》或《“扬帆计划”协议》，来访支付签署后恢复已签约</text>
        <input
          v-model="counselorKeyword"
          class="bind-search"
          type="text"
          placeholder="搜索咨询师姓名"
          confirm-type="search"
          @confirm="loadCounselorOptions"
        />
        <scroll-view scroll-y class="counselor-pick-list">
          <view
            v-for="c in counselorOptions"
            :key="c.counselorId"
            class="counselor-pick-item"
            :class="{ active: selectedCounselorId === c.counselorId }"
            @tap="selectedCounselorId = c.counselorId"
          >
            <text class="pick-name">{{ c.name }}</text>
            <text v-if="c.typeLabel" class="pick-meta">{{ c.typeLabel }}</text>
          </view>
          <view v-if="!counselorOptions.length" class="pick-empty">暂无咨询师</view>
        </scroll-view>
        <view class="modal-btns">
          <button v-if="detail?.boundCounselorId" class="modal-btn ghost" @tap="saveBindCounselor(null)">解除绑定</button>
          <button class="modal-btn cancel" @tap="closeBindCounselor">取消</button>
          <button class="modal-btn confirm" :loading="bindSaving" @tap="saveBindCounselor(selectedCounselorId)">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import ConsultationFeedbackDisplay from '@/components/ConsultationFeedbackDisplay.vue'
import StaffRemarkEditor from '@/components/StaffRemarkEditor.vue'
import PatientContractBadge from '@/components/PatientContractBadge.vue'
import { boundCounselorLabel, isContractSignedLabel } from '@/utils/patientContract'
import {
  PATIENT_SOURCE_DETAIL_OPTIONS,
  PATIENT_SOURCE_OPTIONS,
} from '@/constants/userRoleMeta'

interface ConsultationItem {
  consultationId: number
  counselorId: number
  counselorName: string
  status: string
  statusLabel: string
  phase: string
  startTime?: string
  endTime?: string
  location?: string
  hasFeedback?: boolean
}

interface FeedbackItem {
  id: number
  consultationId: number
  counselorName: string
  startTime?: string
  endTime?: string
  goalScore?: number
  rhythmScore?: number
  improvements?: string[]
  summary: string
  createdAt: string
}

interface PatientDetail {
  patientId: number
  name: string
  mobile?: string
  gender?: string
  roleLabel?: string
  typeLabel?: string
  patientSource?: string
  patientSourceLabel?: string
  patientSourceDetail?: string
  isContractSigned?: boolean
  boundCounselorId?: number | null
  boundCounselorName?: string | null
  contractTag?: string | null
  emergencyContact?: string
  emergencyPhone?: string
  feedbackCount: number
  consultations: ConsultationItem[]
  feedbacks: FeedbackItem[]
  staffRemark?: string
}

interface CounselorOption {
  counselorId: number
  name: string
  typeLabel?: string
}

const tabs = [
  { value: 'ALL', label: '全部' },
  { value: 'upcoming', label: '即将开始' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
  { value: 'feedback', label: '已评价' },
]

const loading = ref(true)
const detail = ref<PatientDetail | null>(null)
const patientIdRef = ref(0)
const staffRemark = ref('')
const activeTab = ref('ALL')
const showFeedbackModal = ref(false)
const feedbackDetail = ref<FeedbackItem | null>(null)
const showBindModal = ref(false)
const bindSaving = ref(false)
const counselorKeyword = ref('')
const counselorOptions = ref<CounselorOption[]>([])
const selectedCounselorId = ref<number | null>(null)
const sourceSaving = ref(false)
const patientSource = ref('')
const patientSourceDetail = ref('')
const patientSourceLabels = PATIENT_SOURCE_OPTIONS.map(option => option.label)
const patientSourceDetailOptions = [...PATIENT_SOURCE_DETAIL_OPTIONS]

const activeTabLabel = computed(() => tabs.find(t => t.value === activeTab.value)?.label || '')
const patientSourceLabel = computed(
  () => PATIENT_SOURCE_OPTIONS.find(option => option.value === patientSource.value)?.label || '',
)
const patientSourceIndex = computed(
  () => Math.max(0, PATIENT_SOURCE_OPTIONS.findIndex(option => option.value === patientSource.value)),
)
const patientSourceDetailIndex = computed(
  () => Math.max(0, patientSourceDetailOptions.indexOf(patientSourceDetail.value as typeof PATIENT_SOURCE_DETAIL_OPTIONS[number])),
)

const filteredConsultations = computed(() => {
  if (!detail.value) return []
  if (activeTab.value === 'ALL') return detail.value.consultations
  return detail.value.consultations.filter(c => c.phase === activeTab.value)
})

const genderLabel = (g: string) => ({ male: '男', female: '女', M: '男', F: '女' }[g] || g)

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '—')

const formatRange = (start?: string, end?: string) => {
  if (!start) return '—'
  const s = formatDT(start)
  if (!end) return s
  const endText = end.replace('T', ' ')
  const endShort = endText.length > 11 ? endText.slice(11, 16) : endText.slice(0, 16)
  return `${s} - ${endShort}`
}

const openFeedbackDetail = (item: FeedbackItem) => {
  feedbackDetail.value = item
  showFeedbackModal.value = true
}

const goProxyBooking = () => {
  if (!patientIdRef.value) return
  uni.navigateTo({ url: `/pages/ops/proxy-booking/index?patientId=${patientIdRef.value}` })
}

const goRebook = (item: ConsultationItem) => {
  if (!patientIdRef.value) return
  uni.navigateTo({
    url: `/pages/ops/proxy-booking/index?patientId=${patientIdRef.value}&counselorId=${item.counselorId}`,
  })
}

const loadCounselorOptions = async () => {
  const params: Record<string, string> = {}
  if (counselorKeyword.value.trim()) params.keyword = counselorKeyword.value.trim()
  const res = await httpV2.get<CounselorOption[]>(API_ENDPOINTS.admin.counselors, params, { showLoading: false })
  if (res.code === 0 && Array.isArray(res.data)) {
    counselorOptions.value = res.data
  } else {
    counselorOptions.value = []
  }
}

const openBindCounselor = async () => {
  selectedCounselorId.value = detail.value?.boundCounselorId ?? null
  counselorKeyword.value = ''
  showBindModal.value = true
  await loadCounselorOptions()
}

const closeBindCounselor = () => {
  showBindModal.value = false
}

const savePatientSource = async (
  payload: { patientSource?: string; patientSourceDetail?: string },
) => {
  if (!patientIdRef.value || sourceSaving.value) return
  sourceSaving.value = true
  try {
    const res = await httpV2.put(
      API_ENDPOINTS.admin.patientSource(patientIdRef.value),
      payload,
    )
    if (res.code !== 0) {
      throw new Error(res.msg || '保存失败')
    }
    if (payload.patientSource !== undefined) patientSource.value = payload.patientSource
    if (payload.patientSourceDetail !== undefined) patientSourceDetail.value = payload.patientSourceDetail
    if (detail.value) {
      detail.value.patientSource = patientSource.value
      detail.value.patientSourceLabel = patientSourceLabel.value
      detail.value.patientSourceDetail = patientSourceDetail.value
      detail.value.typeLabel = patientSourceLabel.value
    }
    uni.showToast({ title: '来访信息已保存', icon: 'success' })
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    sourceSaving.value = false
  }
}

const changePatientSource = (event: { detail: { value: string | number } }) => {
  const option = PATIENT_SOURCE_OPTIONS[Number(event.detail.value)]
  if (option) void savePatientSource({ patientSource: option.value })
}

const changePatientSourceDetail = (event: { detail: { value: string | number } }) => {
  const option = patientSourceDetailOptions[Number(event.detail.value)]
  if (option) void savePatientSource({ patientSourceDetail: option })
}

const saveBindCounselor = async (counselorId: number | null) => {
  if (!patientIdRef.value) return
  if (counselorId !== null && !counselorId) {
    uni.showToast({ title: '请选择咨询师', icon: 'none' })
    return
  }
  bindSaving.value = true
  try {
    const res = await httpV2.put(
      API_ENDPOINTS.admin.patientBoundCounselor(patientIdRef.value),
      { counselorId },
    )
    if (res.code === 0 && res.data) {
      const data = res.data as PatientDetail
      if (detail.value) {
        detail.value.isContractSigned = !!data.isContractSigned
        detail.value.boundCounselorId = data.boundCounselorId ?? null
        detail.value.boundCounselorName = data.boundCounselorName ?? null
        detail.value.contractTag = data.contractTag ?? null
      }
      uni.showToast({ title: counselorId ? '已更新绑定' : '已解除绑定', icon: 'success' })
      closeBindCounselor()
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    bindSaving.value = false
  }
}

onLoad(async (opts) => {
  const patientId = Number(opts?.patientId || 0)
  patientIdRef.value = patientId
  if (!patientId) {
    loading.value = false
    return
  }
  if (opts?.tab === 'feedback') activeTab.value = 'feedback'
  try {
    const res = await httpV2.get<PatientDetail>(API_ENDPOINTS.admin.patientDetail(patientId))
    if (res.code === 0 && res.data) {
      detail.value = res.data
      staffRemark.value = res.data.staffRemark || ''
      patientSource.value = res.data.patientSource || ''
      patientSourceDetail.value = res.data.patientSourceDetail || ''
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-detail { min-height: 100vh; background: #F7F5F2; padding: 32rpx; padding-bottom: 48rpx; }
.empty, .empty-list { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }
.profile-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.profile-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.profile-name { font-size: 34rpx; font-weight: 600; color: #2C2C2C; }
.type-badge {
  font-size: 22rpx;
  color: #6B6560;
  background: #F0EDE8;
  padding: 4rpx 14rpx;
  border-radius: 100rpx;
  white-space: nowrap;
  flex-shrink: 0;
}
.info-row { display: flex; gap: 24rpx; padding: 10rpx 0; }
.label { font-size: 26rpx; color: #8A8A8A; width: 160rpx; flex-shrink: 0; }
.value { flex: 1; font-size: 26rpx; color: #2C2C2C; line-height: 1.5; }
.picker-value { min-height: 39rpx; color: #2C2C2C; }
.picker-arrow { color: #9CA3AF; margin-left: 8rpx; }
.feedback-entry {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  background: #F0FDFA;
  border-radius: 16rpx;
}
.feedback-entry:active { opacity: 0.9; }
.feedback-entry-label { font-size: 28rpx; font-weight: 600; color: #047857; }
.feedback-entry-count { font-size: 26rpx; color: #6B7280; flex: 1; }
.feedback-entry-arrow { font-size: 26rpx; color: #3D5A4E; }
.proxy-btn {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  margin-top: 20rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 28rpx;
}
.proxy-btn::after { border: none; }
.bind-btn {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  margin-top: 16rpx;
  background: #fff;
  color: #3D5A4E;
  border: 2rpx solid #3D5A4E;
  border-radius: 100rpx;
  font-size: 28rpx;
}
.bind-btn::after { border: none; }
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
}
.bind-modal {
  width: 100%;
  max-width: 640rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-sizing: border-box;
}
.modal-title { display: block; font-size: 32rpx; font-weight: 700; color: #2C2C2C; }
.modal-sub { display: block; margin: 12rpx 0 20rpx; font-size: 24rpx; color: #9CA3AF; line-height: 1.5; }
.bind-search {
  width: 100%;
  box-sizing: border-box;
  height: 72rpx;
  line-height: 72rpx;
  background: #F7F5F2;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}
.counselor-pick-list { max-height: 420rpx; }
.counselor-pick-item {
  padding: 20rpx 16rpx;
  border-radius: 16rpx;
  border: 1rpx solid #E8E4DE;
  margin-bottom: 12rpx;
}
.counselor-pick-item.active {
  border-color: #3D5A4E;
  background: #E8E4DE;
}
.pick-name { display: block; font-size: 28rpx; font-weight: 600; color: #2C2C2C; }
.pick-meta { display: block; margin-top: 4rpx; font-size: 22rpx; color: #9CA3AF; }
.pick-empty { text-align: center; padding: 40rpx 0; color: #9CA3AF; font-size: 26rpx; }
.modal-btns { display: flex; gap: 12rpx; margin-top: 24rpx; flex-wrap: wrap; }
.modal-btn {
  flex: 1;
  min-width: 140rpx;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 100rpx;
  font-size: 26rpx;
  margin: 0;
}
.modal-btn::after { border: none; }
.modal-btn.cancel { background: #F3F4F6; color: #6B7280; }
.modal-btn.confirm { background: #3D5A4E; color: #fff; }
.modal-btn.ghost { background: #fff; color: #B45309; border: 1rpx solid #FCD34D; }
.cons-actions { display: flex; justify-content: flex-end; margin-top: 16rpx; }
.rebook-btn {
  font-size: 24rpx;
  color: #3D5A4E;
  padding: 8rpx 20rpx;
  border: 1rpx solid #3D5A4E;
  border-radius: 999rpx;
}
.filter-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
  overflow-x: auto;
  flex-wrap: nowrap;
}
.filter-tab {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: #fff;
  font-size: 24rpx;
  color: #6B6560;
}
.filter-tab.active { background: #3D5A4E; color: #fff; font-weight: 600; }
.cons-card, .feedback-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.03);
}
.feedback-card:active { opacity: 0.92; }
.cons-head { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.status-wrap { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; }
.counselor { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.feedback-tag, .feedback-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: #D1FAE5;
  color: #047857;
  font-weight: 600;
}
.status {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-weight: 600;
}
.status.upcoming { background: #DBEAFE; color: #1D4ED8; }
.status.completed { background: #E8E4DE; color: #3D5A4E; }
.status.cancelled { background: #F3F4F6; color: #6B7280; }
.status.other { background: #F5EFE3; color: #C9A96E; }
.line { display: block; margin-top: 10rpx; font-size: 26rpx; color: #4B5563; line-height: 1.5; }
.line.muted { font-size: 22rpx; color: #9CA3AF; margin-top: 12rpx; }
.feedback-preview { margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #F3F4F6; }
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
}
.modal-card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
  box-sizing: border-box;
}
.modal-title { display: block; font-size: 32rpx; font-weight: 700; color: #2C2C2C; }
.modal-sub { display: block; margin: 8rpx 0 20rpx; font-size: 24rpx; color: #9CA3AF; }
.modal-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  margin-top: 28rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 28rpx;
}
.modal-btn::after { border: none; }
</style>
