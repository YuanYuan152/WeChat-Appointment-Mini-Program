<template>

  <view class="page-records">

    <view class="page-header">

      <text class="page-title">预约记录</text>

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

      <text class="empty-text">{{ emptyText }}</text>

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

            <text class="time">{{ formatSlotRange(r.startTime, r.endTime) }}</text>

            <text v-if="r.centerName" class="center">{{ r.centerName }}</text>

          </view>

          <text class="status" :class="r.status.toLowerCase()">{{ statusLabel(r.status) }}</text>

        </view>

        <view v-if="r.note && !isCenterNote(r.note)" class="note">{{ r.note }}</view>

        <view v-if="r.exemptionStatus === 'PENDING'" class="exemption-banner pending">
          <text class="exemption-title">退款豁免审核中</text>
          <text class="exemption-desc">管理员审核通过后将取消预约并退款；审核前预约与订单维持不变</text>
        </view>
        <view v-else-if="r.exemptionStatus === 'REJECTED'" class="exemption-banner rejected">
          <text class="exemption-title">退款豁免未通过</text>
          <text v-if="r.exemptionRejectReason" class="exemption-desc">拒绝理由：{{ r.exemptionRejectReason }}</text>
          <text class="exemption-desc">预约与订单维持不变，您仍可按原订单前来咨询或自行取消（不退款）</text>
        </view>
        <view v-else-if="r.exemptionStatus === 'APPROVED'" class="exemption-banner approved">
          <text class="exemption-title">退款豁免已通过</text>
          <text class="exemption-desc">预约已取消，款项将原路退回</text>
        </view>

        <view v-else-if="r.status === 'CANCELLED' && r.cancelSummary" class="cancel-summary">
          <text class="cancel-summary-text">{{ r.cancelSummary }}</text>
          <text v-if="r.orderAmount" class="cancel-summary-amount">订单金额：￥{{ formatYuan(r.orderAmount) }}</text>
        </view>

        <view v-if="r.canCancel" class="record-actions">

          <text class="refund-hint">{{ r.refundEligible ? '距咨询超过24小时，取消可退款' : '距咨询不足24小时，取消不退款' }}</text>

          <button class="cancel-btn" :disabled="cancellingId === r.id" @click="openCancelModal(r)">

            {{ cancellingId === r.id ? '取消中...' : '取消预约' }}

          </button>

        </view>

      </view>

    </view>



    <!-- 取消预约详情弹窗 -->

    <view v-if="showCancelModal" class="cancel-overlay" @touchmove.stop.prevent>

      <view class="cancel-card" @tap.stop>

        <text class="cancel-title">取消预约</text>

        <text class="cancel-sub">请确认以下咨询信息</text>



        <view class="cancel-info">

          <view class="cancel-row">

            <text class="cancel-label">咨询师</text>

            <text class="cancel-value">{{ cancelTarget?.counselorName }}</text>

          </view>

          <view class="cancel-row">

            <text class="cancel-label">咨询时段</text>

            <text class="cancel-value highlight">

              {{ formatSlotRange(cancelTarget?.startTime, cancelTarget?.endTime) }}

            </text>

          </view>

          <view v-if="cancelTarget?.centerName" class="cancel-row">

            <text class="cancel-label">预约中心</text>

            <text class="cancel-value">{{ cancelTarget.centerName }}</text>

          </view>

          <view class="cancel-row">

            <text class="cancel-label">是否全额退款</text>

            <text class="cancel-value" :class="cancelTarget?.refundEligible ? 'refund-yes' : 'refund-no'">

              {{ cancelTarget?.refundEligible ? '是，取消后原路全额退款' : '否' }}

            </text>

          </view>

          <view v-if="!cancelTarget?.refundEligible && cancelTarget?.refundReason" class="cancel-reason-box">

            <text class="cancel-reason-label">不能全额退款原因</text>

            <text class="cancel-reason-text">{{ cancelTarget.refundReason }}</text>

          </view>

          <view v-if="cancelTarget?.orderAmount" class="cancel-row">

            <text class="cancel-label">订单金额</text>

            <text class="cancel-value">￥{{ formatYuan(cancelTarget.orderAmount) }}</text>

          </view>

        </view>



        <view class="cancel-btns">

          <view class="cancel-btn-row">

            <button class="cancel-action-btn back" @tap="closeCancelModal">返回</button>

            <button class="cancel-action-btn exempt" :disabled="cancelTarget?.exemptionStatus === 'PENDING'" @tap="goExemption">

              {{ cancelTarget?.exemptionStatus === 'PENDING' ? '审核中' : '申请豁免' }}

            </button>

          </view>

          <button

            class="cancel-action-btn confirm"

            :disabled="cancellingId === cancelTarget?.id"

            @tap="confirmCancel"

          >

            {{ cancellingId === cancelTarget?.id ? '取消中...' : '确认取消' }}

          </button>

        </view>

      </view>

    </view>

  </view>

