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

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="counselors.length === 0" class="empty">暂无匹配的咨询师或排期</view>

    <view
      v-for="c in counselors"
      :key="c.counselorId"
      class="counselor-card"
    >
      <view class="card-main">
        <text class="name">{{ c.counselorName }}</text>
        <text class="count">未来30天 {{ c.scheduleCount }} 节</text>
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
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

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

const loading = ref(true)
const keyword = ref('')
const counselors = ref<CounselorGroup[]>([])

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    const res = await httpV2.get<{ counselors: CounselorGroup[] }>(
      API_ENDPOINTS.ops.schedulesOverview,
      { keyword: keyword.value.trim() || undefined },
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
