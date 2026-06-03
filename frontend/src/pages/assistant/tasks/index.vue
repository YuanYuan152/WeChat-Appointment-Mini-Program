<template>
  <view class="page-tasks">
    <scroll-view class="filter-bar" scroll-x :show-scrollbar="false">
      <view
        v-for="f in filters" :key="f.value"
        class="filter-tag" :class="{ active: activeFilter === f.value }"
        @click="activeFilter = f.value"
      >{{ f.label }}</view>
    </scroll-view>

    <view v-if="filtered.length === 0" class="empty-state">
      <text class="empty-text">暂无任务</text>
    </view>
    <view v-for="t in filtered" :key="t.Id" class="task-card">
      <view class="tc-left">
        <text class="tc-title">{{ t.Title }}</text>
        <text class="tc-type">{{ t.Type }}</text>
        <text class="tc-due" v-if="t.DueAt">截止 {{ formatDT(t.DueAt) }}</text>
      </view>
      <view class="tc-right">
        <text class="tc-priority" :class="t.Priority.toLowerCase()">{{ priorityLabel(t.Priority) }}</text>
        <button v-if="t.Status !== 'DONE'" class="tc-btn" @click="done(t.Id)">完成</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'

interface Task { Id: number; Title: string; Type: string; Priority: string; Status: string; DueAt?: string }

const filters = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'OPEN' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'DONE' },
]
const activeFilter = ref('')
const allTasks = ref<Task[]>([])

const filtered = computed(() =>
  activeFilter.value ? allTasks.value.filter(t => t.Status === activeFilter.value) : allTasks.value
)

const priorityLabel = (p: string) => ({ HIGH: '紧急', NORMAL: '普通', LOW: '低优' }[p] || p)
const formatDT = (dt: string) => dt?.slice(0, 16).replace('T', ' ') ?? ''

const load = async () => {
  const res = await httpV2.get('/api/mini/assistant/tasks')
  if (res.code === 0 && res.data) allTasks.value = res.data
}

const done = async (id: number) => {
  await httpV2.put(`/api/mini/assistant/tasks/${id}`, { status: 'DONE' })
  await load()
}

onMounted(() => {
  const pages = getCurrentPages()
  const opts = (pages[pages.length - 1] as any)?.options
  if (opts?.status) activeFilter.value = opts.status
  load()
})
</script>

<style scoped>
.page-tasks { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }
.filter-bar { white-space: nowrap; margin-bottom: 32rpx; }
.filter-tag {
  display: inline-block; padding: 12rpx 28rpx; border-radius: 100rpx;
  font-size: 26rpx; color: #6B7280; background: #fff;
  margin-right: 16rpx; border: 2rpx solid #E5E7EB;
}
.filter-tag.active { background: #7C3AED; color: #fff; border-color: #7C3AED; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }
.task-card {
  background: #fff; border-radius: 24rpx; padding: 32rpx;
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 20rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.tc-title { display: block; font-size: 30rpx; font-weight: 700; color: #1F2937; margin-bottom: 8rpx; }
.tc-type { display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 6rpx; }
.tc-due { font-size: 24rpx; color: #F59E0B; }
.tc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 16rpx; }
.tc-priority {
  font-size: 22rpx; font-weight: 700; padding: 4rpx 16rpx; border-radius: 100rpx;
}
.tc-priority.high { background: #FEE2E2; color: #B91C1C; }
.tc-priority.normal { background: #DBEAFE; color: #1E40AF; }
.tc-priority.low { background: #F3F4F6; color: #6B7280; }
.tc-btn {
  height: 60rpx; line-height: 60rpx; padding: 0 24rpx; border-radius: 100rpx;
  font-size: 24rpx; font-weight: 600; background: #7C3AED; color: #fff; border: none; margin: 0;
}
</style>
