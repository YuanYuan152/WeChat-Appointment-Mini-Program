<template>
  <view class="page-workbench">
    <!-- 顶部问候 -->
    <view class="header-card">
      <view class="header-left">
        <text class="greeting">你好，咨询师</text>
        <text class="date-text">{{ today }}</text>
      </view>
      <view class="header-right">
        <view class="badge-wrap" @click="goSchedule">
          <text class="badge-icon">📅</text>
          <text class="badge-label">排班</text>
        </view>
      </view>
    </view>

    <!-- 今日数据统计 -->
    <view class="stats-row">
      <view class="stat-card">
        <text class="stat-num">{{ todayCount }}</text>
        <text class="stat-label">今日咨询</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ pendingCount }}</text>
        <text class="stat-label">待确认</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ scheduleCount }}</text>
        <text class="stat-label">近期排班</text>
      </view>
    </view>

    <!-- 今日排班 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">今日日程</text>
        <text class="section-more" @click="goSchedule">全部排班 ›</text>
      </view>
      <view v-if="todaySchedules.length === 0" class="empty-card">
        <text class="empty-text">今日暂无排班</text>
      </view>
      <view v-for="s in todaySchedules" :key="s.Id" class="schedule-card">
        <view class="sc-time">
          <text class="sc-start">{{ formatTime(s.StartTime) }}</text>
          <text class="sc-sep">–</text>
          <text class="sc-end">{{ formatTime(s.EndTime) }}</text>
        </view>
        <view class="sc-status" :class="s.Status.toLowerCase()">
          <text>{{ scheduleLabel(s.Status) }}</text>
        </view>
      </view>
    </view>

    <!-- 待处理咨询单 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">待确认咨询单</text>
        <text class="section-more" @click="goConsultations">全部 ›</text>
      </view>
      <view v-if="pendingConsultations.length === 0" class="empty-card">
        <text class="empty-text">暂无待确认咨询</text>
      </view>
      <view v-for="c in pendingConsultations" :key="c.Id" class="consultation-card">
        <view class="cc-info">
          <text class="cc-id">咨询单 #{{ c.Id }}</text>
          <text class="cc-time" v-if="c.StartTime">{{ formatDateTime(c.StartTime) }}</text>
        </view>
        <view class="cc-actions">
          <button class="cc-btn confirm" @click="confirmConsultation(c.Id)">确认</button>
          <button class="cc-btn cancel" @click="cancelConsultation(c.Id)">拒绝</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'

interface Schedule {
  Id: number
  StartTime: string
  EndTime: string
  Status: string
}

interface Consultation {
  Id: number
  Status: string
  StartTime?: string
}

const schedules = ref<Schedule[]>([])
const consultations = ref<Consultation[]>([])

const today = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})

const todaySchedules = computed(() =>
  schedules.value.filter(s => s.StartTime?.startsWith(today.value))
)
const todayCount = computed(() => todaySchedules.value.length)
const pendingConsultations = computed(() =>
  consultations.value.filter(c => c.Status === 'PENDING')
)
const pendingCount = computed(() => pendingConsultations.value.length)
const scheduleCount = computed(() => schedules.value.length)

const formatTime = (dt: string) => dt ? dt.slice(11, 16) : ''
const formatDateTime = (dt: string) => dt ? dt.slice(0, 16).replace('T', ' ') : ''
const scheduleLabel = (s: string) => ({ AVAILABLE: '空闲', BOOKED: '已预约', CANCELLED: '已取消' }[s] || s)

const loadData = async () => {
  try {
    const [sr, cr] = await Promise.all([
      httpV2.get('/api/mini/counselor/schedules'),
      httpV2.get('/api/mini/counselor/consultations'),
    ])
    if (sr.code === 0 && sr.data) schedules.value = sr.data
    if (cr.code === 0 && cr.data) consultations.value = cr.data
  } catch (e) {
    console.error('加载工作台数据失败', e)
  }
}

const confirmConsultation = async (id: number) => {
  await httpV2.put(`/api/mini/counselor/consultations/${id}`, { status: 'CONFIRMED' })
  await loadData()
  uni.showToast({ title: '已确认', icon: 'success' })
}

const cancelConsultation = async (id: number) => {
  await httpV2.put(`/api/mini/counselor/consultations/${id}`, { status: 'CANCELLED' })
  await loadData()
  uni.showToast({ title: '已拒绝', icon: 'none' })
}

const goSchedule = () => uni.navigateTo({ url: '/pages/counselor/schedule/index' })
const goConsultations = () => uni.navigateTo({ url: '/pages/counselor/consultations/index' })

onMounted(loadData)
</script>

<style scoped>
.page-workbench { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }

.header-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #0D9488, #0F766E);
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  margin-bottom: 32rpx;
}
.greeting { display: block; font-size: 40rpx; font-weight: 800; color: #fff; }
.date-text { font-size: 26rpx; color: rgba(255,255,255,0.8); margin-top: 8rpx; }
.badge-wrap { display: flex; flex-direction: column; align-items: center; }
.badge-icon { font-size: 48rpx; }
.badge-label { font-size: 22rpx; color: rgba(255,255,255,0.85); margin-top: 4rpx; }

.stats-row { display: flex; gap: 20rpx; margin-bottom: 32rpx; }
.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 16rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.stat-num { display: block; font-size: 56rpx; font-weight: 800; color: #0D9488; }
.stat-label { font-size: 24rpx; color: #6B7280; margin-top: 8rpx; }

.section { margin-bottom: 32rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.section-title { font-size: 32rpx; font-weight: 700; color: #1F2937; }
.section-more { font-size: 26rpx; color: #0D9488; }

.empty-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx;
  text-align: center;
}
.empty-text { font-size: 28rpx; color: #9CA3AF; }

.schedule-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}
.sc-time { display: flex; align-items: center; gap: 12rpx; }
.sc-start, .sc-end { font-size: 32rpx; font-weight: 700; color: #1F2937; }
.sc-sep { font-size: 28rpx; color: #9CA3AF; }
.sc-status { font-size: 24rpx; font-weight: 600; padding: 6rpx 20rpx; border-radius: 100rpx; }
.sc-status.available { background: #D1FAE5; color: #065F46; }
.sc-status.booked { background: #DBEAFE; color: #1E40AF; }
.sc-status.cancelled { background: #F3F4F6; color: #9CA3AF; }

.consultation-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}
.cc-id { display: block; font-size: 28rpx; font-weight: 600; color: #1F2937; }
.cc-time { font-size: 24rpx; color: #6B7280; margin-top: 4rpx; }
.cc-actions { display: flex; gap: 16rpx; }
.cc-btn {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 28rpx;
  border-radius: 100rpx;
  font-size: 26rpx;
  font-weight: 600;
  margin: 0;
}
.cc-btn.confirm { background: #0D9488; color: #fff; border: none; }
.cc-btn.cancel { background: #fff; color: #6B7280; border: 1rpx solid #E5E7EB; }
</style>
