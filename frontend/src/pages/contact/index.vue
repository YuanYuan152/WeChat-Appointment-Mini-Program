<template>
  <view class="page-contact">
    <view class="hero-card">
      <text class="hero-title">{{ intro.title }}</text>
      <text class="hero-subtitle">{{ intro.subtitle }}</text>
    </view>

    <view v-if="intro.paragraphs.length" class="intro-card">
      <text
        v-for="(p, pIdx) in intro.paragraphs"
        :key="pIdx"
        class="intro-paragraph"
      >{{ p }}</text>
    </view>

    <ContactUsContent :qrcode-src="assistantQrcodeSrc" />
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ContactUsContent from '@/components/ContactUsContent.vue'
import {
  fetchPublicSiteContent,
  fallbackContactIntro,
  resolvePageContent,
} from '@/utils/siteContentApi'

const intro = ref(fallbackContactIntro())
const assistantQrcodeSrc = ref('')

onMounted(async () => {
  const payload = await fetchPublicSiteContent()
  intro.value = resolvePageContent(payload?.pages, 'contact', fallbackContactIntro())
  assistantQrcodeSrc.value = payload?.pages?.contact?.assistantQrcodeUrl?.trim() || ''
})
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

.intro-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);
}

.intro-paragraph {
  display: block;
  font-size: 28rpx;
  color: #6B6560;
  line-height: 1.85;
  margin-bottom: 16rpx;
}

.intro-paragraph:last-child {
  margin-bottom: 0;
}
</style>
