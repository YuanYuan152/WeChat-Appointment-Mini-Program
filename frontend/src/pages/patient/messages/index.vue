<template>
  <view class="page-messages">
    <view class="toolbar">
      <view class="filter" :class="{ active: !unreadOnly }" @click="setFilter(false)">全部</view>
      <view class="filter" :class="{ active: unreadOnly }" @click="setFilter(true)">
        未读
        <text v-if="unreadCount > 0" class="badge">{{ unreadCount }}</text>
      </view>
    </view>

    <view v-if="messages.length === 0" class="empty-state">
      <text class="empty-title">暂无消息</text>
      <text class="empty-desc">预约、支付、咨询提醒会在这里显示</text>
    </view>

    <view
      v-for="item in messages"
      :key="item.Id"
      class="message-card"
      :class="{ unread: !item.IsRead }"
      @click="markRead(item)"
    >
      <view class="msg-head">
        <view class="type-dot" :class="item.Type.toLowerCase()" />
        <text class="msg-title">{{ item.Title }}</text>
        <text v-if="!item.IsRead" class="unread-dot" />
      </view>
      <text class="msg-content">{{ item.Content || '暂无详情' }}</text>
      <view class="msg-foot">
        <text class="msg-type">{{ typeLabel(item.Type) }}</text>
        <text class="msg-time">{{ formatTime(item.CreatedAt) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface MessageItem {
  Id: number
  Type: string
  Title: string
  Content?: string
  RelatedType?: string
  RelatedId?: number
  IsRead: boolean
  CreatedAt: string
}

const messages = ref<MessageItem[]>([])
const unreadOnly = ref(false)
const unreadCount = ref(0)

const typeLabel = (type: string) => ({
  ORDER: '预约',
  PAYMENT: '支付',
  CONSULTATION: '咨询',
  SYSTEM: '系统',
  RISK: '风险',
  REMIND: '提醒',
}[type] || type)

const formatTime = (dt: string) => dt ? dt.slice(0, 16).replace('T', ' ') : ''

const loadUnreadCount = async () => {
  const res = await httpV2.get<{ count: number }>(API_ENDPOINTS.message.unreadCount, undefined, { showLoading: false })
  if (res.code === 0 && res.data) unreadCount.value = res.data.count || 0
}

const loadMessages = async () => {
  const res = await httpV2.get<MessageItem[]>(
    API_ENDPOINTS.message.list,
    { unread_only: unreadOnly.value },
    { showLoading: true }
  )
  if (res.code === 0 && res.data) messages.value = res.data
  await loadUnreadCount()
}

const setFilter = async (value: boolean) => {
  unreadOnly.value = value
  await loadMessages()
}

const markRead = async (item: MessageItem) => {
  if (item.IsRead) return
  const res = await httpV2.put<MessageItem>(
    API_ENDPOINTS.message.markRead(item.Id),
    undefined,
    { showLoading: false }
  )
  if (res.code === 0) {
    item.IsRead = true
    if (unreadCount.value > 0) unreadCount.value -= 1
    if (unreadOnly.value) messages.value = messages.value.filter(m => m.Id !== item.Id)
  }
}

onMounted(loadMessages)
</script>

<style scoped>
.page-messages {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 28rpx;
}

.toolbar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.filter {
  position: relative;
  padding: 14rpx 36rpx;
  border-radius: 100rpx;
  background: #fff;
  color: #6B7280;
  font-size: 28rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.filter.active {
  background: #0D9488;
  color: #fff;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  margin-left: 8rpx;
  border-radius: 100rpx;
  background: #EF4444;
  color: #fff;
  font-size: 20rpx;
}

.empty-state {
  background: #fff;
  border-radius: 28rpx;
  padding: 80rpx 40rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.empty-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #1F2937;
}

.empty-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #9CA3AF;
}

.message-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
  border-left: 8rpx solid transparent;
}

.message-card.unread {
  border-left-color: #0D9488;
}

.msg-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.type-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: #9CA3AF;
  flex-shrink: 0;
}

.type-dot.payment { background: #F59E0B; }
.type-dot.order { background: #3B82F6; }
.type-dot.consultation { background: #0D9488; }
.type-dot.system { background: #6B7280; }
.type-dot.risk { background: #EF4444; }
.type-dot.remind { background: #8B5CF6; }

.msg-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 800;
  color: #1F2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #EF4444;
  flex-shrink: 0;
}

.msg-content {
  display: block;
  font-size: 27rpx;
  line-height: 1.7;
  color: #4B5563;
  margin-bottom: 18rpx;
}

.msg-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.msg-type,
.msg-time {
  font-size: 23rpx;
  color: #9CA3AF;
}
</style>
