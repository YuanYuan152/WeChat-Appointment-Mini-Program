<template>
  <view class="page-detail">
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="!detail" class="empty">来访者不存在</view>
    <view v-else class="content-wrap">
      <view class="profile-card">
        <text class="profile-name">{{ detail.name }}</text>
        <view class="info-row">
          <text class="label">手机号</text>
          <text class="value">{{ detail.mobile || '未填写' }}</text>
        </view>
        <view v-if="detail.gender" class="info-row">
          <text class="label">性别</text>
          <text class="value">{{ genderLabel(detail.gender) }}</text>
        </view>
        <view v-if="detail.emergencyContact || detail.emergencyPhone" class="info-row">
          <text class="label">紧急联系人</text>
          <text class="value">
            {{ detail.emergencyContact || '—' }}
            {{ detail.emergencyPhone ? ` ${detail.emergencyPhone}` : '' }}
          </text>
        </view>
        <view class="stats">
          <view class="stat"><text class="num">{{ detail.totalConsultations }}</text><text class="lbl">全部</text></view>
          <view class="stat"><text class="num upcoming">{{ detail.upcomingCount }}</text><text class="lbl">即将开始</text></view>
          <view class="stat"><text class="num done">{{ detail.completedCount }}</text><text class="lbl">已完成</text></view>
          <view class="stat"><text class="num cancelled">{{ detail.cancelledCount }}</text><text class="lbl">已取消</text></view>
        </view>
      </view>

      <view class="filter-bar">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeTab === tab.value }"
          @tap="activeTab = tab.value"
        >
          {{ tab.label }}
        </view>
      </view>

      <view v-if="filteredConsultations.length === 0" class="empty-list">暂无{{ activeTabLabel }}预约记录</view>
      <view v-else class="cons-list">
        <view v-for="item in filteredConsultations" :key="item.consultationId" class="cons-card">
          <view class="cons-head">
            <text class="counselor">{{ item.counselorName }}</text>
            <text class="status" :class="item.phase">{{ item.statusLabel }}</text>
          </view>
          <text class="line">时间：{{ formatRange(item.startTime, item.endTime) }}</text>
          <text v-if="item.location" class="line">地点：{{ item.location }}</text>
          <text class="line muted">预约编号 #{{ item.consultationId }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface ConsultationItem {
  consultationId: number
  counselorName: string
  status: string
  statusLabel: string
  phase: string
  startTime?: string
  endTime?: string
  location?: string
}

interface PatientDetail {
  patientId: number
  name: string
  mobile?: string
  gender?: string
  emergencyContact?: string
  emergencyPhone?: string
  totalConsultations: number
  upcomingCount: number
  completedCount: number
  cancelledCount: number
  consultations: ConsultationItem[]
}

const tabs = [
  { value: 'ALL', label: '全部' },
  { value: 'upcoming', label: '即将开始' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

const loading = ref(true)
const detail = ref<PatientDetail | null>(null)
const activeTab = ref('ALL')

const activeTabLabel = computed(() => tabs.find(t => t.value === activeTab.value)?.label || '')

const filteredConsultations = computed(() => {
  if (!detail.value) return []
  if (activeTab.value === 'ALL') return detail.value.consultations
  return detail.value.consultations.filter(c => c.phase === activeTab.value)
})

const genderLabel = (g: string) => ({ male: '男', female: '女', M: '男', F: '女' }[g] || g)

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '—')

const formatRange = (start?: string, end?: string) => {
  if (!start) return '—'
  const s = formatDT(start)
  if (!end) return s
  const endText = end.replace('T', ' ')
  const endShort = endText.length > 11 ? endText.slice(11, 16) : endText.slice(0, 16)
  return `${s} - ${endShort}`
}

onLoad(async (opts) => {
  const patientId = Number(opts?.patientId || 0)
  if (!patientId) {
    loading.value = false
    return
  }
  try {
    const res = await httpV2.get<PatientDetail>(API_ENDPOINTS.admin.patientDetail(patientId))
    if (res.code === 0 && res.data) detail.value = res.data
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-detail { min-height: 100vh; background: #F7F5F2; padding: 32rpx; padding-bottom: 48rpx; }
.empty, .empty-list { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }
.profile-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.profile-name { display: block; font-size: 34rpx; font-weight: 600; color: #2C2C2C; margin-bottom: 20rpx; }
.info-row { display: flex; gap: 24rpx; padding: 10rpx 0; }
.label { font-size: 26rpx; color: #8A8A8A; width: 160rpx; flex-shrink: 0; }
.value { flex: 1; font-size: 26rpx; color: #2C2C2C; line-height: 1.5; }
.stats { display: flex; gap: 12rpx; margin-top: 24rpx; }
.stat { flex: 1; text-align: center; background: #FAF7F3; border-radius: 12rpx; padding: 14rpx 6rpx; }
.num { display: block; font-size: 32rpx; font-weight: 700; color: #2C2C2C; }
.num.upcoming { color: #2563EB; }
.num.done { color: #3D5A4E; }
.num.cancelled { color: #9CA3AF; }
.lbl { display: block; margin-top: 4rpx; font-size: 20rpx; color: #8A8A8A; }
.filter-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
  overflow-x: auto;
}
.filter-tab {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: #fff;
  font-size: 24rpx;
  color: #6B6560;
}
.filter-tab.active { background: #3D5A4E; color: #fff; font-weight: 600; }
.cons-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.03);
}
.cons-head { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.counselor { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.status {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-weight: 600;
}
.status.upcoming { background: #DBEAFE; color: #1D4ED8; }
.status.completed { background: #E8E4DE; color: #3D5A4E; }
.status.cancelled { background: #F3F4F6; color: #6B7280; }
.status.other { background: #F5EFE3; color: #C9A96E; }
.line { display: block; margin-top: 10rpx; font-size: 26rpx; color: #4B5563; line-height: 1.5; }
.line.muted { font-size: 22rpx; color: #9CA3AF; margin-top: 12rpx; }
</style>
