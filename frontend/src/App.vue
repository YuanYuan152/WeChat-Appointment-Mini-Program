<template>
  <view id="app">
    <!-- UniApp会自动处理页面路由 -->
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { updateTabBarForRole, readStoredRoles } from '@/utils/tabBar'

// 应用启动时执行
onLaunch(() => {
  console.log('App Launch')
  // 初始化应用配置
  initApp()
})

// 应用显示时执行
onShow(() => {
  console.log('App Show')
  updateTabBarForRole(readStoredRoles())
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
/* 全局样式 — 亚朵风简约高级 */
page {
  background-color: #F7F5F2;
  color: #2C2C2C;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-size: 14px;
  line-height: 1.6;
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