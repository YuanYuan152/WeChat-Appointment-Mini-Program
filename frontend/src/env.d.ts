/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_V2_BASE_URL: string
  readonly VITE_USE_BOOKING_MOCK: string
  readonly VITE_API_TIMEOUT: string
    readonly VITE_ADMIN_WEB_URL: string
    readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 