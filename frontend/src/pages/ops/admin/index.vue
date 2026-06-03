<template>
  <view class="page-admin">
    <web-view :src="webviewUrl" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const webviewUrl = ref('')

onMounted(() => {
  const pages = getCurrentPages()
  const opts = (pages[pages.length - 1] as any)?.options
  // url 参数从路由传入，也可在此处配置默认后台地址
  const rawUrl = opts?.url || ''
  webviewUrl.value = rawUrl ? decodeURIComponent(rawUrl) : import.meta.env.VITE_ADMIN_WEB_URL || ''
})
</script>

<style scoped>
.page-admin { width: 100%; height: 100vh; }
web-view { width: 100%; height: 100%; }
</style>
