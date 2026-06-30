<template>
  <view class="page-index">
    <!-- 顶部氛围大图 -->
    <view class="hero-wrap">
      <image class="hero-bg" src="/static/images/slide11.png" mode="aspectFill" />
      <view class="hero-mask" />
      <view class="hero-content">
        <text class="hero-brand">连心心理</text>
        <text class="hero-sub">专业 · 温暖 · 可信</text>
      </view>
    </view>

    <!-- 悬浮预约卡片（亚朵风格） -->
    <view class="float-card">
      <view class="search-bar">
        <view class="search-divider" />
        <input
          class="search-input"
          placeholder="搜索咨询师、文章、活动"
          placeholder-class="search-placeholder"
          v-model="searchKeyword"
          confirm-type="search"
          @input="handleSearchInput"
          @confirm="goSearchPage"
          @focus="showSearchSuggestions"
          @blur="hideSearchSuggestions"
        />
        <view class="search-action" @tap="() => goSearchPage()">搜索</view>

        <view v-if="showSuggestions && (searchKeyword || searchHistory.length > 0)" class="search-suggestions">
          <view v-if="searchHistory.length > 0 && !searchKeyword" class="suggestion-section">
            <view class="suggestion-header">
              <text class="suggestion-title">搜索历史</text>
              <text class="clear-history" @tap="clearSearchHistory">清空</text>
            </view>
            <view class="suggestion-list row">
              <text class="suggestion-tag" v-for="(item, index) in searchHistory" :key="index" @tap="selectHistoryItem(item)">{{ item }}</text>
            </view>
          </view>
          <view v-if="searchKeyword && filteredSuggestions.length > 0" class="suggestion-section">
            <view class="suggestion-header"><text class="suggestion-title">搜索建议</text></view>
            <view class="suggestion-list column">
              <text class="suggestion-item" v-for="(item, index) in filteredSuggestions" :key="index" @tap="selectSuggestionItem(item)">{{ item }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="primary-cta" @tap="navigateTo('/pages/consultant/list')">
        <view class="cta-left">
          <text class="cta-title">预约咨询</text>
          <text class="cta-desc">专业心理支持</text>
        </view>
        <view class="cta-btn">
          <text>立即预约</text>
          <view class="cta-tag">推荐</view>
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-row">
      <view class="quick-item" @tap="navigateTo('/pages/highlights/index')">
        <view class="quick-icon"><text class="quick-symbol">精</text></view>
        <text class="quick-label">往期精华</text>
      </view>
      <view class="quick-item" @tap="navigateTo('/pages/consultation/guide')">
        <view class="quick-icon"><text class="quick-symbol">询</text></view>
        <text class="quick-label">了解咨询</text>
      </view>
      <view class="quick-item" @tap="navigateTo('/pages/contact/index')">
        <view class="quick-icon"><text class="quick-symbol">联</text></view>
        <text class="quick-label">联系我们</text>
      </view>
      <view class="quick-item" @tap="navigateTo('/pages/jixinli/index')">
        <view class="quick-icon"><text class="quick-symbol">济</text></view>
        <text class="quick-label">济心理</text>
      </view>
    </view>

    <!-- 轮播推荐 -->
    <view class="section-block" v-if="banners.length">
      <view class="section-head">
        <text class="section-title">精选推荐</text>
      </view>
      <view class="banner-section">
        <swiper
          class="banner-swiper"
          :indicator-dots="true"
          indicator-color="rgba(61,90,78,0.2)"
          indicator-active-color="#3D5A4E"
          :autoplay="true"
          :interval="4000"
          :duration="500"
          circular
        >
          <swiper-item v-for="banner in banners" :key="banner.id" @tap="handleBannerClick(banner)">
            <view class="banner-item">
              <image :src="banner.image" class="banner-image" mode="aspectFill" />
              <view class="banner-overlay">
                <button class="banner-btn" @tap.stop="handleBannerAction(banner)">
                  {{ banner.buttonText }}
                </button>
              </view>
            </view>
          </swiper-item>
        </swiper>
      </view>
    </view>

    <!-- 服务入口 -->
    <view class="section-block">
      <view class="section-head">
        <text class="section-title">探索服务</text>
      </view>
      <view class="service-list">
        <view class="service-card" @tap="goPsychTest">
          <view class="service-icon"><text>测</text></view>
          <view class="service-body">
            <text class="service-name">心理测评</text>
            <text class="service-desc">探索未知的自己</text>
          </view>
          <text class="service-arrow">›</text>
        </view>
        <view class="service-card" @tap="navigateTo('/pages/activity/list')">
          <view class="service-icon gold"><text>活</text></view>
          <view class="service-body">
            <text class="service-name">精彩活动</text>
            <text class="service-desc">团体沙龙体验</text>
          </view>
          <text class="service-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 专业咨询师 -->
    <view class="section-block">
      <view class="section-head">
        <text class="section-title">专业咨询师</text>
        <text class="section-more" @tap="navigateTo('/pages/consultant/list')">全部 ›</text>
      </view>

      <scroll-view class="doctor-scroll" :scroll-x="true" :show-scrollbar="false">
        <view class="doctor-list">
          <view
            class="doctor-card"
            v-for="doctor in doctors"
            :key="doctor.id"
            @tap="navigateTo(`/pages/consultant/detail?id=${doctor.id}`)"
          >
            <image :src="doctor.avatar || '/static/images/tc59.png'" class="doc-avatar" mode="aspectFill" @error="handleImageError" />
            <view class="doc-info">
              <view class="doc-head">
                <text class="doc-name">{{ doctor.name }}</text>
                <text class="doc-loc">{{ doctor.province }}</text>
              </view>
              <text class="doc-spec">{{ doctor.specialty }}</text>
              <view class="doc-foot">
                <text class="doc-price">￥{{ doctor.price || 500 }}<text class="price-unit">/时</text></text>
                <view class="book-btn">预约</view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 活动招募 / 直播预告 -->
    <view class="section-block">
      <view class="section-head">
        <text class="section-title">最新动态</text>
      </view>

      <view class="seg-tabs">
        <view class="seg-item" :class="{ active: activeTab === 'activity' }" @tap="switchTab('activity')">活动招募</view>
        <view class="seg-item" :class="{ active: activeTab === 'live' }" @tap="switchTab('live')">直播预告</view>
      </view>

      <view class="activity-content">
        <view v-if="activeTab === 'activity'" class="activity-list">
          <view class="act-card" v-for="activity in activities" :key="activity.id" @tap="handleActivityClick(activity)">
            <image :src="activity.image" class="act-img" mode="aspectFill" />
            <view class="act-info">
              <text class="act-title">{{ activity.title }}</text>
              <text class="act-desc">{{ activity.description }}</text>
              <view class="act-foot">
                <text class="act-price">免费</text>
                <view class="act-btn" @tap.stop="handleJoinActivity(activity)">立即加入</view>
              </view>
            </view>
          </view>
        </view>

        <view v-if="activeTab === 'live'" class="activity-list">
          <view class="act-card" v-for="live in liveStreams" :key="live.id" @tap="handleLiveClick(live)">
            <view class="live-badge"><view class="live-dot" />预告</view>
            <image :src="live.image" class="act-img" mode="aspectFill" />
            <view class="act-info">
              <text class="act-title">{{ live.title }}</text>
              <text class="act-desc">{{ live.description }}</text>
              <view class="act-foot">
                <text class="act-time">{{ live.time || '即将开始' }}</text>
                <view class="act-btn outline" @tap.stop="handleJoinLive(live)">预约直播</view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="view-more" @tap="navigateTo('/pages/activity/list')">
        <text>探索更多内容</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Banner, Doctor, Activity, LiveStream } from '@/types'
