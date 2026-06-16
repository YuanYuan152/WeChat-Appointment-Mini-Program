<template>
  <view class="page-refund-exemptions">
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

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="items.length === 0" class="empty">暂无{{ activeTabLabel }}申请</view>
    <view v-else class="list">
      <view v-for="item in items" :key="item.id" class="card" @click="openDetail(item)">
        <view class="card-head">
          <text class="patient">{{ item.patientName }}</text>
          <text class="status" :class="item.status.toLowerCase()">{{ statusLabel(item.status) }}</text>
        </view>
        <text class="line">咨询师：{{ item.counselorName }}</text>
        <text class="line">申请金额：￥{{ formatYuan(item.amount) }}</text>
        <text class="line">咨询时段：{{ formatTime(item.consultationStartTime) }}</text>
        <text class="reason-preview">原因：{{ item.reason }}</text>
        <text class="time">提交于 {{ formatTime(item.createdAt) }}</text>
      </view>
    </view>

    <view v-if="showDetail" class="overlay" @touchmove.stop.prevent>
      <view class="detail-card" @tap.stop>
        <text class="detail-title">豁免申请详情</text>
        <view class="detail-body">
          <view class="detail-row"><text class="label">来访者</text><text class="value">{{ detail?.patientName }}</text></view>
          <view class="detail-row"><text class="label">手机号</text><text class="value">{{ detail?.patientMobile || '-' }}</text></view>
          <view class="detail-row"><text class="label">咨询师</text><text class="value">{{ detail?.counselorName }}</text></view>
          <view class="detail-row"><text class="label">咨询时段</text><text class="value">{{ formatTime(detail?.consultationStartTime) }}</text></view>
          <view class="detail-row"><text class="label">预约状态</text><text class="value">{{ detail?.consultationStatus || '-' }}</text></view>
          <view class="detail-row"><text class="label">申请金额</text><text class="value highlight">￥{{ formatYuan(detail?.amount) }}</text></view>
          <view class="reason-box">
            <text class="reason-label">申请原因</text>
            <text class="reason-text">{{ detail?.reason }}</text>
          </view>
          <view v-if="detail?.status === 'REJECTED' && detail?.rejectReason" class="reject-box">
            <text class="reason-label">拒绝理由</text>
            <text class="reason-text">{{ detail.rejectReason }}</text>
          </view>
        </view>

        <view v-if="detail?.status === 'PENDING'" class="actions">
          <button class="btn reject" :disabled="processing" @click="showRejectInput = true">拒绝</button>
          <button class="btn approve" :loading="processing" @click="approve">同意豁免</button>
        </view>
        <button v-else class="btn close" @click="closeDetail">关闭</button>

        <view v-if="showRejectInput" class="reject-form">
          <text class="reject-form-title">填写拒绝理由（来访者可见）</text>
          <textarea
            v-model="rejectReason"
            class="reject-textarea"
            placeholder="请说明不予豁免的原因"
            maxlength="500"
          />
          <view class="reject-actions">
            <button class="btn ghost" @click="showRejectInput = false">取消</button>
            <button class="btn reject" :loading="processing" @click="reject">确认拒绝</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface ExemptionItem {
  id: number
  consultationId: number
  accountId: number
  patientName: string
  patientMobile?: string
  counselorId: number
  counselorName: string
  amount: number
  reason: string
  status: string
  rejectReason?: string
  consultationStartTime?: string
  consultationStatus?: string
  createdAt: string
  reviewedAt?: string
}

const tabs = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
  { label: '全部', value: 'ALL' },
]

const activeTab = ref('PENDING')
const items = ref<ExemptionItem[]>([])
const loading = ref(true)
const showDetail = ref(false)
const detail = ref<ExemptionItem | null>(null)
const processing = ref(false)
const showRejectInput = ref(false)
const rejectReason = ref('')

const activeTabLabel = computed(() => tabs.find(t => t.value === activeTab.value)?.label || '')

const formatYuan = (cents?: number) => {
  if (!cents) return '0'
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}

