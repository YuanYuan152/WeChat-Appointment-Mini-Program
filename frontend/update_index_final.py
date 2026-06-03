import re

file_path = r"d:\data\extra\lxxl-main\frontend\src\pages\index\index.vue"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

script_match = re.search(r'(<script setup lang="ts">.*?</script>)', content, re.DOTALL)
if not script_match:
    print("Script block not found!")
    exit(1)
script_block = script_match.group(1)

new_template = """<template>
  <view class="page-index">
    <!-- 顶部品牌色渐变背景 -->
    <view class="top-bg-gradient"></view>

    <!-- 搜索栏 (Glassmorphism 毛玻璃) -->
    <view class="search-section">
      <view class="search-bar">
        <image src="/static/images/seI.png" class="search-icon" mode="aspectFit" />
        <input 
          class="search-input" 
          placeholder="搜索咨询师姓名、地区、专业" 
          placeholder-class="search-placeholder"
          v-model="searchKeyword"
          @input="handleSearchInput"
          @confirm="handleSearch"
          @focus="showSearchSuggestions"
          @blur="hideSearchSuggestions"
        />
        
        <!-- 搜索建议 -->
        <view v-if="showSuggestions && (searchKeyword || searchHistory.length > 0)" class="search-suggestions">
          <view v-if="searchHistory.length > 0 && !searchKeyword" class="suggestion-section">
            <view class="suggestion-header">
              <text class="suggestion-title">搜索历史</text>
              <text class="clear-history" @click="clearSearchHistory">清空</text>
            </view>
            <view class="suggestion-list row">
              <text class="suggestion-tag" v-for="(item, index) in searchHistory" :key="index" @click="selectHistoryItem(item)">{{ item }}</text>
            </view>
          </view>
          <view v-if="searchKeyword && filteredSuggestions.length > 0" class="suggestion-section">
            <view class="suggestion-header"><text class="suggestion-title">搜索建议</text></view>
            <view class="suggestion-list column">
              <text class="suggestion-item" v-for="(item, index) in filteredSuggestions" :key="index" @click="selectSuggestionItem(item)">{{ item }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 轮播图 (3D悬浮效果) -->
    <view class="banner-section">
      <swiper 
        class="banner-swiper" 
        :indicator-dots="true" 
        indicator-color="rgba(255,255,255,0.4)"
        indicator-active-color="#ffffff"
        :autoplay="true" 
        :interval="4000" 
        :duration="600"
        circular
        previous-margin="24rpx"
        next-margin="24rpx"
      >
        <swiper-item v-for="banner in banners" :key="banner.id" @click="handleBannerClick(banner)">
          <view class="banner-item">
            <image :src="banner.image" class="banner-image" mode="aspectFill" />
            <view class="banner-overlay">
              <button class="banner-btn glass-btn" @click.stop="handleBannerAction(banner)">
                {{ banner.buttonText }}
              </button>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <!-- 悬浮功能导航 (修复了被挤压的问题) -->
    <view class="nav-section">
      <view class="nav-glass-card">
        <view class="nav-item" @click="navigateTo('/pages/highlights/index')">
          <view class="nav-icon-wrap bg-teal-light">
            <image src="/static/images/icon21.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">往期精华</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/consultation/guide')">
          <view class="nav-icon-wrap bg-blue-light">
            <image src="/static/images/icon22.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">了解咨询</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/about/index')">
          <view class="nav-icon-wrap bg-orange-light">
            <image src="/static/images/icon23.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">关于我们</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/jixinli/index')">
          <view class="nav-icon-wrap bg-purple-light">
            <image src="/static/images/icon24.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">济心理</text>
        </view>
      </view>
    </view>

    <!-- Bento Box 功能卡片 (治愈系马卡龙色调) -->
    <view class="bento-section">
      <view class="bento-left bg-teal-soft" @click="navigateTo('/pages/consultant/list')">
        <view class="bento-text-wrap">
          <text class="bento-title text-teal-dark">预约咨询</text>
          <text class="bento-subtitle text-teal-muted">专业心理支持</text>
          <view class="bento-action bg-teal-dark">
            <text>立即预约</text>
            <text class="arrow-icon">→</text>
          </view>
        </view>
        <image src="/static/images/place11.png" class="bento-img-large" mode="aspectFit" />
      </view>
      
      <view class="bento-right">
        <view class="bento-small bg-blue-soft" @click="navigateTo('/pages/test/index')">
          <view class="bento-text-wrap">
            <text class="bento-title-small text-blue-dark">心理测评</text>
            <text class="bento-subtitle text-blue-muted">探索未知自己</text>
          </view>
          <image src="/static/images/place12.png" class="bento-img-small" mode="aspectFit" />
        </view>
        <view class="bento-small bg-orange-soft" @click="navigateTo('/pages/activity/list')">
          <view class="bento-text-wrap">
            <text class="bento-title-small text-orange-dark">精彩活动</text>
            <text class="bento-subtitle text-orange-muted">团体沙龙体验</text>
          </view>
          <image src="/static/images/place14.png" class="bento-img-small" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- 专业咨询师 (横向滑动卡片) -->
    <view class="doctor-section">
      <view class="section-header">
        <view class="header-left">
          <view class="title-indicator"></view>
          <text class="section-title">专业咨询师</text>
        </view>
        <view class="header-right" @click="navigateTo('/pages/consultant/list')">
          <text class="section-more">查看更多</text>
          <text class="more-arrow">›</text>
        </view>
      </view>
      
      <scroll-view class="doctor-scroll" :scroll-x="true" :show-scrollbar="false">
        <view class="doctor-list">
          <view 
            class="doctor-card-modern" 
            v-for="doctor in doctors" 
            :key="doctor.id"
            @click="navigateTo(`/pages/consultant/detail?id=${doctor.id}`)"
          >
            <view class="doc-image-wrap">
              <image :src="doctor.avatar || '/static/images/tc59.png'" class="doc-avatar" mode="aspectFill" @error="handleImageError" />
              <view class="doc-badge glass-badge">{{ doctor.experience || '300' }}小时+</view>
            </view>
            <view class="doc-info-modern">
              <view class="doc-head">
                <text class="doc-name">{{ doctor.name }}</text>
                <text class="doc-loc">{{ doctor.province }}</text>
              </view>
              <text class="doc-spec">{{ doctor.specialty }}</text>
              <view class="doc-foot">
                <text class="doc-price">￥{{ doctor.price || 500 }}<text class="price-unit">/时</text></text>
                <view class="book-btn-small">预约</view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 活动招募/直播预告 (分段控制器) -->
    <view class="activity-section">
      <view class="segmented-control">
        <view class="seg-item" :class="{ active: activeTab === 'activity' }" @click="switchTab('activity')">活动招募</view>
        <view class="seg-item" :class="{ active: activeTab === 'live' }" @click="switchTab('live')">直播预告</view>
        <view class="seg-indicator" :class="'pos-' + activeTab"></view>
      </view>
      
      <view class="activity-content">
        <view v-if="activeTab === 'activity'" class="activity-list-modern">
          <view class="act-card-modern" v-for="activity in activities" :key="activity.id" @click="handleActivityClick(activity)">
            <image :src="activity.image" class="act-img" mode="aspectFill" />
            <view class="act-info">
              <view class="act-text">
                <text class="act-title">{{ activity.title }}</text>
                <text class="act-desc">{{ activity.description }}</text>
              </view>
              <view class="act-foot">
                <text class="act-price free">免费</text>
                <button class="act-join-btn" @click.stop="handleJoinActivity(activity)">立即加入</button>
              </view>
            </view>
          </view>
        </view>

        <view v-if="activeTab === 'live'" class="activity-list-modern">
          <view class="act-card-modern" v-for="live in liveStreams" :key="live.id" @click="handleLiveClick(live)">
            <view class="live-badge"><view class="live-dot"></view>预告</view>
            <image :src="live.image" class="act-img" mode="aspectFill" />
            <view class="act-info">
              <view class="act-text">
                <text class="act-title">{{ live.title }}</text>
                <text class="act-desc">{{ live.description }}</text>
              </view>
              <view class="act-foot">
                <text class="act-time">{{ live.time || '即将开始' }}</text>
                <button class="act-join-btn live-btn" @click.stop="handleJoinLive(live)">预约直播</button>
              </view>
            </view>
          </view>
        </view>
      </view>
      
      <view class="view-more-modern" @click="navigateTo('/pages/activity/list')">
        <text>探索更多内容</text>
      </view>
    </view>
  </view>
</template>"""

