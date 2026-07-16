<template>
  <view class="page-theme">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar">
      <view class="navbar-content">
        <view class="nav-left" @click="goBack">
          <text class="nav-icon">‹</text>
        </view>
        <view class="nav-title">主题月</view>
        <view class="nav-right"></view>
      </view>
    </view>

    <!-- 占位符 -->
    <view class="header-placeholder"></view>

    <!-- 主题列表 -->
    <scroll-view 
      class="list-scroll" 
      scroll-y 
      @scrolltolower="loadMore"
      :refresher-enabled="true"
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="theme-grid">
        <view 
          class="theme-card-modern" 
          v-for="theme in themes" 
          :key="theme.id"
          @click="goToDetail(theme.id)"
        >
          <view class="theme-img-wrap">
            <image 
              :src="theme.image || '/static/images-opt/place11.jpg'" 
              class="theme-img" 
              mode="aspectFill" 
              @error="handleImageError"
            />
            <view class="theme-overlay"></view>
            <view class="theme-date-badge">
              <text class="date-month">{{ getMonth(theme.month) }}</text>
              <text class="date-year">{{ getYear(theme.month) }}</text>
            </view>
          </view>
          
          <view class="theme-content">
            <view class="theme-header">
              <text class="theme-title">{{ theme.title }}</text>
              <view class="theme-status" :class="theme.status === 'active' ? 'active' : 'ended'">
                {{ theme.status === 'active' ? '进行中' : '已结束' }}
              </view>
            </view>
            <text class="theme-desc">{{ theme.description }}</text>
            
            <view class="theme-footer">
              <view class="theme-stats">
                <text class="stat-icon">👁</text>
                <text class="stat-text">{{ theme.views || 0 }} 人看过</text>
              </view>
              <view class="theme-action">
                <text class="action-text">探索主题</text>
                <view class="action-arrow">→</view>
              </view>
            </view>
          </view>
        </view>

        <!-- 加载状态 -->
        <view class="loading-state">
          <text v-if="loading">加载中...</text>
          <text v-else-if="!hasMore && themes.length > 0">没有更多了</text>
          <view v-else-if="themes.length === 0 && !loading" class="empty-box">
            <image src="/static/images-opt/place13.jpg" class="empty-img" mode="aspectFit" />
            <text class="empty-text">暂无主题月活动</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface ApiActivity {
  id: number
  title: string
  type?: string
  summary?: string
  coverUrl?: string
  startAt?: string
  endAt?: string
  isActive?: boolean
  views?: number
}

interface Theme {
  id: number
  title: string
  description: string
  month: string
  status: 'active' | 'ended'
  image: string
  views: number
}

const themes = ref<Theme[]>([])
const loading = ref(false)
const isRefreshing = ref(false)
const hasMore = ref(false)

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/index/index' })
}

const goToDetail = (id: number) => {
  // 暂用文章详情页承载主题详情；后续可接独立主题月详情页
  uni.navigateTo({ url: `/pages/article/detail?id=${id}&source=AppActivity` })
}

const handleImageError = () => {}

const loadMore = () => {
  // 主题月数量较少，目前一次性加载
}

const onRefresh = async () => {
  isRefreshing.value = true
  await loadThemes()
  isRefreshing.value = false
}

const mapTheme = (a: ApiActivity): Theme => {
  const now = new Date()
  const start = a.startAt ? new Date(a.startAt) : null
  const end = a.endAt ? new Date(a.endAt) : null
  const isActive =
    a.isActive !== false &&
    (!end || end.getTime() >= now.getTime()) &&
    (!start || start.getTime() <= now.getTime())
  const month = (start || end || now).toISOString().slice(0, 7)
  return {
    id: a.id,
    title: a.title,
    description: a.summary || '',
    month,
    status: isActive ? 'active' : 'ended',
    image: a.coverUrl || '/static/images-opt/place11.jpg',
    views: a.views || 0,
  }
}

