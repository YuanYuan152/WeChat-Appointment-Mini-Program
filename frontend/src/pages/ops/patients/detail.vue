<template>
  <view class="page-detail">
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="!detail" class="empty">来访者不存在</view>
    <view v-else class="content-wrap">
      <view class="profile-card">
        <text class="profile-name">{{ detail.name }}</text>
        <view class="info-row">
          <text class="label">手机号</text>
          <text class="value">{{ detail.mobile || '未填写' }}</text>
        </view>
        <view v-if="detail.gender" class="info-row">
          <text class="label">性别</text>
          <text class="value">{{ genderLabel(detail.gender) }}</text>
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
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import ConsultationFeedbackDisplay from '@/components/ConsultationFeedbackDisplay.vue'

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
  emergencyContact?: string
  emergencyPhone?: string
  feedbackCount: number
  consultations: ConsultationItem[]
  feedbacks: FeedbackItem[]
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
const activeTab = ref('ALL')
const showFeedbackModal = ref(false)
const feedbackDetail = ref<FeedbackItem | null>(null)

const activeTabLabel = computed(() => tabs.find(t => t.value === activeTab.value)?.label || '')

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
    if (res.code === 0 && res.data) detail.value = res.data
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
.profile-name { display: block; font-size: 34rpx; font-weight: 600; color: #2C2C2C; margin-bottom: 20rpx; }
.info-row { display: flex; gap: 24rpx; padding: 10rpx 0; }
.label { font-size: 26rpx; color: #8A8A8A; width: 160rpx; flex-shrink: 0; }
.value { flex: 1; font-size: 26rpx; color: #2C2C2C; line-height: 1.5; }
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
