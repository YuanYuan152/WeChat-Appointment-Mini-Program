<template>
  <view class="page-search">
    <view class="search-box">
      <input
        class="search-input"
        v-model.trim="keyword"
        confirm-type="search"
        placeholder="搜索咨询师、文章、活动"
        @confirm="doSearch"
      />
      <button class="search-btn" @click="doSearch">搜索</button>
    </view>

    <view v-if="!searched" class="tips-card">
      <text class="tips-title">你可以搜索</text>
      <text class="tips-item">咨询师姓名、擅长方向、心理知识、活动主题</text>
    </view>

    <view v-else-if="isEmpty" class="empty-state">
      <text class="empty-text">未找到相关结果</text>
    </view>

    <view v-else class="result-wrap">
      <view v-if="result.counselors.length" class="section">
        <text class="section-title">咨询师</text>
        <view
          v-for="item in result.counselors"
          :key="`c-${item._source}-${item.id}`"
          class="counselor-card"
          @click="goCounselor(item)"
        >
          <image class="avatar" :src="item.avatarUrl || defaultAvatar" mode="aspectFill" />
          <view class="card-main">
            <text class="name">{{ item.name || item.nickname || '咨询师' }}</text>
            <text class="desc">{{ item.specialty || item.field || '心理咨询' }}</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>

      <view v-if="result.articles.length" class="section">
        <text class="section-title">文章</text>
        <view
          v-for="item in result.articles"
          :key="`a-${item._source}-${item.id}`"
          class="article-card"
          @click="goArticle(item)"
        >
          <view class="card-main">
            <text class="article-title">{{ item.title }}</text>
            <text class="desc">{{ item.summary || item.source || '心理知识' }}</text>
          </view>
          <image v-if="item.coverUrl" class="cover" :src="item.coverUrl" mode="aspectFill" />
        </view>
      </view>

      <view v-if="result.activities.length" class="section">
        <text class="section-title">活动</text>
        <view
          v-for="item in result.activities"
          :key="`act-${item.id}`"
          class="article-card"
          @click="goActivity(item)"
        >
          <view class="card-main">
            <text class="article-title">{{ item.title }}</text>
            <text class="desc">{{ item.summary || item.type || '活动' }}</text>
          </view>
          <image v-if="item.coverUrl" class="cover" :src="item.coverUrl" mode="aspectFill" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface SearchItem {
  id: number
  title?: string
  name?: string
  nickname?: string
  summary?: string
  source?: string
  coverUrl?: string
  avatarUrl?: string
  specialty?: string
  field?: string
  type?: string
  _source?: string
}

interface SearchResult {
  keyword: string
  counselors: SearchItem[]
  articles: SearchItem[]
  activities: SearchItem[]
}

const keyword = ref('')
const searched = ref(false)
const loading = ref(false)
const defaultAvatar = '/static/images/default-avatar.png'
const result = ref<SearchResult>({
  keyword: '',
  counselors: [],
  articles: [],
  activities: [],
})

const isEmpty = computed(() =>
  !result.value.counselors.length &&
  !result.value.articles.length &&
  !result.value.activities.length
)

const doSearch = async () => {
  if (!keyword.value) {
    uni.showToast({ title: '请输入关键词', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await httpV2.get<SearchResult>(
      API_ENDPOINTS.common.search,
      { q: keyword.value },
      { showLoading: true }
    )
    if (res.code === 0 && res.data) {
      result.value = {
        keyword: res.data.keyword,
        counselors: res.data.counselors || [],
        articles: res.data.articles || [],
        activities: res.data.activities || [],
      }
      searched.value = true
    } else {
      uni.showToast({ title: res.msg || '搜索失败', icon: 'none' })
    }
  } finally {
    loading.value = false
  }
}

const goCounselor = (item: SearchItem) => {
  uni.navigateTo({
    url: `/pages/consultant/detail?id=${item.id}&source=${item._source || ''}`
  })
}

const goArticle = (item: SearchItem) => {
  uni.navigateTo({
    url: `/pages/article/detail?id=${item.id}&source=${item._source || 'AppArticle'}`
  })
}

const goActivity = (item: SearchItem) => {
  uni.navigateTo({
    url: `/pages/activity/list?highlight=${item.id}`
  })
}
</script>

<style scoped>
.page-search {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 28rpx;
}

.search-box {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-bottom: 28rpx;
}

.search-input {
  flex: 1;
  height: 80rpx;
  background: #fff;
  border-radius: 100rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
  color: #1F2937;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.search-btn {
  width: 140rpx;
  height: 80rpx;
  line-height: 80rpx;
  margin: 0;
  border: none;
  border-radius: 100rpx;
  background: #0D9488;
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
}

.tips-card,
.empty-state {
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 36rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.tips-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 16rpx;
}

.tips-item,
.empty-text {
  font-size: 28rpx;
  color: #6B7280;
}

.section {
  margin-bottom: 32rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: #1F2937;
  margin: 10rpx 0 18rpx;
}

.counselor-card,
.article-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #E5E7EB;
  flex-shrink: 0;
}

.cover {
  width: 140rpx;
  height: 100rpx;
  border-radius: 16rpx;
  background: #E5E7EB;
  flex-shrink: 0;
}

.card-main {
  flex: 1;
  min-width: 0;
}

.name,
.article-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1F2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6B7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: #9CA3AF;
  font-size: 44rpx;
  flex-shrink: 0;
}
</style>
