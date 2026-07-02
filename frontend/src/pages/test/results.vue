<template>
  <view class="page-results">
    <view class="filter-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ active: activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >{{ tab.label }}</view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="!isLoggedIn()" class="empty">
      <text>请先登录查看量表结果</text>
      <button class="login-btn" @click="goLogin">去登录</button>
    </view>
    <view v-else-if="items.length === 0" class="empty">
      <text class="empty-icon">📋</text>
      <text>暂无{{ activeTabLabel }}记录</text>
      <text class="empty-hint">完成 PHQ-9 / GAD-7 测评后，报告将保存在此处</text>
      <button class="login-btn" @click="goHub">去做测评</button>
    </view>
    <view v-else class="list">
      <view v-for="item in items" :key="item.id" class="card" @tap="openDetail(item)">
        <view class="card-badge">小程序量表</view>
        <view class="card-head">
          <text class="name">{{ item.scaleLabel }}</text>
          <text class="time">{{ formatDT(item.createdAt) }}</text>
        </view>
        <text class="summary">{{ item.resultSummary }}</text>
        <view class="score-row">
          <text class="score">总分 {{ item.total }}</text>
          <text class="level">{{ item.levelLabel }}</text>
        </view>
        <text class="view-link">查看报告 ›</text>
      </view>
    </view>

    <button v-if="isLoggedIn()" class="fab" @click="goHub">去做测评</button>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { isLoggedIn as checkLogin } from '@/utils/auth'
import { enrichScaleResult, type ScaleResult } from '@/constants/psychScales'

const tabs = [
  { value: 'ALL', label: '全部' },
  { value: 'PHQ9', label: 'PHQ-9' },
  { value: 'GAD7', label: 'GAD-7' },
]

const loading = ref(false)
const isLoggedIn = ref(false)
const activeTab = ref('ALL')
const items = ref<ScaleResult[]>([])

const activeTabLabel = computed(() => tabs.find(t => t.value === activeTab.value)?.label || '')

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '—')

const switchTab = (v: string) => {
  activeTab.value = v
  load()
}

const load = async () => {
  isLoggedIn.value = checkLogin()
  if (!isLoggedIn.value) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (activeTab.value !== 'ALL') params.scale_type = activeTab.value
    const res = await httpV2.get<ScaleResult[]>(API_ENDPOINTS.patient.scales, params)
    if (res.code === 0 && Array.isArray(res.data)) {
      items.value = res.data.map(enrichScaleResult)
    }
  } finally {
    loading.value = false
  }
}

const openDetail = (item: ScaleResult) => {
  uni.navigateTo({ url: `/pages/test/result-detail?id=${item.id}` })
}

const goLogin = () => {
  uni.navigateTo({ url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/test/results') })
}

const goHub = () => {
  uni.navigateTo({ url: '/pages/test/index' })
}

onShow(load)
</script>

<style scoped>
.page-results { min-height: 100vh; background: #F7F5F2; padding: 32rpx; padding-bottom: 120rpx; box-sizing: border-box; }
.filter-bar { display: flex; gap: 12rpx; margin-bottom: 24rpx; flex-wrap: wrap; }
.filter-tab {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: #fff;
  font-size: 26rpx;
  color: #6B6560;
}
.filter-tab.active { background: #3D5A4E; color: #fff; font-weight: 600; }
.empty { text-align: center; padding: 80rpx 32rpx; color: #9CA3AF; font-size: 28rpx; }
.empty-icon { display: block; font-size: 64rpx; margin-bottom: 16rpx; }
.empty-hint { display: block; margin-top: 12rpx; font-size: 24rpx; line-height: 1.6; }
.login-btn {
  margin-top: 24rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 28rpx;
}
.login-btn::after { border: none; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.card:active { opacity: 0.92; }
.card-badge {
  display: inline-block;
  font-size: 20rpx;
  color: #3D5A4E;
  background: rgba(61,90,78,0.1);
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  margin-bottom: 12rpx;
}
.card-head { display: flex; justify-content: space-between; gap: 16rpx; margin-bottom: 8rpx; }
.name { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.time { font-size: 22rpx; color: #9CA3AF; flex-shrink: 0; }
.summary { display: block; font-size: 26rpx; color: #3D5A4E; font-weight: 600; margin-bottom: 12rpx; }
.score-row { display: flex; align-items: center; gap: 16rpx; }
.score { font-size: 32rpx; font-weight: 700; color: #3D5A4E; }
.level { font-size: 24rpx; color: #047857; background: #D1FAE5; padding: 4rpx 14rpx; border-radius: 999rpx; }
.view-link { display: block; margin-top: 16rpx; font-size: 26rpx; color: #3D5A4E; font-weight: 600; }
.fab {
  position: fixed;
  left: 32rpx;
  right: 32rpx;
  bottom: 48rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 24rpx rgba(61,90,78,0.25);
}
.fab::after { border: none; }
</style>