const formatTime = (value?: string) => {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

const statusLabel = (s: string) => {
  if (s === 'PENDING') return '待审核'
  if (s === 'APPROVED') return '已通过'
  if (s === 'REJECTED') return '已拒绝'
  return s
}

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<ExemptionItem[]>(
      API_ENDPOINTS.admin.refundExemptions,
      { status: activeTab.value },
      { showLoading: false },
    )
    if (res.code === 0 && Array.isArray(res.data)) {
      items.value = res.data
    } else {
      items.value = []
      const msg = res.msg || (res.code === 403 ? '请使用管理员或运营账号登录' : '加载失败')
      uni.showToast({ title: msg, icon: 'none', duration: 2500 })
    }
  } catch (err: any) {
    items.value = []
    uni.showToast({ title: err?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const switchTab = (value: string) => {
  if (activeTab.value === value) return
  activeTab.value = value
  load()
}

const openDetail = (item: ExemptionItem) => {
  detail.value = item
  showRejectInput.value = false
  rejectReason.value = ''
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  detail.value = null
  showRejectInput.value = false
  rejectReason.value = ''
}

const approve = async () => {
  if (!detail.value || processing.value) return
  processing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.admin.refundExemptionApprove(detail.value.id))
    if (res.code === 0) {
      uni.showToast({ title: res.data?.message || '已同意豁免', icon: 'success' })
      closeDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
  } finally {
    processing.value = false
  }
}

const reject = async () => {
  if (!detail.value || processing.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    uni.showToast({ title: '请填写拒绝理由', icon: 'none' })
    return
  }
  processing.value = true
  try {
    const res = await httpV2.post(
      API_ENDPOINTS.admin.refundExemptionReject(detail.value.id),
      { reject_reason: reason },
    )
    if (res.code === 0) {
      uni.showToast({ title: '已拒绝，预约维持不变', icon: 'success' })
      closeDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
  } finally {
    processing.value = false
  }
}

onShow(load)
</script>

<style scoped>
.page-refund-exemptions { min-height: 100vh; background: #F7F5F2; padding: 24rpx; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 24rpx; }
.filter-tab {
  padding: 12rpx 24rpx; border-radius: 999rpx; font-size: 24rpx;
  background: #fff; color: #6B6560; border: 1rpx solid #E8E4DE;
}
.filter-tab.active { background: #3D5A4E; color: #fff; border-color: #3D5A4E; }
.empty { text-align: center; color: #8A8A8A; padding: 80rpx 0; font-size: 28rpx; }
.list { display: flex; flex-direction: column; gap: 20rpx; }
.card {
  background: #fff; border-radius: 20rpx; padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.patient { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.status { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 999rpx; }
.status.pending { background: #FEF3C7; color: #B45309; }
.status.approved { background: #D1FAE5; color: #047857; }
.status.rejected { background: #FEE2E2; color: #B91C1C; }
.line { display: block; font-size: 24rpx; color: #6B6560; line-height: 1.7; }
.reason-preview {
  display: block; margin-top: 12rpx; font-size: 24rpx; color: #4B5563;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.time { display: block; margin-top: 12rpx; font-size: 22rpx; color: #9CA3AF; }
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; padding: 32rpx; z-index: 1000;
}
.detail-card {
  width: 100%; max-width: 680rpx; background: #fff; border-radius: 24rpx; padding: 32rpx;
}
.detail-title { display: block; text-align: center; font-size: 34rpx; font-weight: 700; margin-bottom: 24rpx; }
.detail-row { display: flex; justify-content: space-between; gap: 20rpx; margin-bottom: 16rpx; }
.label { font-size: 26rpx; color: #8A8A8A; flex-shrink: 0; }
.value { font-size: 26rpx; color: #2C2C2C; text-align: right; }
.value.highlight { color: #B45309; font-weight: 600; }
.reason-box, .reject-box {
  margin-top: 16rpx; background: #F9FAFB; border-radius: 16rpx; padding: 20rpx;
}
.reject-box { background: #FEF2F2; border: 1rpx solid #FECACA; }
.reason-label { display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 8rpx; }
.reason-text { display: block; font-size: 26rpx; color: #374151; line-height: 1.6; }
.actions { display: flex; gap: 16rpx; margin-top: 28rpx; }
.btn {
  flex: 1; height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; border: none;
}
.btn::after { border: none; }
.btn.approve { background: #3D5A4E; color: #fff; }
.btn.reject { background: #FEE2E2; color: #B91C1C; }
.btn.close { width: 100%; margin-top: 28rpx; background: #F0EDE8; color: #3D5A4E; }
.reject-form { margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #F3F4F6; }
.reject-form-title { display: block; font-size: 26rpx; color: #374151; margin-bottom: 12rpx; }
.reject-textarea {
  width: 100%; box-sizing: border-box; min-height: 160rpx; background: #F9FAFB;
  border-radius: 12rpx; padding: 16rpx; font-size: 28rpx;
}
.reject-actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
.btn.ghost { background: #fff; color: #6B6560; border: 1rpx solid #E8E4DE; }
</style>
