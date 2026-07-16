<script lang="ts">
/**
 * uni-app App 入口：不要写 <template>，不要用 script setup 的 render。
 * 真机（尤其 iOS）上错误写法会触发 Vue Proxy `$` 自递归：
 * Maximum call stack size exceeded → getApp().$vm undefined。
 */
import { updateTabBarForRole, readStoredRole } from '@/utils/tabBar'
import { warnIfDeviceCannotReachLocalApi } from '@/utils/auth'

export default {
  onLaunch() {
    console.log('App Launch')
    console.log('API地址:', import.meta.env.VITE_API_BASE_URL)
    setTimeout(() => {
      warnIfDeviceCannotReachLocalApi()
    }, 0)
  },
  onShow() {
    console.log('App Show')
    setTimeout(() => {
      updateTabBarForRole(readStoredRole())
    }, 0)
  },
  onHide() {
    console.log('App Hide')
  },
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

::-webkit-scrollbar {
  width: 0;
  height: 0;
  color: transparent;
}
</style>
