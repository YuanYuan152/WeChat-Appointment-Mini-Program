<template>
  <view class="page-search">
    <view class="search-box">
      <input
        class="search-input"
        v-model.trim="keyword"
        confirm-type="search"
        placeholder="搜索咨询师、文章、活动"
        placeholder-class="input-ph"
        @confirm="doSearch"
      />
      <view class="search-btn" @tap="doSearch">搜索</view>
    </view>

    <view v-if="loading" class="tips-card">
      <text class="tips-item">搜索中...</text>
    </view>

    <view v-else-if="!searched" class="tips-card">
      <text class="tips-title">你可以搜索</text>
      <text class="tips-item">咨询师姓名、咨询流派、心理知识、活动主题</text>
      <view v-if="history.length" class="history-block">
        <view class="history-head">
          <text class="history-title">最近搜索</text>
          <text class="history-clear" @tap="clearHistory">清空</text>
        </view>
        <view class="history-tags">
          <text
            v-for="item in history"
            :key="item"
            class="history-tag"
            @tap="searchFromHistory(item)"
          >{{ item }}</text>
        </view>
      </view>
    </view>

    <view v-else-if="isEmpty" class="empty-state">
      <text class="empty-text">未找到「{{ keyword }}」相关结果</text>
      <text class="empty-hint">试试咨询师姓名、擅长领域或活动关键词</text>
    </view>

    <view v-else class="result-wrap">
      <view v-if="result.counselors.length" class="section">
        <text class="section-title">咨询师（{{ result.counselors.length }}）</text>
        <view
          v-for="item in result.counselors"
          :key="`c-${item._source}-${item.id}`"
          class="counselor-card"
          @tap="goCounselor(item)"
        >
          <image class="avatar" :src="resolveCounselorPublicAvatar(item.avatarUrl)" mode="aspectFill" />
          <view class="card-main">
            <text class="name">{{ item.name || item.nickname || '咨询师' }}</text>
            <text class="desc">{{ item.specialty || item.field || item.title || '心理咨询' }}</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>

      <view v-if="result.articles.length" class="section">
        <text class="section-title">文章（{{ result.articles.length }}）</text>
        <view
          v-for="item in result.articles"
          :key="`a-${item._source}-${item.id}`"
          class="article-card"
          @tap="goArticle(item)"
        >
          <view class="card-main">
            <text class="article-title">{{ item.title }}</text>
            <text class="desc">{{ item.summary || item.source || '心理知识' }}</text>
          </view>
          <image v-if="item.coverUrl" class="cover" :src="fixUrl(item.coverUrl)" mode="aspectFill" />
        </view>
      </view>

      <view v-if="result.activities.length" class="section">
        <text class="section-title">活动（{{ result.activities.length }}）</text>
        <view
          v-for="item in result.activities"
          :key="`act-${item.id}`"
          class="article-card"
          @tap="goActivity(item)"
        >
          <view class="card-main">
            <text class="article-title">{{ item.title }}</text>
            <text class="desc">{{ item.summary || item.type || '活动' }}</text>
          </view>
          <image v-if="item.coverUrl" class="cover" :src="fixUrl(item.coverUrl)" mode="aspectFill" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { fixImageUrl, resolveCounselorPublicAvatar, DEFAULT_COUNSELOR_PUBLIC_AVATAR } from '@/utils/image'

