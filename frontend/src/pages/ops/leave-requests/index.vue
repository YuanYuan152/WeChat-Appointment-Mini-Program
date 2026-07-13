<template>
  <view class="redirect-page" />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

onLoad((options) => {
  const parts = ['category=LEAVE']
  const leaveId = Number(options?.leaveId || options?.id || 0)
  if (leaveId) parts.push(`leaveId=${leaveId}`)
  uni.redirectTo({ url: `/pages/ops/approvals/index?${parts.join('&')}` })
})
</script>

<style scoped>
.redirect-page { min-height: 100vh; background: #F7F5F2; }
</style>
