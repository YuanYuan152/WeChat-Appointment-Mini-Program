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
  background: #F7F5F2;
  padding: 32rpx;
  padding-bottom: 60rpx;
}

.hero-card {
  background: linear-gradient(135deg, #3D5A4E 0%, #2F4A40 100%);
  border-radius: 28rpx;
  padding: 48rpx 36rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);
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
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}

.info-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
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
  color: #3D5A4E;
  margin-bottom: 16rpx;
}

.info-paragraph {
  display: block;
  font-size: 28rpx;
  color: #6B6560;
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
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
  border: 1rpx solid #E8E4DE;
}

.link-card:active {
  opacity: 0.92;
  background: #F0EDE8;
}

.link-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #2C2C2C;
}

.link-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8A8A8A;
}

.link-arrow {
  font-size: 40rpx;
  color: #3D5A4E;
}
</style>
