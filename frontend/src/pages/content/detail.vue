<template>
  <view class="page-content-detail">
    <view v-if="detail" class="detail-wrap">
      <view class="detail-header">
        <text class="detail-title">{{ detail.title }}</text>
        <text v-if="detail.subtitle" class="detail-subtitle">{{ detail.subtitle }}</text>
      </view>
      <view class="detail-body">
        <view v-for="(section, idx) in detail.sections" :key="idx" class="section-block">
          <text v-if="section.heading" class="section-heading">{{ section.heading }}</text>
          <text
            v-for="(p, pIdx) in section.paragraphs"
            :key="pIdx"
            class="paragraph"
          >{{ p }}</text>
        </view>
      </view>
    </view>
    <view v-else class="empty-wrap">
      <text class="empty-text">内容不存在或已下架</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CONTENT_DETAILS, type ContentDetail } from '@/constants/siteContent'

const detail = ref<ContentDetail | null>(null)

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const key = current?.options?.key || ''
  detail.value = CONTENT_DETAILS[key] || null
  if (detail.value?.title) {
    uni.setNavigationBarTitle({ title: detail.value.title })
  }
})
</script>

<style scoped>
.page-content-detail {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
}

.detail-wrap {
  background: #fff;
  border-radius: 28rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.05);
}

.detail-header {
  padding-bottom: 32rpx;
  border-bottom: 1rpx solid #F3F4F6;
  margin-bottom: 32rpx;
}

.detail-title {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: #1F2937;
  line-height: 1.4;
}

.detail-subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #0D9488;
  font-weight: 600;
}

.section-block {
  margin-bottom: 32rpx;
}

.section-block:last-child {
  margin-bottom: 0;
}

.section-heading {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0D9488;
  margin-bottom: 16rpx;
}

.paragraph {
  display: block;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.85;
  margin-bottom: 16rpx;
}

.paragraph:last-child {
  margin-bottom: 0;
}

.empty-wrap {
  padding: 120rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #9CA3AF;
}
</style>
