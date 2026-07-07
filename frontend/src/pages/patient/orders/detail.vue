<template>
  <view class="page-order-detail">
    <view v-if="loading" class="loading"><text>加载中...</text></view>
    <template v-else-if="order">
      <view class="detail-card">
        <view class="status-banner" :class="order.Status.toLowerCase()">
          {{ statusLabel(order.Status) }}
        </view>

        <view v-if="order.counselorName" class="section">
          <text class="section-title">预约信息</text>
          <view class="detail-row">
            <text class="label">咨询师</text>
            <text class="value">{{ order.counselorName }}</text>
          </view>
          <view v-if="order.startTime" class="detail-row">
            <text class="label">预约时间</text>
            <text class="value highlight">{{ formatOrderTime(order.startTime, order.endTime) }}</text>
          </view>
          <view v-if="order.centerName" class="detail-row">
            <text class="label">预约中心</text>
            <text class="value">{{ order.centerName }}</text>
          </view>
          <view v-if="order.roomName" class="detail-row">
            <text class="label">咨询室</text>
            <text class="value">{{ order.roomName }}</text>
          </view>
        </view>

        <view class="section">
          <text class="section-title">订单信息</text>
          <view class="detail-row">
            <text class="label">订单号</text>
            <text class="value mono">{{ order.OutTradeNo }}</text>
          </view>
          <view class="detail-row">
            <text class="label">金额</text>
            <text class="value price">¥{{ (order.TotalFee / 100).toFixed(2) }}</text>
          </view>
          <view class="detail-row">
            <text class="label">创建时间</text>
            <text class="value">{{ formatTime(order.CreatedAt) }}</text>
          </view>
          <view v-if="order.ExpiresAt && order.Status === 'PENDING'" class="expire-row">
            {{ expireHintText(order.ExpiresAt) }}
          </view>
        </view>
      </view>

      <button
        v-if="order.Status === 'PENDING'"
        class="pay-btn"
        @tap="showPaySheet = true"
      >去支付</button>
    </template>

    <OrderPaymentSheet
      :visible="showPaySheet"
      :initial-order="order"
      @close="showPaySheet = false"
      @paid="reloadOrder"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import OrderPaymentSheet from '@/components/OrderPaymentSheet.vue'
import { type PatientOrder, expireHintText, formatOrderTime } from '@/utils/orderPayment'

const order = ref<PatientOrder | null>(null)
const loading = ref(true)
const showPaySheet = ref(false)
const orderId = ref(0)

const statusLabel = (status: string) => {
  const map: Record<string, string> = { PENDING: '待支付', PAID: '已支付', CANCELLED: '已取消' }
  return map[status] || status
}

const formatTime = (s: string) => (s ? s.replace('T', ' ').slice(0, 19) : '')

const loadOrder = async () => {
  if (!orderId.value) return
  loading.value = true
  try {
    const res = await httpV2.get<PatientOrder>(API_ENDPOINTS.patient.orderDetail(orderId.value))
    if (res.code === 0 && res.data) {
      order.value = res.data
    }
  } catch {
    uni.showToast({ title: '加载订单失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const reloadOrder = () => {
  loadOrder()
}

onLoad((opts) => {
  orderId.value = Number(opts?.id || 0)
  if (opts?.pay === '1') {
    showPaySheet.value = true
  }
  loadOrder()
})
</script>

<style scoped>
.page-order-detail { padding: 32rpx; padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); }
.detail-card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 32rpx; }
.status-banner {
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  padding: 20rpx;
  border-radius: 16rpx;
  margin-bottom: 32rpx;
}
.status-banner.pending { background: #FEF3C7; color: #B45309; }
.status-banner.paid { background: #D1FAE5; color: #047857; }
.status-banner.cancelled { background: #F3F4F6; color: #6B7280; }
.section { margin-bottom: 28rpx; }
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16rpx;
}
.detail-row { display: flex; justify-content: space-between; gap: 24rpx; padding: 16rpx 0; border-bottom: 1rpx solid #F3F4F6; }
.label { font-size: 28rpx; color: #6B7280; flex-shrink: 0; }
.value { font-size: 28rpx; color: #1F2937; font-weight: 500; text-align: right; flex: 1; }
.value.price { color: #0D9488; font-weight: 700; }
.value.highlight { color: #3D5A4E; font-weight: 600; }
.value.mono { font-size: 24rpx; word-break: break-all; }
.expire-row { margin-top: 16rpx; font-size: 24rpx; color: #F59E0B; }
.pay-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #0D9488;
  color: #fff;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 600;
}
.pay-btn::after { border: none; }
.loading { text-align: center; padding: 80rpx; color: #9CA3AF; }
</style>
