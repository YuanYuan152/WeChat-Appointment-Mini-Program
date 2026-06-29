<template>
  <view class="page-messages">
    <view class="toolbar-card">
      <view class="filter-section">
        <view
          class="filter-trigger"
          :class="{ active: activeCategory !== 'ALL', open: filterOpen }"
          @click="toggleFilter"
        >
          <text class="filter-prefix">消息类型</text>
          <view class="filter-value-wrap">
            <text class="filter-value">{{ currentCategoryLabel }}</text>
            <text
              v-if="activeCategory === 'UNREAD' && unreadCount > 0"
              class="filter-badge"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </text>
            <text class="filter-arrow" :class="{ up: filterOpen }">▾</text>
          </view>
        </view>

        <view v-if="filterOpen" class="filter-mask" @click="closeFilter" />
        <view class="filter-dropdown" :class="{ show: filterOpen }">
          <view
            v-for="cat in categories"
            :key="cat.value"
            class="filter-option"
            :class="{ selected: activeCategory === cat.value }"
            @click="selectCategory(cat.value)"
          >
            <text class="option-label">{{ cat.label }}</text>
            <view class="option-right">
              <text
                v-if="cat.value === 'UNREAD' && unreadCount > 0"
                class="option-badge"
              >
                {{ unreadCount > 99 ? '99+' : unreadCount }}
              </text>
              <text v-if="activeCategory === cat.value" class="check-icon">✓</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="showSearch" class="search-row">
        <input
          v-model="searchKeyword"
          class="search-input"
          type="text"
          placeholder="搜索时间、姓名、消息类型..."
          confirm-type="search"
          @confirm="loadMessages"
          @input="onSearchInput"
        />
        <text v-if="searchKeyword" class="search-clear" @click="clearSearch">清除</text>
      </view>
    </view>

    <view
      v-if="showCrisisUnreadBanner"
      class="crisis-unread-banner"
      :class="{ 'is-zero': unreadCrisisCount <= 0 }"
      @tap="openCrisisUnreadList"
    >
      <view class="crisis-banner-left">
        <text class="crisis-alert-icon">!</text>
        <text class="crisis-banner-text">
          个案风险上报未读 {{ unreadCrisisCount }} 条
        </text>
      </view>
      <text class="crisis-banner-arrow">›</text>
    </view>

    <view v-if="loading" class="empty-state">
      <text class="empty-desc">加载中...</text>
    </view>
    <view v-else-if="messages.length === 0" class="empty-state">
      <text class="empty-title">暂无消息</text>
      <text class="empty-desc">{{ emptyHint }}</text>
    </view>
    <template v-else>
      <view
        v-for="item in messages"
        :key="item.Id"
        class="message-card"
        :class="{ unread: !item.IsRead }"
        @click="openMessage(item)"
      >
        <view class="msg-main">
          <view class="msg-head">
            <text class="msg-type-tag">{{ messageCategoryLabel(item) }}</text>
            <text class="msg-title">{{ messageDisplayTitle(item) }}</text>
            <text v-if="!item.IsRead" class="unread-dot" />
          </view>
          <text class="msg-summary">{{ messageSummary(item) }}</text>
          <text class="msg-time">{{ formatTime(item.CreatedAt) }}</text>
        </view>
        <text class="msg-arrow">›</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { AuthApi } from '@/apis/auth'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import {
  canSearchMessages,
  getMessageCategoriesForRole,
  hasAdminOpsMessageInbox,
  isCrisisReportMessage,
  messageCategoryLabel,
  messageDisplayTitle,
  messageSummary,
  resolveMessageInboxRole,
  resolveMessageNavigation,
  sanitizeMessageCategoryForRole,
  type MessageItem,
} from '@/utils/message'

