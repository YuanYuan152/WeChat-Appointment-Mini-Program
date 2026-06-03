<template>
  <view class="page-stats">
    <view class="header">
      <text class="title">咨询师统计看板</text>
      <text class="subtitle">本月咨询与履约概览</text>
    </view>

    <view class="grid">
      <view class="stat-card">
        <text class="num">{{ stats.monthConsultations }}</text>
        <text class="label">本月咨询</text>
      </view>
      <view class="stat-card">
        <text class="num">{{ stats.pendingConsultations }}</text>
        <text class="label">待确认</text>
      </view>
      <view class="stat-card">
        <text class="num">{{ stats.doneConsultations }}</text>
        <text class="label">已完成</text>
      </view>
      <view class="stat-card">
        <text class="num">¥{{ (stats.estimatedRevenue / 100).toFixed(0) }}</text>
        <text class="label">预估收入</text>
      </view>
    </view>

    <view class="summary">
      <text class="summary-title">累计服务</text>
      <text class="summary-num">{{ stats.totalConsultations }}</text>
      <text class="summary-desc">历史咨询单总数</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const stats = ref({
  totalConsultations: 0,
  monthConsultations: 0,
  pendingConsultations: 0,
  doneConsultations: 0,
  estimatedRevenue: 0,
})

const load = async () => {
  const res = await httpV2.get<typeof stats.value>(API_ENDPOINTS.counselor.stats)
  if (res.code === 0 && res.data) stats.value = res.data
}

onMounted(load)
</script>

<style scoped>
.page-stats {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
}

.header {
  background: linear-gradient(135deg, #0D9488, #0F766E);
  border-radius: 32rpx;
  padding: 44rpx 36rpx;
  margin-bottom: 28rpx;
}

.title {
  display: block;
  font-size: 38rpx;
  font-weight: 900;
  color: #fff;
}

.subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.stat-card,
.summary {
  background: #fff;
  border-radius: 28rpx;
  padding: 36rpx 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.num {
  display: block;
  font-size: 48rpx;
  font-weight: 900;
  color: #0D9488;
}

.label {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #6B7280;
}

.summary {
  margin-top: 28rpx;
  text-align: center;
}

.summary-title {
  display: block;
  font-size: 28rpx;
  color: #6B7280;
}

.summary-num {
  display: block;
  margin-top: 10rpx;
  font-size: 68rpx;
  font-weight: 900;
  color: #111827;
}

.summary-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}
</style>
