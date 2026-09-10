<template>
  <view class="page-orders">
    <view class="page-header">
      <text class="page-title">我的订单</text>
      <text class="page-subtitle">来访对本咨询师的已支付预约</text>
    </view>

    <view v-if="loading" class="empty-state">
      <text class="empty-text">加载中...</text>
    </view>
    <view v-else-if="orders.length === 0" class="empty-state">
      <text class="empty-text">暂无来访付费订单</text>
    </view>
    <view v-else class="order-list">
      <view v-for="order in orders" :key="order.id" class="order-card">
        <view class="order-header">
          <text class="visitor-name">{{ order.visitorName || '来访者' }}</text>
          <text class="order-status">已支付</text>
        </view>
        <view class="order-row">
          <text class="row-label">付费时间</text>
          <text class="row-value">{{ formatTime(order.paidAt) || '—' }}</text>
        </view>
        <view class="order-row">
          <text class="row-label">预约时间</text>
          <text class="row-value">{{ formatAppointment(order.startTime, order.endTime) }}</text>
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
import { ensureLoggedInOrRedirect } from '@/utils/auth'
import { formatOrderTime } from '@/utils/orderPayment'
import { formatChinaDateTime } from '@/utils/dateTime'

interface CounselorVisitorOrder {
  id: number
  visitorName?: string
  paidAt?: string | null
  startTime?: string | null
  endTime?: string | null
  totalFee?: number
  outTradeNo?: string | null
  status?: string
}

const orders = ref<CounselorVisitorOrder[]>([])
const loading = ref(true)

const formatTime = (value?: string | null) => formatChinaDateTime(value)

const formatAppointment = (start?: string | null, end?: string | null) => {
  if (start) {
    return formatOrderTime(start, end || undefined) || formatTime(start)
  }
  return '—'
}

const loadOrders = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<CounselorVisitorOrder[]>(
      API_ENDPOINTS.counselor.orders,
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && Array.isArray(res.data)) {
      orders.value = res.data
    } else {
      orders.value = []
    }
  } catch {
    orders.value = []
  } finally {
    loading.value = false
  }
}

onShow(async () => {
  const ok = await ensureLoggedInOrRedirect('/pages/counselor/orders/list')
  if (!ok) return
  await loadOrders()
})
</script>

<style lang="scss" scoped>
.page-orders {
  min-height: 100vh;
  background: #f7f5f2;
  padding: 32rpx;
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 24rpx;
}

.page-title {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
  color: #2c2c2c;
}

.page-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8a8a8a;
}

.empty-state {
  padding: 120rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #a8a8a8;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.order-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(44, 44, 44, 0.04);
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.visitor-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #2c2c2c;
}

.order-status {
  font-size: 22rpx;
  color: #3d5a4e;
  background: rgba(61, 90, 78, 0.1);
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.order-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  padding-top: 12rpx;
}

.row-label {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #8a8a8a;
}

.row-value {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  color: #2c2c2c;
  line-height: 1.5;
}
</style>
