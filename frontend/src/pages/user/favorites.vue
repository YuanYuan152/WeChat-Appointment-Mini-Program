<template>
  <view class="page-favorites">
    <view v-if="loading" class="state-box">
      <text class="state-text">加载中...</text>
    </view>

    <view v-else-if="!isLoggedIn" class="state-box">
      <text class="state-text">登录后可查看收藏的咨询师</text>
      <button class="login-btn" @click="goLogin">去登录</button>
    </view>

    <view v-else-if="favorites.length === 0" class="state-box">
      <image src="/static/images/place12.png" class="empty-img" mode="aspectFit" />
      <text class="state-text">暂无收藏的咨询师</text>
      <button class="login-btn outline" @click="goConsultants">去找咨询师</button>
    </view>

    <view v-else class="list-wrap">
      <view
        v-for="item in favorites"
        :key="item.counselorId"
        class="doc-card"
        @click="goDetail(item.counselorId)"
      >
        <view class="doc-card-top">
          <image
            :src="getAvatarUrl(item.avatarUrl)"
            class="doc-avatar"
            mode="aspectFill"
          />
          <view class="doc-info">
            <view class="doc-name-row">
              <text class="doc-name">{{ item.name }}</text>
              <text class="doc-title">{{ item.title || '心理咨询师' }}</text>
            </view>
            <view class="doc-stats">
              <text class="stat-text">从业{{ item.workYears || 0 }}年</text>
              <text class="stat-dot">·</text>
              <text class="stat-text">{{ item.consultHours || 0 }}小时+</text>
            </view>
            <view v-if="item.specialty" class="doc-tags">
              <text
                v-for="(tag, idx) in getSpecialties(item.specialty)"
                :key="idx"
                class="doc-tag"
              >{{ tag }}</text>
            </view>
          </view>
        </view>
        <view class="doc-card-bottom">
          <view class="doc-price-box">
            <text class="price-symbol">￥</text>
            <text class="price-num">{{ formatPrice(item.billing) }}</text>
            <text class="price-unit">/50分钟</text>
          </view>
          <button class="book-btn" @click.stop="goDetail(item.counselorId)">立即预约</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { API_ENDPOINTS } from '@/config/api'
import { httpV2 } from '@/utils/http'
import { isLoggedIn as checkIsLoggedIn } from '@/utils/auth'

interface FavoriteItem {
  counselorId: number
  name: string
  title?: string
  avatarUrl?: string
  specialty?: string
  billing?: number
  workYears?: number
  consultHours?: number
  createdAt?: string
}

const loading = ref(true)
const isLoggedIn = ref(false)
const favorites = ref<FavoriteItem[]>([])

const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return '/static/images/tc59.png'
  if (avatar.startsWith('http')) return avatar
  return avatar
}

const formatPrice = (billing?: number) => {
  if (!billing) return 500
  return Math.round(billing / 100)
}

const getSpecialties = (specialty?: string) => {
  if (!specialty) return []
  return specialty.split(/[,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 3)
}

const loadFavorites = async () => {
  loading.value = true
  isLoggedIn.value = checkIsLoggedIn()
  if (!isLoggedIn.value) {
    favorites.value = []
    loading.value = false
    return
  }
  try {
    const res = await httpV2.get<FavoriteItem[]>(
      API_ENDPOINTS.patient.favorites,
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && Array.isArray(res.data)) {
      favorites.value = res.data
    } else {
      favorites.value = []
    }
  } catch {
    favorites.value = []
  } finally {
    loading.value = false
  }
}

const goDetail = (id: number) => {
  uni.navigateTo({ url: `/pages/consultant/detail?id=${id}` })
}

const goLogin = () => {
  uni.navigateTo({ url: '/pages/auth/login' })
}

const goConsultants = () => {
  uni.navigateTo({ url: '/pages/consultant/list' })
}

onMounted(loadFavorites)
onShow(loadFavorites)
</script>

<style scoped>
.page-favorites {
  min-height: 100vh;
  background: #F5F7FA;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
  gap: 24rpx;
}

.empty-img {
  width: 240rpx;
  height: 240rpx;
  opacity: 0.6;
}

.state-text {
  font-size: 28rpx;
  color: #9CA3AF;
}

.login-btn {
  margin-top: 16rpx;
  background: linear-gradient(135deg, #0F766E 0%, #0D9488 100%);
  color: #fff;
  font-size: 28rpx;
  padding: 0 48rpx;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 100rpx;
}

.login-btn::after {
  border: none;
}

.login-btn.outline {
  background: #fff;
  color: #0D9488;
  border: 2rpx solid #0D9488;
}

.list-wrap {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.doc-card {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.03);
}

.doc-card:active {
  transform: scale(0.98);
}

.doc-card-top {
  display: flex;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.doc-avatar {
  width: 140rpx;
  height: 140rpx;
  border-radius: 24rpx;
  background: #F3F4F6;
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.doc-name-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}

.doc-name {
  font-size: 34rpx;
  font-weight: 800;
  color: #1F2937;
}

.doc-title {
  font-size: 24rpx;
  color: #6B7280;
  background: #F3F4F6;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.doc-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16rpx;
}

.stat-text {
  font-size: 24rpx;
  color: #6B7280;
}

.stat-dot {
  font-size: 24rpx;
  color: #D1D5DB;
  margin: 0 8rpx;
}

.doc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.doc-tag {
  font-size: 22rpx;
  color: #0D9488;
  background: #F0FDFA;
  padding: 6rpx 16rpx;
  border-radius: 100rpx;
}

.doc-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24rpx;
  border-top: 1px dashed #E5E7EB;
}

.doc-price-box {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 24rpx;
  color: #F59E0B;
  font-weight: 700;
}

.price-num {
  font-size: 40rpx;
  color: #F59E0B;
  font-weight: 800;
}

.price-unit {
  font-size: 22rpx;
  color: #9CA3AF;
  margin-left: 4rpx;
}

.book-btn {
  background: linear-gradient(135deg, #0F766E 0%, #0D9488 100%);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  padding: 0 32rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 100rpx;
  margin: 0;
}

.book-btn::after {
  border: none;
}
</style>
