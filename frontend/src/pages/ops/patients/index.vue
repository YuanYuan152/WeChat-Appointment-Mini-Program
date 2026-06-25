<template><view></view></template>
<script setup lang="ts">
import { onMounted } from 'vue'
onMounted(() => {
  uni.redirectTo({ url: '/pages/ops/users/index?tab=patients' })
})
</script>
