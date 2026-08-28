<template>
  <view class="tab-slot">
    <view v-if="!ready" class="tab-slot-placeholder">
      <text class="tab-slot-placeholder-text">{{ placeholderText }}</text>
    </view>
    <PatientRecordsPanel v-else-if="mode === 'patient'" ref="patientPanelRef" />
    <WorkbenchRouter v-else ref="workbenchRef" />
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { AuthApi } from '@/apis/auth'
import { ensureLoggedInOrRedirect, isLoggedIn } from '@/utils/auth'
import { updateTabBarForRole, resolveTabSlotIsPatient } from '@/utils/tabBar'
import PatientRecordsPanel from '@/components/PatientRecordsPanel.vue'
import WorkbenchRouter from '@/components/WorkbenchRouter.vue'

const mode = ref<'patient' | 'workbench'>('patient')
const ready = ref(false)
const placeholderText = ref('请先登录')
const patientPanelRef = ref<InstanceType<typeof PatientRecordsPanel> | null>(null)
const workbenchRef = ref<InstanceType<typeof WorkbenchRouter> | null>(null)

const syncMode = async () => {
  if (!ensureLoggedInOrRedirect('/pages/tab-slot/index')) {
    ready.value = false
    mode.value = 'patient'
    placeholderText.value = '请先登录'
    updateTabBarForRole([])
    uni.setNavigationBarTitle({ title: '预约记录' })
    return
  }

  try {
    const me = await AuthApi.getMe()
    uni.setStorageSync('user_roles', JSON.stringify(me.roles || []))
    if (me.activeRole) uni.setStorageSync('active_role', me.activeRole)

    const isPatient = resolveTabSlotIsPatient(me.roles)
    mode.value = isPatient ? 'patient' : 'workbench'
    ready.value = true
    updateTabBarForRole(me.roles)
    uni.setNavigationBarTitle({ title: isPatient ? '预约记录' : '工作台' })
  } catch {
    if (!isLoggedIn()) {
      ready.value = false
      placeholderText.value = '请先登录'
      ensureLoggedInOrRedirect('/pages/tab-slot/index')
      return
    }
    mode.value = 'patient'
    ready.value = true
    updateTabBarForRole()
    uni.setNavigationBarTitle({ title: '预约记录' })
  }
}

onShow(async () => {
  ready.value = false
  await syncMode()
  await nextTick()
  if (!ready.value) return
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

.tab-slot-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 48rpx;
}

.tab-slot-placeholder-text {
  font-size: 28rpx;
  color: #8a8a8a;
}
</style>
