<template>
  <view class="page-order-detail">
    <view v-if="order" class="detail-card">
      <view class="detail-row">
        <text class="label">订单号</text>
        <text class="value">{{ order.OutTradeNo }}</text>
      </view>
      <view class="detail-row">
        <text class="label">状态</text>
        <text class="value status" :class="order.Status.toLowerCase()">{{ statusLabel(order.Status) }}</text>
      </view>
      <view class="detail-row">
        <text class="label">描述</text>
        <text class="value">{{ order.Description || '心理咨询预约' }}</text>
      </view>
      <view class="detail-row">
        <text class="label">金额</text>
        <text class="value price">¥{{ (order.TotalFee / 100).toFixed(2) }}</text>
      </view>
      <view class="detail-row">
        <text class="label">创建时间</text>
        <text class="value">{{ order.CreatedAt }}</text>
      </view>
    </view>
    <view v-else class="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const order = ref<any>(null)

const statusLabel = (status: string) => {
  const map: Record<string, string> = { PENDING: '待支付', PAID: '已支付', CANCELLED: '已取消' }
  return map[status] || status
}

onMounted(async () => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const id = current?.options?.id
  if (!id) return

  try {
    const res = await httpV2.get<any>(`${API_ENDPOINTS.patient.orders}/${id}`)
    if (res.code === 0 && res.data) {
      order.value = res.data
    }
  } catch {
    uni.showToast({ title: '加载订单失败', icon: 'none' })
  }
})
</script>

<style scoped>
.page-order-detail { padding: 32rpx; }
.detail-card { background: #fff; border-radius: 24rpx; padding: 40rpx; }
.detail-row { display: flex; justify-content: space-between; padding: 20rpx 0; border-bottom: 1rpx solid #F3F4F6; }
.label { font-size: 28rpx; color: #6B7280; }
.value { font-size: 28rpx; color: #1F2937; font-weight: 500; }
.value.price { color: #0D9488; font-weight: 700; }
.value.pending { color: #F59E0B; }
.value.paid { color: #10B981; }
.value.cancelled { color: #9CA3AF; }
.loading { text-align: center; padding: 80rpx; color: #9CA3AF; }
</style>
