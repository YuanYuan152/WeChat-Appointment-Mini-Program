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
          <text class="order-desc">{{ order.Description || '心理咨询预约' }}</text>
          <text class="order-price">¥{{ (order.TotalFee / 100).toFixed(2) }}</text>
        </view>
        <view class="order-footer">
          <text class="order-time">{{ formatTime(order.CreatedAt) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface Order {
  Id: number
  OutTradeNo: string
  Status: string
  Description: string
  TotalFee: number
  CreatedAt: string
}

const orders = ref<Order[]>([])
const loading = ref(true)

const statusLabel = (status: string) => {
  const map: Record<string, string> = { PENDING: '待支付', PAID: '已支付', CANCELLED: '已取消' }
  return map[status] || status
}

const formatTime = (s: string) => {
  if (!s) return ''
  return s.replace('T', ' ').slice(0, 19)
}

const goDetail = (order: Order) => {
  uni.navigateTo({ url: `/pages/patient/orders/detail?id=${order.Id}` })
}

onMounted(async () => {
  try {
    const res = await httpV2.get<Order[]>(API_ENDPOINTS.patient.orders)
    if (res.code === 0 && Array.isArray(res.data)) {
      orders.value = res.data
    }
  } catch {
    // 静默失败，已由 httpV2 弹错
  } finally {
    loading.value = false
  }
})
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
.order-body { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.order-desc { font-size: 28rpx; color: #374151; }
.order-price { font-size: 32rpx; font-weight: 700; color: #0D9488; }
.order-time { font-size: 24rpx; color: #9CA3AF; }
</style>
