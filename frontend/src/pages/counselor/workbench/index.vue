<template>
  <view class="workbench-shell">
    <StaffWorkbenchNavBar title="咨询师工作台" theme="green" />
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

    <SchedulePanel
      v-show="activeTab === 'schedule'"
      ref="scheduleRef"
      :initial-list-filter="initialListFilter"
    />
    <DashboardPanel v-if="dashboardMounted" v-show="activeTab === 'dashboard'" ref="dashboardRef" />
  </view>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import StaffWorkbenchNavBar from '@/components/StaffWorkbenchNavBar.vue'
import SchedulePanel from './schedule-panel.vue'
import DashboardPanel from './dashboard-panel.vue'

type WorkbenchTab = 'schedule' | 'dashboard'
type InitialListFilter = {
  time?: 'all' | 'today' | 'week' | 'month'
  status?: 'ALL' | 'OPEN' | 'BOOKED' | 'DONE' | 'UNRECORDED' | 'RECORDED' | 'ON_LEAVE' | 'EXPIRED'
  expand?: boolean
}

const activeTab = ref<WorkbenchTab>('schedule')
const dashboardMounted = ref(false)
const scheduleRef = ref<InstanceType<typeof SchedulePanel> | null>(null)
const dashboardRef = ref<InstanceType<typeof DashboardPanel> | null>(null)
const pendingScheduleId = ref(0)
const preferDashboard = ref(false)
const preferScheduleFilter = ref<'unrecorded' | ''>('')
/** 个人中心「咨询记录填写」等入口：挂载时即进入普通模式并套用筛选 */
const initialListFilter = ref<InitialListFilter | null>(null)

const switchTab = (tab: WorkbenchTab) => {
  activeTab.value = tab
  if (tab === 'dashboard') dashboardMounted.value = true
  if (tab === 'schedule') scheduleRef.value?.refresh?.()
  if (tab === 'dashboard') dashboardRef.value?.refresh?.()
}

const waitForSchedulePanel = async (retries = 30) => {
  for (let i = 0; i < retries; i++) {
    if (scheduleRef.value?.applyListFilter) return scheduleRef.value
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 32))
  }
  return scheduleRef.value
}

const applyPendingFocus = async () => {
  if (!pendingScheduleId.value) return
  const scheduleId = pendingScheduleId.value
  pendingScheduleId.value = 0
  const panel = await waitForSchedulePanel()
  await panel?.focusScheduleId?.(scheduleId)
}

const applyPendingScheduleFilter = async () => {
  if (!preferScheduleFilter.value) return
  const filter = preferScheduleFilter.value
  activeTab.value = 'schedule'
  const panel = await waitForSchedulePanel()
  if (!panel?.applyListFilter) return
  preferScheduleFilter.value = ''
  if (filter === 'unrecorded') {
    // 时间段：全部；状态：未填写咨询记录；普通模式
    await panel.applyListFilter({ status: 'UNRECORDED', time: 'all', expand: true })
  } else {
    await panel.refresh?.()
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
    initialListFilter.value = { status: 'UNRECORDED', time: 'all', expand: true }
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
