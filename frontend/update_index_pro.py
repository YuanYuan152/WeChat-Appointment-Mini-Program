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
  <view class="page-home">
    <!-- 极简搜索栏 -->
    <view class="header-search">
      <view class="search-box">
        <image src="/static/images/seI.png" class="icon-search" mode="aspectFit" />
        <input 
          class="input-search" 
          placeholder="搜索咨询师姓名、地区、专业" 
          placeholder-class="input-placeholder"
          v-model="searchKeyword"
          @input="handleSearchInput"
          @confirm="handleSearch"
          @focus="showSearchSuggestions"
          @blur="hideSearchSuggestions"
        />
      </view>
      
      <!-- 搜索建议 (极简白底) -->
      <view v-if="showSuggestions && (searchKeyword || searchHistory.length > 0)" class="search-dropdown">
        <view v-if="searchHistory.length > 0 && !searchKeyword" class="suggest-group">
          <view class="suggest-head">
            <text class="suggest-title">搜索历史</text>
            <text class="suggest-clear" @click="clearSearchHistory">清空</text>
          </view>
          <view class="suggest-list">
            <text class="suggest-tag" v-for="(item, index) in searchHistory" :key="index" @click="selectHistoryItem(item)">{{ item }}</text>
          </view>
        </view>
        <view v-if="searchKeyword && filteredSuggestions.length > 0" class="suggest-group">
          <view class="suggest-head"><text class="suggest-title">搜索建议</text></view>
          <view class="suggest-list column">
            <text class="suggest-row" v-for="(item, index) in filteredSuggestions" :key="index" @click="selectSuggestionItem(item)">{{ item }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 轮播图 -->
    <view class="banner-wrap">
      <swiper class="banner-swiper" circular autoplay :interval="4000" :duration="500" indicator-dots indicator-color="rgba(255,255,255,0.5)" indicator-active-color="#ffffff">
        <swiper-item v-for="banner in banners" :key="banner.id" @click="handleBannerClick(banner)">
          <image :src="banner.image" class="banner-img" mode="aspectFill" />
        </swiper-item>
      </swiper>
    </view>

    <!-- 金刚区导航 -->
    <view class="nav-grid">
      <view class="nav-item" @click="navigateTo('/pages/highlights/index')">
        <image src="/static/images/icon21.png" class="nav-icon" mode="aspectFit" />
        <text class="nav-text">往期精华</text>
      </view>
      <view class="nav-item" @click="navigateTo('/pages/consultation/guide')">
        <image src="/static/images/icon22.png" class="nav-icon" mode="aspectFit" />
        <text class="nav-text">了解咨询</text>
      </view>
      <view class="nav-item" @click="navigateTo('/pages/about/index')">
        <image src="/static/images/icon23.png" class="nav-icon" mode="aspectFit" />
        <text class="nav-text">关于我们</text>
      </view>
      <view class="nav-item" @click="navigateTo('/pages/jixinli/index')">
        <image src="/static/images/icon24.png" class="nav-icon" mode="aspectFit" />
        <text class="nav-text">济心理</text>
      </view>
    </view>

    <!-- 核心业务区 (白底干净卡片) -->
    <view class="business-section">
      <view class="biz-left" @click="navigateTo('/pages/consultant/list')">
        <view class="biz-text-wrap">
          <text class="biz-title">预约咨询</text>
          <text class="biz-desc">专业心理支持</text>
        </view>
        <image src="/static/images/place11.png" class="biz-img-large" mode="aspectFit" />
      </view>
      <view class="biz-right">
        <view class="biz-card" @click="navigateTo('/pages/test/index')">
          <view class="biz-text-wrap">
            <text class="biz-title">心理测评</text>
            <text class="biz-desc">探索未知自己</text>
          </view>
          <image src="/static/images/place12.png" class="biz-img-small" mode="aspectFit" />
        </view>
        <view class="biz-card" @click="navigateTo('/pages/activity/list')">
          <view class="biz-text-wrap">
            <text class="biz-title">精彩活动</text>
            <text class="biz-desc">团体沙龙体验</text>
          </view>
          <image src="/static/images/place14.png" class="biz-img-small" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- 专业咨询师 (专家名片风) -->
    <view class="expert-section">
      <view class="section-head">
        <text class="section-title">专业咨询师</text>
        <view class="section-more" @click="navigateTo('/pages/consultant/list')">查看更多 <text class="arrow">›</text></view>
      </view>
      <scroll-view scroll-x class="expert-scroll" :show-scrollbar="false">
        <view class="expert-list">
          <view class="expert-card" v-for="doctor in doctors" :key="doctor.id" @click="navigateTo(`/pages/consultant/detail?id=${doctor.id}`)">
            <image :src="doctor.avatar || '/static/images/tc59.png'" class="expert-avatar" mode="aspectFill" @error="handleImageError" />
            <text class="expert-name">{{ doctor.name }}</text>
            <text class="expert-loc">{{ doctor.province || '上海' }} · {{ doctor.experience || '5年' }}经验</text>
            <view class="expert-tags">
              <text class="tag-item">{{ doctor.specialty ? doctor.specialty.split(' ')[0] : '心理咨询' }}</text>
            </view>
            <view class="expert-price">￥{{ doctor.price || 500 }}/次</view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 活动与直播 -->
    <view class="content-section">
      <view class="clean-tabs">
        <view class="clean-tab" :class="{ active: activeTab === 'activity' }" @click="switchTab('activity')">活动招募</view>
        <view class="clean-tab" :class="{ active: activeTab === 'live' }" @click="switchTab('live')">直播预告</view>
      </view>
      
      <view class="content-list">
        <template v-if="activeTab === 'activity'">
          <view class="content-card" v-for="activity in activities" :key="activity.id" @click="handleActivityClick(activity)">
            <image :src="activity.image" class="content-img" mode="aspectFill" />
            <view class="content-info">
              <text class="content-title">{{ activity.title }}</text>
              <text class="content-desc">{{ activity.description }}</text>
              <view class="content-bottom">
                <text class="content-status text-green">报名中</text>
                <view class="btn-join" @click.stop="handleJoinActivity(activity)">加入</view>
              </view>
            </view>
          </view>
        </template>

        <template v-if="activeTab === 'live'">
          <view class="content-card" v-for="live in liveStreams" :key="live.id" @click="handleLiveClick(live)">
            <image :src="live.image" class="content-img" mode="aspectFill" />
            <view class="content-info">
              <text class="content-title">{{ live.title }}</text>
              <text class="content-desc">{{ live.description }}</text>
              <view class="content-bottom">
                <text class="content-status text-orange">{{ live.time || '即将开始' }}</text>
                <view class="btn-join outline" @click.stop="handleJoinLive(live)">预约</view>
              </view>
            </view>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>"""

new_style = """<style>
/* 极简专业风重置 */
.page-home {
  min-height: 100vh;
  background-color: #F9FAFB;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", STHeiti, "Microsoft Yahei", Tahoma, Simsun, sans-serif;
  padding-bottom: 40rpx;
}

/* 搜索栏 */
.header-search {
  background-color: #FFFFFF;
  padding: 20rpx 32rpx;
  padding-top: calc(20rpx + var(--status-bar-height, 0px));
  position: relative;
  z-index: 100;
}

.search-box {
  display: flex;
  align-items: center;
  background-color: #F3F4F6;
  height: 72rpx;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.icon-search {
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
}

.input-search {
  flex: 1;
  font-size: 28rpx;
  color: #1F2937;
}

.input-placeholder {
  color: #9CA3AF;
}

/* 搜索建议弹窗 */
.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #FFFFFF;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.05);
  border-radius: 0 0 24rpx 24rpx;
  padding: 24rpx 32rpx;
  z-index: 99;
}

.suggest-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.suggest-title { font-size: 26rpx; color: #6B7280; font-weight: 500; }
.suggest-clear { font-size: 24rpx; color: #9CA3AF; }

.suggest-list { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 24rpx; }
.suggest-list.column { flex-direction: column; gap: 0; }

.suggest-tag {
  background: #F3F4F6;
  color: #4B5563;
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 100rpx;
}

.suggest-row {
  padding: 16rpx 0;
  font-size: 28rpx;
  color: #1F2937;
  border-bottom: 1px solid #F9FAFB;
}

/* 轮播图 */
.banner-wrap {
  background-color: #FFFFFF;
  padding: 16rpx 32rpx;
}

.banner-swiper {
  height: 280rpx;
  border-radius: 16rpx;
  overflow: hidden;
  transform: translateY(0); /* Fix Safari rounded corner bug */
}

.banner-img {
  width: 100%;
  height: 100%;
  background-color: #F3F4F6;
}

/* 金刚区导航 */
.nav-grid {
  display: flex;
  justify-content: space-between;
  background-color: #FFFFFF;
  padding: 32rpx 40rpx 40rpx;
  margin-bottom: 20rpx;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.nav-icon {
  width: 88rpx;
  height: 88rpx;
}

.nav-text {
  font-size: 24rpx;
  color: #374151;
  font-weight: 500;
}

/* 核心业务区 */
.business-section {
  display: flex;
  gap: 20rpx;
  padding: 0 32rpx;
  margin-bottom: 24rpx;
}

.biz-left {
  flex: 1.1;
  background-color: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  height: 340rpx;
  position: relative;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.02);
}

.biz-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.biz-card {
  flex: 1;
  background-color: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  position: relative;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.02);
}

.biz-text-wrap {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
}

.biz-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 4rpx;
}

.biz-desc {
  font-size: 22rpx;
  color: #9CA3AF;
}

.biz-img-large {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  width: 160rpx;
  height: 160rpx;
  z-index: 1;
}

.biz-img-small {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  width: 100rpx;
  height: 100rpx;
  z-index: 1;
}

/* 章节标题通用 */
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
}

