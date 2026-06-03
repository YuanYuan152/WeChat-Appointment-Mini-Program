<template>
  <view class="page-article">
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="article" class="article-wrap">
      <view class="article-header">
        <text class="article-title">{{ article.title }}</text>
        <view class="article-meta">
          <text class="article-date">{{ article.publishDate }}</text>
          <text class="article-author" v-if="article.author">{{ article.author }}</text>
        </view>
        <image v-if="article.coverImage" :src="article.coverImage" class="article-cover" mode="aspectFill" />
      </view>

      <view class="article-body">
        <!-- uni-app 富文本渲染 -->
        <rich-text :nodes="richNodes" class="rich-content"></rich-text>
      </view>
    </view>
    <view v-else class="error-wrap">
      <text class="error-text">内容加载失败，请稍后重试</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS, API_V2_CONFIG } from '@/config/api'

interface Article {
  id: number
  title: string
  content: string       // 可能是 HTML 富文本
  publishDate: string
  author?: string
  coverImage?: string
}

const loading = ref(true)
const article = ref<Article | null>(null)

/** 将 HTML 字符串中的图片路径转为绝对 URL */
const fixImageUrls = (html: string): string => {
  const baseUrl = API_V2_CONFIG.baseURL || ''
  return html.replace(/src="(?!https?:\/\/)([^"]+)"/g, `src="${baseUrl}$1"`)
}

/** 供 rich-text 使用的 nodes */
const richNodes = computed(() => {
  if (!article.value?.content) return ''
  return fixImageUrls(article.value.content)
})

onMounted(async () => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const id = current?.options?.id

  if (!id) {
    loading.value = false
    return
  }

  try {
    const res = await httpV2.get<any>(API_ENDPOINTS.common.articleDetail(id), {
      source: current?.options?.source || 'AppArticle',
    })
    if (res.code === 0 && res.data) {
      article.value = {
        id: res.data.id,
        title: res.data.title,
        content: res.data.content || '',
        publishDate: res.data.publishedAt || '',
        author: res.data.author || res.data.source,
        coverImage: res.data.coverUrl,
      }
    }
  } catch (e) {
    console.error('文章加载失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-article { padding: 32rpx; background: #fff; min-height: 100vh; }

.loading-wrap, .error-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.loading-text, .error-text { font-size: 28rpx; color: #9CA3AF; }

.article-header { margin-bottom: 40rpx; }

.article-title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #1F2937;
  line-height: 1.4;
  margin-bottom: 24rpx;
}

.article-meta {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}
.article-date, .article-author {
  font-size: 26rpx;
  color: #9CA3AF;
}

.article-cover {
  width: 100%;
  height: 400rpx;
  border-radius: 24rpx;
  object-fit: cover;
}

.article-body { margin-top: 40rpx; }

.rich-content {
  font-size: 30rpx;
  line-height: 1.8;
  color: #374151;
  word-break: break-word;
}
</style>
