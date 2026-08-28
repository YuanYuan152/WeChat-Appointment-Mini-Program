<template>
  <view class="page-content-detail">
    <view v-if="loading" class="empty-wrap">
      <text class="empty-text">加载中...</text>
    </view>
    <view v-else-if="detail" class="detail-wrap">
      <view class="detail-header">
        <text class="detail-title">{{ detail.title }}</text>
      </view>
      <view class="detail-body">
        <text
          v-for="(p, pIdx) in detail.paragraphs"
          :key="pIdx"
          class="paragraph"
        >{{ p }}</text>
      </view>
    </view>
    <view v-else class="empty-wrap">
      <text class="empty-text">内容不存在或已下架</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { CONTENT_DETAILS } from '@/constants/siteContent'
import {
  bodyToParagraphs,
  fetchSiteGuideItem,
} from '@/utils/siteContentApi'

const loading = ref(true)
const detail = ref<{ title: string; paragraphs: string[] } | null>(null)

onLoad(async (options) => {
  loading.value = true
  detail.value = null

  const rawId = options?.id
  const guideId = rawId ? Number(rawId) : 0
  const legacyKey = (options?.key || '').trim()

  if (guideId > 0) {
    const remote = await fetchSiteGuideItem(guideId)
    if (remote?.title) {
      detail.value = {
        title: remote.title,
        paragraphs: bodyToParagraphs(remote.body || remote.summary || ''),
      }
      uni.setNavigationBarTitle({ title: remote.title })
      loading.value = false
      return
    }
  }

  if (legacyKey && CONTENT_DETAILS[legacyKey]) {
    const legacy = CONTENT_DETAILS[legacyKey]
    detail.value = {
      title: legacy.title,
      paragraphs: legacy.sections.flatMap((section) => section.paragraphs),
    }
    uni.setNavigationBarTitle({ title: legacy.title })
  }

  loading.value = false
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
