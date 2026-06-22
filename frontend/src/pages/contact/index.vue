<template>
  <view class="page-contact">
    <view class="hero-card">
      <text class="hero-title">联系我们</text>
      <text class="hero-subtitle">上海连心心理咨询有限公司</text>
    </view>
    <ContactUsContent />
  </view>
</template>

<script setup lang="ts">
import ContactUsContent from '@/components/ContactUsContent.vue'
</script>

<style scoped>
.page-contact {
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
}
</style>
