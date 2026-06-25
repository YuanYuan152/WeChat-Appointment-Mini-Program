<template>
  <PatientRecordsPanel ref="panelRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PatientRecordsPanel from '@/components/PatientRecordsPanel.vue'

const panelRef = ref<InstanceType<typeof PatientRecordsPanel> | null>(null)

onShow(() => {
  void panelRef.value?.refresh()
})
</script>
