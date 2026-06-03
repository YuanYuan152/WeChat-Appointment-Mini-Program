<template>
  <view class="page-risk">
    <scroll-view class="filter-bar" scroll-x :show-scrollbar="false">
      <view
        v-for="f in filters" :key="f.value"
        class="filter-tag" :class="{ active: activeFilter === f.value }"
        @click="activeFilter = f.value"
      >{{ f.label }}</view>
    </scroll-view>

    <view v-if="filtered.length === 0" class="empty-state">
      <text class="empty-text">暂无风险提醒</text>
    </view>
    <view v-for="a in filtered" :key="a.Id" class="alert-card" :class="a.Level.toLowerCase()">
      <view class="al-header">
        <text class="al-level">{{ levelLabel(a.Level) }}</text>
        <text class="al-status" :class="a.Status.toLowerCase()">{{ a.Status === 'OPEN' ? '未处理' : '已处理' }}</text>
      </view>
      <text class="al-desc">{{ a.Description || '请关注该来访者' }}</text>
      <text class="al-time">{{ formatDT(a.CreatedAt) }}</text>
      <button v-if="a.Status === 'OPEN'" class="al-btn" @click="handle(a.Id)">标记已处理</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'

interface Alert { Id: number; Level: string; Description?: string; Status: string; CreatedAt: string }

const filters = [
  { label: '全部', value: '' },
  { label: '未处理', value: 'OPEN' },
  { label: '已处理', value: 'HANDLED' },
]
const activeFilter = ref('')
const allAlerts = ref<Alert[]>([])

const filtered = computed(() =>
  activeFilter.value ? allAlerts.value.filter(a => a.Status === activeFilter.value) : allAlerts.value
)

const levelLabel = (l: string) => ({ CRITICAL: '危急', HIGH: '高危', MEDIUM: '中危', LOW: '低危' }[l] || l)
const formatDT = (dt: string) => dt?.slice(0, 16).replace('T', ' ') ?? ''

const load = async () => {
  const res = await httpV2.get('/api/mini/assistant/risk-alerts')
  if (res.code === 0 && res.data) allAlerts.value = res.data
}

const handle = async (id: number) => {
  await httpV2.put(`/api/mini/assistant/risk-alerts/${id}`, { handler_note: '已处理' })
  await load()
  uni.showToast({ title: '已处理', icon: 'success' })
}

onMounted(load)
</script>

<style scoped>
.page-risk { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }
.filter-bar { white-space: nowrap; margin-bottom: 32rpx; }
.filter-tag {
  display: inline-block; padding: 12rpx 28rpx; border-radius: 100rpx;
  font-size: 26rpx; color: #6B7280; background: #fff;
  margin-right: 16rpx; border: 2rpx solid #E5E7EB;
}
.filter-tag.active { background: #EF4444; color: #fff; border-color: #EF4444; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }

.alert-card {
  background: #fff; border-radius: 24rpx; padding: 32rpx;
  margin-bottom: 20rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
  border-left: 8rpx solid #9CA3AF;
}
.alert-card.critical { border-left-color: #B91C1C; }
.alert-card.high { border-left-color: #EF4444; }
.alert-card.medium { border-left-color: #F59E0B; }
.alert-card.low { border-left-color: #10B981; }

.al-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.al-level { font-size: 28rpx; font-weight: 800; color: #1F2937; }
.al-status { font-size: 24rpx; }
.al-status.open { color: #EF4444; }
.al-status.handled { color: #10B981; }
.al-desc { display: block; font-size: 28rpx; color: #374151; margin-bottom: 12rpx; line-height: 1.6; }
.al-time { display: block; font-size: 24rpx; color: #9CA3AF; margin-bottom: 20rpx; }
.al-btn {
  height: 72rpx; line-height: 72rpx; width: 100%;
  border-radius: 100rpx; font-size: 28rpx; font-weight: 700;
  background: #fff; color: #EF4444; border: 2rpx solid #EF4444; margin: 0;
}
</style>
