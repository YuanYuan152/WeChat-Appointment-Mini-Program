import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setupRouteGuard } from '@/utils/routeGuard'

/**
 * uni-app 约定：必须在 createApp() 内创建实例并 return { app }。
 * 不要在模块顶层 createSSRApp，也不要调用 app.mount('#app')——
 * 后者是 H5 写法，打进 mp-weixin 后真机上会触发 `$` 无限递归
 * （Maximum call stack size exceeded → getApp().$vm undefined）。
 */
export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  setupRouteGuard()
  return {
    app,
  }
}
