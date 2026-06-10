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

      <text class="empty-text">暂无预约记录</text>

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

          <button class="cancel-action-btn back" @tap="closeCancelModal">返回</button>

          <button class="cancel-action-btn exempt" @tap="goExemption">申请豁免</button>

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

  orderAmount?: number

  refundReason?: string

}



type RecordTab = 'unfinished' | 'done'



const tabs: { label: string; value: RecordTab }[] = [

  { label: '未完成', value: 'unfinished' },

  { label: '已完成', value: 'done' },

]



const UNFINISHED_STATUSES = new Set(['PENDING', 'CONFIRMED', 'ONGOING'])



const activeTab = ref<RecordTab>('unfinished')

const records = ref<Consultation[]>([])

const loading = ref(true)

const cancellingId = ref<number | null>(null)

const showCancelModal = ref(false)

const cancelTarget = ref<Consultation | null>(null)



const statusLabel = (s: string) => {

  if (s === 'DONE') return '已完成'

  if (UNFINISHED_STATUSES.has(s)) return '未完成'

  return s

}



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

  return list.filter(r => UNFINISHED_STATUSES.has(r.status))

}



const fetchList = async () => {

  loading.value = true

  try {

    const res = await httpV2.get<Consultation[]>(API_ENDPOINTS.patient.consultations)

    const all = res.code === 0 && Array.isArray(res.data) ? res.data : []

    records.value = filterByTab(all, activeTab.value)

  } catch {

    records.value = []

  } finally {

    loading.value = false

  }

}



const switchTab = (v: RecordTab) => {

  if (activeTab.value === v) return

  activeTab.value = v

  fetchList()

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

.record-card--done { background: #F9FAFB; opacity: 0.85; }

.record-card--cancelled { background: #F9FAFB; opacity: 0.75; }

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

.status.pending, .status.confirmed, .status.ongoing { color: #0D9488; background: #CCFBF1; }

.status.done { color: #6B7280; background: #E5E7EB; }

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



.cancel-overlay {

  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);

  display: flex; align-items: center; justify-content: center;

  padding: 40rpx; z-index: 1000;

}

.cancel-card {

  width: 100%; max-width: 640rpx; background: #fff;

  border-radius: 28rpx; padding: 40rpx 32rpx 32rpx;

}

.cancel-title { display: block; font-size: 36rpx; font-weight: 800; color: #1F2937; text-align: center; }

.cancel-sub { display: block; font-size: 24rpx; color: #9CA3AF; text-align: center; margin: 8rpx 0 28rpx; }

.cancel-info {

  background: #F9FAFB; border-radius: 20rpx; padding: 24rpx; margin-bottom: 32rpx;

}

.cancel-row { display: flex; justify-content: space-between; gap: 20rpx; margin-bottom: 20rpx; align-items: flex-start; }

.cancel-row:last-child { margin-bottom: 0; }

.cancel-label { font-size: 26rpx; color: #6B7280; flex-shrink: 0; }

.cancel-value { font-size: 26rpx; color: #1F2937; font-weight: 600; text-align: right; flex: 1; }

.cancel-value.highlight { color: #0D9488; }

.cancel-value.refund-yes { color: #059669; }

.cancel-value.refund-no { color: #DC2626; }

.cancel-reason-box {

  margin-top: 16rpx; padding: 16rpx; background: #FEF2F2;

  border-radius: 12rpx; border: 1rpx solid #FECACA;

}

.cancel-reason-label { display: block; font-size: 22rpx; color: #991B1B; margin-bottom: 6rpx; }

.cancel-reason-text { display: block; font-size: 24rpx; color: #B91C1C; line-height: 1.6; }

.cancel-btns { display: flex; gap: 16rpx; }

.cancel-action-btn {

  flex: 1; height: 76rpx; line-height: 76rpx; font-size: 26rpx;

  border-radius: 12rpx; margin: 0; padding: 0; border: none;

}

.cancel-action-btn::after { border: none; }

.cancel-action-btn.back { background: #F3F4F6; color: #4B5563; }

.cancel-action-btn.exempt { background: #FFFBEB; color: #B45309; border: 1rpx solid #FDE68A; }

.cancel-action-btn.confirm { background: #DC2626; color: #fff; }

</style>

