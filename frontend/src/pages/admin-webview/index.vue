<template>
  <view class="page-admin-webview">
    <view v-if="!confirmed" class="card">
      <text class="title">即将进入 Web 重后台</text>
      <text class="desc">
        小程序为轻量轻控制台，复杂能力（批量导入导出、富文本重编辑、组织权限）保留在 Web 后台。
        进入后将以 webview 嵌入运行，部分原生能力可能受限。
      </text>
      <view class="url-box">
        <text class="url-label">目标地址</text>
        <text class="url-value">{{ webviewUrl || '未配置 VITE_ADMIN_WEB_URL' }}</text>
      </view>
      <view class="actions">
        <button class="btn primary" :disabled="!webviewUrl" @click="confirmed = true">继续进入</button>
        <button class="btn ghost" @click="goBack">返回</button>
      </view>
      <text class="footer-tip">
        如未看到目标地址，请运营/部署同学在 frontend/.env 配置 VITE_ADMIN_WEB_URL 指向旧后台域名。
      </text>
    </view>

    <web-view v-else :src="webviewUrl" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const webviewUrl = ref('')
const confirmed = ref(false)

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/index/index' })
}

onMounted(() => {
  const pages = getCurrentPages()
  const opts = (pages[pages.length - 1] as any)?.options
  const rawUrl = opts?.url || ''
  webviewUrl.value = rawUrl ? decodeURIComponent(rawUrl) : (import.meta.env.VITE_ADMIN_WEB_URL || '')
  // 如果传了 ?auto=1 则跳过确认页直接进入
  if (opts?.auto === '1' && webviewUrl.value) {
    confirmed.value = true
  }
})
</script>

<style scoped>
.page-admin-webview { width: 100%; height: 100vh; background: #F4F6F8; }
web-view { width: 100%; height: 100%; }

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

.title { font-size: 36rpx; font-weight: 800; color: #1F2937; text-align: center; }
.desc { font-size: 26rpx; color: #6B7280; line-height: 1.7; }

.url-box {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 24rpx;
  border-left: 6rpx solid #0D9488;
  margin: 12rpx 0;
}
.url-label { display: block; font-size: 22rpx; color: #6B7280; margin-bottom: 8rpx; }
.url-value { display: block; font-size: 26rpx; color: #1F2937; word-break: break-all; }

.actions { display: flex; flex-direction: column; gap: 16rpx; margin-top: 16rpx; }
.btn { height: 88rpx; line-height: 88rpx; border: none; border-radius: 100rpx; font-size: 30rpx; font-weight: 700; }
.btn.primary { background: #0D9488; color: #fff; }
.btn.primary[disabled] { background: #D1FAE5; color: #fff; }
.btn.ghost { background: #F3F4F6; color: #374151; }

.footer-tip { font-size: 22rpx; color: #9CA3AF; text-align: center; line-height: 1.6; }
</style>
