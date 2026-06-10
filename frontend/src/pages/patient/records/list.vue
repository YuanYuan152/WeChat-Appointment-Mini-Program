<template>
  <view class="page-records">
    <view class="page-header">
      <text class="page-title">咨询记录</text>
      <view class="filter-bar">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeTab === tab.value }"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
        </view>
      </view>
    </view>

    <view v-if="loading" class="empty-state">
      <text class="empty-text">加载中...</text>
    </view>
    <view v-else-if="records.length === 0" class="empty-state">
      <text class="empty-text">暂无咨询记录</text>
    </view>
    <view v-else class="record-list">
      <view
        v-for="r in records"
        :key="r.id"
        class="record-card"
        :class="cardClass(r)"
      >
        <view class="record-header">
          <image class="avatar" :src="r.counselorAvatar || '/static/images/tc59.png'" mode="aspectFill" />
          <view class="meta">
            <text class="name">{{ r.counselorName }}</text>
            <text class="time">{{ formatTime(r.startTime || r.createdAt) }}</text>
            <text v-if="r.centerName" class="center">{{ r.centerName }}</text>
          </view>
          <text class="status" :class="r.status.toLowerCase()">{{ statusLabel(r.status) }}</text>
        </view>
        <view v-if="r.note && !isCenterNote(r.note)" class="note">{{ r.note }}</view>
        <view v-if="r.canCancel" class="record-actions">
          <text class="refund-hint">{{ r.refundEligible ? '距开始超过24小时，取消可退款' : '距开始不足24小时，取消不退款' }}</text>
          <button class="cancel-btn" :disabled="cancellingId === r.id" @click="handleCancel(r)">
            {{ cancellingId === r.id ? '取消中...' : '取消预约' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface Consultation {
  id: number
  orderId?: number
  counselorId: number
  counselorName: string
  counselorAvatar?: string
  scheduleId?: number
  status: string
  startTime?: string
  endTime?: string
  note?: string
  createdAt: string
  centerId?: string
  centerName?: string
  canCancel?: boolean
  refundEligible?: boolean
}

const tabs = [
  { label: '全部', value: '' },
  { label: '待确认', value: 'PENDING' },
  { label: '已确认', value: 'CONFIRMED' },
  { label: '已完成', value: 'DONE' },
]

const activeTab = ref<string>('')
const records = ref<Consultation[]>([])
const loading = ref(true)
const cancellingId = ref<number | null>(null)

const statusLabel = (s: string) => ({
  PENDING: '待确认',
  CONFIRMED: '已确认',
  ONGOING: '进行中',
  DONE: '已完成',
  CANCELLED: '已取消',
}[s] || s)

const formatTime = (s?: string) => (s ? s.replace('T', ' ').slice(0, 16) : '')

const isCenterNote = (note: string) => note.toLowerCase().startsWith('center:')

const cardClass = (r: Consultation) => {
  if (r.status === 'DONE') return 'record-card--done'
  if (r.status === 'CANCELLED') return 'record-card--cancelled'
  return ''
}

const fetchList = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (activeTab.value) params.status = activeTab.value
    const res = await httpV2.get<Consultation[]>(API_ENDPOINTS.patient.consultations, params)
    records.value = res.code === 0 && Array.isArray(res.data) ? res.data : []
  } catch {
    records.value = []
  } finally {
    loading.value = false
  }
}

const switchTab = (v: string) => {
  if (activeTab.value === v) return
  activeTab.value = v
  fetchList()
}

const handleCancel = (r: Consultation) => {
  const content = r.refundEligible
    ? '距咨询开始超过24小时，取消后将原路退款。确认取消？'
    : '距咨询开始不足24小时，取消后不予退款。确认取消？'
  uni.showModal({
    title: '取消预约',
    content,
    confirmText: '确认取消',
    cancelText: '再想想',
    success: async (modal) => {
      if (!modal.confirm) return
      cancellingId.value = r.id
      try {
        const res = await httpV2.post<{ refunded: boolean; message: string }>(
          API_ENDPOINTS.patient.consultationCancel(r.id),
        )
        if (res.code === 0) {
          uni.showToast({ title: res.data?.message || '已取消', icon: 'none', duration: 2500 })
          await fetchList()
        } else {
          uni.showToast({ title: res.msg || '取消失败', icon: 'none' })
        }
      } catch (err: any) {
        uni.showToast({ title: err?.message || '取消失败', icon: 'none' })
      } finally {
        cancellingId.value = null
      }
    },
  })
}

onShow(fetchList)
</script>

<style scoped>
.page-records { padding: 32rpx; min-height: 100vh; background: #F4F6F8; }
.page-header { margin-bottom: 24rpx; }
.page-title { font-size: 40rpx; font-weight: 700; color: #1F2937; }
.filter-bar { display: flex; gap: 16rpx; margin-top: 24rpx; flex-wrap: wrap; }
.filter-tab {
  padding: 12rpx 28rpx; border-radius: 100rpx; font-size: 26rpx;
  background: #fff; color: #6B7280; border: 1px solid #E5E7EB;
}
.filter-tab.active { background: #0D9488; color: #fff; border-color: #0D9488; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }
.record-list { display: flex; flex-direction: column; gap: 24rpx; }
.record-card {
  background: #fff; border-radius: 24rpx; padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.record-card--done {
  background: #F9FAFB;
  opacity: 0.85;
}
.record-card--cancelled {
  background: #F9FAFB;
  opacity: 0.75;
}
.record-header { display: flex; align-items: flex-start; gap: 20rpx; }
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; background: #E5E7EB; flex-shrink: 0; }
.meta { flex: 1; display: flex; flex-direction: column; gap: 6rpx; min-width: 0; }
.name { font-size: 30rpx; font-weight: 600; color: #1F2937; }
.time { font-size: 24rpx; color: #9CA3AF; }
.center { font-size: 24rpx; color: #6B7280; }
.status {
  font-size: 24rpx; font-weight: 600; padding: 4rpx 16rpx; border-radius: 12rpx;
  flex-shrink: 0;
}
.status.pending { color: #F59E0B; background: #FEF3C7; }
.status.confirmed, .status.ongoing { color: #0D9488; background: #CCFBF1; }
.status.done { color: #6B7280; background: #E5E7EB; }
.status.cancelled { color: #6B7280; background: #F3F4F6; }
.note {
  margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx dashed #E5E7EB;
  font-size: 26rpx; color: #4B5563; line-height: 1.6;
}
.record-actions {
  margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #F3F4F6;
  display: flex; flex-direction: column; gap: 16rpx; align-items: flex-end;
}
.refund-hint { width: 100%; font-size: 22rpx; color: #9CA3AF; text-align: right; }
.cancel-btn {
  margin: 0; padding: 0 32rpx; height: 64rpx; line-height: 64rpx;
  font-size: 26rpx; color: #DC2626; background: #FEF2F2;
  border: 1rpx solid #FECACA; border-radius: 12rpx;
}
.cancel-btn::after { border: none; }
</style>
