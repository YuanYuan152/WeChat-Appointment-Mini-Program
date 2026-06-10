<template>
  <view class="page-guide">
    <view class="page-header">
      <text class="page-title">了解咨询</text>
      <text class="page-desc">帮助您全面了解心理咨询的方方面面</text>
    </view>

    <view class="card-grid">
      <view
        class="guide-card"
        v-for="item in cards"
        :key="item.id"
        @click="openGuide(item.id)"
      >
        <view class="guide-icon-wrap">
          <text class="guide-icon">{{ iconFor(item.id) }}</text>
        </view>
        <view class="guide-body">
          <view class="guide-top">
            <text class="guide-tag">{{ item.tag }}</text>
          </view>
          <text class="guide-title">{{ item.title }}</text>
          <text class="guide-summary">{{ item.summary }}</text>
        </view>
        <text class="guide-arrow">›</text>
      </view>
    </view>

    <view class="cta-card" @click="goBooking">
      <text class="cta-title">准备好了？</text>
      <text class="cta-desc">浏览咨询师列表，选择适合您的专业人士</text>
      <view class="cta-btn">立即预约咨询</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { CONSULTATION_GUIDE_CARDS } from '@/constants/siteContent'

const cards = CONSULTATION_GUIDE_CARDS

const ICON_MAP: Record<string, string> = {
  'guide-what': '💡',
  'guide-process': '📋',
  'guide-who': '👤',
  'guide-methods': '💻',
  'guide-fee': '💰',
  'guide-privacy': '🔒',
  'guide-first': '✅',
  'guide-faq': '❓',
}

const iconFor = (id: string) => ICON_MAP[id] || '📖'

const openGuide = (id: string) => {
  uni.navigateTo({ url: `/pages/content/detail?key=${id}` })
}

const goBooking = () => {
  uni.switchTab({ url: '/pages/consultant/list' })
}
</script>

<style scoped>
.page-guide {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
  padding-bottom: 60rpx;
}

.page-header {
  padding: 16rpx 0 32rpx;
}

.page-title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #1F2937;
}

.page-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #6B7280;
}

.card-grid {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.guide-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.03);
}

.guide-card:active {
  opacity: 0.9;
}

.guide-icon-wrap {
  flex-shrink: 0;
  width: 88rpx;
  height: 88rpx;
  background: #F0FDFA;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guide-icon {
  font-size: 40rpx;
}

.guide-body {
  flex: 1;
  min-width: 0;
}

.guide-top {
  margin-bottom: 8rpx;
}

.guide-tag {
  font-size: 20rpx;
  color: #0D9488;
  background: #F0FDFA;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  font-weight: 600;
}

.guide-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 8rpx;
}

.guide-summary {
  display: block;
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.guide-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: #D1D5DB;
  font-weight: 300;
}

.cta-card {
  margin-top: 40rpx;
  background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
  border-radius: 28rpx;
  padding: 40rpx 32rpx;
  text-align: center;
}

.cta-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #fff;
}

.cta-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

.cta-btn {
  display: inline-block;
  margin-top: 28rpx;
  background: #fff;
  color: #0D9488;
  font-size: 28rpx;
  font-weight: 700;
  padding: 16rpx 48rpx;
  border-radius: 999rpx;
}
</style>
