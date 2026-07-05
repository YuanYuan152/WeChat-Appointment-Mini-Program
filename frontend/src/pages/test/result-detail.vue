<template>
  <view class="page-result-detail">
    <view v-if="loading" class="state">加载中...</view>
    <view v-else-if="!result" class="state">未找到该测评报告</view>
    <template v-else>
      <view class="head-card">
        <text class="head-title">{{ result.scaleLabel }}</text>
        <text class="head-sub">{{ result.resultSummary }}</text>
        <text class="head-time">完成于 {{ formatDT(result.createdAt) }}</text>
      </view>
      <ScaleReportView
        :result="result"
        :show-actions="true"
        @retest="retest"
        @reports="goReports"
        @back="goHub"
      />
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { isLoggedIn } from '@/utils/auth'
import ScaleReportView from '@/components/ScaleReportView.vue'
import { enrichScaleResult, type ScaleResult } from '@/constants/psychScales'

const loading = ref(true)
const result = ref<ScaleResult | null>(null)
const resultId = ref(0)

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '—')

const loadById = async (id: number) => {
  loading.value = true
  try {
    const res = await httpV2.get<ScaleResult[]>(API_ENDPOINTS.patient.scales)
    if (res.code === 0 && Array.isArray(res.data)) {
      const hit = res.data.find(r => r.id === id)
      result.value = hit ? enrichScaleResult(hit) : null
    }
  } finally {
    loading.value = false
  }
}

onLoad((opts) => {
  if (!isLoggedIn()) {
    uni.redirectTo({
      url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/test/result-detail?id=' + (opts?.id || '')),
    })
    return
  }
  const cached = uni.getStorageSync('last_scale_result')
  const id = Number(opts?.id || 0)
  resultId.value = id
  if (cached?.id && (!id || cached.id === id)) {
    result.value = enrichScaleResult(cached as ScaleResult)
    loading.value = false
    if (id) uni.removeStorageSync('last_scale_result')
    return
  }
  if (id) {
    loadById(id)
    return
  }
  loading.value = false
})

const retest = () => {
  if (!result.value) return
  uni.navigateTo({ url: `/pages/test/scale?type=${result.value.scaleType}` })
}

const goReports = () => {
  uni.navigateTo({ url: '/pages/test/results' })
}

const goHub = () => {
  uni.navigateBack({
    fail: () => uni.redirectTo({ url: '/pages/test/index' }),
  })
}
</script>

<style scoped>
.page-result-detail {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}

.state {
  text-align: center;
  padding: 120rpx 0;
  color: #9CA3AF;
  font-size: 28rpx;
}

.head-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.head-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #fff;
}

.head-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
}

.head-time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}
</style>
