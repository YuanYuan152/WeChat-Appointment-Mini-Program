<script lang="ts">
/**
 * uni-app App 入口：不要写 <template>。
 * createApp().app.mount('#app') 在微信端必须保留。
 */
import { updateTabBarForRole, readStoredRole } from '@/utils/tabBar'
import { isDevMode, warnIfDeviceCannotReachLocalApi } from '@/utils/auth'
import { migrateLegacySession } from '@/utils/session'
import { resolveApiV2BaseUrl } from '@/config/apiBase'

let launched = false

export default {
  onLaunch() {
    if (launched) return
    launched = true
    const v2Base = resolveApiV2BaseUrl()
    // warn 比 info 更容易在真机调试/过滤级别下看到
    console.warn('[API_V2] V2后端地址=', v2Base)
    console.log('App Launch')
    console.log('V2 API:', v2Base)
    if (isDevMode()) {
      // 真机调试时主窗口 Console 往往看不到日志，用 Toast 直接确认地址
      setTimeout(() => {
        uni.showToast({
          title: `V2:${v2Base.replace(/^https?:\/\//, '')}`,
          icon: 'none',
          duration: 3500,
        })
      }, 500)
    }
    try {
      migrateLegacySession()
    } catch (e) {
      console.warn('migrateLegacySession failed', e)
    }
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
