<template>
  <view class="page-consultations">
    <!-- 状态筛选 -->
    <scroll-view class="filter-bar" scroll-x :show-scrollbar="false">
      <view
        v-for="f in filters"
        :key="f.value"
        class="filter-tag"
        :class="{ active: activeFilter === f.value }"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
      </view>
    </scroll-view>

    <view v-if="list.length === 0" class="empty-state">
      <text class="empty-text">暂无咨询单</text>
    </view>

    <view v-for="c in list" :key="c.Id" class="c-card">
      <view class="c-header">
        <text class="c-id">咨询单 #{{ c.Id }}</text>
        <text class="c-status" :class="c.Status.toLowerCase()">{{ statusLabel(c.Status) }}</text>
      </view>
      <view class="c-body">
        <text class="c-time" v-if="c.StartTime">{{ formatDT(c.StartTime) }}</text>
        <text class="c-note" v-if="c.Note">{{ c.Note }}</text>
      </view>
      <view class="c-footer">
        <button
          v-if="c.Status === 'CONFIRMED'"
          class="c-btn primary"
          @click="updateStatus(c.Id, 'ONGOING')"
        >开始咨询</button>
        <button
          v-if="c.Status === 'ONGOING'"
          class="c-btn success"
          @click="updateStatus(c.Id, 'DONE')"
        >结束咨询</button>
        <button
          v-if="c.Status === 'DONE'"
          class="c-btn outline"
          @click="writeCaseRecord(c.Id)"
        >填写个案记录</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'

interface Consultation {
  Id: number
  Status: string
  StartTime?: string
  Note?: string
}

const filters = [
  { label: '全部', value: '' },
  { label: '待确认', value: 'PENDING' },
  { label: '已确认', value: 'CONFIRMED' },
  { label: '进行中', value: 'ONGOING' },
  { label: '已完成', value: 'DONE' },
  { label: '已取消', value: 'CANCELLED' },
]
const activeFilter = ref('')
const allList = ref<Consultation[]>([])

const list = computed(() =>
  activeFilter.value
    ? allList.value.filter(c => c.Status === activeFilter.value)
    : allList.value
)

const statusLabel = (s: string) =>
  ({ PENDING: '待确认', CONFIRMED: '已确认', ONGOING: '进行中', DONE: '已完成', CANCELLED: '已取消' }[s] || s)

const formatDT = (dt: string) => dt?.slice(0, 16).replace('T', ' ') ?? ''

const load = async () => {
  const res = await httpV2.get('/api/mini/counselor/consultations')
  if (res.code === 0 && res.data) allList.value = res.data
}

const updateStatus = async (id: number, status: string) => {
  await httpV2.put(`/api/mini/counselor/consultations/${id}`, { status })
  await load()
  uni.showToast({ title: '已更新', icon: 'success' })
}

const writeCaseRecord = (consultationId: number) => {
  uni.navigateTo({ url: `/pages/counselor/case-record/edit?consultationId=${consultationId}` })
}

onMounted(load)
</script>

<style scoped>
.page-consultations { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }

.filter-bar { white-space: nowrap; margin-bottom: 32rpx; }
.filter-tag {
  display: inline-block;
  padding: 12rpx 28rpx;
  border-radius: 100rpx;
  font-size: 26rpx;
  color: #6B7280;
  background: #fff;
  margin-right: 16rpx;
  border: 2rpx solid #E5E7EB;
}
.filter-tag.active { background: #0D9488; color: #fff; border-color: #0D9488; }

.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }

.c-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.c-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.c-id { font-size: 28rpx; font-weight: 600; color: #1F2937; }
.c-status {
  font-size: 24rpx; font-weight: 600;
  padding: 4rpx 16rpx; border-radius: 100rpx;
}
.c-status.pending { background: #FEF3C7; color: #D97706; }
.c-status.confirmed { background: #DBEAFE; color: #1E40AF; }
.c-status.ongoing { background: #D1FAE5; color: #065F46; }
.c-status.done { background: #F3F4F6; color: #374151; }
.c-status.cancelled { background: #FEE2E2; color: #B91C1C; }

.c-time, .c-note { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 8rpx; }

.c-footer { display: flex; gap: 16rpx; margin-top: 20rpx; }
.c-btn {
  height: 64rpx; line-height: 64rpx;
  padding: 0 28rpx; border-radius: 100rpx;
  font-size: 26rpx; font-weight: 600; margin: 0;
}
.c-btn.primary { background: #0D9488; color: #fff; border: none; }
.c-btn.success { background: #10B981; color: #fff; border: none; }
.c-btn.outline { background: #fff; color: #0D9488; border: 2rpx solid #0D9488; }
</style>
