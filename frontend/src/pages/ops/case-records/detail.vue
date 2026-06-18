<template>
  <view class="page-detail">
    <view class="header">
      <text class="title">{{ counselorName }}</text>
      <text class="subtitle">近 30 天咨询记录明细</text>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">该时段暂无已完成咨询</view>

    <view v-else class="list">
      <view v-for="item in list" :key="item.consultationId" class="card">
        <view class="card-head">
          <text class="patient">{{ item.patientName }}</text>
          <text class="tag" :class="item.hasRecord ? 'ok' : 'warn'">
            {{ item.hasRecord ? '已填写' : '待填写' }}
          </text>
        </view>
        <text class="time">{{ formatDT(item.endTime || item.startTime) }}</text>
        <text v-if="item.subjectivePreview" class="preview">{{ item.subjectivePreview }}</text>
        <view class="meta">
          <text v-if="item.photoCount > 0">照片 {{ item.photoCount }} 张</text>
          <text v-if="item.recordUpdatedAt">更新 {{ formatDT(item.recordUpdatedAt) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface RecordItem {
  consultationId: number
  patientName: string
  startTime?: string
  endTime?: string
  hasRecord: boolean
  subjectivePreview?: string
  photoCount: number
  recordUpdatedAt?: string
}

const loading = ref(false)
const list = ref<RecordItem[]>([])
const counselorId = ref(0)
const counselorName = ref('咨询师')

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '')

onMounted(async () => {
  const pages = getCurrentPages()
  const opts = (pages[pages.length - 1] as any)?.options || {}
  counselorId.value = Number(opts.counselorId || 0)
  counselorName.value = decodeURIComponent(opts.name || '咨询师')

  if (!counselorId.value) return
  loading.value = true
  try {
    const res = await httpV2.get<RecordItem[]>(
      API_ENDPOINTS.admin.consultationRecordDetail(counselorId.value),
    )
    if (res.code === 0 && Array.isArray(res.data)) list.value = res.data
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-detail { min-height: 100vh; background: #F7F5F2; padding: 32rpx; }
.header { margin-bottom: 24rpx; }
.title { display: block; font-size: 34rpx; font-weight: 600; color: #2C2C2C; }
.subtitle { display: block; margin-top: 8rpx; font-size: 24rpx; color: #8A8A8A; }
.empty { text-align: center; padding: 120rpx 0; color: #9CA3AF; font-size: 28rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card-head { display: flex; justify-content: space-between; align-items: center; }
.patient { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.tag { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; font-weight: 600; }
.tag.ok { background: #E8E4DE; color: #3D5A4E; }
.tag.warn { background: #F5EFE3; color: #C9A96E; }
.time { display: block; margin-top: 10rpx; font-size: 24rpx; color: #8A8A8A; }
.preview {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #4B5563;
  line-height: 1.6;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #9CA3AF;
}
</style>