const messages = ref<MessageItem[]>([])
const unreadCount = ref(0)
const unreadCrisisCount = ref(0)
const crisisUnreadView = ref(false)
const activeRole = ref('')
const userRoles = ref<string[]>([])
const activeCategory = ref('ALL')
const searchKeyword = ref('')
const loading = ref(false)
const filterOpen = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null

const inboxRole = computed(() => resolveMessageInboxRole(activeRole.value, userRoles.value))
const isAdminOpsInbox = computed(() => hasAdminOpsMessageInbox(activeRole.value, userRoles.value))
const categories = computed(() => getMessageCategoriesForRole(inboxRole.value))
const showSearch = computed(() => canSearchMessages(inboxRole.value))
const showCrisisUnreadBanner = computed(() => isAdminOpsInbox.value)
const currentCategoryLabel = computed(() => {
  if (crisisUnreadView.value) return '个案风险上报（未读）'
  const cat = categories.value.find(c => c.value === activeCategory.value)
  return cat?.label || '全部'
})
const emptyHint = computed(() => {
  if (crisisUnreadView.value) return '暂无未读的个案风险上报消息'
  if (searchKeyword.value.trim()) return '未找到匹配的消息，请换个关键词试试'
  if (activeCategory.value === 'UNREAD') return '暂无未读消息'
  const cat = categories.value.find(c => c.value === activeCategory.value)
  if (cat && cat.value !== 'ALL') return `暂无「${cat.label}」类消息`
  if (isAdminOpsInbox.value) {
    return '豁免申请、咨询师请假、记录修改、风险上报等通知会在这里显示'
  }
  return '预约、请假、取消等通知会在这里显示'
})

const formatTime = (dt: string) => dt ? dt.slice(0, 16).replace('T', ' ') : ''

const loadActiveRole = async () => {
  try {
    const me = await AuthApi.getMe()
    userRoles.value = me.roles || []
    activeRole.value = me.activeRole || me.roles?.[0] || ''
    if (me.roles?.length) {
      uni.setStorageSync('user_roles', JSON.stringify(me.roles))
    }
    if (me.activeRole) {
      uni.setStorageSync('active_role', me.activeRole)
    }
  } catch {
    userRoles.value = []
    activeRole.value = uni.getStorageSync('active_role') || ''
    try {
      userRoles.value = JSON.parse(uni.getStorageSync('user_roles') || '[]')
    } catch {
      userRoles.value = []
    }
  }
}

const countUnreadCrisis = (items: MessageItem[]) =>
  items.filter(item => isCrisisReportMessage(item) && !item.IsRead).length

const loadUnreadCrisisCount = async () => {
  if (!isAdminOpsInbox.value) {
    unreadCrisisCount.value = 0
    return
  }

  let count = 0

  try {
    const countRes = await httpV2.get<{ count: number }>(
      API_ENDPOINTS.message.unreadCount,
      { category: 'case_record_crisis' },
      { showLoading: false, showError: false },
    )
    if (countRes.code === 0 && countRes.data && typeof countRes.data.count === 'number') {
      count = countRes.data.count
    }
  } catch {
    // ignore
  }

  if (count <= 0) {
    try {
      const listRes = await httpV2.get<MessageItem[]>(
        API_ENDPOINTS.message.list,
        { unread_only: true, category: 'case_record_crisis' },
        { showLoading: false, showError: false },
      )
      if (listRes.code === 0 && Array.isArray(listRes.data)) {
        count = countUnreadCrisis(listRes.data)
      }
    } catch {
      // ignore
    }
  }

  if (count <= 0) {
    try {
      const allUnreadRes = await httpV2.get<MessageItem[]>(
        API_ENDPOINTS.message.list,
        { unread_only: true },
        { showLoading: false, showError: false },
      )
      if (allUnreadRes.code === 0 && Array.isArray(allUnreadRes.data)) {
        count = countUnreadCrisis(allUnreadRes.data)
      }
    } catch {
      // ignore
    }
  }

  unreadCrisisCount.value = count
}

