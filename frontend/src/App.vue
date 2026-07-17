<script lang="ts">
/**
 * uni-app App 入口：不要写 <template>。
 * createApp().app.mount('#app') 在微信端必须保留。
 */
import { updateTabBarForRole, readStoredRole } from '@/utils/tabBar'
import { warnIfDeviceCannotReachLocalApi } from '@/utils/auth'

let launched = false

export default {
  onLaunch() {
    if (launched) return
    launched = true
    console.log('App Launch')
    console.log('V2 API:', import.meta.env.VITE_API_V2_BASE_URL || 'http://localhost:8000')
    setTimeout(() => {
      try {
        warnIfDeviceCannotReachLocalApi()
      } catch (e) {
        console.warn('warnIfDeviceCannotReachLocalApi failed', e)
      }
    }, 300)
  },
  onShow() {
    console.log('App Show')
    setTimeout(() => {
      try {
        updateTabBarForRole(readStoredRole())
      } catch (e) {
        console.warn('updateTabBarForRole failed', e)
      }
    }, 300)
  },
  onHide() {
    console.log('App Hide')
  },
}
</script>

<style>
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
