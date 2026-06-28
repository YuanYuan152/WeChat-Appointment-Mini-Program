<template>
  <view class="tab-slot">
    <PatientRecordsPanel v-if="mode === 'patient'" ref="patientPanelRef" />
    <WorkbenchRouter v-else ref="workbenchRef" />
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { AuthApi } from '@/apis/auth'
import { isLoggedIn } from '@/utils/auth'
import { updateTabBarForRole, resolveTabSlotIsPatient } from '@/utils/tabBar'
import PatientRecordsPanel from '@/components/PatientRecordsPanel.vue'
import WorkbenchRouter from '@/components/WorkbenchRouter.vue'

const mode = ref<'patient' | 'workbench'>('patient')
const patientPanelRef = ref<InstanceType<typeof PatientRecordsPanel> | null>(null)
const workbenchRef = ref<InstanceType<typeof WorkbenchRouter> | null>(null)

const syncMode = async () => {
  if (!isLoggedIn()) {
    mode.value = 'patient'
    updateTabBarForRole([], 'Patient')
    uni.setNavigationBarTitle({ title: '预约记录' })
    return
  }

  try {
    const me = await AuthApi.getMe()
    uni.setStorageSync('user_roles', JSON.stringify(me.roles || []))
    if (me.activeRole) uni.setStorageSync('active_role', me.activeRole)

    const isPatient = resolveTabSlotIsPatient(me.roles, me.activeRole)
    mode.value = isPatient ? 'patient' : 'workbench'
    updateTabBarForRole(me.roles, me.activeRole)
    uni.setNavigationBarTitle({ title: isPatient ? '预约记录' : '工作台' })
  } catch {
    mode.value = 'patient'
    updateTabBarForRole()
    uni.setNavigationBarTitle({ title: '预约记录' })
  }
}

onShow(async () => {
  await syncMode()
  await nextTick()
  if (mode.value === 'patient') {
    await patientPanelRef.value?.refresh()
  } else {
    workbenchRef.value?.activate()
  }
})
</script>

<style scoped>
.tab-slot {
  min-height: 100vh;
}
</style>
