<template>
  <view class="page-jixinli">
    <view class="hero-card">
      <text class="hero-title">{{ content.title }}</text>
      <text v-if="content.subtitle" class="hero-subtitle">{{ content.subtitle }}</text>
    </view>

    <view class="info-card">
      <view
        v-for="(section, idx) in content.sections"
        :key="idx"
        class="info-block"
      >
        <text v-if="section.heading" class="info-heading">{{ section.heading }}</text>
        <text
          v-for="(p, pIdx) in section.paragraphs"
          :key="pIdx"
          class="info-paragraph"
        >{{ p }}</text>
      </view>
    </view>

    <view class="action-row">
      <view class="action-btn" @click="goHighlights">
        <text class="action-text">往期精华</text>
      </view>
      <view class="action-btn outline" @click="goAbout">
        <text class="action-text">关于连心</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { JIXINLI_CONTENT } from '@/constants/siteContent'

const content = JIXINLI_CONTENT

const goHighlights = () => {
  uni.navigateTo({ url: '/pages/highlights/index' })
}

const goAbout = () => {
  uni.navigateTo({ url: '/pages/about/index' })
}
</script>

<style scoped>
.page-jixinli {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
  padding-bottom: 60rpx;
}

.hero-card {
  background: linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%);
  border-radius: 28rpx;
  padding: 48rpx 36rpx;
  margin-bottom: 24rpx;
}

.hero-title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #fff;
}

.hero-subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.info-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.05);
  margin-bottom: 32rpx;
}

.info-block {
  margin-bottom: 36rpx;
}

.info-block:last-child {
  margin-bottom: 0;
}

.info-heading {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #7C3AED;
  margin-bottom: 16rpx;
}

.info-paragraph {
  display: block;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.85;
  margin-bottom: 16rpx;
}

.info-paragraph:last-child {
  margin-bottom: 0;
}

.action-row {
  display: flex;
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  text-align: center;
  background: #7C3AED;
  border-radius: 100rpx;
  padding: 24rpx 0;
}

.action-btn.outline {
  background: #fff;
  border: 2rpx solid #7C3AED;
}

.action-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #fff;
}

.action-btn.outline .action-text {
  color: #7C3AED;
}
</style>
