<template>
  <view class="page-test-hub">
    <view class="hero">
      <text class="hero-title">心理测评</text>
      <text class="hero-sub">选择测评类型，在测评站完成填写并查看报告</text>
    </view>

    <view
      v-for="entry in ASSESSMENT_HUB_ENTRIES"
      :key="entry.key"
      class="card link-card"
      :class="entry.key"
      @tap="openHub(entry)"
    >
      <view class="link-left">
        <text class="link-title">{{ entry.title }}</text>
        <text class="link-desc">{{ entry.subtitle }}</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <view class="tip-card">
      <text class="tip-text">测评结果仅供参考，不能替代专业诊断。如有需要，请预约咨询师进一步评估。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import {
  ASSESSMENT_HUB_ENTRIES,
  buildAssessmentHubUrl,
  type AssessmentHubEntry,
} from '@/constants/psychAssessmentCatalog'

const STORAGE_URL_KEY = 'assessment_webview_url'
const STORAGE_TITLE_KEY = 'assessment_webview_title'

const openHub = (entry: AssessmentHubEntry) => {
  const url = buildAssessmentHubUrl(entry)
  if (!url) {
    uni.showToast({ title: '测评地址未配置', icon: 'none' })
    return
  }

  try {
    uni.setStorageSync(STORAGE_URL_KEY, url)
    uni.setStorageSync(STORAGE_TITLE_KEY, entry.title)
  } catch (e) {
    console.warn('setStorageSync failed', e)
  }

  uni.navigateTo({
    url: `/pages/test/webview?url=${encodeURIComponent(url)}&title=${encodeURIComponent(entry.title)}`,
    fail: (err) => {
      console.error('navigateTo webview failed', err)
      uni.showToast({
        title: err?.errMsg || '页面打开失败',
        icon: 'none',
        duration: 2500,
      })
    },
  })
}
</script>

<style scoped>
.page-test-hub {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}
.hero {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 24rpx;
}
.hero-title { display: block; font-size: 40rpx; font-weight: 700; color: #fff; }
.hero-sub { display: block; margin-top: 12rpx; font-size: 26rpx; color: rgba(255,255,255,0.85); line-height: 1.6; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.link-card:active { opacity: 0.92; }
.link-card.professional { border-left: 6rpx solid #3D5A4E; }
.link-card.fun { border-left: 6rpx solid #C9A96E; }
.link-card.reports { border-left: 6rpx solid #6B8F7A; }
.link-title { display: block; font-size: 32rpx; font-weight: 700; color: #3D5A4E; }
.link-desc { display: block; margin-top: 10rpx; font-size: 24rpx; color: #9CA3AF; line-height: 1.5; }
.arrow { font-size: 36rpx; color: #C9A96E; flex-shrink: 0; margin-left: 16rpx; }
.tip-card {
  background: #FFFBEB;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 8rpx;
}
.tip-text { font-size: 24rpx; color: #92400E; line-height: 1.7; }
</style>
