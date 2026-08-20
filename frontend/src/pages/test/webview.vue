<template>
  <view class="page-webview">
    <!-- 不可内嵌：http / IP 等，避免白屏 -->
    <view v-if="mode === 'fallback'" class="card">
      <text class="title">{{ pageTitle }}</text>
      <text class="desc">
        微信小程序内嵌网页要求使用已备案的 HTTPS 域名，当前地址为 HTTP 或 IP，无法在小程序内直接打开，页面会显示为空白。
      </text>
      <view class="url-box">
        <text class="url-label">测评地址</text>
        <text class="url-value">{{ targetUrl }}</text>
      </view>
      <view class="actions">
        <button class="btn primary" @tap="copyLink">复制链接，到浏览器打开</button>
        <button class="btn outline" @tap="tryEmbedAnyway">仍尝试内嵌打开</button>
        <button class="btn ghost" @tap="goBack">返回</button>
      </view>
      <text class="footer-tip">
        开发者工具请勾选「不校验合法域名 / web-view 业务域名」。正式环境请把测评站部署到 HTTPS 域名，并在公众平台配置业务域名。
      </text>
    </view>

    <!-- 可内嵌：直接打开 -->
    <web-view v-else-if="mode === 'embed' && targetUrl" :src="targetUrl" @error="onWebViewError" />

    <!-- 加载中 / 缺少地址 -->
    <view v-else class="card">
      <text class="title">{{ pageTitle || '心理测评' }}</text>
      <text class="desc">{{ targetUrl ? '正在打开…' : '缺少测评链接，请返回重试。' }}</text>
      <button class="btn ghost" @tap="goBack">返回</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const STORAGE_URL_KEY = 'assessment_webview_url'
const STORAGE_TITLE_KEY = 'assessment_webview_title'

const targetUrl = ref('')
const pageTitle = ref('心理测评')
const mode = ref<'loading' | 'embed' | 'fallback'>('loading')

const isIpHost = (hostname: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost' || hostname === '127.0.0.1'

/** 微信 web-view：正式环境需 HTTPS 域名；IP / http 通常白屏 */
const canEmbedInMpWebView = (url: string) => {
  try {
    // 简易解析，避免依赖 URL 构造在部分运行时异常
    const m = url.match(/^(https?):\/\/([^/:]+)(?::(\d+))?/i)
    if (!m) return false
    const protocol = m[1].toLowerCase()
    const host = m[2].toLowerCase()
    if (protocol !== 'https') return false
    if (isIpHost(host)) return false
    return true
  } catch {
    return false
  }
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.redirectTo({ url: '/pages/test/index' })
}

const copyLink = () => {
  if (!targetUrl.value) return
  uni.setClipboardData({
    data: targetUrl.value,
    success: () => {
      uni.showModal({
        title: '链接已复制',
        content: '请打开手机浏览器，粘贴地址即可访问测评页。',
        showCancel: false,
      })
    },
  })
}

const tryEmbedAnyway = () => {
  if (!targetUrl.value) return
  mode.value = 'embed'
}

const onWebViewError = () => {
  mode.value = 'fallback'
  uni.showToast({ title: '网页打开失败', icon: 'none' })
}

const resolveUrl = (opts?: Record<string, string | undefined>) => {
  let raw = ''
  if (opts?.url) {
    try {
      raw = decodeURIComponent(String(opts.url))
    } catch {
      raw = String(opts.url)
    }
  }
  if (!raw) {
    try {
      raw = String(uni.getStorageSync(STORAGE_URL_KEY) || '')
    } catch {
      raw = ''
    }
  }
  // 丢弃历史错误地址（旧 IP / HTTP），避免缓存导致仍打开旧测评站
  if (raw && (/124\.221\.56\.121/i.test(raw) || /^http:\/\//i.test(raw))) {
    raw = ''
    try {
      uni.removeStorageSync(STORAGE_URL_KEY)
    } catch {
      /* ignore */
    }
  }
  let title = ''
  if (opts?.title) {
    try {
      title = decodeURIComponent(String(opts.title))
    } catch {
      title = String(opts.title)
    }
  }
  if (!title) {
    try {
      title = String(uni.getStorageSync(STORAGE_TITLE_KEY) || '')
    } catch {
      title = ''
    }
  }
  return { raw, title }
}

onLoad((opts) => {
  const { raw, title } = resolveUrl(opts as Record<string, string | undefined>)
  targetUrl.value = raw
  pageTitle.value = title || '心理测评'
  uni.setNavigationBarTitle({ title: pageTitle.value })

  if (!targetUrl.value) {
    mode.value = 'fallback'
    uni.showToast({ title: '缺少测评链接', icon: 'none' })
    return
  }

  // 微信 web-view 正式环境需 HTTPS 域名；http / IP 会白屏，改走兜底说明页
  if (!canEmbedInMpWebView(targetUrl.value)) {
    mode.value = 'fallback'
    return
  }

  mode.value = 'embed'
})
</script>

<style scoped>
.page-webview {
  width: 100%;
  min-height: 100vh;
  background: #F7F5F2;
}

web-view {
  width: 100%;
  height: 100vh;
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
  font-size: 28rpx;
  font-weight: 700;
}

.btn::after { border: none; }

.btn.primary {
  background: #3D5A4E;
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
