<template>
  <view class="page-charity">
    <view class="hero-card">
      <text class="hero-title">{{ content.title }}</text>
      <text v-if="content.subtitle" class="hero-subtitle">{{ content.subtitle }}</text>
    </view>

    <view class="info-card">
      <text
        v-for="(p, pIdx) in content.paragraphs"
        :key="pIdx"
        class="info-paragraph"
      >{{ p }}</text>
    </view>

    <view class="action-row">
      <view class="action-btn" @tap="goContact">
        <text class="action-text">咨询助理</text>
      </view>
      <view class="action-btn outline" @tap="goBooking">
        <text class="action-text">预约咨询</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  fetchPublicSiteContent,
  fallbackCharityContent,
  resolvePageContent,
} from '@/utils/siteContentApi'

const content = ref(fallbackCharityContent())

onMounted(async () => {
  const payload = await fetchPublicSiteContent()
  content.value = resolvePageContent(payload?.pages, 'charity', fallbackCharityContent())
})

const goContact = () => {
  uni.navigateTo({
    url: '/pages/contact/index',
    fail: () => {
      uni.showToast({ title: '页面打开失败，请稍后重试', icon: 'none' })
    },
  })
}

const goBooking = () => {
  uni.switchTab({ url: '/pages/consultant/list' })
}
</script>

<style scoped>
.page-charity {
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
  margin-bottom: 32rpx;
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

.action-row {
  display: flex;
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  text-align: center;
  background: #3D5A4E;
  border-radius: 16rpx;
  padding: 24rpx 0;
}

.action-btn.outline {
  background: #F0EDE8;
  border: 1rpx solid #E8E4DE;
}

.action-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}

.action-btn.outline .action-text {
  color: #3D5A4E;
}
</style>