import { homeApi } from '@/apis'
import { fixArrayImageUrls } from '@/utils/image'
import { handleRequireLogin } from '@/utils/auth'

// 响应式数据
const searchKeyword = ref('')
const activeTab = ref('activity')
const banners = ref<Banner[]>([])
const doctors = ref<Doctor[]>([])
const activities = ref<Activity[]>([])
const liveStreams = ref<LiveStream[]>([])

// 搜索相关状态
const showSuggestions = ref(false)
const searchHistory = ref<string[]>([])
const filteredSuggestions = ref<string[]>([])

// 图片加载处理
const handleImageError = (e: any) => {
  console.error('图片加载失败:', e)
  // 可以在这里设置默认图片
}

const handleImageLoad = (e: any) => {
  console.log('图片加载成功:', e)
}

// 生命周期
onMounted(() => {
  // 加载页面数据
  loadPageData()
  
  // 加载搜索历史
  searchHistory.value = getSearchHistory()
})

// 加载页面数据
const loadPageData = async () => {
  try {
    const payload = await homeApi.getIndexData()
    if (payload.code === 0 && payload.data) {
      banners.value = fixArrayImageUrls(payload.data.banners || [], ['image'])
      doctors.value = fixArrayImageUrls(payload.data.doctors || [], ['avatar'])
      activities.value = fixArrayImageUrls(payload.data.activities || [], ['image'])
      liveStreams.value = fixArrayImageUrls(payload.data.liveStreams || [], ['image'])
    } else {
      throw new Error(payload.msg || '获取数据失败')
    }
  } catch (error) {
    console.error('加载首页数据失败:', error)
    
    // API失败时加载模拟数据作为备用
    loadMockData()
    
    // 显示错误提示
    uni.showToast({
      title: '网络连接失败，已加载本地数据',
      icon: 'none',
      duration: 3000
    })
  }
}

