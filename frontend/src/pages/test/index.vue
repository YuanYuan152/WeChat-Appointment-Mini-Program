<template>
  <view class="page-test-hub">
    <view class="hero">
      <text class="hero-title">心理测评</text>
      <text class="hero-sub">登录后可填写量表、查看自己的测评报告；更多专业量表可跳转测评站填写</text>
    </view>

    <view class="card link-card" @tap="goResults">
      <view class="link-left">
        <text class="link-title">我的量表结果</text>
        <text class="link-desc">查看已完成的 PHQ-9 / GAD-7 测评报告</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <view v-if="loggedIn && recentResults.length" class="recent-block">
      <view class="section-head">
        <text class="section-title">最近报告</text>
        <text class="section-more" @tap="goResults">全部 ›</text>
      </view>
      <view
        v-for="item in recentResults"
        :key="item.id"
        class="card report-preview"
        @tap="openResult(item)"
      >
        <view class="preview-badge">小程序量表</view>
        <text class="preview-title">{{ item.scaleLabel }}</text>
        <text class="preview-summary">{{ item.resultSummary || formatSummary(item) }}</text>
        <text class="preview-time">{{ formatDT(item.createdAt) }}</text>
        <text class="preview-action">查看报告 ›</text>
      </view>
    </view>

    <text class="section-title">小程序内量表</text>
    <view
      v-for="scale in SCALE_LIST"
      :key="scale.type"
      class="card scale-card"
      @tap="goScale(scale.type)"
    >
      <text class="scale-name">{{ scale.title }}</text>
      <text class="scale-sub">{{ scale.subtitle }}</text>
      <text class="scale-desc">{{ scale.questionCount }} 道题 · 约 {{ scale.duration }} 分钟</text>
      <text class="scale-action">开始测评 ›</text>
    </view>

    <text class="section-title">更多专业测评（外链填写）</text>
    <text class="section-hint">以下量表在测评站填写，完成后可在测评站「我的报告」查看</text>
    <view
      v-for="item in EXTERNAL_ASSESSMENT_LIST"
      :key="item.id"
      class="card external-card"
    >
      <view class="external-head">
        <text class="external-badge" :class="item.category">{{ item.categoryLabel }}</text>
        <text class="external-meta">{{ item.questionCount }} 题 · 约 {{ item.duration }} 分钟</text>
      </view>
      <text class="external-title">{{ item.title }}</text>
      <text class="external-sub">{{ item.subtitle }}</text>
      <view class="external-actions">
        <button class="ext-btn primary" @click.stop="openExternal(item)">去填写</button>
        <button class="ext-btn outline" @click.stop="copyExternalLink(item)">复制链接</button>
      </view>
    </view>

    <view class="card link-card muted" @tap="openExternalReports">
      <view class="link-left">
        <text class="link-title">测评站 · 我的报告</text>
        <text class="link-desc">查看在测评站完成的专业/趣味测评报告</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <view class="tip-card">
      <text class="tip-text">测评结果仅供参考，不能替代专业诊断。如有需要，请预约咨询师进一步评估。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { isLoggedIn } from '@/utils/auth'
import {
  SCALE_LIST,
  buildResultSummary,
  enrichScaleResult,
  type ScaleResult,
  type ScaleType,
} from '@/constants/psychScales'
import {
  EXTERNAL_ASSESSMENT_LIST,
  buildAssessmentFillUrl,
  buildAssessmentReportsUrl,
  type ExternalAssessmentItem,
} from '@/constants/psychAssessmentCatalog'

const loggedIn = ref(false)
const recentResults = ref<ScaleResult[]>([])

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '—')
const formatSummary = (item: ScaleResult) => buildResultSummary(item)

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

