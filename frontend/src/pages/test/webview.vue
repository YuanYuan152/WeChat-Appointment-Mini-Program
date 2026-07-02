<template>
  <view class="page-webview">
    <view v-if="!confirmed" class="card">
      <text class="title">即将打开测评页面</text>
      <text class="desc">
        将在小程序内打开外部网页进行心理测评。完成后可在测评站「我的报告」查看结果；小程序内 PHQ-9 / GAD-7 的结果保存在「我的量表结果」。
      </text>
      <view class="url-box">
        <text class="url-label">目标地址</text>
        <text class="url-value">{{ targetUrl || '未配置测评站地址' }}</text>
      </view>
      <view class="actions">
        <button class="btn primary" :disabled="!targetUrl" @click="confirmed = true">继续填写</button>
        <button class="btn outline" :disabled="!targetUrl" @click="copyLink">复制链接</button>
        <button class="btn ghost" @click="goBack">返回</button>
      </view>
      <text class="footer-tip">
        若无法打开，请在 frontend/.env 配置 VITE_ASSESSMENT_WEB_URL，并在微信公众平台配置业务域名。
      </text>
    </view>
    <web-view v-else :src="targetUrl" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { ASSESSMENT_WEB_BASE } from '@/constants/psychAssessmentCatalog'

const targetUrl = ref('')
const confirmed = ref(false)
const pageTitle = ref('心理测评')

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.redirectTo({ url: '/pages/test/index' })
}

const copyLink = () => {
  if (!targetUrl.value) return
  uni.setClipboardData({
    data: targetUrl.value,
    success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
  })
}

onLoad((opts) => {
  const rawUrl = opts?.url ? decodeURIComponent(String(opts.url)) : ''
  const rawTitle = opts?.title ? decodeURIComponent(String(opts.title)) : ''
  targetUrl.value = rawUrl
  pageTitle.value = rawTitle || '心理测评'
  uni.setNavigationBarTitle({ title: pageTitle.value })
  if (opts?.auto === '1' && targetUrl.value) {
    confirmed.value = true
  }
  if (!targetUrl.value) {
    uni.showToast({ title: '缺少测评链接', icon: 'none' })
  }
  if (!ASSESSMENT_WEB_BASE) {
    uni.showToast({ title: '未配置测评站地址', icon: 'none' })
  }
})
</script>

<style scoped>
.page-webview {
  width: 100%;
  height: 100vh;
  background: #F7F5F2;
}

web-view {
  width: 100%;
  height: 100%;
}

.card {
  margin: 96rpx 32rpx 0;
  background: #fff;
  border-radius: 32rpx;
  padding: 56rpx 40rpx;
  box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 800;
  color: #1F2937;
  text-align: center;
}

.desc {
  font-size: 26rpx;
  color: #6B7280;
  line-height: 1.7;
}

.url-box {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 24rpx;
  border-left: 6rpx solid #3D5A4E;
}

.url-label {
  display: block;
  font-size: 22rpx;
  color: #6B7280;
  margin-bottom: 8rpx;
}

.url-value {
  display: block;
  font-size: 24rpx;
  color: #1F2937;
  word-break: break-all;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 8rpx;
}

.btn {
  height: 88rpx;
  line-height: 88rpx;
  border: none;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.btn::after { border: none; }

.btn.primary {
  background: #3D5A4E;
  color: #fff;
}

.btn.primary[disabled] {
  background: #D1D5DB;
  color: #fff;
}

.btn.outline {
  background: #fff;
  color: #3D5A4E;
  border: 2rpx solid #3D5A4E;
}

.btn.ghost {
  background: #F3F4F6;
  color: #374151;
}

.footer-tip {
  font-size: 22rpx;
  color: #9CA3AF;
  text-align: center;
  line-height: 1.6;
}
</style>
