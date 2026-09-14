<template>
  <view class="page-schedules">
    <view class="header">
      <text class="title">排期情况</text>
      <text class="subtitle">默认展示未来30天全部咨询师，可按咨询师或来访姓名、昵称搜索</text>
    </view>

    <view class="search-card">
      <input
        v-model="keyword"
        class="search-input"
        confirm-type="search"
        placeholder="搜索咨询师或来访姓名、昵称"
        @confirm="load"
      />
      <view class="search-btn" @tap="load">搜索</view>
      <view v-if="keyword" class="reset-btn" @tap="resetSearch">清空</view>
    </view>

    <view class="filter-bar">
      <view
        v-for="option in filterOptions"
        :key="option.value"
        class="filter-btn"
        :class="{ active: scheduleFilter === option.value }"
        @tap="scheduleFilter = option.value"
      >
        {{ option.label }}
      </view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="displayedCounselors.length === 0" class="empty">{{ emptyText }}</view>

    <view
      v-for="c in displayedCounselors"
      :key="c.counselorId"
      class="counselor-card"
    >
      <view class="card-main">
        <text class="name">{{ c.counselorName }}</text>
        <text class="count">{{ countText(c.scheduleCount) }}</text>
      </view>
      <view v-if="c.schedules.length" class="schedule-list">
        <view v-for="s in c.schedules" :key="s.scheduleId" class="schedule-row">
          <text class="pair-name">{{ c.counselorName }} - {{ s.patientName || '开放排期' }}</text>
          <text class="schedule-meta">{{ formatScheduleTime(s.startTime) }} · {{ s.centerName || '未指定中心' }}{{ s.roomName ? ` · ${s.roomName}` : '' }}</text>
        </view>
      </view>
      <text v-else class="no-schedule">未来30天暂无排期</text>
      <view class="view-btn" @tap.stop="goDetail(c)">查看完整排期</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { addDays } from '@/constants/scheduleSlots'

interface ScheduleItem {
  scheduleId: number
  startTime: string
  endTime: string
  status: string
  patientName?: string
  centerName?: string
  roomName?: string
}

interface CounselorGroup {
  counselorId: number
  counselorName: string
  scheduleCount: number
  schedules: ScheduleItem[]
}

type ScheduleFilter = 'all' | 'today' | 'week'

interface ScheduleOverview {
  startDate?: string
  counselors: CounselorGroup[]
}

const loading = ref(true)
const keyword = ref('')
const counselors = ref<CounselorGroup[]>([])
const scheduleFilter = ref<ScheduleFilter>('all')
const overviewStartDate = ref('')
const filterOptions: { label: string; value: ScheduleFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '仅今日有约', value: 'today' },
  { label: '仅本周有约', value: 'week' },
]

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const displayedCounselors = computed(() => {
  if (scheduleFilter.value === 'all') return counselors.value

  const startDate = overviewStartDate.value || todayStr()
  const endDate = scheduleFilter.value === 'today' ? startDate : addDays(startDate, 6)
  return counselors.value
    .map(counselor => {
      const schedules = counselor.schedules.filter(schedule => {
        const date = schedule.startTime?.slice(0, 10)
        if (!date) return false
        return schedule.status === 'BOOKED' && date >= startDate && date <= endDate
      })
      return { ...counselor, scheduleCount: schedules.length, schedules }
    })
    .filter(counselor => counselor.schedules.length > 0)
})

const emptyText = computed(() => {
  if (scheduleFilter.value === 'today') return '今日暂无已预约排期'
  if (scheduleFilter.value === 'week') return '未来7天暂无已预约排期'
  return '暂无匹配的咨询师或排期'
})

const countText = (count: number) => {
  if (scheduleFilter.value === 'today') return `今日已约 ${count} 节`
  if (scheduleFilter.value === 'week') return `未来7天已约 ${count} 节`
  return `未来30天 ${count} 节`
}

const goDetail = (c: CounselorGroup) => {
  const date = c.schedules[0]?.startTime?.slice(0, 10) || todayStr()
  const url = `/pages/ops/schedules/detail?counselorId=${c.counselorId}&counselorName=${encodeURIComponent(c.counselorName || '咨询师')}&date=${date}`
  uni.navigateTo({
    url,
    fail: () => {
      uni.showModal({
        title: '无法打开排期详情',
        content: '请重新编译小程序（pnpm dev:mp-weixin）并在微信开发者工具中点击「编译」后重试。',
        showCancel: false,
      })
    },
  })
}

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<ScheduleOverview>(
      API_ENDPOINTS.ops.schedulesOverview,
      { keyword: keyword.value.trim() || undefined },
    )
    if (res.code === 0 && res.data?.counselors) {
      counselors.value = res.data.counselors
      overviewStartDate.value = res.data.startDate || todayStr()
    } else {
      counselors.value = []
      overviewStartDate.value = todayStr()
    }
  } catch {
    counselors.value = []
    overviewStartDate.value = todayStr()
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  keyword.value = ''
  void load()
}

const formatScheduleTime = (value: string) => value?.replace('T', ' ').slice(0, 16) || '—'

onShow(load)
</script>

<style scoped>
.page-schedules { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.header { margin-bottom: 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 800; color: #1F2937; }
.subtitle { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B7280; line-height: 1.5; }
.search-card {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #fff;
  border-radius: 18rpx;
  padding: 16rpx;
  margin-bottom: 20rpx;
}
.search-input { flex: 1; min-width: 0; font-size: 26rpx; padding: 10rpx 12rpx; }
.search-btn, .reset-btn { flex-shrink: 0; font-size: 25rpx; color: #3D5A4E; font-weight: 600; padding: 10rpx; }
.filter-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
  padding: 8rpx;
  background: #fff;
  border-radius: 18rpx;
}
.filter-btn {
  flex: 1;
  min-width: 0;
  padding: 16rpx 8rpx;
  border-radius: 14rpx;
  color: #6B7280;
  font-size: 24rpx;
  font-weight: 600;
  text-align: center;
}
.filter-btn.active {
  background: #3D5A4E;
  color: #fff;
}
.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }
.counselor-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.card-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.name { font-size: 32rpx; font-weight: 700; color: #1F2937; flex: 1; }
.count { font-size: 24rpx; color: #0D9488; font-weight: 700; flex-shrink: 0; }
.schedule-list { margin-bottom: 20rpx; border-top: 1rpx solid #EEF0F2; }
.schedule-row { padding: 18rpx 0; border-bottom: 1rpx solid #EEF0F2; }
.pair-name { display: block; font-size: 27rpx; font-weight: 600; color: #374151; }
.schedule-meta { display: block; margin-top: 8rpx; font-size: 23rpx; color: #7C8590; line-height: 1.5; }
.no-schedule { display: block; margin-bottom: 20rpx; color: #9CA3AF; font-size: 25rpx; }
.view-btn {
  text-align: center;
  padding: 20rpx 0;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.view-btn:active { opacity: 0.9; }
</style>