.section-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #111827;
}

.section-more {
  font-size: 26rpx;
  color: #6B7280;
}

.arrow {
  font-family: serif;
  margin-left: 4rpx;
}

/* 专业咨询师 */
.expert-section {
  background-color: #FFFFFF;
  margin-bottom: 24rpx;
  padding-bottom: 32rpx;
}

.expert-scroll {
  width: 100%;
}

.expert-list {
  display: flex;
  padding: 0 32rpx;
  gap: 24rpx;
}

.expert-card {
  width: 240rpx;
  flex-shrink: 0;
  background: #FFFFFF;
  border: 1px solid #F3F4F6;
  border-radius: 16rpx;
  padding: 32rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.01);
}

.expert-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  margin-bottom: 16rpx;
  background: #F9FAFB;
  border: 1px solid #F3F4F6;
}

.expert-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 8rpx;
}

.expert-loc {
  font-size: 22rpx;
  color: #6B7280;
  margin-bottom: 12rpx;
}

.expert-tags {
  margin-bottom: 16rpx;
}

.tag-item {
  font-size: 20rpx;
  color: #0D9488;
  background: #F0FDFA;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.expert-price {
  font-size: 26rpx;
  font-weight: 600;
  color: #1F2937;
  margin-top: auto;
}

/* 活动与直播 */
.content-section {
  background-color: #FFFFFF;
  padding: 0 32rpx 32rpx;
}

