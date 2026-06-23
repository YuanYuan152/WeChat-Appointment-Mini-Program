<template>
  <view class="page-patients">
    <view class="header">
      <text class="title">来访管理</text>
      <text class="subtitle">查看来访者信息与全部咨询预约记录</text>
    </view>

    <view class="search-bar">
      <input
        class="search-input"
        v-model="keyword"
        placeholder="搜索姓名或手机号"
        confirm-type="search"
        @confirm="load"
      />
      <view class="search-btn" @tap="load">搜索</view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">暂无来访者数据</view>

    <view v-else class="list">
      <view
        v-for="item in list"
        :key="item.patientId"
        class="card"
        @tap="openDetail(item.patientId)"
      >
        <view class="card-head">
          <text class="name">{{ item.name }}</text>
          <text class="arrow">›</text>
        </view>
        <text class="mobile">{{ item.mobile || '未填写手机号' }}</text>
        <view class="stats">
          <view class="stat">
            <text class="num">{{ item.totalConsultations }}</text>
            <text class="label">全部</text>
          </view>
          <view class="stat">
            <text class="num upcoming">{{ item.upcomingCount }}</text>
            <text class="label">即将开始</text>
          </view>
          <view class="stat">
            <text class="num done">{{ item.completedCount }}</text>
            <text class="label">已完成</text>
          </view>
          <view class="stat">
            <text class="num cancelled">{{ item.cancelledCount }}</text>
            <text class="label">已取消</text>
          </view>
        </view>
        <text v-if="item.lastConsultationTime" class="meta">
          最近咨询 {{ formatDT(item.lastConsultationTime) }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface PatientSummary {
  patientId: number
  name: string
  mobile?: string
  totalConsultations: number
  upcomingCount: number
  completedCount: number
  cancelledCount: number
  lastConsultationTime?: string
}

const loading = ref(false)
const keyword = ref('')
const list = ref<PatientSummary[]>([])

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '')

const load = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await httpV2.get<PatientSummary[]>(API_ENDPOINTS.admin.patients, params)
    if (res.code === 0 && Array.isArray(res.data)) list.value = res.data
  } finally {
    loading.value = false
  }
}

const openDetail = (patientId: number) => {
  uni.navigateTo({ url: `/pages/ops/patients/detail?patientId=${patientId}` })
}

onMounted(load)
onShow(load)
</script>

<style scoped>
.page-patients { min-height: 100vh; background: #F7F5F2; padding: 32rpx; }
.header {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 24rpx;
}
.title { display: block; font-size: 36rpx; font-weight: 600; color: #fff; }
.subtitle { display: block; margin-top: 10rpx; font-size: 24rpx; color: rgba(255,255,255,0.82); line-height: 1.5; }
.search-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.search-input {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.search-btn {
  flex-shrink: 0;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  padding: 0 28rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
.empty { text-align: center; padding: 120rpx 0; color: #9CA3AF; font-size: 28rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card:active { opacity: 0.92; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.name { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.arrow { font-size: 36rpx; color: #C9A96E; }
.mobile { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B6560; }
.stats { display: flex; gap: 12rpx; margin-top: 20rpx; }
.stat { flex: 1; text-align: center; background: #FAF7F3; border-radius: 12rpx; padding: 14rpx 6rpx; }
.num { display: block; font-size: 32rpx; font-weight: 700; color: #2C2C2C; }
.num.upcoming { color: #2563EB; }
.num.done { color: #3D5A4E; }
.num.cancelled { color: #9CA3AF; }
.label { display: block; margin-top: 4rpx; font-size: 20rpx; color: #8A8A8A; }
.meta { display: block; margin-top: 14rpx; font-size: 22rpx; color: #9CA3AF; }
</style>
