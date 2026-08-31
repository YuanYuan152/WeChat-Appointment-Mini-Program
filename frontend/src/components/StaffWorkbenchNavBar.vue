<template>
  <view class="staff-nav-root">
    <view class="staff-nav" :class="theme" :style="navWrapStyle">
      <view class="staff-nav-content" :style="contentStyle">
        <view class="staff-nav-side staff-nav-side-left" :style="sideStyle">
          <view class="staff-nav-back-area" @tap="onBack">
            <text class="staff-nav-back-icon">‹</text>
            <text class="staff-nav-back-text">返回</text>
          </view>
        </view>
        <text class="staff-nav-title" :style="titleStyle">{{ title }}</text>
        <view class="staff-nav-side staff-nav-side-right" :style="sideStyle" />
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
      const backSlotMin = uni.upx2px(120)
      return {
        navBarHeight,
        sideWidth: Math.max(capsuleWidth, backSlotMin),
      }
    }
  } catch {
    // ignore
  }
  return {
    navBarHeight: uni.upx2px(88),
    sideWidth: uni.upx2px(120),
  }
}

const navMetrics = resolveNavMetrics()
const navBarPx = navMetrics.navBarHeight
const sideWidthPx = ref(navMetrics.sideWidth)
const navHeightPx = computed(() => statusBarPx.value + navBarPx)

const navWrapStyle = computed(() => ({
  paddingTop: `${statusBarPx.value}px`,
}))

const contentStyle = computed(() => ({
  height: `${navBarPx}px`,
}))

const sideStyle = computed(() => ({
  width: `${sideWidthPx.value}px`,
}))

const titleStyle = computed(() => ({
  maxWidth: `calc(100% - ${sideWidthPx.value * 2}px)`,
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.staff-nav-side {
  flex-shrink: 0;
  height: 100%;
  display: flex;
  align-items: center;
}

.staff-nav-side-left {
  justify-content: flex-start;
}

.staff-nav-side-right {
  justify-content: flex-end;
}

.staff-nav-back-area {
  display: flex;
  align-items: center;
  height: 64rpx;
  padding: 0 8rpx 0 12rpx;
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
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: 17px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.staff-nav-placeholder {
  width: 100%;
}
</style>
