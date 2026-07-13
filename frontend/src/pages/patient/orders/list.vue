<template>
  <view class="page-orders">
    <view class="page-header">
      <text class="page-title">我的订单</text>
    </view>
    <view v-if="loading" class="empty-state">
      <text class="empty-text">加载中...</text>
    </view>
    <view v-else-if="orders.length === 0" class="empty-state">
      <text class="empty-text">暂无订单记录</text>
    </view>
    <view v-else class="order-list">
      <view v-for="order in orders" :key="order.Id" class="order-card" @click="goDetail(order)">
        <view class="order-header">
          <text class="order-no">{{ order.OutTradeNo }}</text>
          <text class="order-status" :class="order.Status.toLowerCase()">{{ statusLabel(order.Status) }}</text>
        </view>
        <view class="order-body">
          <text class="order-desc">{{ orderSummary(order) }}</text>
          <text class="order-price">¥{{ (order.TotalFee / 100).toFixed(2) }}</text>
        </view>
        <view v-if="order.proxyAgreementLabel && order.Status === 'PENDING'" class="agreement-hint">
          待签署：{{ order.proxyAgreementLabel }}
        </view>
        <view class="order-footer">
          <text class="order-time">{{ formatTime(order.CreatedAt) }}</text>
          <text v-if="order.ExpiresAt && order.Status === 'PENDING'" class="order-expire">
            {{ expireHint(order.ExpiresAt) }}
          </text>
          <button
            v-if="order.Status === 'PENDING'"
            class="pay-btn"
            @click.stop="openPaySheet(order)"
          >去支付</button>
        </view>
      </view>
    </view>

    <OrderPaymentSheet
      :visible="showPaySheet"
      :order-id="payOrderId"
      :initial-order="payOrder"
      @close="closePaySheet"
      @paid="onPaid"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import OrderPaymentSheet from '@/components/OrderPaymentSheet.vue'
import { type PatientOrder, expireHintText, formatOrderTime } from '@/utils/orderPayment'

const orders = ref<PatientOrder[]>([])
const loading = ref(true)
const showPaySheet = ref(false)
const payOrderId = ref<number | null>(null)
const payOrder = ref<PatientOrder | null>(null)
const pendingPayOrderId = ref(0)

const statusLabel = (status: string) => {
  const map: Record<string, string> = { PENDING: '待支付', PAID: '已支付', CANCELLED: '已取消' }
  return map[status] || status
}

const formatTime = (s: string) => {
  if (!s) return ''
  return s.replace('T', ' ').slice(0, 19)
}

const expireHint = (expiresAt: string) => expireHintText(expiresAt)

const orderSummary = (order: PatientOrder) => {
  if (order.counselorName && order.startTime) {
    return `${order.counselorName} · ${formatOrderTime(order.startTime, order.endTime)}`
  }
  return order.Description || '心理咨询预约'
}

const goDetail = (order: PatientOrder) => {
  uni.navigateTo({ url: `/pages/patient/orders/detail?id=${order.Id}` })
}

const openPaySheet = (order: PatientOrder) => {
  payOrder.value = order
  payOrderId.value = order.Id
  showPaySheet.value = true
}

const closePaySheet = () => {
  showPaySheet.value = false
  payOrder.value = null
  payOrderId.value = null
}

const onPaid = () => {
  loadOrders()
}

const tryOpenPendingPay = () => {
  if (!pendingPayOrderId.value) return
  const target = orders.value.find(o => o.Id === pendingPayOrderId.value)
  pendingPayOrderId.value = 0
  if (target?.Status === 'PENDING') {
    openPaySheet(target)
  }
}

const loadOrders = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<PatientOrder[]>(API_ENDPOINTS.patient.orders)
    if (res.code === 0 && Array.isArray(res.data)) {
      orders.value = res.data
      tryOpenPendingPay()
    }
  } catch {
    // 静默失败
  } finally {
    loading.value = false
  }
}

onLoad((opts) => {
  pendingPayOrderId.value = Number(opts?.payOrderId || 0)
})

onShow(loadOrders)
</script>

<style scoped>
.page-orders { padding: 32rpx; }
.page-header { margin-bottom: 32rpx; }
.page-title { font-size: 40rpx; font-weight: 700; color: #1F2937; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }
.order-card { background: #fff; border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06); }
.order-header { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.order-no { font-size: 24rpx; color: #6B7280; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 16rpx; }
.order-status { font-size: 24rpx; font-weight: 600; flex-shrink: 0; }
.order-status.pending { color: #F59E0B; }
.order-status.paid { color: #10B981; }
.order-status.cancelled { color: #9CA3AF; }
.order-body { display: flex; justify-content: space-between; margin-bottom: 12rpx; gap: 16rpx; }
.agreement-hint {
  font-size: 24rpx;
  color: #B45309;
  background: #FFFBEB;
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
  margin-bottom: 12rpx;
}
.order-desc { font-size: 28rpx; color: #374151; flex: 1; }
.order-price { font-size: 32rpx; font-weight: 700; color: #0D9488; flex-shrink: 0; }
.order-footer { display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; margin-top: 8rpx; }
.order-time { font-size: 24rpx; color: #9CA3AF; flex: 1; }
.order-expire { font-size: 22rpx; color: #F59E0B; }
.pay-btn {
  margin: 0;
  padding: 0 28rpx;
  height: 56rpx;
  line-height: 56rpx;
  background: #0D9488;
  color: #fff;
  border-radius: 999rpx;
  font-size: 24rpx;
}
.pay-btn::after { border: none; }
</style>
