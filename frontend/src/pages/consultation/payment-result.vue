<template>
  <view class="page-payment-result">
    <view class="result-card">
      <view class="icon-wrap" :class="statusClass">
        <text class="icon-text">{{ statusIcon }}</text>
      </view>
      <text class="result-title">{{ statusTitle }}</text>
      <text class="result-desc">{{ statusDesc }}</text>

      <view v-if="orderInfo" class="order-summary">
        <view class="summary-row">
          <text class="summary-label">订单号</text>
          <text class="summary-value">{{ orderInfo.OutTradeNo }}</text>
        </view>
        <view class="summary-row">
          <text class="summary-label">金额</text>
          <text class="summary-value price">{{ formatOrderFeeCents(orderInfo.TotalFee) }}</text>
        </view>
      </view>

      <view class="actions">
        <button class="btn primary" @click="goOrders">查看订单</button>
        <button class="btn ghost" @click="goHome">返回首页</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { formatOrderFeeCents } from '@/utils/orderPayment'

const orderInfo = ref<any>(null)
const payStatus = ref<'polling' | 'success' | 'pending' | 'failed'>('polling')
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollCount = 0
const MAX_POLL = 5
const POLL_INTERVAL = 2000

const statusClass = computed(() => payStatus.value)
const statusIcon = computed(() => {
  const map = { polling: '⏳', success: '✓', pending: '⏳', failed: '✗' }
  return map[payStatus.value]
})
const statusTitle = computed(() => {
  const map = { polling: '查询支付结果...', success: '支付成功', pending: '等待支付确认', failed: '支付未完成' }
  return map[payStatus.value]
})
const statusDesc = computed(() => {
  const map = {
    polling: '正在确认支付状态，请稍候',
    success: '您的预约已确认，咨询师将按时为您服务',
    pending: '支付结果尚未到账，请稍后在订单中查看',
    failed: '如已完成支付，请稍后在订单中查看状态',
  }
  return map[payStatus.value]
})

const pollOrderStatus = async (orderId: string) => {
  try {
    // 官方指引：收银台返回后先查单再展示结果
    await httpV2.post(API_ENDPOINTS.payment.syncOrder, { order_id: Number(orderId) })
  } catch { /* ignore */ }

  try {
    const res = await httpV2.get<any>(API_ENDPOINTS.patient.orderDetail(orderId), undefined, { showLoading: false })
    if (res.code === 0 && res.data) {
      orderInfo.value = res.data
      if (res.data.Status === 'PAID') {
        payStatus.value = 'success'
        return
      }
    }
  } catch { /* ignore */ }

  pollCount++
  if (pollCount >= MAX_POLL) {
    payStatus.value = orderInfo.value ? 'pending' : 'failed'
    return
  }
  pollTimer = setTimeout(() => pollOrderStatus(orderId), POLL_INTERVAL)
}

const goOrders = () => {
  uni.navigateTo({ url: '/pages/patient/orders/list' })
}
const goHome = () => {
  uni.switchTab({ url: '/pages/index/index' })
}

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const orderId = current?.options?.order_id
  if (orderId) {
    pollOrderStatus(String(orderId))
  } else {
    payStatus.value = 'failed'
  }
})

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
})
</script>

<style scoped>
.page-payment-result {
  min-height: 100vh;
  background: #F7F5F2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.result-card {
  width: 100%;
  background: #fff;
  border-radius: 32rpx;
  padding: 64rpx 48rpx;
  text-align: center;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.06);
}
.icon-wrap {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 32rpx;
}
.icon-wrap.success { background: #D1FAE5; }
.icon-wrap.polling, .icon-wrap.pending { background: #FEF3C7; }
.icon-wrap.failed { background: #FEE2E2; }
.icon-text { font-size: 56rpx; color: #059669; }
.icon-wrap.failed .icon-text { color: #DC2626; }
.result-title { display: block; font-size: 40rpx; font-weight: 700; color: #1F2937; margin-bottom: 12rpx; }
.result-desc { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 40rpx; }
.order-summary { background: #F9FAFB; border-radius: 16rpx; padding: 24rpx; margin-bottom: 40rpx; text-align: left; }
.summary-row { display: flex; justify-content: space-between; padding: 8rpx 0; }
.summary-label { font-size: 26rpx; color: #6B7280; }
.summary-value { font-size: 26rpx; color: #1F2937; }
.summary-value.price { color: #0D9488; font-weight: 700; }
.actions { display: flex; flex-direction: column; gap: 20rpx; }
.btn {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 600;
  margin: 0;
}
.btn.primary { background: #0D9488; color: #fff; }
.btn.ghost { background: #F3F4F6; color: #6B7280; }
.btn::after { border: none; }
</style>
