/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_V2_BASE_URL: string
  readonly VITE_DEV_LOGIN_ROLE: string
  /** true：显示开发者入口与模拟登录；生产构建务必 false 或不写 */
  readonly VITE_ENABLE_MOCK_LOGIN: string
  readonly VITE_USE_BOOKING_MOCK: string
  /** 设为 true 时走真实微信支付；默认 false，一键模拟支付 */
  readonly VITE_ENABLE_REAL_PAY: string
  readonly VITE_API_TIMEOUT: string
    readonly VITE_ADMIN_WEB_URL: string
    readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 