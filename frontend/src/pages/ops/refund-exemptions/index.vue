<template>
  <view class="redirect-page" />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

onLoad((options) => {
  const parts = ['category=EXEMPTION']
  const exemptionId = Number(options?.exemptionId || options?.id || 0)
  if (exemptionId) parts.push(`exemptionId=${exemptionId}`)
  uni.redirectTo({ url: `/pages/ops/approvals/index?${parts.join('&')}` })
})
</script>

<style scoped>
.redirect-page { min-height: 100vh; background: #F7F5F2; }
</style>
