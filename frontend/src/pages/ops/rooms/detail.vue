<template>
  <view class="page-room-detail">
    <view v-if="loading" class="empty">加载中...</view>
    <template v-else-if="detail">
      <view class="hero">
        <text class="name">{{ detail.name }}</text>
        <text class="loc">{{ detail.centerName }}</text>
        <text class="current-tag" :class="tagClass">{{ currentLabel }}</text>
      </view>

      <view v-if="detail.current?.counselorName" class="info-card">
        <text class="info-row">咨询师：{{ detail.current.counselorName }}</text>
        <text v-if="detail.current.patientName" class="info-row">来访者：{{ detail.current.patientName }}</text>
        <text v-if="detail.current.startTime" class="info-row">
          时段：{{ formatTime(detail.current.startTime) }} - {{ formatTime(detail.current.endTime) }}
        </text>
      </view>

      <view class="section" v-if="canEditStatus">
        <text class="section-title">管理状态（仅空闲时可改）</text>
        <view class="status-row">
          <view
            v-for="opt in statusOptions"
            :key="opt.value"
            class="status-chip"
            :class="{ active: detail.status === opt.value }"
            @tap="changeStatus(opt.value)"
          >{{ opt.label }}</view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">当日排期</text>
          <picker mode="date" :value="filterDate" @change="onDateChange">
            <text class="date-link">{{ filterDate }} ▼</text>
          </picker>
        </view>
        <view v-if="!detail.daySchedules?.length" class="empty-inline">当日无排期</view>
        <view v-for="s in detail.daySchedules" :key="s.scheduleId" class="schedule-row">
          <text class="time">{{ formatTime(s.startTime) }} - {{ formatTime(s.endTime) }}</text>
          <text class="meta">{{ s.counselorName }} · {{ scheduleLabel(s) }}</text>
          <text v-if="s.patientName" class="meta">来访者：{{ s.patientName }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface RoomDetail {
  id: number
  name: string
  centerName: string
  status: string
  current: {
    occupancy: string
    label: string
    counselorName?: string
    patientName?: string
    startTime?: string
    endTime?: string
  }
  daySchedules: Array<{
    scheduleId: number
    startTime: string
    endTime: string
    status: string
    counselorName: string
    patientName?: string
  }>
}

const roomId = ref(0)
const filterDate = ref('')
const loading = ref(true)
const detail = ref<RoomDetail | null>(null)

const statusOptions = [
  { label: '可用', value: 'AVAILABLE' },
  { label: '维护中', value: 'MAINTENANCE' },
  { label: '停用', value: 'DISABLED' },
]

const currentLabel = computed(() => detail.value?.current?.label || '—')
const tagClass = computed(() => {
  const occ = detail.value?.current?.occupancy || ''
  return ({ IDLE: 'idle', IN_SESSION: 'busy', RESERVED: 'reserved' }[occ] || 'other')
})
const canEditStatus = computed(() => {
  const occ = detail.value?.current?.occupancy
  return occ === 'IDLE' || occ === 'MAINTENANCE' || occ === 'DISABLED'
})

const formatTime = (s?: string) => (s ? s.slice(11, 16) : '')
const scheduleLabel = (s: { status: string; patientName?: string }) =>
  s.patientName || s.status === 'BOOKED' ? '已预约' : '已挂课'

const load = async () => {
  if (!roomId.value) return
  loading.value = true
  try {
    const res = await httpV2.get<RoomDetail>(
      API_ENDPOINTS.ops.roomDetail(roomId.value),
      { date: filterDate.value }
    )
    if (res.code === 0 && res.data) detail.value = res.data
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const changeStatus = async (status: string) => {
  if (!detail.value || detail.value.status === status) return
  try {
    const res = await httpV2.put(API_ENDPOINTS.ops.roomDetail(roomId.value), { status })
    if (res.code === 0) {
      uni.showToast({ title: '已更新', icon: 'success' })
      await load()
    } else {
      uni.showToast({ title: res.msg || '更新失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '更新失败', icon: 'none' })
  }
}

const onDateChange = (e: any) => {
  filterDate.value = e.detail.value
  load()
}

onLoad((opts) => {
  roomId.value = Number(opts?.id || 0)
  filterDate.value = opts?.date || ''
  if (!filterDate.value) {
    const d = new Date()
    filterDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  load()
})
</script>

<style scoped>
.page-room-detail { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.empty, .empty-inline { text-align: center; padding: 60rpx 0; color: #9CA3AF; font-size: 28rpx; }
.hero {
  background: linear-gradient(135deg, #0D9488, #0F766E);
  border-radius: 28rpx; padding: 40rpx 32rpx; margin-bottom: 24rpx;
}
.name { display: block; font-size: 40rpx; font-weight: 800; color: #fff; }
.loc { display: block; margin-top: 8rpx; font-size: 26rpx; color: rgba(255,255,255,.85); }
.current-tag {
  display: inline-block; margin-top: 20rpx; padding: 8rpx 20rpx; border-radius: 100rpx;
  font-size: 24rpx; font-weight: 700; background: rgba(255,255,255,.2); color: #fff;
}
.current-tag.busy { background: #DBEAFE; color: #1E40AF; }
.current-tag.idle { background: #D1FAE5; color: #065F46; }
.current-tag.reserved { background: #FEF3C7; color: #92400E; }
.info-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 24rpx;
}
.info-row { display: block; font-size: 28rpx; color: #374151; margin-bottom: 8rpx; }
.section {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 24rpx;
}
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.section-title { font-size: 30rpx; font-weight: 700; color: #1F2937; }
.date-link { font-size: 26rpx; color: #0D9488; }
.status-row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.status-chip {
  padding: 14rpx 28rpx; border-radius: 100rpx; font-size: 26rpx;
  border: 2rpx solid #E5E7EB; color: #6B7280;
}
.status-chip.active { background: #0D9488; color: #fff; border-color: #0D9488; }
.schedule-row {
  border-top: 1rpx solid #F3F4F6; padding: 18rpx 0;
}
.time { display: block; font-size: 28rpx; font-weight: 600; color: #374151; }
.meta { display: block; margin-top: 6rpx; font-size: 24rpx; color: #6B7280; }
</style>
