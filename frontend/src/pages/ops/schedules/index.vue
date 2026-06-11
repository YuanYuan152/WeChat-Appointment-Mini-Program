<template>
  <view class="page-schedules">
    <view class="header">
      <text class="title">挂课情况</text>
      <text class="subtitle">查看各咨询师当日挂课与预约</text>
    </view>

    <picker mode="date" :value="filterDate" @change="onDateChange">
      <view class="date-picker">
        <text>{{ filterDate || '选择日期' }}</text>
        <text class="arrow">▼</text>
      </view>
    </picker>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="counselors.length === 0" class="empty">暂无咨询师数据</view>

    <view v-for="c in counselors" :key="c.counselorId" class="counselor-card">
      <view class="card-head">
        <text class="name">{{ c.counselorName }}</text>
        <text class="count">{{ c.scheduleCount }} 节</text>
      </view>

      <view v-if="!c.schedules?.length" class="no-slot">当日暂无挂课</view>
      <view v-for="s in c.schedules" :key="s.scheduleId" class="slot-row">
        <view class="slot-time">
          <text>{{ formatTime(s.startTime) }} - {{ formatTime(s.endTime) }}</text>
        </view>
        <view class="slot-meta">
          <text class="badge" :class="statusClass(s)">{{ statusLabel(s) }}</text>
          <text v-if="s.centerName || s.roomName" class="loc">
            {{ s.centerName }}{{ s.roomName ? ' · ' + s.roomName : '' }}
          </text>
          <text v-if="s.patientName" class="patient">来访者：{{ s.patientName }}</text>
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
  scheduleId: number
  startTime: string
  endTime: string
  status: string
  centerName?: string
  roomName?: string
  patientName?: string
}

interface CounselorGroup {
  counselorId: number
  counselorName: string
  scheduleCount: number
  schedules: ScheduleItem[]
}

const loading = ref(true)
const filterDate = ref('')
const counselors = ref<CounselorGroup[]>([])

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatTime = (s: string) => (s ? s.slice(11, 16) : '')

const statusLabel = (s: ScheduleItem) => {
  if (s.patientName || s.status === 'BOOKED') return '已预约'
  if (s.status === 'AVAILABLE') return '已挂课'
  return s.status
}

const statusClass = (s: ScheduleItem) => {
  if (s.patientName || s.status === 'BOOKED') return 'booked'
  if (s.status === 'AVAILABLE') return 'available'
  return 'other'
}

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<{ counselors: CounselorGroup[] }>(
      API_ENDPOINTS.ops.schedulesOverview,
      { date: filterDate.value }
    )
    if (res.code === 0 && res.data?.counselors) {
      counselors.value = res.data.counselors
    } else {
      counselors.value = []
    }
  } catch {
    counselors.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const onDateChange = (e: any) => {
  filterDate.value = e.detail.value
  load()
}

onMounted(() => {
  filterDate.value = todayStr()
  load()
})
</script>

<style scoped>
.page-schedules { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.header { margin-bottom: 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 800; color: #1F2937; }
.subtitle { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B7280; }
.date-picker {
  display: flex; justify-content: space-between; align-items: center;
  background: #fff; border-radius: 16rpx; padding: 22rpx 24rpx; margin-bottom: 24rpx;
  font-size: 28rpx; color: #374151;
}
.arrow { color: #9CA3AF; font-size: 22rpx; }
.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }
.counselor-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.name { font-size: 32rpx; font-weight: 700; color: #1F2937; }
.count { font-size: 24rpx; color: #0D9488; font-weight: 600; }
.no-slot { font-size: 26rpx; color: #9CA3AF; padding: 12rpx 0; }
.slot-row {
  border-top: 1rpx solid #F3F4F6; padding: 18rpx 0;
}
.slot-time { font-size: 28rpx; font-weight: 600; color: #374151; }
.slot-meta { margin-top: 10rpx; display: flex; flex-direction: column; gap: 6rpx; }
.badge {
  align-self: flex-start; padding: 4rpx 14rpx; border-radius: 100rpx;
  font-size: 22rpx; font-weight: 600;
}
.badge.available { background: #EDE4D4; color: #7A5C3A; }
.badge.booked { background: #B8D4C8; color: #1F4034; }
.badge.other { background: #F3F4F6; color: #6B7280; }
.loc, .patient { font-size: 24rpx; color: #6B7280; }
</style>
