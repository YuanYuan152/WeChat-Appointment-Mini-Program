<template>
  <view class="page-about">
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

    <view class="link-card" @click="goJixinli">
      <view class="link-left">
        <text class="link-title">了解济心理</text>
        <text class="link-desc">连心心理旗下知识品牌</text>
      </view>
      <text class="link-arrow">›</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ABOUT_CONTENT } from '@/constants/siteContent'

const content = ABOUT_CONTENT

const goJixinli = () => {
  uni.navigateTo({ url: '/pages/jixinli/index' })
}
</script>

<style scoped>
.page-about {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
  padding-bottom: 60rpx;
}

.hero-card {
  background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
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
  margin-bottom: 24rpx;
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
  color: #0D9488;
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

.link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.05);
}

.link-card:active {
  opacity: 0.9;
}

.link-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1F2937;
}

.link-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6B7280;
}

.link-arrow {
  font-size: 40rpx;
  color: #D1D5DB;
}
</style>