</template>



<script setup lang="ts">

import { computed, onMounted, ref } from 'vue'

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

  orderAmount?: number

  refundReason?: string

  exemptionStatus?: string

  exemptionRejectReason?: string

  exemptionId?: number

  orderStatus?: string

  cancelSummary?: string

}



type RecordTab = 'unfinished' | 'done' | 'cancelled'



const tabs: { label: string; value: RecordTab }[] = [

  { label: '未完成', value: 'unfinished' },

  { label: '已完成', value: 'done' },

  { label: '已取消', value: 'cancelled' },

]



const UNFINISHED_STATUSES = new Set(['PENDING', 'CONFIRMED', 'ONGOING'])



const activeTab = ref<RecordTab>('unfinished')

const allRecords = ref<Consultation[]>([])

const records = ref<Consultation[]>([])

const loading = ref(true)

const cancellingId = ref<number | null>(null)

const showCancelModal = ref(false)

const cancelTarget = ref<Consultation | null>(null)



const statusLabel = (s: string) => {

  if (s === 'DONE') return '已完成'

  if (s === 'CANCELLED') return '已取消'

  if (UNFINISHED_STATUSES.has(s)) return '未完成'

  return s

}



const emptyText = computed(() => {

  if (activeTab.value === 'cancelled') return '暂无已取消的预约'

  if (activeTab.value === 'done') return '暂无已完成的预约'

  return '暂无未完成的预约'

})



const formatYuan = (cents?: number) => {

  if (!cents) return '0'

  return (cents / 100).toFixed(2).replace(/\.00$/, '')

}



/** 预约时段：2026-06-15 10:00 – 10:50 */

const formatSlotRange = (start?: string, end?: string) => {

  if (!start) return ''

  const startNorm = start.replace('T', ' ')

  const datePart = startNorm.slice(0, 10)

  const startClock = startNorm.slice(11, 16)

  if (!end) return `${datePart} ${startClock}`

  const endNorm = end.replace('T', ' ')

  const endDate = endNorm.slice(0, 10)

  const endClock = endNorm.slice(11, 16)

  if (endDate === datePart) {

    return `${datePart} ${startClock} – ${endClock}`

  }

  return `${startNorm.slice(0, 16)} – ${endNorm.slice(0, 16)}`

}



const isCenterNote = (note: string) => note.toLowerCase().includes('center:')



const cardClass = (r: Consultation) => {

  if (r.status === 'DONE') return 'record-card--done'

  if (r.status === 'CANCELLED') return 'record-card--cancelled'

  return ''

}



const filterByTab = (list: Consultation[], tab: RecordTab) => {

  if (tab === 'done') {

    return list.filter(r => r.status === 'DONE')

  }

  if (tab === 'cancelled') {

    return list.filter(r => r.status === 'CANCELLED')

  }

  return list.filter(r => UNFINISHED_STATUSES.has(r.status))

}



const applyTabFilter = () => {

  records.value = filterByTab(allRecords.value, activeTab.value)

}