.clean-tabs {
  display: flex;
  gap: 48rpx;
  padding: 32rpx 0;
  border-bottom: 1px solid #F3F4F6;
  margin-bottom: 32rpx;
}

.clean-tab {
  font-size: 30rpx;
  color: #6B7280;
  font-weight: 500;
  position: relative;
  padding-bottom: 12rpx;
}

.clean-tab.active {
  color: #111827;
  font-weight: 600;
}

.clean-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 32rpx;
  height: 6rpx;
  background-color: #0D9488;
  border-radius: 6rpx;
}

.content-list {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.content-card {
  display: flex;
  gap: 24rpx;
}

.content-img {
  width: 200rpx;
  height: 150rpx;
  border-radius: 12rpx;
  background: #F3F4F6;
  flex-shrink: 0;
}

.content-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 8rpx;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.content-desc {
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-bottom: auto;
}

.content-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
}

.content-status {
  font-size: 24rpx;
  font-weight: 500;
}

.text-green { color: #10B981; }
.text-orange { color: #F59E0B; }

.btn-join {
  font-size: 24rpx;
  color: #FFFFFF;
  background: #0D9488;
  padding: 8rpx 32rpx;
  border-radius: 100rpx;
}

.btn-join.outline {
  background: transparent;
  color: #0D9488;
  border: 1px solid #0D9488;
}
</style>"""

new_content = new_template + "\n\n" + script_block + "\n\n" + new_style

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("index.vue updated to professional medical style.")