const loadUnreadCount = async () => {
  const res = await httpV2.get<{ count: number }>(API_ENDPOINTS.message.unreadCount, undefined, { showLoading: false })
  if (res.code === 0 && res.data) unreadCount.value = res.data.count || 0
}

const buildListParams = () => {
  const params: Record<string, string | boolean> = {}
  if (crisisUnreadView.value) {
    params.unread_only = true
    params.category = 'case_record_crisis'
  } else if (activeCategory.value === 'UNREAD') {
    params.unread_only = true
    params.category = 'UNREAD'
  } else if (activeCategory.value !== 'ALL') {
    params.category = activeCategory.value
  }
  const q = searchKeyword.value.trim()
  if (q && showSearch.value) params.q = q
  return params
}

const loadMessages = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<MessageItem[]>(
      API_ENDPOINTS.message.list,
      buildListParams(),
      { showLoading: false },
    )
    if (res.code === 0 && res.data) {
      messages.value = res.data
      if (isAdminOpsInbox.value && !crisisUnreadView.value) {
        const fromList = countUnreadCrisis(res.data)
        unreadCrisisCount.value = Math.max(unreadCrisisCount.value, fromList)
      }
    } else {
      messages.value = []
    }
    await loadUnreadCount()
    await loadUnreadCrisisCount()
  } finally {
    loading.value = false
  }
}

const toggleFilter = () => {
  filterOpen.value = !filterOpen.value
}

const closeFilter = () => {
  filterOpen.value = false
}

const selectCategory = async (value: string) => {
  closeFilter()
  crisisUnreadView.value = false
  const next = sanitizeMessageCategoryForRole(inboxRole.value, value)
  if (activeCategory.value === next && !crisisUnreadView.value) return
  activeCategory.value = next
  await loadMessages()
}

const openCrisisUnreadList = async () => {
  crisisUnreadView.value = true
  activeCategory.value = 'ALL'
  searchKeyword.value = ''
  closeFilter()
  await loadMessages()
}

const onSearchInput = () => {
  if (!showSearch.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadMessages()
  }, 400)
}

const clearSearch = async () => {
  searchKeyword.value = ''
  await loadMessages()
}

const markRead = async (item: MessageItem) => {
  if (item.IsRead) return
  const res = await httpV2.put<MessageItem>(
    API_ENDPOINTS.message.markRead(item.Id),
    undefined,
    { showLoading: false, showError: false },
  )
  if (res.code === 0) {
    item.IsRead = true
    if (unreadCount.value > 0) unreadCount.value -= 1
    if (isCrisisReportMessage(item) && unreadCrisisCount.value > 0) {
      unreadCrisisCount.value -= 1
    }
    if (activeCategory.value === 'UNREAD' || crisisUnreadView.value) {
      messages.value = messages.value.filter(m => m.Id !== item.Id)
    }
  }
}

const openMessage = async (item: MessageItem) => {
  await markRead(item)
  const url = resolveMessageNavigation(item, inboxRole.value)
  uni.navigateTo({
    url,
    fail: () => {
      if (url.includes('case-record-amendments') || url.includes('refund-exemptions')) {
        uni.showModal({
          title: '页面未找到',
          content: '请重启 pnpm dev:mp-weixin，并在微信开发者工具中点击「编译」刷新后重试。',
          showCancel: false,
        })
        return
      }
      uni.navigateTo({ url: `/pages/patient/messages/detail?id=${item.Id}` })
    },
  })
}

onLoad(loadActiveRole)

onShow(async () => {
  await loadActiveRole()
  activeCategory.value = sanitizeMessageCategoryForRole(inboxRole.value, activeCategory.value)
  await loadUnreadCrisisCount()
  await loadMessages()
})
</script>

<style scoped>
.page-messages {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 28rpx;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.toolbar-card {
  position: relative;
  z-index: 20;
  background: #fff;
  border-radius: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
  overflow: visible;
}

.filter-section {
  position: relative;
}

.filter-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  border-radius: 24rpx;
}

