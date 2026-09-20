<template>
  <view class="page-live-detail">
    <view v-if="loading" class="state-text">加载中...</view>
    <view v-else-if="!live" class="state-text">直播预告不存在或已下架</view>
    <view v-else class="detail-wrap">
      <view class="detail-card">
        <text class="detail-title">{{ live.title }}</text>
        <text v-if="live.description" class="detail-copy">{{ live.description }}</text>
      </view>

      <!-- 图片独立于圆角 overflow 容器，避免影响长按识别 -->
      <view v-if="live.image" class="calendar-block">
        <image
          :src="displayImageSrc"
          class="calendar-image"
          mode="widthFix"
          :show-menu-by-longpress="true"
          @error="handleImageError"
          @tap="previewCalendarImage"
        />
        <text class="calendar-tip">点击放大后长按，如果无法扫码请先下载图片</text>
        <view class="calendar-actions">
          <view class="calendar-btn" @tap="previewCalendarImage">放大</view>
          <view class="calendar-btn outline" @tap="shareCalendarImage">分享</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { homeApi } from '@/apis'
import type { LiveStream } from '@/types'

const loading = ref(true)
const live = ref<LiveStream | null>(null)
/** 本地下载后的临时路径，iOS 长按识别更稳定 */
const localImagePath = ref('')

const displayImageSrc = computed(() => localImagePath.value || live.value?.image || '')

const resolveLocalImage = (url: string): Promise<string> => {
  const src = String(url || '').trim()
  if (!src) return Promise.resolve('')
  // 已是本地临时文件
  if (
    src.startsWith('wxfile://')
    || src.startsWith('http://tmp')
    || src.startsWith('https://tmp')
    || src.startsWith('file://')
  ) {
    return Promise.resolve(src)
  }
  // 包内相对路径无需下载
  if (src.startsWith('/') && !src.startsWith('//') && !src.startsWith('/static/uploads/')) {
    return Promise.resolve(src)
  }
  if (!/^https?:\/\//i.test(src)) {
    return Promise.resolve(src)
  }

  return new Promise((resolve) => {
    uni.downloadFile({
      url: src,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }
        resolve(src)
      },
      fail: () => resolve(src),
    })
  })
}

const prepareLocalImage = async (url?: string) => {
  const src = String(url || '').trim()
  if (!src) {
    localImagePath.value = ''
    return
  }
  localImagePath.value = await resolveLocalImage(src)
}

const loadLive = async (id: number) => {
  try {
    const result = await homeApi.getLiveStreams()
    if (result.code === 0) {
      live.value = (result.data || []).find((item) => item.id === id) || null
      if (live.value?.title) {
        uni.setNavigationBarTitle({ title: live.value.title })
      }
      await prepareLocalImage(live.value?.image)
    }
  } catch {
    live.value = null
    uni.showToast({ title: '直播预告加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const handleImageError = () => {
  // 本地下载失败时回退网络地址再试一次
  if (localImagePath.value && live.value?.image && localImagePath.value !== live.value.image) {
    localImagePath.value = live.value.image
    return
  }
  uni.showToast({ title: '直播日历图片加载失败', icon: 'none' })
}

const previewCalendarImage = async () => {
  const remote = live.value?.image
  if (!remote) return
  if (!localImagePath.value) {
    await prepareLocalImage(remote)
  }
  const url = localImagePath.value || remote
  uni.previewImage({
    current: url,
    urls: [url],
    fail: () => {
      uni.showToast({ title: '无法预览图片', icon: 'none' })
    },
  })
}

const shareCalendarImage = async () => {
  const remote = live.value?.image
  if (!remote) return
  if (!localImagePath.value) {
    await prepareLocalImage(remote)
  }
  const path = localImagePath.value || remote
  // #ifdef MP-WEIXIN
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wxApi = (globalThis as any).wx
    if (wxApi && typeof wxApi.showShareImageMenu === 'function') {
      wxApi.showShareImageMenu({
        path,
        fail: () => {
          void previewCalendarImage()
        },
      })
      return
    }
  } catch {
    // fall through
  }
  // #endif
  void previewCalendarImage()
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
.detail-wrap {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.detail-card {
  padding: 32rpx;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
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
.calendar-block {
  padding: 24rpx;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}
.calendar-image {
  display: block;
  width: 100%;
  background: #F0EDE8;
}
.calendar-tip {
  display: block;
  margin-top: 20rpx;
  color: #8A8A8A;
  font-size: 24rpx;
  line-height: 1.6;
}
.calendar-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
.calendar-btn {
  flex: 1;
  text-align: center;
  padding: 18rpx 12rpx;
  border-radius: 999rpx;
  background: #3D5A4E;
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
}
.calendar-btn.outline {
  background: #fff;
  color: #3D5A4E;
  border: 1rpx solid #3D5A4E;
}
.calendar-btn:active {
  opacity: 0.85;
}
</style>