const loadThemes = async () => {
  loading.value = true
  try {
    // 优先取 type=THEME 的活动；如未配置则回退展示全部活动
    let list: ApiActivity[] = []
    const themeRes = await httpV2.get<ApiActivity[]>(API_ENDPOINTS.ops.activities, { type: 'THEME' })
    if (themeRes.code === 0 && Array.isArray(themeRes.data) && themeRes.data.length) {
      list = themeRes.data
    } else {
      const allRes = await httpV2.get<ApiActivity[]>(API_ENDPOINTS.ops.activities)
      list = allRes.code === 0 && Array.isArray(allRes.data) ? allRes.data : []
    }
    themes.value = list.map(mapTheme)
  } catch {
    themes.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadThemes)

const getMonth = (dateStr: string) => {
  if (!dateStr) return '01月'
  const parts = dateStr.split('-')
  if (parts.length >= 2) return `${parts[1]}月`
  return dateStr
}

const getYear = (dateStr: string) => {
  if (!dateStr) return new Date().getFullYear().toString()
  const parts = dateStr.split('-')
  if (parts.length >= 1) return parts[0]
  return new Date().getFullYear().toString()
}
</script>

<style>
/* 顶级设计系统变量与重置 */
.page-theme {
  min-height: 100vh;
  background-color: #F4F6F8;
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
  background: #0D9488;
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

/* 占位符 */
.header-placeholder {
  height: calc(88rpx + var(--status-bar-height, 0px));
}

/* 列表区域 */
.list-scroll {
  flex: 1;
  height: 0;
}

.theme-grid {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.theme-card-modern {
  background: #ffffff;
  border-radius: 40rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.06);
  transition: transform 0.2s;
  position: relative;
}

.theme-card-modern:active {
  transform: scale(0.98);
}

.theme-img-wrap {
  position: relative;
  width: 100%;
  height: 360rpx;
}

.theme-img {
  width: 100%;
  height: 100%;
  background: #E5E7EB;
  object-fit: cover;
}

.theme-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, rgba(0,0,0,0.1) 100%);
}

.theme-date-badge {
  position: absolute;
  top: 32rpx;
  left: 32rpx;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 24rpx;
  padding: 16rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.15);
}

.date-month {
  font-size: 40rpx;
  font-weight: 800;
  color: #0D9488;
  line-height: 1;
  margin-bottom: 4rpx;
}

.date-year {
  font-size: 22rpx;
  font-weight: 600;
  color: #6B7280;
  letter-spacing: 2rpx;
}

.theme-content {
  padding: 40rpx 32rpx 32rpx;
  position: relative;
  background: #ffffff;
  margin-top: -40rpx;
  border-radius: 40rpx 40rpx 0 0;
  z-index: 10;
}

.theme-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
  gap: 24rpx;
}

.theme-title {
  flex: 1;
  font-size: 36rpx;
  font-weight: 800;
  color: #1F2937;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.theme-status {
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
  font-size: 22rpx;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 6rpx;
}

.theme-status.active {
  background: #F0FDFA;
  color: #0D9488;
  border: 1px solid rgba(13, 148, 136, 0.2);
}

.theme-status.ended {
  background: #F3F4F6;
  color: #6B7280;
  border: 1px solid rgba(107, 114, 128, 0.2);
}

.theme-desc {
  display: block;
  font-size: 28rpx;
  color: #4B5563;
  line-height: 1.6;
  margin-bottom: 32rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.theme-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24rpx;
  border-top: 1px dashed #E5E7EB;
}

.theme-stats {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.stat-icon {
  font-size: 28rpx;
  color: #9CA3AF;
}

.stat-text {
  font-size: 24rpx;
  color: #9CA3AF;
  font-weight: 500;
}

.theme-action {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.action-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #0D9488;
}

.action-arrow {
  width: 48rpx;
  height: 48rpx;
  background: #F0FDFA;
  color: #0D9488;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
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