// 加载模拟数据
const loadMockData = () => {
  banners.value = [
    {
      id: 1,
      title: '防疫新知识',
      image: '/static/images/slide11.png',
      buttonText: '预约讲座',
      date: ''
    },
    {
      id: 2,
      title: '心理健康讲座',
      image: '/static/images/slide11.png',
      buttonText: '预约讲座',
      date: ''
    }
  ]
  
  doctors.value = [
    {
      id: 1,
      name: '沈世琴',
      avatar: '/static/images/zixunshi11.png',
      province: '上海',
      specialty: '家庭婚姻 | 亲子关系',
      experience: '9年经验',
      rating: 4.8,
      description: '',
      price: 600
    },
    {
      id: 2,
      name: '王医生',
      avatar: '/static/images/tc59.png',
      province: '北京',
      specialty: '青少年心理 | 学业压力',
      experience: '5年经验',
      rating: 4.8,
      description: '',
      price: 500
    }
  ]
  
  activities.value = [
    {
      id: 1,
      title: '益家之言论坛',
      description: '家庭热点问题系列公益论坛',
      image: '/static/images/huodong11.png',
      date: '2024-05-15',
      status: 'active'
    },
    {
      id: 2,
      title: '系列读书会【第二期火热招募中】',
      description: '让阅读成为一种习惯',
      image: '/static/images/huodong11.png',
      date: '2024-05-20',
      status: 'active'
    }
  ]
  
  liveStreams.value = [
    {
      id: 1,
      title: '益家之言论坛直播预告',
      description: '家庭热点问题系列公益论坛',
      image: '/static/images/huodong11.png',
      time: '2024-05-15 19:30',
      status: 'upcoming'
    }
  ]
}

// 跳转搜索页（统一展示咨询师 / 文章 / 活动结果）
const goSearchPage = (keyword?: unknown) => {
  const raw = typeof keyword === 'string' ? keyword : searchKeyword.value
  const q = String(raw ?? '').trim()
  if (!q) {
    uni.navigateTo({ url: '/pages/search/index' })
    return
  }
  saveSearchHistory(q)
  searchHistory.value = getSearchHistory()
  showSuggestions.value = false
  uni.navigateTo({ url: `/pages/search/index?q=${encodeURIComponent(q)}` })
}

// 搜索处理（兼容旧调用）
const handleSearch = () => goSearchPage()

// 保存搜索历史
const saveSearchHistory = (keyword: string) => {
  try {
    let history = uni.getStorageSync('searchHistory') || []
    
    // 避免重复
    if (!history.includes(keyword)) {
      history.unshift(keyword)
      // 只保留最近10条
      history = history.slice(0, 10)
      uni.setStorageSync('searchHistory', history)
    }
  } catch (error) {
    console.error('保存搜索历史失败:', error)
  }
}

// 获取搜索历史
const getSearchHistory = () => {
  try {
    return uni.getStorageSync('searchHistory') || []
  } catch (error) {
    console.error('获取搜索历史失败:', error)
    return []
  }
}

// 清空搜索历史
const clearSearchHistory = () => {
  try {
    uni.removeStorageSync('searchHistory')
    searchHistory.value = []
    uni.showToast({
      title: '搜索历史已清空',
      icon: 'success'
    })
  } catch (error) {
    console.error('清空搜索历史失败:', error)
  }
}

