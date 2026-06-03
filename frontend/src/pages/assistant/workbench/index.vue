<template>
  <view class="page-assistant">
    <view class="header-card">
      <text class="greeting">助理工作台</text>
      <text class="date-text">{{ today }}</text>
    </view>

    <!-- 数据统计 -->
    <view class="stats-row">
      <view class="stat-card" @click="goTasks('OPEN')">
        <text class="stat-num alert" v-if="openTasks > 0">{{ openTasks }}</text>
        <text class="stat-num" v-else>0</text>
        <text class="stat-label">待处理任务</text>
      </view>
      <view class="stat-card" @click="goRisk">
        <text class="stat-num alert" v-if="openAlerts > 0">{{ openAlerts }}</text>
        <text class="stat-num" v-else>0</text>
        <text class="stat-label">风险提醒</text>
      </view>
      <view class="stat-card" @click="goSchedule">
        <text class="stat-num">{{ scheduleCount }}</text>
        <text class="stat-label">本周排班</text>
      </view>
    </view>

    <!-- 高优先任务 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">紧急任务</text>
        <text class="section-more" @click="goTasks('')">全部 ›</text>
      </view>
      <view v-if="highTasks.length === 0" class="empty-card">
        <text class="empty-text">暂无紧急任务</text>
      </view>
      <view v-for="t in highTasks" :key="t.Id" class="task-card">
        <view class="task-badge" :class="t.Priority.toLowerCase()">{{ priorityLabel(t.Priority) }}</view>
        <view class="task-info">
          <text class="task-title">{{ t.Title }}</text>
          <text class="task-due" v-if="t.DueAt">截止：{{ formatDT(t.DueAt) }}</text>
        </view>
        <button class="task-done-btn" @click="doneTask(t.Id)">完成</button>
      </view>
    </view>

    <!-- 未处理风险提醒 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">风险提醒</text>
        <text class="section-more" @click="goRisk">全部 ›</text>
      </view>
      <view v-if="openAlertList.length === 0" class="empty-card">
        <text class="empty-text">暂无未处理风险</text>
      </view>
      <view v-for="a in openAlertList" :key="a.Id" class="alert-card" :class="a.Level.toLowerCase()">
        <view class="alert-level">{{ levelLabel(a.Level) }}</view>
        <view class="alert-desc">
          <text class="alert-text">{{ a.Description || '请关注该来访者状态' }}</text>
        </view>
        <button class="alert-handle-btn" @click="handleAlert(a.Id)">已处理</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'

interface Task { Id: number; Title: string; Priority: string; Status: string; DueAt?: string }
interface Alert { Id: number; Level: string; Description?: string; Status: string }

const tasks = ref<Task[]>([])
const alerts = ref<Alert[]>([])
const scheduleCount = ref(0)

const today = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})

const openTasks = computed(() => tasks.value.filter(t => t.Status !== 'DONE').length)
const openAlerts = computed(() => alerts.value.filter(a => a.Status === 'OPEN').length)
const highTasks = computed(() =>
  tasks.value.filter(t => t.Priority === 'HIGH' && t.Status !== 'DONE').slice(0, 5)
)
const openAlertList = computed(() => alerts.value.filter(a => a.Status === 'OPEN').slice(0, 5))

const priorityLabel = (p: string) => ({ HIGH: '紧急', NORMAL: '普通', LOW: '低优' }[p] || p)
const levelLabel = (l: string) => ({ CRITICAL: '危急', HIGH: '高危', MEDIUM: '中危', LOW: '低危' }[l] || l)
const formatDT = (dt: string) => dt?.slice(0, 16).replace('T', ' ') ?? ''

const load = async () => {
  const [tr, ar, sr] = await Promise.all([
    httpV2.get('/api/mini/assistant/tasks'),
    httpV2.get('/api/mini/assistant/risk-alerts'),
    httpV2.get('/api/mini/assistant/schedule-overview'),
  ])
  if (tr.code === 0 && tr.data) tasks.value = tr.data
  if (ar.code === 0 && ar.data) alerts.value = ar.data
  if (sr.code === 0 && Array.isArray(sr.data)) scheduleCount.value = sr.data.length
}

