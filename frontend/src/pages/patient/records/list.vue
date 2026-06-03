<template>
  <view class="page-records">
    <view class="page-header">
      <text class="page-title">咨询记录</text>
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
    </view>

    <view v-if="loading" class="empty-state">
      <text class="empty-text">加载中...</text>
    </view>
    <view v-else-if="records.length === 0" class="empty-state">
      <text class="empty-text">暂无咨询记录</text>
    </view>
    <view v-else class="record-list">
      <view v-for="r in records" :key="r.id" class="record-card">
        <view class="record-header">
          <image class="avatar" :src="r.counselorAvatar || '/static/images/tc59.png'" mode="aspectFill" />
          <view class="meta">
            <text class="name">{{ r.counselorName }}</text>
            <text class="time">{{ formatTime(r.startTime || r.createdAt) }}</text>
          </view>
          <text class="status" :class="r.status.toLowerCase()">{{ statusLabel(r.status) }}</text>
        </view>
        <view v-if="r.note" class="note">{{ r.note }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface Consultation {
  id: number
  orderId?: number
  counselorId: number
  counselorName: string
  counselorAvatar?: string
  scheduleId?: number
  status: string
  startTime?: string
  endTime?: string
  note?: string
  createdAt: string
}

const tabs = [
  { label: '全部', value: '' },
  { label: '待确认', value: 'PENDING' },
  { label: '已确认', value: 'CONFIRMED' },
  { label: '已完成', value: 'DONE' },
]

const activeTab = ref<string>('')
const records = ref<Consultation[]>([])
const loading = ref(true)

const statusLabel = (s: string) => ({
  PENDING: '待确认',
  CONFIRMED: '已确认',
  ONGOING: '进行中',
  DONE: '已完成',
  CANCELLED: '已取消',
}[s] || s)

const formatTime = (s?: string) => (s ? s.replace('T', ' ').slice(0, 16) : '')

const fetchList = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (activeTab.value) params.status = activeTab.value
    const res = await httpV2.get<Consultation[]>(API_ENDPOINTS.patient.consultations, params)
    records.value = res.code === 0 && Array.isArray(res.data) ? res.data : []
  } catch {
    records.value = []
  } finally {
    loading.value = false
  }
}

const switchTab = (v: string) => {
  if (activeTab.value === v) return
  activeTab.value = v
  fetchList()
}

onMounted(fetchList)
</script>

<style scoped>
.page-records { padding: 32rpx; min-height: 100vh; background: #F4F6F8; }
.page-header { margin-bottom: 24rpx; }
.page-title { font-size: 40rpx; font-weight: 700; color: #1F2937; }
.filter-bar { display: flex; gap: 16rpx; margin-top: 24rpx; flex-wrap: wrap; }
.filter-tab {
  padding: 12rpx 28rpx; border-radius: 100rpx; font-size: 26rpx;
  background: #fff; color: #6B7280; border: 1px solid #E5E7EB;
}
.filter-tab.active { background: #0D9488; color: #fff; border-color: #0D9488; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }
.record-list { display: flex; flex-direction: column; gap: 24rpx; }
.record-card { background: #fff; border-radius: 24rpx; padding: 32rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06); }
.record-header { display: flex; align-items: center; gap: 20rpx; }
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; background: #E5E7EB; }
.meta { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.name { font-size: 30rpx; font-weight: 600; color: #1F2937; }
.time { font-size: 24rpx; color: #9CA3AF; }
.status { font-size: 24rpx; font-weight: 600; padding: 4rpx 16rpx; border-radius: 12rpx; }
.status.pending { color: #F59E0B; background: #FEF3C7; }
.status.confirmed, .status.ongoing { color: #0D9488; background: #CCFBF1; }
.status.done { color: #10B981; background: #D1FAE5; }
.status.cancelled { color: #6B7280; background: #F3F4F6; }
.note { margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx dashed #E5E7EB; font-size: 26rpx; color: #4B5563; line-height: 1.6; }
</style>