.filter-trigger.open {
  border-radius: 24rpx 24rpx 0 0;
}

.filter-trigger.active .filter-value {
  color: #3D5A4E;
  font-weight: 700;
}

.filter-prefix {
  flex-shrink: 0;
  font-size: 28rpx;
  color: #6B7280;
  font-weight: 500;
}

.filter-value-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  min-width: 0;
}

.filter-value {
  font-size: 28rpx;
  color: #1F2937;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-badge {
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 100rpx;
  background: #EF4444;
  color: #fff;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
  flex-shrink: 0;
}

.filter-arrow {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #9CA3AF;
  transition: transform 0.25s;
}

.filter-arrow.up {
  transform: rotate(180deg);
  color: #3D5A4E;
}

.filter-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 90;
}

.filter-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  z-index: 95;
  max-height: 0;
  overflow: hidden;
  border-radius: 0 0 24rpx 24rpx;
  transition: max-height 0.25s ease;
  box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.1);
}

.filter-dropdown.show {
  max-height: 640rpx;
  overflow-y: auto;
}

.filter-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-top: 1rpx solid #F3F4F6;
}

.filter-option.selected .option-label {
  color: #3D5A4E;
  font-weight: 700;
}

.option-label {
  font-size: 28rpx;
  color: #374151;
}

.option-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.option-badge {
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 100rpx;
  background: #FEE2E2;
  color: #EF4444;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
}

.check-icon {
  font-size: 28rpx;
  color: #3D5A4E;
  font-weight: 700;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 28rpx 16rpx;
  border-top: 1rpx solid #F3F4F6;
}

.search-input {
  flex: 1;
  height: 56rpx;
  line-height: 56rpx;
  font-size: 26rpx;
  color: #1F2937;
}

.search-clear {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #3D5A4E;
  padding: 4rpx 8rpx;
}

.crisis-unread-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: rgba(234, 88, 12, 0.14);
  border: 1rpx solid rgba(234, 88, 12, 0.28);
}

.crisis-unread-banner.is-zero {
  background: rgba(234, 88, 12, 0.08);
  border-color: rgba(234, 88, 12, 0.18);
}

.crisis-unread-banner.is-zero .crisis-banner-text {
  color: #EA580C;
  font-weight: 600;
}

.crisis-unread-banner.is-zero .crisis-alert-icon {
  background: rgba(234, 88, 12, 0.14);
  color: #EA580C;
}

.crisis-banner-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
  min-width: 0;
}

.crisis-alert-icon {
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  border-radius: 50%;
  background: rgba(234, 88, 12, 0.22);
  color: #C2410C;
  font-size: 28rpx;
  font-weight: 800;
  flex-shrink: 0;
}

.crisis-banner-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #C2410C;
  line-height: 1.5;
}

.crisis-banner-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: #EA580C;
  font-weight: 300;
  line-height: 1;
  margin-left: 12rpx;
}

.empty-state {
  background: #fff;
  border-radius: 32rpx;
  padding: 80rpx 40rpx;
  text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
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
  line-height: 1.6;
}

.message-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #fff;
  border-radius: 32rpx;
  padding: 28rpx;
  margin-bottom: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
  border-left: 8rpx solid transparent;
}

.message-card.unread {
  border-left-color: #3D5A4E;
}

.msg-main {
  flex: 1;
  min-width: 0;
}

.msg-head {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 10rpx;
}

.msg-type-tag {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #F0EDE8;
  color: #3D5A4E;
  font-size: 20rpx;
  font-weight: 600;
}

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

.msg-summary {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: #9CA3AF;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-time {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  color: #D1D5DB;
}

.msg-arrow {
  flex-shrink: 0;
  font-size: 44rpx;
  color: #D1D5DB;
  font-weight: 300;
  line-height: 1;
}
</style>

