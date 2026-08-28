<template>
  <view class="staff-nav-root">
    <view class="staff-nav" :class="theme" :style="navWrapStyle">
      <view class="staff-nav-content" :style="contentStyle">
        <view class="staff-nav-back-area" @tap="onBack">
          <text class="staff-nav-back-icon">‹</text>
          <text class="staff-nav-back-text">返回</text>
        </view>
        <text class="staff-nav-title">{{ title }}</text>
        <view class="staff-nav-side" :style="{ width: capsuleWidthPx + 'px' }" />
      </view>
    </view>
    <view class="staff-nav-placeholder" :style="{ height: navHeightPx + 'px' }" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { navigateBackOrHome } from '@/utils/pageBack'

withDefaults(
  defineProps<{
    title: string
    theme?: 'green' | 'light'
  }>(),
  { theme: 'green' },
)

const sys = uni.getSystemInfoSync()
const statusBarPx = ref(sys.statusBarHeight || 0)

function resolveNavMetrics() {
  try {
    const menuButton = uni.getMenuButtonBoundingClientRect()
    const windowWidth = sys.windowWidth || 0
    if (menuButton?.height && menuButton?.top) {
      const navBarHeight = menuButton.height + (menuButton.top - (sys.statusBarHeight || 0)) * 2
      const capsuleWidth = windowWidth - menuButton.left + uni.upx2px(8)
      return {
        navBarHeight,
        capsuleWidth: Math.max(capsuleWidth, uni.upx2px(80)),
      }
    }
  } catch {
    // ignore
  }
  return {
    navBarHeight: uni.upx2px(88),
    capsuleWidth: uni.upx2px(80),
  }
}

const navMetrics = resolveNavMetrics()
const navBarPx = navMetrics.navBarHeight
const capsuleWidthPx = ref(navMetrics.capsuleWidth)
const navHeightPx = computed(() => statusBarPx.value + navBarPx)

const navWrapStyle = computed(() => ({
  paddingTop: `${statusBarPx.value}px`,
}))

const contentStyle = computed(() => ({
  height: `${navBarPx}px`,
}))

const onBack = () => navigateBackOrHome()

defineExpose({ navHeightPx })
</script>

<style scoped>
.staff-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  box-sizing: border-box;
}

.staff-nav.green {
  background: #3d5a4e;
}

.staff-nav.light {
  background: #ffffff;
  box-shadow: 0 1rpx 0 rgba(0, 0, 0, 0.06);
}

.staff-nav-content {
  display: flex;
  align-items: center;
  padding: 0 16rpx 0 8rpx;
  box-sizing: border-box;
}

.staff-nav-back-area {
  display: flex;
  align-items: center;
  min-width: 120rpx;
  height: 64rpx;
  padding: 0 16rpx 0 8rpx;
  flex-shrink: 0;
}

.staff-nav-back-icon {
  font-size: 52rpx;
  line-height: 1;
  margin-top: -6rpx;
  margin-right: 2rpx;
  font-weight: 400;
}

.staff-nav-back-text {
  font-size: 30rpx;
  font-weight: 500;
}

.staff-nav.green .staff-nav-back-icon,
.staff-nav.green .staff-nav-back-text,
.staff-nav.green .staff-nav-title {
  color: #ffffff;
}

.staff-nav.light .staff-nav-back-icon,
.staff-nav.light .staff-nav-back-text,
.staff-nav.light .staff-nav-title {
  color: #2c2c2c;
}

.staff-nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staff-nav-side {
  flex-shrink: 0;
}

.staff-nav-placeholder {
  width: 100%;
}
</style>
