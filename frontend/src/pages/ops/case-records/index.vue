<template>
  <view class="page-case-records">
    <view class="header">
      <text class="title">咨询记录</text>
      <text class="subtitle">近 30 天各咨询师已完成咨询的记录填写情况</text>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">暂无数据</view>

    <view v-else class="list">
      <view
        v-for="item in list"
        :key="item.counselorId"
        class="card"
        @tap="openDetail(item.counselorId, item.counselorName)"
      >
        <view class="card-head">
          <text class="name">{{ item.counselorName }}</text>
          <text class="arrow">›</text>
        </view>
        <view class="stats">
          <view class="stat">
            <text class="num">{{ item.completedCount }}</text>
            <text class="label">已完成</text>
          </view>
          <view class="stat">
            <text class="num ok">{{ item.recordedCount }}</text>
            <text class="label">已填写</text>
          </view>
          <view class="stat">
            <text class="num warn">{{ item.missingCount }}</text>
            <text class="label">待填写</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface CounselorSummary {
  counselorId: number
  counselorName: string
  completedCount: number
  recordedCount: number
  missingCount: number
}

const loading = ref(false)
const list = ref<CounselorSummary[]>([])

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<CounselorSummary[]>(API_ENDPOINTS.admin.consultationRecordCounselors)
    if (res.code === 0 && Array.isArray(res.data)) list.value = res.data
  } finally {
    loading.value = false
  }
}

const openDetail = (counselorId: number, name: string) => {
  uni.navigateTo({
    url: `/pages/ops/case-records/detail?counselorId=${counselorId}&name=${encodeURIComponent(name)}`,
  })
}

onMounted(load)
</script>

<style scoped>
.page-case-records { min-height: 100vh; background: #F7F5F2; padding: 32rpx; }
.header {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 24rpx;
}
.title { display: block; font-size: 36rpx; font-weight: 600; color: #fff; }
.subtitle { display: block; margin-top: 10rpx; font-size: 24rpx; color: rgba(255,255,255,0.82); line-height: 1.5; }
.empty { text-align: center; padding: 120rpx 0; color: #9CA3AF; font-size: 28rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card:active { opacity: 0.92; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.name { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.arrow { font-size: 36rpx; color: #C9A96E; }
.stats { display: flex; gap: 24rpx; }
.stat { flex: 1; text-align: center; background: #FAF7F3; border-radius: 12rpx; padding: 16rpx 8rpx; }
.num { display: block; font-size: 36rpx; font-weight: 700; color: #2C2C2C; }
.num.ok { color: #3D5A4E; }
.num.warn { color: #C9A96E; }
.label { display: block; margin-top: 6rpx; font-size: 22rpx; color: #8A8A8A; }
</style>
