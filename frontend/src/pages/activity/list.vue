<template>
  <view class="page-activity-list">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar">
      <view class="navbar-content">
        <view class="nav-left" @click="goBack">
          <text class="nav-icon">‹</text>
        </view>
        <view class="nav-title">精彩活动</view>
        <view class="nav-right"></view>
      </view>
    </view>

    <!-- 分类标签 (吸顶) -->
    <view class="category-tabs">
      <view class="tab-scroll-view">
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 'all' }"
          @click="switchTab('all')"
        >全部活动</view>
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 'ongoing' }"
          @click="switchTab('ongoing')"
        >进行中</view>
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 'ended' }"
          @click="switchTab('ended')"
        >已结束</view>
      </view>
    </view>

    <!-- 占位符 -->
    <view class="header-placeholder"></view>

    <!-- 活动列表 -->
    <scroll-view 
      class="list-scroll" 
      scroll-y 
      @scrolltolower="loadMore"
      :refresher-enabled="true"
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="activity-grid">
        <view 
          class="act-card-modern" 
          v-for="activity in activities" 
          :key="activity.id"
          @click="goToDetail(activity.id)"
        >
          <view class="act-img-wrap">
            <image 
              :src="activity.image || '/static/images/huodong11.png'" 
              class="act-img" 
              mode="aspectFill" 
              @error="handleImageError"
            />
            <view class="act-status-badge" :class="activity.status === '进行中' ? 'ongoing' : 'ended'">
              {{ activity.status || '进行中' }}
            </view>
            <view class="act-date-badge">
              <text class="date-day">{{ getDay(activity.date) }}</text>
              <text class="date-month">{{ getMonth(activity.date) }}月</text>
            </view>
          </view>
          
          <view class="act-info">
            <text class="act-title">{{ activity.title }}</text>
            <text class="act-desc">{{ activity.description }}</text>
            
            <view class="act-meta">
              <view class="meta-item">
                <text class="meta-icon">📍</text>
                <text class="meta-text">{{ activity.location || '线上/线下' }}</text>
              </view>
              <view class="meta-item">
                <text class="meta-icon">👥</text>
                <text class="meta-text">{{ activity.participants || 0 }}人参与</text>
              </view>
            </view>
            
            <view class="act-foot">
              <view class="act-price-box">
                <text v-if="activity.price === 0 || !activity.price" class="price-free">免费</text>
                <block v-else>
                  <text class="price-symbol">￥</text>
                  <text class="price-num">{{ activity.price }}</text>
                </block>
              </view>
              <button 
                class="act-btn" 
                :class="{ 'disabled': activity.status === '已结束' }"
                @click.stop="handleJoin(activity)"
              >
                {{ activity.status === '已结束' ? '查看详情' : '立即报名' }}
              </button>
            </view>
          </view>
        </view>

        <!-- 加载状态 -->
        <view class="loading-state">
          <text v-if="loading">加载中...</text>
          <text v-else-if="!hasMore && activities.length > 0">没有更多了</text>
          <view v-else-if="activities.length === 0 && !loading" class="empty-box">
            <image src="/static/images/place14.png" class="empty-img" mode="aspectFit" />
            <text class="empty-text">暂无相关活动</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Activity } from '@/types'
import { activityApi } from '@/apis'

const activities = ref<Activity[]>([])
const loading = ref(false)
const hasMore = ref(false)
const isRefreshing = ref(false)
const activeTab = ref<'all' | 'ongoing' | 'ended'>('all')

onMounted(() => {
  loadActivities()
})

const loadActivities = async () => {
  loading.value = true
  try {
    const res = await activityApi.getList({ page: 1, pageSize: 50 })
    activities.value = (res.data || []).filter((item) => {
      if (activeTab.value === 'all') return true
      if (activeTab.value === 'ongoing') return item.status !== '已结束'
      return item.status === '已结束'
    })
  } catch (error) {
    console.error('活动列表加载失败:', error)
    activities.value = []
  } finally {
    loading.value = false
  }
}

const switchTab = (tab: typeof activeTab.value) => {
  activeTab.value = tab
  loadActivities()
}

const onRefresh = async () => {
  isRefreshing.value = true
  try {
    await loadActivities()
  } finally {
    isRefreshing.value = false
  }
}

const loadMore = () => {
  hasMore.value = false
}

const goBack = () => {
  uni.navigateBack()
}

const goToDetail = (id: number | string) => {
  uni.navigateTo({ url: `/pages/article/detail?id=${id}` })
}

