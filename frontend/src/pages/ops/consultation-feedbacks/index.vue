<template>
  <view class="page-feedbacks">
    <view class="search-bar">
      <input
        class="search-input"
        v-model="keyword"
        placeholder="搜索来访者或咨询师"
        confirm-type="search"
        @confirm="load"
      />
      <view class="search-btn" @tap="load">搜索</view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="items.length === 0" class="empty">暂无用户反馈</view>
    <view v-else class="list">
      <view v-for="item in items" :key="item.id" class="card" @tap="openDetail(item)">
        <view class="card-head">
          <text class="patient">{{ item.patientName }}</text>
          <text class="time">{{ formatDT(item.createdAt) }}</text>
        </view>
        <text class="line">咨询师：{{ item.counselorName }}</text>
        <text class="line">咨询时段：{{ formatRange(item.startTime, item.endTime) }}</text>
        <text class="preview">{{ previewText(item) }}</text>
      </view>
    </view>

    <view v-if="showDetail && detail" class="overlay" @touchmove.stop.prevent>
      <view class="detail-card" @tap.stop>
        <text class="detail-title">用户反馈详情</text>
        <view class="detail-body">
          <view class="detail-row">
            <text class="label">来访者</text>
            <text class="value">{{ detail.patientName }}</text>
          </view>
          <view class="detail-row">
            <text class="label">手机号</text>
            <text class="value">{{ detail.patientMobile || '—' }}</text>
          </view>
          <view class="detail-row">
            <text class="label">咨询师</text>
            <text class="value">{{ detail.counselorName }}</text>
          </view>
          <view class="detail-row">
            <text class="label">咨询时段</text>
            <text class="value">{{ formatRange(detail.startTime, detail.endTime) }}</text>
          </view>
          <view class="detail-row">
            <text class="label">提交时间</text>
            <text class="value">{{ formatDT(detail.createdAt) }}</text>
          </view>
          <view class="feedback-box">
            <text class="box-label">反馈内容</text>
            <ConsultationFeedbackDisplay
              :goal-score="detail.goalScore"
              :rhythm-score="detail.rhythmScore"
              :improvements="detail.improvements"
              :summary="detail.summary"
            />
          </view>
        </view>
        <button class="btn close" @click="closeDetail">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import ConsultationFeedbackDisplay from '@/components/ConsultationFeedbackDisplay.vue'

interface FeedbackItem {
  id: number
  consultationId: number
  patientId: number
  patientName: string
  patientMobile?: string
  counselorId: number
  counselorName: string
  startTime?: string
  endTime?: string
  goalScore?: number
  rhythmScore?: number
  improvements?: string[]
  summary: string
  createdAt: string
}

const loading = ref(false)
const keyword = ref('')
const items = ref<FeedbackItem[]>([])
const showDetail = ref(false)
const detail = ref<FeedbackItem | null>(null)
const filterPatientId = ref<number | null>(null)

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '—')

const formatRange = (start?: string, end?: string) => {
  if (!start) return '—'
  const s = formatDT(start)
  if (!end) return s
  const endClock = end.replace('T', ' ').slice(11, 16)
  return `${s} - ${endClock}`
}

const previewText = (item: FeedbackItem) => {
  const parts: string[] = []
  if (item.goalScore && item.goalScore > 0) parts.push(`目标 ${item.goalScore} 星`)
  if (item.rhythmScore && item.rhythmScore > 0) parts.push(`节奏 ${item.rhythmScore} 星`)
  if (item.improvements?.length) parts.push(`改进 ${item.improvements.length} 项`)
  return parts.length ? parts.join(' · ') : (item.summary || '已提交')
}

const load = async () => {
  loading.value = true
  try {
    const params: Record<string, string | number> = {}
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (filterPatientId.value) params.patient_id = filterPatientId.value
    const res = await httpV2.get<FeedbackItem[]>(API_ENDPOINTS.admin.consultationFeedbacks, params)
    if (res.code === 0 && Array.isArray(res.data)) items.value = res.data
  } finally {
    loading.value = false
  }
}

const openDetail = (item: FeedbackItem) => {
  detail.value = item
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  detail.value = null
}

onLoad((opts) => {
  if (opts?.patientId) filterPatientId.value = Number(opts.patientId)
})

onShow(load)
</script>

<style scoped>
.page-feedbacks { min-height: 100vh; background: #F7F5F2; padding: 32rpx; box-sizing: border-box; }
.search-bar { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.search-input {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
}
.search-btn {
  flex-shrink: 0;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  padding: 0 28rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card:active { opacity: 0.92; }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; margin-bottom: 8rpx; }
.patient { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.time { font-size: 22rpx; color: #9CA3AF; flex-shrink: 0; }
.line { display: block; font-size: 26rpx; color: #6B7280; margin-top: 6rpx; }
.preview { display: block; margin-top: 12rpx; font-size: 24rpx; color: #3D5A4E; }
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}
.detail-card {
  width: 100%;
  max-height: 85vh;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 36rpx 32rpx 48rpx;
  box-sizing: border-box;
  overflow-y: auto;
}
.detail-title { display: block; font-size: 34rpx; font-weight: 700; color: #2C2C2C; margin-bottom: 24rpx; }
.detail-row { display: flex; gap: 20rpx; padding: 12rpx 0; }
.label { width: 160rpx; flex-shrink: 0; font-size: 26rpx; color: #9CA3AF; }
.value { flex: 1; font-size: 26rpx; color: #2C2C2C; line-height: 1.5; }
.feedback-box {
  margin-top: 20rpx;
  padding: 24rpx;
  background: #F0FDFA;
  border-radius: 16rpx;
}
.box-label { display: block; font-size: 26rpx; font-weight: 600; color: #047857; margin-bottom: 16rpx; }
.btn.close {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  margin-top: 28rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 30rpx;
}
.btn.close::after { border: none; }
</style>
