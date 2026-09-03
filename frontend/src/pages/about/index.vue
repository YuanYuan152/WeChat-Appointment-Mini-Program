<template>
  <view class="page-about">
    <view class="hero-card">
      <text class="hero-title">{{ content.title }}</text>
      <text v-if="content.subtitle" class="hero-subtitle">{{ content.subtitle }}</text>
    </view>

    <view class="info-card">
      <SiteProseBlock :paragraphs="content.paragraphs" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SiteProseBlock from '@/components/SiteProseBlock.vue'
import {
  fetchPublicSiteContent,
  fallbackBrandContent,
  resolvePageContent,
} from '@/utils/siteContentApi'

const content = ref(fallbackBrandContent())

onMounted(async () => {
  const payload = await fetchPublicSiteContent()
  content.value = resolvePageContent(payload?.pages, 'brand', fallbackBrandContent())
})
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
}

</style>