const doneTask = async (id: number) => {
  await httpV2.put(`/api/mini/assistant/tasks/${id}`, { status: 'DONE' })
  await load()
  uni.showToast({ title: '已完成', icon: 'success' })
}

const handleAlert = async (id: number) => {
  await httpV2.put(`/api/mini/assistant/risk-alerts/${id}`, { handler_note: '已处理' })
  await load()
  uni.showToast({ title: '已处理', icon: 'success' })
}

const goTasks = (status: string) =>
  uni.navigateTo({ url: `/pages/assistant/tasks/index?status=${status}` })
const goRisk = () =>
  uni.navigateTo({ url: '/pages/assistant/risk/index' })
const goSchedule = () =>
  uni.navigateTo({ url: '/pages/assistant/schedule/index' })

onMounted(load)
</script>

<style scoped>
.page-assistant { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }

.header-card {
  background: linear-gradient(135deg, #7C3AED, #6D28D9);
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  margin-bottom: 32rpx;
}
.greeting { display: block; font-size: 40rpx; font-weight: 800; color: #fff; }
.date-text { font-size: 26rpx; color: rgba(255,255,255,0.8); margin-top: 8rpx; }

.stats-row { display: flex; gap: 20rpx; margin-bottom: 32rpx; }
.stat-card {
  flex: 1; background: #fff; border-radius: 24rpx;
  padding: 32rpx 16rpx; text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.stat-num { display: block; font-size: 56rpx; font-weight: 800; color: #374151; }
.stat-num.alert { color: #EF4444; }
.stat-label { font-size: 24rpx; color: #6B7280; margin-top: 8rpx; }

.section { margin-bottom: 32rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.section-title { font-size: 32rpx; font-weight: 700; color: #1F2937; }
.section-more { font-size: 26rpx; color: #7C3AED; }

.empty-card { background: #fff; border-radius: 24rpx; padding: 48rpx; text-align: center; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }

.task-card {
  background: #fff; border-radius: 20rpx;
  padding: 24rpx 28rpx; display: flex; align-items: center; gap: 20rpx;
  margin-bottom: 16rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}
.task-badge {
  padding: 6rpx 16rpx; border-radius: 100rpx; font-size: 22rpx; font-weight: 700;
  flex-shrink: 0;
}
.task-badge.high { background: #FEE2E2; color: #B91C1C; }
.task-badge.normal { background: #DBEAFE; color: #1E40AF; }
.task-badge.low { background: #F3F4F6; color: #6B7280; }
.task-info { flex: 1; }
.task-title { display: block; font-size: 28rpx; font-weight: 600; color: #1F2937; }
.task-due { font-size: 24rpx; color: #9CA3AF; margin-top: 4rpx; }
.task-done-btn {
  height: 60rpx; line-height: 60rpx; padding: 0 24rpx;
  border-radius: 100rpx; font-size: 24rpx; font-weight: 600;
  background: #7C3AED; color: #fff; border: none; margin: 0; flex-shrink: 0;
}

.alert-card {
  background: #fff; border-radius: 20rpx; padding: 24rpx 28rpx;
  display: flex; align-items: center; gap: 20rpx;
  margin-bottom: 16rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
  border-left: 8rpx solid #9CA3AF;
}
.alert-card.critical { border-left-color: #B91C1C; }
.alert-card.high { border-left-color: #EF4444; }
.alert-card.medium { border-left-color: #F59E0B; }
.alert-card.low { border-left-color: #10B981; }
.alert-level { font-size: 24rpx; font-weight: 700; color: #6B7280; flex-shrink: 0; }
.alert-desc { flex: 1; }
.alert-text { font-size: 28rpx; color: #374151; }
.alert-handle-btn {
  height: 60rpx; line-height: 60rpx; padding: 0 24rpx;
  border-radius: 100rpx; font-size: 24rpx; font-weight: 600;
  background: #fff; color: #7C3AED;
  border: 2rpx solid #7C3AED; margin: 0; flex-shrink: 0;
}
</style>
