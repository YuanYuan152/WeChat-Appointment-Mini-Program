<template>
  <view id="app">
    <!-- UniApp会自动处理页面路由 -->
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

// 应用启动时执行
onLaunch(() => {
  console.log('App Launch')
  // 初始化应用配置
  initApp()
})

// 应用显示时执行
onShow(() => {
  console.log('App Show')
})

// 应用隐藏时执行
onHide(() => {
  console.log('App Hide')
})

// 初始化应用
const initApp = () => {
  console.log('应用初始化完成')
  console.log('API地址:', import.meta.env.VITE_API_BASE_URL)
}
</script>

<style>
/* 全局样式重置与规范 */
page {
  background-color: #F9FAFB; /* 暖灰背景，减少视觉疲劳 */
  color: #1F2937; /* 深灰文字，避免纯黑的压迫感 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 14px;
  line-height: 1.5;
}

#app {
  min-height: 100vh;
}

/* 隐藏滚动条但保留滚动功能 (提升美观度) */
::-webkit-scrollbar {
  width: 0;
  height: 0;
  color: transparent;
}

/* 统一图片默认行为 */
image {
  will-change: transform;
}
</style>