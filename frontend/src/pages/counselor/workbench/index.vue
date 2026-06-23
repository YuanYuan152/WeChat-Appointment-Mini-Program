<template>
  <view class="workbench-shell">
    <view class="segment-wrap">
      <view class="segment-track">
        <view class="segment-thumb" :class="{ right: activeTab === 'dashboard' }" />
        <view
          class="segment-item"
          :class="{ active: activeTab === 'schedule' }"
          @tap="switchTab('schedule')"
        >
          咨询排期
        </view>
        <view
          class="segment-item"
          :class="{ active: activeTab === 'dashboard' }"
          @tap="switchTab('dashboard')"
        >
          个人看板
        </view>
      </view>
    </view>

    <SchedulePanel v-show="activeTab === 'schedule'" ref="scheduleRef" />
    <DashboardPanel v-if="dashboardMounted" v-show="activeTab === 'dashboard'" ref="dashboardRef" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import SchedulePanel from './schedule-panel.vue'
import DashboardPanel from './dashboard-panel.vue'

type WorkbenchTab = 'schedule' | 'dashboard'

const activeTab = ref<WorkbenchTab>('schedule')
const dashboardMounted = ref(false)
const scheduleRef = ref<InstanceType<typeof SchedulePanel> | null>(null)
const dashboardRef = ref<InstanceType<typeof DashboardPanel> | null>(null)
const pendingScheduleId = ref(0)
const preferDashboard = ref(false)
const preferScheduleFilter = ref<'unrecorded' | ''>('')

const switchTab = (tab: WorkbenchTab) => {
  activeTab.value = tab
  if (tab === 'dashboard') dashboardMounted.value = true
  if (tab === 'schedule') scheduleRef.value?.refresh?.()
  if (tab === 'dashboard') dashboardRef.value?.refresh?.()
}

const applyPendingFocus = async () => {
  if (!pendingScheduleId.value) return
  const scheduleId = pendingScheduleId.value
  pendingScheduleId.value = 0
  await scheduleRef.value?.focusScheduleId?.(scheduleId)
}

const applyPendingScheduleFilter = async () => {
  if (!preferScheduleFilter.value) return
  const filter = preferScheduleFilter.value
  preferScheduleFilter.value = ''
  activeTab.value = 'schedule'
  await scheduleRef.value?.refresh?.()
  if (filter === 'unrecorded') {
    scheduleRef.value?.applyListFilter?.({ status: 'UNRECORDED', time: 'all' })
  }
}

onLoad((options?: Record<string, string | undefined>) => {
  pendingScheduleId.value = Number(options?.scheduleId || 0)
  if (options?.tab === 'dashboard') {
    preferDashboard.value = true
    dashboardMounted.value = true
    activeTab.value = 'dashboard'
  }
  if (options?.scheduleFilter === 'unrecorded') {
    preferScheduleFilter.value = 'unrecorded'
  }
})

onShow(async () => {
  if (preferScheduleFilter.value) {
    await applyPendingScheduleFilter()
  } else if (preferDashboard.value) {
    preferDashboard.value = false
    switchTab('dashboard')
  } else {
    activeTab.value = 'schedule'
    await scheduleRef.value?.refresh?.()
  }
  dashboardRef.value?.refresh?.()
  await applyPendingFocus()
})
</script>

<style scoped>
.workbench-shell {
  min-height: 100vh;
  background: #F7F5F2;
}

.segment-wrap {
  padding: 24rpx 32rpx 0;
  position: sticky;
  top: 0;
  z-index: 20;
  background: #F7F5F2;
}

.segment-track {
  position: relative;
  display: flex;
  background: #E8E4DE;
  border-radius: 999rpx;
  padding: 6rpx;
}

.segment-thumb {
  position: absolute;
  top: 6rpx;
  left: 6rpx;
  width: calc(50% - 6rpx);
  height: calc(100% - 12rpx);
  background: #fff;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 16rpx rgba(61, 90, 78, 0.12);
  transition: transform 0.25s ease;
}

.segment-thumb.right {
  transform: translateX(100%);
}

.segment-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 28rpx;
  font-weight: 600;
  color: #8A8A8A;
  position: relative;
  z-index: 1;
  transition: color 0.2s;
}

.segment-item.active {
  color: #3D5A4E;
}
</style>
