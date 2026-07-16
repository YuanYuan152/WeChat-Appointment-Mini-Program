<template>
  <view class="page-highlights">
    <view class="page-header">
      <text class="page-title">往期精华</text>
      <text class="page-desc">回顾连心心理历年优质内容与活动</text>
    </view>

    <view class="card-list">
      <view
        class="content-card"
        v-for="item in cards"
        :key="item.id"
        @click="openCard(item)"
      >
        <image
          v-if="item.image"
          :src="item.image"
          class="card-cover"
          mode="aspectFill"
        />
        <view class="card-body">
          <view class="card-top">
            <text v-if="item.tag" class="card-tag">{{ item.tag }}</text>
            <text v-if="item.date" class="card-date">{{ item.date }}</text>
          </view>
          <text class="card-title">{{ item.title }}</text>
          <text class="card-summary">{{ item.summary }}</text>
          <view class="card-foot">
            <text class="read-more">阅读详情 ›</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { HIGHLIGHT_CARDS, type ContentCard } from '@/constants/siteContent'

const cards = ref<ContentCard[]>([...HIGHLIGHT_CARDS])

const mapArticleToCard = (a: any): ContentCard => ({
  id: `article-${a.id}`,
  title: a.title || '未命名',
  summary: a.summary || a.content?.slice(0, 80) || '',
  date: a.publishedAt ? String(a.publishedAt).slice(0, 7) : undefined,
  tag: a.category || '文章',
  image: a.coverUrl || '/static/images-opt/slide11.jpg',
  articleId: a.id,
})

const loadArticles = async () => {
  try {
    const res = await httpV2.get<any[]>(API_ENDPOINTS.common.articles, { category: '知识' }, {
      showLoading: false,
      showError: false,
    })
    if (res.code === 0 && Array.isArray(res.data) && res.data.length > 0) {
      const fromApi = res.data.map(mapArticleToCard)
      cards.value = [...fromApi, ...HIGHLIGHT_CARDS]
    }
  } catch {
    // 保留静态卡片
  }
}

const openCard = (item: ContentCard) => {
  if (item.articleId) {
    uni.navigateTo({ url: `/pages/article/detail?id=${item.articleId}` })
    return
  }
  uni.navigateTo({ url: `/pages/content/detail?key=${item.id}` })
}

onMounted(loadArticles)
</script>

<style scoped>
.page-highlights {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
  padding-bottom: 60rpx;
}

.page-header {
  padding: 16rpx 0 32rpx;
}

.page-title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #1F2937;
}

.page-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #6B7280;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.content-card {
  background: #fff;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.04);
}

.content-card:active {
  opacity: 0.92;
}

.card-cover {
  width: 100%;
  height: 280rpx;
  background: #E5E7EB;
}

.card-body {
  padding: 28rpx 32rpx 32rpx;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.card-tag {
  font-size: 22rpx;
  color: #0D9488;
  background: #F0FDFA;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 600;
}

.card-date {
  font-size: 22rpx;
  color: #9CA3AF;
}

.card-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: #1F2937;
  line-height: 1.4;
  margin-bottom: 12rpx;
}

.card-summary {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.card-foot {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed #E5E7EB;
}

.read-more {
  font-size: 26rpx;
  color: #0D9488;
  font-weight: 600;
}
</style>
