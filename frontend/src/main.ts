import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setupRouteGuard } from '@/utils/routeGuard'

// 创建应用实例
const app = createSSRApp(App)

// 配置Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 注册路由守卫
setupRouteGuard()

// 挂载应用
export function createApp() {
  return {
    app
  }
} 