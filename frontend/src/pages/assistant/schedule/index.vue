<template>
  <view class="page-schedule">
    <view class="page-header">
      <text class="page-title">排期协调</text>
      <text class="page-subtitle">查看咨询师排班，协调预约时间</text>
    </view>

    <view class="filter-bar">
      <picker mode="date" :value="filterDate" @change="onDateChange">
        <view class="date-picker">
          <text class="date-text">{{ filterDate || '选择日期' }}</text>
          <text class="date-icon">▼</text>
        </view>
      </picker>
    </view>

    <view v-if="loading" class="empty-state">
      <text class="empty-text">加载中...</text>
    </view>
    <view v-else-if="schedules.length === 0" class="empty-state">
      <text class="empty-text">暂无排班数据</text>
    </view>
    <view v-else class="schedule-list">
      <view v-for="item in schedules" :key="item.Id" class="schedule-card">
        <view class="card-header">
          <text class="counselor-name">{{ item.CounselorName || '咨询师' }}</text>
          <view class="status-badge" :class="item.Status.toLowerCase()">
            <text>{{ statusLabel(item.Status) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="time-row">
            <text class="time-label">时间</text>
            <text class="time-value">{{ formatDate(item.StartTime) }} {{ formatTime(item.StartTime) }} - {{ formatTime(item.EndTime) }}</text>
          </view>
          <view class="time-row" v-if="item.PatientName">
            <text class="time-label">来访者</text>
            <text class="time-value">{{ item.PatientName }}</text>
          </view>
        </view>
        <view class="card-footer" v-if="item.Status === 'AVAILABLE'">
          <text class="hint-text">可安排预约</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface ScheduleItem {
  Id: number
  CounselorName: string
  StartTime: string
  EndTime: string
  Status: string
  PatientName?: string
}

const schedules = ref<ScheduleItem[]>([])
const loading = ref(true)
const filterDate = ref('')

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    AVAILABLE: '空闲',
    BOOKED: '已约',
    CANCELLED: '已取消',
  }
  return map[status] || status
}

const formatDate = (s: string) => {
  if (!s) return ''
  return s.slice(0, 10)
}

const formatTime = (s: string) => {
  if (!s) return ''
  return s.slice(11, 16)
}

const load = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {}
    if (filterDate.value) params.date = filterDate.value
    const res = await httpV2.get<ScheduleItem[]>(API_ENDPOINTS.assistant.scheduleOverview, params)
    if (res.code === 0 && Array.isArray(res.data)) {
      schedules.value = res.data
    }
  } catch { /* silent */ } finally {
    loading.value = false
  }
}

const onDateChange = (e: any) => {
  filterDate.value = e.detail.value
  load()
}

onMounted(load)
</script>
<style scoped>
.page-schedule { padding: 32rpx; min-height: 100vh; background: #F4F6F8; }
.page-header { margin-bottom: 32rpx; }
.page-title { display: block; font-size: 40rpx; font-weight: 700; color: #1F2937; }
.page-subtitle { display: block; font-size: 26rpx; color: #6B7280; margin-top: 8rpx; }
.filter-bar { margin-bottom: 24rpx; }
.date-picker {
  display: flex; align-items: center; gap: 12rpx;
  background: #fff; border-radius: 16rpx; padding: 20rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.date-text { font-size: 28rpx; color: #374151; flex: 1; }
.date-icon { font-size: 22rpx; color: #9CA3AF; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }
.schedule-list { display: flex; flex-direction: column; gap: 20rpx; }
.schedule-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.counselor-name { font-size: 30rpx; font-weight: 600; color: #1F2937; }
.status-badge {
  padding: 6rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; font-weight: 500;
}
.status-badge.available { background: #EDE4D4; color: #7A5C3A; }
.status-badge.booked { background: #B8D4C8; color: #1F4034; }
.status-badge.cancelled { background: #F3F4F6; color: #6B7280; }
.card-body { margin-bottom: 12rpx; }
.time-row { display: flex; gap: 16rpx; padding: 8rpx 0; }
.time-label { font-size: 26rpx; color: #6B7280; min-width: 100rpx; }
.time-value { font-size: 26rpx; color: #1F2937; }
.card-footer { border-top: 1rpx solid #F3F4F6; padding-top: 16rpx; }
.hint-text { font-size: 24rpx; color: #0D9488; }
</style>
