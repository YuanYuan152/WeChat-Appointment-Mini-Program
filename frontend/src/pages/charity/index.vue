<template>
  <view class="page-charity">
    <view class="hero-card">
      <text class="hero-title">{{ content.title }}</text>
      <text v-if="content.subtitle" class="hero-subtitle">{{ content.subtitle }}</text>
    </view>

    <view class="info-card">
      <SiteProseBlock :paragraphs="content.paragraphs" />
    </view>

    <view class="action-row">
      <view class="action-btn" @tap="goContact">
        <text class="action-text">联系咨询助理了解</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SiteProseBlock from '@/components/SiteProseBlock.vue'
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

.action-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}
</style>