// 搜索输入处理
const handleSearchInput = () => {
  if (searchKeyword.value.trim()) {
    // 生成搜索建议
    generateSearchSuggestions()
  } else {
    filteredSuggestions.value = []
  }
}

// 生成搜索建议
const generateSearchSuggestions = () => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    filteredSuggestions.value = []
    return
  }
  
  // 从咨询师数据中生成建议
  const suggestions = new Set<string>()
  
  doctors.value.forEach(doctor => {
    if (doctor.name.toLowerCase().includes(keyword)) {
      suggestions.add(doctor.name)
    }
    if (doctor.province && doctor.province.toLowerCase().includes(keyword)) {
      suggestions.add(doctor.province)
    }
    if (doctor.specialty && doctor.specialty.toLowerCase().includes(keyword)) {
      suggestions.add(doctor.specialty)
    }
  })
  
  filteredSuggestions.value = Array.from(suggestions).slice(0, 5)
}

// 显示搜索建议
const showSearchSuggestions = () => {
  showSuggestions.value = true
}

// 隐藏搜索建议
const hideSearchSuggestions = () => {
  // 延迟隐藏，让用户有时间点击建议项
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

// 选择历史搜索项
const selectHistoryItem = (keyword: string) => {
  searchKeyword.value = keyword
  goSearchPage(keyword)
}

const selectSuggestionItem = (keyword: string) => {
  searchKeyword.value = keyword
  goSearchPage(keyword)
}

// 轮播图点击
const handleBannerClick = (banner: Banner) => {
  // 轮播图点击处理，可以根据需要添加跳转逻辑
  console.log('轮播图点击:', banner)
}

// 轮播图按钮点击
const handleBannerAction = (banner: Banner) => {
  // TODO: 处理轮播图按钮点击
  console.log('轮播图按钮点击:', banner)
}

// 切换标签页
const switchTab = (tab: string) => {
  activeTab.value = tab
}

// 活动点击
const handleActivityClick = (activity: Activity) => {
  // TODO: 处理活动点击
  console.log('活动点击:', activity)
}

// 加入活动
const handleJoinActivity = (activity: Activity) => {
  // TODO: 处理加入活动
  console.log('加入活动:', activity)
}

// 直播点击
const handleLiveClick = (live: LiveStream) => {
  // TODO: 处理直播点击
  console.log('直播点击:', live)
}

// 加入直播
const handleJoinLive = (live: LiveStream) => {
  // TODO: 处理加入直播
  console.log('加入直播:', live)
}

// tabBar 页面必须用 switchTab，不能用 navigateTo（否则 H5/小程序点击无反应）
const TAB_BAR_PATHS = new Set([
  '/pages/index/index',
  '/pages/consultant/list',
  '/pages/tab-slot/index',
  '/pages/theme/index',
  '/pages/user/profile'
])

// 页面跳转
const goPsychTest = () => {
  handleRequireLogin(() => {
    navigateTo('/pages/test/index')
  }, '/pages/test/index')
}

const navigateTo = (url: string) => {
  if (!url.startsWith('/pages/')) {
    console.log('外部链接:', url)
    return
  }
  const pathOnly = url.split('?')[0]
  if (TAB_BAR_PATHS.has(pathOnly)) {
    uni.switchTab({ url: pathOnly })
    return
  }
  uni.navigateTo({ url })
}
</script>

<style>
/* 亚朵风 — 森林绿 + 米白 + 大量留白 */
.page-index {
  min-height: 100vh;
  background: #F7F5F2;
  padding-bottom: 48rpx;
}

/* 顶部氛围图 */
.hero-wrap {
  position: relative;
  height: 420rpx;
  overflow: hidden;
}
.hero-bg { width: 100%; height: 100%; }
.hero-mask {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.35) 100%);
}
.hero-content {
  position: absolute; left: 40rpx; bottom: 80rpx; z-index: 2;
  padding-top: env(safe-area-inset-top);
}
.hero-brand {
  display: block; font-size: 44rpx; font-weight: 600; color: #fff;
  letter-spacing: 4rpx;
}
.hero-sub {
  display: block; margin-top: 10rpx; font-size: 24rpx; color: rgba(255,255,255,0.85);
  letter-spacing: 2rpx;
}