interface SearchItem {
  id: number
  name?: string
  nickname?: string
  summary?: string
  source?: string
  coverUrl?: string
  avatarUrl?: string
  specialty?: string
  field?: string
  title?: string
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
const history = ref<string[]>([])
const defaultAvatar = DEFAULT_COUNSELOR_PUBLIC_AVATAR
const result = ref<SearchResult>({
  keyword: '',
  counselors: [],
  articles: [],
  activities: [],
})

const fixUrl = (u?: string) => (u ? fixImageUrl(u) : '')

const isEmpty = computed(() =>
  !result.value.counselors.length &&
  !result.value.articles.length &&
  !result.value.activities.length
)

const loadHistory = () => {
  try {
    history.value = uni.getStorageSync('searchHistory') || []
  } catch {
    history.value = []
  }
}

const saveHistory = (q: string) => {
  try {
    let list: string[] = uni.getStorageSync('searchHistory') || []
    list = [q, ...list.filter((x) => x !== q)].slice(0, 10)
    uni.setStorageSync('searchHistory', list)
    history.value = list
  } catch { /* ignore */ }
}

const clearHistory = () => {
  uni.removeStorageSync('searchHistory')
  history.value = []
}

const searchFromHistory = (q: string) => {
  keyword.value = q
  doSearch()
}

const doSearch = async () => {
  if (!keyword.value) {
    uni.showToast({ title: '请输入关键词', icon: 'none' })
    return
  }
  loading.value = true
  searched.value = true
  try {
    const res = await httpV2.get<SearchResult>(
      API_ENDPOINTS.common.search,
      { q: keyword.value },
      { showLoading: false }
    )
    if (res.code === 0 && res.data) {
      result.value = {
        keyword: res.data.keyword || keyword.value,
        counselors: res.data.counselors || [],
        articles: res.data.articles || [],
        activities: res.data.activities || [],
      }
      saveHistory(keyword.value)
      if (isEmpty.value) {
        uni.showToast({ title: '未找到相关结果', icon: 'none' })
      }
    } else {
      uni.showToast({ title: res.msg || '搜索失败', icon: 'none' })
      result.value = { keyword: keyword.value, counselors: [], articles: [], activities: [] }
    }
  } catch {
    uni.showToast({ title: '搜索失败，请检查网络', icon: 'none' })
    result.value = { keyword: keyword.value, counselors: [], articles: [], activities: [] }
  } finally {
    loading.value = false
  }
}

const goCounselor = (item: SearchItem) => {
  if (!item.id) return
  const source = item._source || 'AppCounselorProfile'
  uni.navigateTo({
    url: `/pages/consultant/detail?id=${item.id}&source=${encodeURIComponent(source)}`,
  })
}

const goArticle = (item: SearchItem) => {
  uni.navigateTo({
    url: `/pages/article/detail?id=${item.id}&source=${item._source || 'AppArticle'}`,
  })
}

const goActivity = (item: SearchItem) => {
  uni.navigateTo({
    url: `/pages/activity/list?highlight=${item.id}`,
  })
}

onLoad((opts) => {
  loadHistory()
  const q = opts?.q ? decodeURIComponent(opts.q) : ''
  if (q) {
    keyword.value = q
    doSearch()
  }
})
</script>

<style scoped>
.page-search {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 28rpx;
}

.search-box {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-bottom: 28rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 12rpx 12rpx 12rpx 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}

.search-input {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 28rpx;
  color: #2C2C2C;
}

.input-ph { color: #B0B0B0; font-size: 28rpx; }

.search-btn {
  flex-shrink: 0;
  padding: 0 28rpx;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 12rpx;
  background: #3D5A4E;
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
}

.tips-card,
.empty-state {
  background: #fff;
  border-radius: 20rpx;
  padding: 48rpx 36rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}

.tips-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #2C2C2C;
  margin-bottom: 16rpx;
}

.tips-item,
.empty-text {
  font-size: 28rpx;
  color: #8A8A8A;
  line-height: 1.6;
}

.empty-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #B0B0B0;
}

.history-block { margin-top: 32rpx; }
.history-head { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.history-title { font-size: 26rpx; color: #8A8A8A; }
.history-clear { font-size: 24rpx; color: #3D5A4E; }
.history-tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.history-tag {
  background: #F0EDE8; color: #5A5A5A;
  font-size: 24rpx; padding: 10rpx 20rpx; border-radius: 8rpx;
}

.section { margin-bottom: 32rpx; }

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #2C2C2C;
  margin: 10rpx 0 18rpx;
}

.counselor-card,
.article-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #E8E4DE;
  flex-shrink: 0;
}

.cover {
  width: 140rpx;
  height: 100rpx;
  border-radius: 12rpx;
  background: #E8E4DE;
  flex-shrink: 0;
}

.card-main { flex: 1; min-width: 0; }

.name,
.article-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #2C2C2C;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8A8A8A;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: #C8C4BE;
  font-size: 44rpx;
  flex-shrink: 0;
}
</style>