new_style = """<style>
/* 顶级设计系统变量与重置 */
.page-index {
  min-height: 100vh;
  background-color: #F4F6F8;
  padding-bottom: 40rpx;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  position: relative;
}

/* 顶部渐变背景 */
.top-bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 560rpx;
  background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
  border-radius: 0 0 60rpx 60rpx;
  z-index: 0;
}

/* 搜索栏 - Glassmorphism */
.search-section {
  position: relative;
  z-index: 100;
  padding: 20rpx 32rpx;
  padding-top: calc(20rpx + var(--status-bar-height, 0px));
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 100rpx;
  height: 88rpx;
  padding: 0 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(13, 148, 136, 0.15);
  transition: all 0.3s ease;
}

.search-bar:focus-within {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.1);
}

.search-icon {
  width: 36rpx;
  height: 36rpx;
  margin-right: 16rpx;
  transition: opacity 0.3s;
}

.search-bar:focus-within .search-icon {
  opacity: 0.6;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 28rpx;
  color: #ffffff;
}

.search-bar:focus-within .search-input {
  color: #1F2937;
}

.search-placeholder {
  color: rgba(255, 255, 255, 0.8);
}

.search-bar:focus-within .search-placeholder {
  color: #9CA3AF;
}

/* 搜索建议弹窗 */
.search-suggestions {
  position: absolute;
  top: calc(100% + 16rpx);
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 32rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  overflow: hidden;
  z-index: 100;
}

.suggestion-section { padding: 24rpx 32rpx; }
.suggestion-header { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.suggestion-title { font-size: 26rpx; color: #6B7280; font-weight: 600; }
.clear-history { font-size: 24rpx; color: #9CA3AF; }
.suggestion-list.row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.suggestion-list.column { display: flex; flex-direction: column; }
.suggestion-tag { background: #F3F4F6; color: #4B5563; font-size: 24rpx; padding: 8rpx 24rpx; border-radius: 100rpx; }
.suggestion-item { padding: 16rpx 0; font-size: 28rpx; color: #374151; border-bottom: 1px solid #F3F4F6; }
.suggestion-item:last-child { border-bottom: none; }

/* 轮播图 - 3D 悬浮 */
.banner-section {
  position: relative;
  z-index: 10;
  margin-top: 20rpx;
}

.banner-swiper {
  height: 320rpx;
}

.banner-item {
  width: calc(100% - 16rpx);
  height: 100%;
  margin: 0 8rpx;
  border-radius: 32rpx;
  overflow: hidden;
  position: relative;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.1);
  transform: scale(0.95);
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

swiper-item.uni-swiper-slide-frame-active .banner-item {
  transform: scale(1);
}

.banner-image {
  width: 100%;
  height: 100%;
  background-color: #E5E7EB;
}

.banner-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40rpx 32rpx 24rpx;
  background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
  display: flex;
  justify-content: flex-end;
}

.glass-btn {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  font-size: 24rpx;
  padding: 0 32rpx;
  height: 56rpx;
  line-height: 54rpx;
  border-radius: 100rpx;
  margin: 0;
  font-weight: 500;
}

/* 悬浮功能导航 */
.nav-section {
  padding: 0 32rpx;
  margin-top: 32rpx;
  margin-bottom: 32rpx;
  position: relative;
  z-index: 10;
}

.nav-glass-card {
  background: #ffffff;
  border-radius: 40rpx;
  padding: 32rpx 20rpx;
  display: flex;
  justify-content: space-around;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.04);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.nav-icon-wrap {
  width: 96rpx;
  height: 96rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  flex-shrink: 0; /* 防止被挤压 */
}

.nav-item:active .nav-icon-wrap {
  transform: scale(0.9);
}

.bg-teal-light { background: #F0FDFA; }
.bg-blue-light { background: #EFF6FF; }
.bg-orange-light { background: #FFF7ED; }
.bg-purple-light { background: #FAF5FF; }

.nav-icon {
  width: 48rpx;
  height: 48rpx;
}

.nav-text {
  font-size: 24rpx;
  color: #4B5563;
  font-weight: 600;
}

/* Bento Box 功能卡片 */
.bento-section {
  display: flex;
  gap: 24rpx;
  padding: 0 32rpx;
  margin-bottom: 40rpx;
  position: relative;
  z-index: 10;
}

.bento-left {
  flex: 1.1;
  border-radius: 40rpx;
  padding: 32rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.03);
  transition: transform 0.2s;
}

.bento-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.bento-small {
  flex: 1;
  border-radius: 32rpx;
  padding: 24rpx 32rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.03);
  transition: transform 0.2s;
}

.bento-left:active, .bento-small:active {
  transform: scale(0.97);
}

/* 治愈系马卡龙背景色 */
.bg-teal-soft { background-color: #F0FDFA; }
.bg-blue-soft { background-color: #EFF6FF; }
.bg-orange-soft { background-color: #FFF7ED; }

.bento-text-wrap {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.bento-title { font-size: 36rpx; font-weight: 800; margin-bottom: 8rpx; }
.bento-title-small { font-size: 30rpx; font-weight: 800; margin-bottom: 6rpx; }
.bento-subtitle { font-size: 24rpx; font-weight: 500; }

.text-teal-dark { color: #0F766E; }
.text-teal-muted { color: #14B8A6; }
.text-blue-dark { color: #1D4ED8; }
.text-blue-muted { color: #3B82F6; }
.text-orange-dark { color: #C2410C; }
.text-orange-muted { color: #F59E0B; }

.bento-action {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 24rpx;
  border-radius: 100rpx;
  font-size: 24rpx;
  color: white;
  font-weight: 600;
  align-self: flex-start;
}

.bg-teal-dark { background-color: #0D9488; }

.arrow-icon { font-family: serif; font-size: 28rpx; }

.bento-img-large {
  position: absolute;
  right: -20rpx;
  bottom: -20rpx;
  width: 220rpx;
  height: 220rpx;
  z-index: 1;
  opacity: 0.9;
}

.bento-img-small {
  position: absolute;
  right: -10rpx;
  bottom: -10rpx;
  width: 130rpx;
  height: 130rpx;
  z-index: 1;
  opacity: 0.9;
}

/* 专业咨询师 */
.doctor-section {
  padding: 16rpx 0 40rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32rpx;
  margin-bottom: 24rpx;
}

.header-left { display: flex; align-items: center; gap: 16rpx; }
.title-indicator { width: 8rpx; height: 32rpx; background: #0D9488; border-radius: 8rpx; }
.section-title { font-size: 36rpx; font-weight: 800; color: #111827; }
.header-right { display: flex; align-items: center; gap: 4rpx; }
.section-more { font-size: 26rpx; color: #6B7280; font-weight: 500; }
.more-arrow { font-size: 32rpx; color: #9CA3AF; margin-top: -4rpx; }

.doctor-scroll { width: 100%; }
.doctor-list { display: flex; gap: 24rpx; padding: 10rpx 32rpx 24rpx; }

.doctor-card-modern {
  width: 280rpx;
  flex-shrink: 0;
  background: #ffffff;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(243, 244, 246, 0.8);
}

.doc-image-wrap { position: relative; height: 280rpx; width: 100%; }
.doc-avatar { width: 100%; height: 100%; background: #F3F4F6; }

.glass-badge {
  position: absolute;
  bottom: 16rpx;
  left: 16rpx;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  color: #0D9488;
  font-size: 20rpx;
  font-weight: 700;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
}

.doc-info-modern { padding: 20rpx; }
.doc-head { display: flex; align-items: baseline; gap: 12rpx; margin-bottom: 8rpx; }
.doc-name { font-size: 32rpx; font-weight: 800; color: #1F2937; }
.doc-loc { font-size: 22rpx; color: #6B7280; }
.doc-spec { font-size: 22rpx; color: #6B7280; display: block; margin-bottom: 16rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.doc-foot { display: flex; justify-content: space-between; align-items: center; padding-top: 16rpx; border-top: 1px dashed #E5E7EB; }
.doc-price { font-size: 28rpx; font-weight: 800; color: #F59E0B; }
.price-unit { font-size: 20rpx; font-weight: 500; color: #9CA3AF; }
.book-btn-small { background: #F0FDFA; color: #0D9488; font-size: 22rpx; font-weight: 700; padding: 8rpx 20rpx; border-radius: 100rpx; }

/* 活动招募/直播预告 */
.activity-section { padding: 0 32rpx; }

.segmented-control {
  display: flex;
  background: #E5E7EB;
  border-radius: 100rpx;
  padding: 6rpx;
  position: relative;
  margin-bottom: 32rpx;
}

.seg-item {
  flex: 1;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  color: #6B7280;
  padding: 16rpx 0;
  position: relative;
  z-index: 2;
  transition: color 0.3s;
}

.seg-item.active { color: #1F2937; }

.seg-indicator {
  position: absolute;
  top: 6rpx;
  bottom: 6rpx;
  width: calc(50% - 6rpx);
  background: #ffffff;
  border-radius: 100rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
  z-index: 1;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.seg-indicator.pos-activity { transform: translateX(0); }
.seg-indicator.pos-live { transform: translateX(100%); }

.activity-list-modern { display: flex; flex-direction: column; gap: 24rpx; }

.act-card-modern {
  display: flex;
  background: #ffffff;
  border-radius: 32rpx;
  padding: 20rpx;
  gap: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.03);
  position: relative;
  transition: transform 0.2s;
}

.act-card-modern:active { transform: scale(0.98); }

.act-img { width: 180rpx; height: 180rpx; border-radius: 24rpx; background: #F3F4F6; flex-shrink: 0; }

.act-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 4rpx 0; }
.act-title { font-size: 32rpx; font-weight: 800; color: #1F2937; line-height: 1.4; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-bottom: 8rpx; }
.act-desc { font-size: 24rpx; color: #6B7280; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; }
.act-foot { display: flex; justify-content: space-between; align-items: center; }
.act-price.free { font-size: 28rpx; font-weight: 800; color: #10B981; }
.act-time { font-size: 24rpx; font-weight: 600; color: #F59E0B; }

.act-join-btn {
  background: #0D9488;
  color: white;
  font-size: 24rpx;
  font-weight: 600;
  padding: 0 32rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 100rpx;
  margin: 0;
  box-shadow: 0 8rpx 20rpx rgba(13, 148, 136, 0.2);
}

.act-join-btn.live-btn { background: #F59E0B; box-shadow: 0 8rpx 20rpx rgba(245, 158, 11, 0.2); }

.live-badge {
  position: absolute;
  top: 32rpx;
  left: 32rpx;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  color: white;
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 12rpx;
  border-radius: 100rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  z-index: 2;
}

.live-dot { width: 12rpx; height: 12rpx; background: #EF4444; border-radius: 50%; animation: pulse 2s infinite; }

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.view-more-modern { margin-top: 40rpx; text-align: center; }
.view-more-modern text { display: inline-block; font-size: 26rpx; font-weight: 600; color: #0D9488; background: #F0FDFA; padding: 16rpx 48rpx; border-radius: 100rpx; }
</style>"""

new_content = new_template + "\n\n" + script_block + "\n\n" + new_style

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("index.vue successfully updated to perfect blend of layout and style.")