const handleJoin = (activity: Activity) => {
  console.log('报名活动:', activity)
  uni.showToast({ title: '活动报名功能待接入', icon: 'none' })
}

const handleImageError = () => {
  console.warn('活动图片加载失败')
}

// 辅助函数
const getDay = (dateStr: string) => {
  if (!dateStr) return '01'
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? '01' : String(date.getDate()).padStart(2, '0')
}

const getMonth = (dateStr: string) => {
  if (!dateStr) return '01'
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? '01' : String(date.getMonth() + 1).padStart(2, '0')
}

</script>

<style>
/* 顶级设计系统变量与重置 */
.page-activity-list {
  min-height: 100vh;
  background-color: #F7F5F2;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

/* 自定义导航栏 */
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #3D5A4E;
  padding-top: var(--status-bar-height, 0px);
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 32rpx;
}

.nav-left, .nav-right {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.nav-right {
  justify-content: flex-end;
}

.nav-icon {
  font-size: 64rpx;
  color: #ffffff;
  line-height: 1;
  margin-top: -8rpx;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}

/* 分类标签 */
.category-tabs {
  position: fixed;
  top: calc(88rpx + var(--status-bar-height, 0px));
  left: 0;
  right: 0;
  z-index: 90;
  background: #ffffff;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.02);
}

.tab-scroll-view {
  display: flex;
  padding: 0 32rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 30rpx;
  font-weight: 600;
  color: #6B7280;
  position: relative;
  transition: color 0.3s;
}

.tab-item.active {
  color: #3D5A4E;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 6rpx;
  background: #3D5A4E;
  border-radius: 6rpx 6rpx 0 0;
}

/* 占位符 */
.header-placeholder {
  height: calc(88rpx + 90rpx + var(--status-bar-height, 0px));
}

/* 列表区域 */
.list-scroll {
  flex: 1;
  height: 0;
}

.activity-grid {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.act-card-modern {
  background: #ffffff;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.04);
  transition: transform 0.2s;
}

.act-card-modern:active {
  transform: scale(0.98);
}

.act-img-wrap {
  position: relative;
  width: 100%;
  height: 320rpx;
}

.act-img {
  width: 100%;
  height: 100%;
  background: #F3F4F6;
  object-fit: cover;
}

.act-status-badge {
  position: absolute;
  top: 24rpx;
  left: 24rpx;
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: white;
  backdrop-filter: blur(8px);
}

.act-status-badge.ongoing {
  background: rgba(16, 185, 129, 0.85);
}

.act-status-badge.ended {
  background: rgba(107, 114, 128, 0.85);
}

.act-date-badge {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 20rpx;
  padding: 12rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8rpx 16rpx rgba(0,0,0,0.1);
}

.date-day {
  font-size: 36rpx;
  font-weight: 800;
  color: #3D5A4E;
  line-height: 1;
  margin-bottom: 4rpx;
}

.date-month {
  font-size: 20rpx;
  font-weight: 600;
  color: #6B7280;
}

.act-info {
  padding: 32rpx;
}

.act-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 12rpx;
  line-height: 1.4;
}

.act-desc {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  line-height: 1.6;
  margin-bottom: 24rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.act-meta {
  display: flex;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.meta-icon {
  font-size: 24rpx;
}

.meta-text {
  font-size: 24rpx;
  color: #9CA3AF;
}

.act-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24rpx;
  border-top: 1px dashed #E5E7EB;
}

.act-price-box {
  display: flex;
  align-items: baseline;
}

.price-free {
  font-size: 32rpx;
  font-weight: 800;
  color: #10B981;
}

.price-symbol {
  font-size: 24rpx;
  color: #F59E0B;
  font-weight: 700;
}

.price-num {
  font-size: 40rpx;
  color: #F59E0B;
  font-weight: 800;
}

.act-btn {
  background: #3D5A4E;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 600;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 40rpx;
  border-radius: 100rpx;
  margin: 0;
  box-shadow: 0 4rpx 12rpx rgba(13, 148, 136, 0.2);
}

.act-btn.disabled {
  background: #F3F4F6;
  color: #9CA3AF;
  box-shadow: none;
}

/* 加载状态 */
.loading-state {
  padding: 40rpx 0;
  text-align: center;
}

.loading-state text {
  font-size: 26rpx;
  color: #9CA3AF;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-img {
  width: 240rpx;
  height: 240rpx;
  margin-bottom: 24rpx;
  opacity: 0.6;
}

.empty-text {
  font-size: 28rpx;
  color: #6B7280;
}
</style>