const loadRecent = async () => {
  loggedIn.value = isLoggedIn()
  if (!loggedIn.value) {
    recentResults.value = []
    return
  }
  try {
    const res = await httpV2.get<ScaleResult[]>(API_ENDPOINTS.patient.scales)
    if (res.code === 0 && Array.isArray(res.data)) {
      recentResults.value = res.data.slice(0, 3).map(enrichScaleResult)
    }
  } catch {
    recentResults.value = []
  }
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

const openResult = (item: ScaleResult) => {
  uni.navigateTo({ url: `/pages/test/result-detail?id=${item.id}` })
}

const openExternal = (item: ExternalAssessmentItem) => {
  const url = buildAssessmentFillUrl(item)
  uni.navigateTo({
    url: `/pages/test/webview?url=${encodeURIComponent(url)}&title=${encodeURIComponent(item.title)}`,
  })
}

const copyExternalLink = (item: ExternalAssessmentItem) => {
  const url = buildAssessmentFillUrl(item)
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
  })
}

const openExternalReports = () => {
  const url = buildAssessmentReportsUrl()
  uni.navigateTo({
    url: `/pages/test/webview?url=${encodeURIComponent(url)}&title=${encodeURIComponent('我的测评报告')}`,
  })
}

onShow(loadRecent)
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
.link-card.muted { background: #F8FAFC; }
.link-card:active, .scale-card:active, .report-preview:active, .external-card:active { opacity: 0.92; }
.link-title { display: block; font-size: 30rpx; font-weight: 700; color: #3D5A4E; }
.link-desc { display: block; margin-top: 8rpx; font-size: 24rpx; color: #9CA3AF; }
.arrow { font-size: 36rpx; color: #C9A96E; }
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8rpx 0 16rpx 8rpx;
}
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #6B6560;
  margin: 8rpx 0 16rpx 8rpx;
}
.section-more { font-size: 24rpx; color: #3D5A4E; }
.section-hint {
  display: block;
  margin: -8rpx 0 16rpx 8rpx;
  font-size: 22rpx;
  color: #9CA3AF;
  line-height: 1.5;
}
.recent-block { margin-bottom: 8rpx; }
.preview-badge {
  display: inline-block;
  font-size: 20rpx;
  color: #3D5A4E;
  background: rgba(61,90,78,0.1);
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  margin-bottom: 12rpx;
}
.preview-title { display: block; font-size: 30rpx; font-weight: 700; color: #2C2C2C; }
.preview-summary { display: block; margin-top: 8rpx; font-size: 26rpx; color: #3D5A4E; font-weight: 600; }
.preview-time { display: block; margin-top: 8rpx; font-size: 22rpx; color: #9CA3AF; }
.preview-action { display: block; margin-top: 16rpx; font-size: 26rpx; color: #3D5A4E; font-weight: 600; }
.scale-name { display: block; font-size: 32rpx; font-weight: 700; color: #2C2C2C; }
.scale-sub { display: block; margin-top: 6rpx; font-size: 24rpx; color: #6B7280; }
.scale-desc { display: block; margin-top: 8rpx; font-size: 24rpx; color: #9CA3AF; }
.scale-action { display: block; margin-top: 16rpx; font-size: 26rpx; color: #3D5A4E; font-weight: 600; }
.external-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.external-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  color: #fff;
  background: #3D5A4E;
}
.external-badge.fun { background: #C9A96E; }
.external-meta { font-size: 22rpx; color: #9CA3AF; }
.external-title { display: block; font-size: 30rpx; font-weight: 700; color: #2C2C2C; }
.external-sub { display: block; margin-top: 8rpx; font-size: 24rpx; color: #6B7280; line-height: 1.5; }
.external-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
.ext-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 100rpx;
  font-size: 26rpx;
  font-weight: 600;
}
.ext-btn::after { border: none; }
.ext-btn.primary { background: #3D5A4E; color: #fff; }
.ext-btn.outline { background: #fff; color: #3D5A4E; border: 2rpx solid #3D5A4E; }
.tip-card {
  background: #FFFBEB;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 8rpx;
}
.tip-text { font-size: 24rpx; color: #92400E; line-height: 1.7; }
</style>
