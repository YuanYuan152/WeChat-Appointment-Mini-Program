<template>
  <WorkbenchRouter ref="routerRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import WorkbenchRouter from '@/components/WorkbenchRouter.vue'

const routerRef = ref<InstanceType<typeof WorkbenchRouter> | null>(null)

onShow(() => {
  routerRef.value?.activate()
})
</script>
