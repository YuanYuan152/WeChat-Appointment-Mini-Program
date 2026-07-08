<template>
  <view class="page-schedules">
    <view class="header">
      <text class="title">排期情况</text>
      <text class="subtitle">选择日期后点击咨询师，进入普通/日历模式查看完整排期</text>
    </view>

    <picker mode="date" :value="filterDate" @change="onDateChange">
      <view class="date-picker">
        <text>{{ filterDate || '选择日期' }}</text>
        <text class="arrow">▼</text>
      </view>
    </picker>

    <view class="filter-row">
      <text class="filter-label">当日有排期的咨询师 {{ displayedCounselors.length }} 位</text>
      <text class="filter-toggle" @tap="showAllCounselors = !showAllCounselors">
        {{ showAllCounselors ? '只看有排期' : '显示全部' }}
      </text>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="displayedCounselors.length === 0" class="empty">
      {{ showAllCounselors ? '暂无咨询师数据' : '当日暂无排期，可切换日期或显示全部咨询师' }}
    </view>

    <view
      v-for="c in displayedCounselors"
      :key="c.counselorId"
      class="counselor-card"
    >
      <view class="card-main">
        <text class="name">{{ c.counselorName }}</text>
        <text class="count">{{ c.scheduleCount }} 节</text>
      </view>
      <view class="view-btn" @tap.stop="goDetail(c)">查看完整排期</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface ScheduleItem {
  scheduleId: number
  startTime: string
  endTime: string
  status: string
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
const showAllCounselors = ref(false)

const displayedCounselors = computed(() => {
  if (showAllCounselors.value) return counselors.value
  return counselors.value.filter(c => c.scheduleCount > 0)
})

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const goDetail = (c: CounselorGroup) => {
  const url = `/pages/ops/schedules/detail?counselorId=${c.counselorId}&counselorName=${encodeURIComponent(c.counselorName || '咨询师')}&date=${filterDate.value}`
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
    const res = await httpV2.get<{ counselors: CounselorGroup[] }>(
      API_ENDPOINTS.ops.schedulesOverview,
      { date: filterDate.value },
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

const onDateChange = (e: { detail: { value: string } }) => {
  filterDate.value = e.detail.value
  load()
}

onMounted(() => {
  filterDate.value = todayStr()
  load()
})

onShow(() => {
  if (filterDate.value) load()
})
</script>

<style scoped>
.page-schedules { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.header { margin-bottom: 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 800; color: #1F2937; }
.subtitle { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B7280; line-height: 1.5; }
.date-picker {
  display: flex; justify-content: space-between; align-items: center;
  background: #fff; border-radius: 16rpx; padding: 22rpx 24rpx; margin-bottom: 16rpx;
  font-size: 28rpx; color: #374151;
}
.arrow { color: #9CA3AF; font-size: 22rpx; }
.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding: 0 4rpx;
}
.filter-label { font-size: 24rpx; color: #6B7280; }
.filter-toggle { font-size: 24rpx; color: #3D5A4E; font-weight: 600; }
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
.count { font-size: 28rpx; color: #0D9488; font-weight: 700; flex-shrink: 0; }
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