const fetchList = async () => {

  loading.value = true

  try {

    const res = await httpV2.get<Consultation[]>(API_ENDPOINTS.patient.consultations)

    const all = res.code === 0 && Array.isArray(res.data) ? res.data : []

    allRecords.value = all

    applyTabFilter()

  } catch {

    allRecords.value = []

    records.value = []

  } finally {

    loading.value = false

  }

}



const switchTab = (v: RecordTab) => {

  if (activeTab.value === v) return

  activeTab.value = v

  applyTabFilter()

}



const openCancelModal = (r: Consultation) => {

  cancelTarget.value = r

  showCancelModal.value = true

}



const closeCancelModal = () => {

  showCancelModal.value = false

  cancelTarget.value = null

}



const goExemption = () => {
  const r = cancelTarget.value
  if (!r) return
  if (r.exemptionStatus === 'PENDING') {
    uni.showToast({ title: '已有待审核的豁免申请', icon: 'none' })
    return
  }
  if (r.refundEligible) {
    uni.showToast({ title: '超过24小时可直接取消退款，无需申请豁免', icon: 'none' })
    return
  }
  const slotText = formatSlotRange(r.startTime, r.endTime)
  const url = `/pages/patient/refund-exemption/apply?consultationId=${r.id}`
    + `&counselorName=${encodeURIComponent(r.counselorName || '')}`
    + `&slotText=${encodeURIComponent(slotText)}`
    + `&orderAmount=${r.orderAmount || 0}`
  closeCancelModal()
  uni.navigateTo({
    url,
    fail: () => {
      uni.showToast({ title: '无法打开申请豁免页，请重新编译小程序', icon: 'none' })
    },
  })
}



