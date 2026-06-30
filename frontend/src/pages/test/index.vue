<template>
  <view class="page-test-hub">
    <view class="hero">
      <text class="hero-title">心理测评</text>
      <text class="hero-sub">登录后可填写量表，并查看自己的历史结果</text>
    </view>

    <view class="card link-card" @tap="goResults">
      <view class="link-left">
        <text class="link-title">我的量表结果</text>
        <text class="link-desc">查看已完成的 PHQ-9 / GAD-7 记录</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <text class="section-title">选择量表</text>
    <view
      v-for="scale in SCALE_LIST"
      :key="scale.type"
      class="card scale-card"
      @tap="goScale(scale.type)"
    >
      <text class="scale-name">{{ scale.title }}</text>
      <text class="scale-desc">{{ scale.questions.length }} 道题 · 约 3 分钟</text>
      <text class="scale-action">开始测评 ›</text>
    </view>

    <view class="tip-card">
      <text class="tip-text">测评结果仅供参考，不能替代专业诊断。如有需要，请预约咨询师进一步评估。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { isLoggedIn } from '@/utils/auth'
import { SCALE_LIST, type ScaleType } from '@/constants/psychScales'

const ensureLogin = (next: () => void) => {
  if (isLoggedIn()) {
    next()
    return
  }
  uni.showModal({
    title: '需要登录',
    content: '登录后才能进行心理量表测评并保存结果',
    confirmText: '去登录',
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/test/index') })
      }
    },
  })
}

const goScale = (type: ScaleType) => {
  ensureLogin(() => {
    uni.navigateTo({ url: `/pages/test/scale?type=${type}` })
  })
}

const goResults = () => {
  ensureLogin(() => {
    uni.navigateTo({ url: '/pages/test/results' })
  })
}

onShow(() => {
  if (!isLoggedIn()) {
    uni.showToast({ title: '请先登录', icon: 'none', duration: 2000 })
  }
})
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
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.link-card:active, .scale-card:active { opacity: 0.92; }
.link-title { display: block; font-size: 30rpx; font-weight: 700; color: #3D5A4E; }
.link-desc { display: block; margin-top: 8rpx; font-size: 24rpx; color: #9CA3AF; }
.arrow { font-size: 36rpx; color: #C9A96E; }
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #6B6560;
  margin: 8rpx 0 16rpx 8rpx;
}
.scale-name { display: block; font-size: 32rpx; font-weight: 700; color: #2C2C2C; }
.scale-desc { display: block; margin-top: 8rpx; font-size: 24rpx; color: #9CA3AF; }
.scale-action { display: block; margin-top: 16rpx; font-size: 26rpx; color: #3D5A4E; font-weight: 600; }
.tip-card {
  background: #FFFBEB;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 8rpx;
}
.tip-text { font-size: 24rpx; color: #92400E; line-height: 1.7; }
</style>