/* 悬浮预约卡片 */
.float-card {
  position: relative; z-index: 10;
  margin: -56rpx 32rpx 0;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 8rpx 40rpx rgba(0,0,0,0.06);
}
.search-bar {
  position: relative;
  display: flex; align-items: center;
  border-bottom: 1rpx solid #EDEAE6;
  padding-bottom: 24rpx; margin-bottom: 28rpx;
}
.search-divider {
  width: 4rpx; height: 32rpx; background: #3D5A4E; border-radius: 2rpx;
  margin-right: 20rpx; flex-shrink: 0;
}
.search-input {
  flex: 1; height: 64rpx; line-height: 64rpx;
  font-size: 28rpx; color: #2C2C2C;
}
.search-action {
  flex-shrink: 0; margin-left: 16rpx;
  font-size: 28rpx; font-weight: 600; color: #3D5A4E;
  padding: 8rpx 4rpx;
}
.search-placeholder { color: #B0B0B0; font-size: 28rpx; }

.search-suggestions {
  position: absolute; top: calc(100% + 12rpx); left: 0; right: 0;
  background: #fff; border-radius: 16rpx;
  box-shadow: 0 12rpx 40rpx rgba(0,0,0,0.08);
  border: 1rpx solid #EDEAE6; overflow: hidden; z-index: 100;
}
.suggestion-section { padding: 24rpx 28rpx; }
.suggestion-header { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.suggestion-title { font-size: 24rpx; color: #8A8A8A; }
.clear-history { font-size: 24rpx; color: #B0B0B0; }
.suggestion-list.row { display: flex; flex-wrap: wrap; gap: 12rpx; }
.suggestion-list.column { display: flex; flex-direction: column; }
.suggestion-tag {
  background: #F7F5F2; color: #5A5A5A; font-size: 24rpx;
  padding: 8rpx 20rpx; border-radius: 8rpx;
}
.suggestion-item {
  padding: 16rpx 0; font-size: 28rpx; color: #2C2C2C;
  border-bottom: 1rpx solid #F0EDE8;
}
.suggestion-item:last-child { border-bottom: none; }

.primary-cta {
  display: flex; align-items: center; justify-content: space-between;
  background: #3D5A4E; border-radius: 16rpx; padding: 28rpx 32rpx;
}
.primary-cta:active { opacity: 0.92; }
.cta-left { display: flex; flex-direction: column; gap: 6rpx; }
.cta-title { font-size: 32rpx; font-weight: 600; color: #fff; }
.cta-desc { font-size: 24rpx; color: rgba(255,255,255,0.75); }
.cta-btn {
  position: relative;
  background: rgba(255,255,255,0.15); color: #fff;
  font-size: 26rpx; font-weight: 500;
  padding: 16rpx 28rpx; border-radius: 12rpx;
}
.cta-tag {
  position: absolute; top: -16rpx; right: -12rpx;
  background: #C9A96E; color: #fff; font-size: 18rpx;
  padding: 4rpx 12rpx; border-radius: 6rpx;
}

/* 快捷入口 */
.quick-row {
  display: flex; justify-content: space-around;
  padding: 40rpx 32rpx 16rpx;
}
.quick-item {
  display: flex; flex-direction: column; align-items: center; gap: 14rpx;
}
.quick-item:active { opacity: 0.7; }
.quick-icon {
  width: 88rpx; height: 88rpx; border-radius: 50%;
  border: 1rpx solid #E8E4DE; background: #fff;
  display: flex; align-items: center; justify-content: center;
}
.quick-symbol { font-size: 32rpx; color: #3D5A4E; font-weight: 500; }
.quick-label { font-size: 24rpx; color: #5A5A5A; }

/* 通用区块 */
.section-block { padding: 24rpx 32rpx 0; }
.section-head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 24rpx;
}
.section-title { font-size: 34rpx; font-weight: 600; color: #2C2C2C; letter-spacing: 1rpx; }
.section-more { font-size: 26rpx; color: #8A8A8A; }

/* 轮播 */
.banner-swiper { height: 280rpx; border-radius: 20rpx; overflow: hidden; }
.banner-item { width: 100%; height: 100%; position: relative; border-radius: 20rpx; overflow: hidden; }
.banner-image { width: 100%; height: 100%; background: #E8E4DE; }
.banner-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 24rpx 28rpx;
  background: linear-gradient(transparent, rgba(0,0,0,0.4));
  display: flex; justify-content: flex-end;
}
.banner-btn {
  background: #3D5A4E; color: #fff; font-size: 24rpx;
  padding: 0 28rpx; height: 52rpx; line-height: 52rpx;
  border-radius: 8rpx; margin: 0; border: none;
}

/* 服务卡片 */
.service-list { display: flex; flex-direction: column; gap: 16rpx; }
.service-card {
  display: flex; align-items: center; gap: 24rpx;
  background: #fff; border-radius: 20rpx; padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.service-card:active { opacity: 0.92; }
.service-icon {
  width: 72rpx; height: 72rpx; border-radius: 16rpx;
  background: #F0EDE8; display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; color: #3D5A4E; font-weight: 600; flex-shrink: 0;
}
.service-icon.gold { background: #F5EFE3; color: #C9A96E; }
.service-body { flex: 1; }
.service-name { display: block; font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.service-desc { display: block; margin-top: 6rpx; font-size: 24rpx; color: #8A8A8A; }
.service-arrow { font-size: 36rpx; color: #C8C4BE; }

/* 咨询师 */
.doctor-scroll { width: 100%; }
.doctor-list { display: flex; gap: 20rpx; padding: 4rpx 0 16rpx; }
.doctor-card {
  width: 260rpx; flex-shrink: 0;
  background: #fff; border-radius: 20rpx; overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}
.doc-avatar { width: 100%; height: 260rpx; background: #F0EDE8; }
.doc-info { padding: 20rpx 24rpx 24rpx; }
.doc-head { display: flex; align-items: baseline; gap: 10rpx; margin-bottom: 8rpx; }
.doc-name { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.doc-loc { font-size: 22rpx; color: #8A8A8A; }
.doc-spec {
  font-size: 22rpx; color: #8A8A8A; display: block; margin-bottom: 16rpx;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.doc-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 16rpx; border-top: 1rpx solid #F0EDE8;
}
.doc-price { font-size: 28rpx; font-weight: 600; color: #C9A96E; }
.price-unit { font-size: 20rpx; font-weight: 400; color: #B0B0B0; }
.book-btn {
  font-size: 22rpx; color: #3D5A4E; font-weight: 500;
  padding: 8rpx 20rpx; border: 1rpx solid #3D5A4E; border-radius: 8rpx;
}

/* 活动 / 直播 */
.seg-tabs {
  display: flex; gap: 32rpx; margin-bottom: 24rpx;
  border-bottom: 1rpx solid #EDEAE6;
}
.seg-item {
  font-size: 28rpx; color: #8A8A8A; padding-bottom: 16rpx;
  position: relative;
}
.seg-item.active { color: #2C2C2C; font-weight: 600; }
.seg-item.active::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0;
  height: 4rpx; background: #3D5A4E; border-radius: 2rpx;
}
.activity-list { display: flex; flex-direction: column; gap: 20rpx; }
.act-card {
  display: flex; background: #fff; border-radius: 20rpx;
  padding: 20rpx; gap: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
  position: relative;
}
.act-card:active { opacity: 0.95; }
.act-img { width: 160rpx; height: 160rpx; border-radius: 12rpx; background: #F0EDE8; flex-shrink: 0; }
.act-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.act-title {
  font-size: 28rpx; font-weight: 600; color: #2C2C2C; line-height: 1.5;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.act-desc {
  font-size: 24rpx; color: #8A8A8A; margin-top: 8rpx;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden;
}
.act-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12rpx; }
.act-price { font-size: 26rpx; font-weight: 600; color: #3D5A4E; }
.act-time { font-size: 24rpx; color: #C9A96E; }
.act-btn {
  font-size: 24rpx; color: #fff; background: #3D5A4E;
  padding: 10rpx 24rpx; border-radius: 8rpx;
}
.act-btn.outline { background: transparent; color: #3D5A4E; border: 1rpx solid #3D5A4E; }

.live-badge {
  position: absolute; top: 28rpx; left: 28rpx; z-index: 2;
  background: rgba(0,0,0,0.55); color: #fff; font-size: 20rpx;
  padding: 4rpx 14rpx; border-radius: 6rpx;
  display: flex; align-items: center; gap: 8rpx;
}
.live-dot { width: 10rpx; height: 10rpx; background: #E85D5D; border-radius: 50%; }

.view-more { margin-top: 32rpx; text-align: center; }
.view-more text {
  font-size: 26rpx; color: #3D5A4E;
  padding: 16rpx 40rpx; border: 1rpx solid #3D5A4E; border-radius: 8rpx;
}
</style>