const confirmCancel = async () => {

  const r = cancelTarget.value

  if (!r || cancellingId.value) return



  cancellingId.value = r.id

  try {

    const res = await httpV2.post<{ refunded: boolean; message: string }>(

      API_ENDPOINTS.patient.consultationCancel(r.id),

    )

    if (res.code === 0) {

      closeCancelModal()

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

}



onMounted(fetchList)

defineExpose({ refresh: fetchList })

</script>



<style scoped>

.page-records { padding: 32rpx; min-height: 100vh; background: #F7F5F2; }

.page-header { margin-bottom: 24rpx; }

.page-title { font-size: 40rpx; font-weight: 800; color: #1F2937; }

.filter-bar { display: flex; gap: 16rpx; margin-top: 24rpx; flex-wrap: wrap; }

.filter-tab {

  padding: 12rpx 28rpx; border-radius: 100rpx; font-size: 26rpx;

  background: #fff; color: #6B7280; border: 1px solid #E5E7EB;

}

.filter-tab.active { background: #3D5A4E; color: #fff; border-color: #3D5A4E; }

.empty-state { text-align: center; padding: 120rpx 0; }

.empty-text { font-size: 28rpx; color: #9CA3AF; }

.record-list { display: flex; flex-direction: column; gap: 24rpx; }

.record-card {

  background: #fff; border-radius: 32rpx; padding: 32rpx;

  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);

}

.record-card--done { background: #FAFAF8; opacity: 0.92; }

.record-card--cancelled { background: #FAFAF8; opacity: 0.85; }

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

.status.pending, .status.confirmed, .status.ongoing { color: #3D5A4E; background: #F0EDE8; }

.status.done { color: #6B7280; background: #E5E7EB; }

.status.cancelled { color: #9CA3AF; background: #F3F4F6; }

.cancel-summary {
  margin-top: 20rpx; padding: 20rpx 24rpx; border-radius: 16rpx;
  background: #F3F4F6; border: 1rpx solid #E5E7EB;
}
.cancel-summary-text { display: block; font-size: 24rpx; color: #6B7280; line-height: 1.6; }
.cancel-summary-amount { display: block; margin-top: 8rpx; font-size: 22rpx; color: #9CA3AF; }

.note {

  margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx dashed #E5E7EB;

  font-size: 26rpx; color: #4B5563; line-height: 1.6;

}

.exemption-banner {
  margin-top: 20rpx; padding: 20rpx 24rpx; border-radius: 16rpx;
}
.exemption-banner.pending { background: #FFFBEB; border: 1rpx solid #FDE68A; }
.exemption-banner.rejected { background: #FEF2F2; border: 1rpx solid #FECACA; }
.exemption-banner.approved { background: #F0EDE8; border: 1rpx solid #D4C9BC; }
.exemption-title { display: block; font-size: 26rpx; font-weight: 700; margin-bottom: 8rpx; }
.exemption-banner.pending .exemption-title { color: #B45309; }
.exemption-banner.rejected .exemption-title { color: #B91C1C; }
.exemption-banner.approved .exemption-title { color: #3D5A4E; }
.exemption-desc { display: block; font-size: 22rpx; color: #6B7280; line-height: 1.6; }

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



.cancel-overlay {

  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx;
  padding-top: calc(48rpx + env(safe-area-inset-top, 0px));
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom, 0px));
  background: rgba(17, 24, 39, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.cancel-card {

  width: 100%;
  max-width: 640rpx;
  background: #ffffff;
  border-radius: 40rpx;
  padding: 40rpx 40rpx 32rpx;
  box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.cancel-title {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  color: #1F2937;
  text-align: center;
}

.cancel-sub {
  display: block;
  font-size: 28rpx;
  color: #6B7280;
  text-align: center;
  margin: 8rpx 0 32rpx;
  line-height: 1.5;
}

.cancel-info {

  background: #F7F5F2;
  border-radius: 24rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 32rpx;
  border: 1rpx solid #F0EDE8;
}

.cancel-row { display: flex; justify-content: space-between; gap: 20rpx; margin-bottom: 20rpx; align-items: flex-start; }

.cancel-row:last-child { margin-bottom: 0; }

.cancel-label { font-size: 28rpx; color: #6B7280; font-weight: 500; flex-shrink: 0; }

.cancel-value { font-size: 28rpx; color: #1F2937; font-weight: 600; text-align: right; flex: 1; line-height: 1.5; }

.cancel-value.highlight { color: #3D5A4E; }

.cancel-value.refund-yes { color: #3D5A4E; }

.cancel-value.refund-no { color: #DC2626; }

.cancel-reason-box {

  margin-top: 16rpx;
  padding: 20rpx;
  background: #FFFBEB;
  border-radius: 16rpx;
  border: 1rpx solid #FDE68A;

}

.cancel-reason-label { display: block; font-size: 24rpx; color: #B45309; font-weight: 600; margin-bottom: 8rpx; }

.cancel-reason-text { display: block; font-size: 26rpx; color: #92400E; line-height: 1.6; }

.cancel-btns { display: flex; flex-direction: column; gap: 20rpx; }

.cancel-btn-row { display: flex; gap: 20rpx; }

.cancel-action-btn {

  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 100rpx;
  margin: 0;
  padding: 0;
  border: none;
}

.cancel-action-btn::after { border: none; }

.cancel-action-btn.back {
  background: #ffffff;
  color: #4B5563;
  border: 2rpx solid #E5E7EB;
  line-height: 84rpx;
}

.cancel-action-btn.exempt {
  background: #ffffff;
  color: #3D5A4E;
  border: 2rpx solid #3D5A4E;
  line-height: 84rpx;
}

.cancel-action-btn.exempt[disabled] {
  opacity: 0.45;
  color: #9CA3AF;
  border-color: #D1D5DB;
}

.cancel-action-btn.confirm {
  width: 100%;
  background: #3D5A4E;
  color: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(61, 90, 78, 0.2);
}

.cancel-action-btn.confirm[disabled] {
  background: #D1D5DB;
  color: #9CA3AF;
  box-shadow: none;
}

.cancel-action-btn.confirm:active:not([disabled]) {
  background: #2F4A40;
}

</style>

