<template>
  <view class="page-live-detail">
    <view v-if="loading" class="state-text">加载中...</view>
    <view v-else-if="!live" class="state-text">直播预告不存在或已下架</view>
    <view v-else class="detail-card">
      <text class="detail-title">{{ live.title }}</text>
      <text v-if="live.description" class="detail-copy">{{ live.description }}</text>
      <image
        v-if="live.image"
        :src="live.image"
        class="calendar-image"
        mode="widthFix"
        @error="handleImageError"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { homeApi } from '@/apis'
import type { LiveStream } from '@/types'

const loading = ref(true)
const live = ref<LiveStream | null>(null)

const loadLive = async (id: number) => {
  try {
    const result = await homeApi.getLiveStreams()
    if (result.code === 0) {
      live.value = (result.data || []).find(item => item.id === id) || null
      if (live.value?.title) {
        uni.setNavigationBarTitle({ title: live.value.title })
      }
    }
  } catch {
    live.value = null
    uni.showToast({ title: '直播预告加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const handleImageError = () => {
  uni.showToast({ title: '直播日历图片加载失败', icon: 'none' })
}

onLoad((query) => {
  const id = Number(query?.id || 0)
  if (!id) {
    loading.value = false
    return
  }
  void loadLive(id)
})
</script>

<style scoped>
.page-live-detail {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 28rpx;
  background: #F7F5F2;
}
.state-text {
  padding: 120rpx 24rpx;
  color: #8A8A8A;
  font-size: 28rpx;
  text-align: center;
}
.detail-card {
  overflow: hidden;
  padding: 32rpx;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}
.detail-title {
  display: block;
  color: #2C2C2C;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.45;
}
.detail-copy {
  display: block;
  margin-top: 20rpx;
  color: #6B7280;
  font-size: 27rpx;
  line-height: 1.8;
  white-space: pre-wrap;
}
.calendar-image {
  display: block;
  width: 100%;
  margin-top: 28rpx;
  border-radius: 16rpx;
  background: #F0EDE8;
}
</style>
