<template>
  <view class="records-panel">
    <view class="header-card">
      <text class="title">咨询记录</text>
      <text class="subtitle">已完成咨询须填写患者情况、观察、评估与计划，提交后不可修改，照片为选填</text>
    </view>

    <view v-if="loading" class="empty-box">
      <text class="empty-text">加载中...</text>
    </view>

    <view v-else-if="list.length === 0" class="empty-box">
      <text class="empty-text">暂无已完成的咨询</text>
    </view>

    <view v-else class="record-list">
      <view v-for="item in list" :key="item.Id" class="record-card">
        <view class="record-head">
          <view>
            <text class="patient-name">{{ item.PatientName }}</text>
            <text class="record-time">{{ formatDT(item.EndTime || item.StartTime) }}</text>
          </view>
          <text class="status-tag" :class="item.HasRecord ? 'done' : 'pending'">
            {{ item.HasRecord ? '已填写' : '待填写' }}
          </text>
        </view>

        <view class="record-meta">
          <text v-if="item.PhotoCount > 0" class="meta-item">照片 {{ item.PhotoCount }} 张</text>
          <text v-if="item.RecordUpdatedAt" class="meta-item">
            更新于 {{ formatDT(item.RecordUpdatedAt) }}
          </text>
        </view>

        <button class="action-btn" @tap="openRecord(item)">
          {{ item.HasRecord ? '查看咨询记录' : '填写咨询记录' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { openCounselorCaseRecord } from '@/utils/case-record'

interface CompletedConsultation {
  Id: number
  PatientName: string
  StartTime?: string
  EndTime?: string
  CaseRecordId?: number | null
  HasRecord: boolean
  RecordUpdatedAt?: string
  PhotoCount: number
}

const loading = ref(false)
const list = ref<CompletedConsultation[]>([])

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '')

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<CompletedConsultation[]>(
      `${API_ENDPOINTS.counselor.consultations}/completed`,
    )
    if (res.code === 0 && Array.isArray(res.data)) {
      list.value = res.data
    }
  } finally {
    loading.value = false
  }
}

const openRecord = (item: CompletedConsultation) => {
  openCounselorCaseRecord({
    consultationId: item.Id,
    recordId: item.CaseRecordId,
    hasRecord: item.HasRecord,
  })
}

onMounted(load)
onShow(load)
</script>

<style scoped>
.records-panel {
  padding: 24rpx 32rpx 48rpx;
}

.header-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);
}

.title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.6;
}

.empty-box {
  text-align: center;
  padding: 120rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: #9CA3AF;
}

.record-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.record-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.patient-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.record-time {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8A8A8A;
}

.status-tag {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.status-tag.done {
  background: #E8E4DE;
  color: #3D5A4E;
}

.status-tag.pending {
  background: #F5EFE3;
  color: #C9A96E;
}

.record-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.meta-item {
  font-size: 22rpx;
  color: #6B6560;
}

.action-btn {
  margin-top: 20rpx;
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}
</style>
