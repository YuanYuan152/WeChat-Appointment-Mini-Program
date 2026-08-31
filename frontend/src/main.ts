import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setupRouteGuard } from '@/utils/routeGuard'
import shareMixin from '@/utils/shareMixin'

/**
 * uni-app 约定：导出 createApp，由编译器注入 createApp().app.mount('#app')。
 * 微信小程序端 mount 会被劫持成注册原生 App / $vm，不要删掉。
 */
export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  app.mixin(shareMixin)
  setupRouteGuard()
  return {
    app,
  }
}
