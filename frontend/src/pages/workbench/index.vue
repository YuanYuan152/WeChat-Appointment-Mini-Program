<template>
  <view class="page-workbench-router" :class="{ 'records-mode': state === 'patientRecords' }">
    <!-- 来访者：第三个 tab 展示预约记录 -->
    <PatientRecordsList v-if="state === 'patientRecords'" :refresh-key="recordsRefreshKey" />

    <!-- 未登录 -->
    <view v-else-if="state === 'needLogin'" class="card">
      <text class="title">请先登录</text>
      <text class="desc">登录后可查看预约记录，或根据账号角色进入对应工作台</text>
      <DevRolePicker />
      <button class="login-btn" @click="goLogin">微信一键登录</button>
    </view>

    <!-- 加载中 -->
    <view v-else-if="state === 'loading'" class="card">
      <view class="spinner" />
      <text class="title">正在进入工作台</text>
      <text class="desc">将根据您的账号角色打开对应工作台</text>
    </view>

    <!-- 失败 -->
    <view v-else-if="state === 'error'" class="card">
      <text class="title">进入工作台失败</text>
      <text class="desc">{{ errorMsg }}</text>
      <button class="login-btn" @click="goLogin">重新登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { AuthApi } from '@/apis/auth'
import DevRolePicker from '@/components/DevRolePicker.vue'
import PatientRecordsList from '@/components/PatientRecordsList.vue'
import {
  getDevLoginCode,
  getDevWorkbenchRole,
  isLoggedIn,
  isMockLoginEnabled,
  resolveWxLoginCode,
} from '@/utils/auth'
import { cacheRoleSnapshot, clearRoleSnapshot, syncTabBarByAuth } from '@/utils/tabBar'

type RouterState = 'loading' | 'needLogin' | 'error' | 'patientRecords'

const state = ref<RouterState>('loading')
const errorMsg = ref('')
const recordsRefreshKey = ref(0)

const ROLE_ROUTES: Record<string, string> = {
  Counselor: '/pages/counselor/workbench/index',
  Assistant: '/pages/assistant/workbench/index',
  Ops: '/pages/ops/index/index',
  Admin: '/pages/ops/index/index',
}

const WORKBENCH_ROLES = new Set(['Counselor', 'Assistant', 'Ops', 'Admin'])

const resolveActiveRole = (roles: string[], activeRole?: string) => {
  // 测试/开发联调：以 DevRolePicker 所选角色为准，避免多角色账号 ActiveRole 不一致
  if (isMockLoginEnabled()) {
    const devRole = getDevWorkbenchRole()
    if (devRole && devRole !== 'Patient' && roles.includes(devRole)) return devRole
  }
  // 来访者主动切换为 Patient 时，不再按多角色优先级跳进工作台
  if (activeRole === 'Patient') return 'Patient'
  if (activeRole && WORKBENCH_ROLES.has(activeRole)) return activeRole
  const priority = ['Counselor', 'Assistant', 'Ops', 'Admin']
  return priority.find(role => roles.includes(role)) || 'Patient'
}

const goLogin = async () => {
  state.value = 'loading'
  try {
    const code = (await resolveWxLoginCode()) || getDevLoginCode()
    await AuthApi.wxLogin(code)
    await routeToWorkbench()
  } catch (e: any) {
    state.value = 'error'
    errorMsg.value = e?.message || '登录失败'
  }
}

const routeToWorkbench = async () => {
  if (!isLoggedIn()) {
    clearRoleSnapshot()
    syncTabBarByAuth()
    uni.setNavigationBarTitle({ title: '预约记录' })
    state.value = 'needLogin'
    return
  }

  state.value = 'loading'
  uni.setNavigationBarTitle({ title: '工作台' })
  try {
    const me = await AuthApi.getMe()
    const role = resolveActiveRole(me.roles || [], me.activeRole)

    cacheRoleSnapshot(me)
    syncTabBarByAuth(me)

    if (!WORKBENCH_ROLES.has(role)) {
      uni.setNavigationBarTitle({ title: '预约记录' })
      recordsRefreshKey.value += 1
      state.value = 'patientRecords'
      return
    }

    if (role !== me.activeRole) {
      await AuthApi.switchRole(role)
      cacheRoleSnapshot({ roles: me.roles || [], activeRole: role })
      syncTabBarByAuth({ roles: me.roles || [], activeRole: role })
    }

    const target = ROLE_ROUTES[role]
    uni.redirectTo({ url: target })
  } catch (e: any) {
    state.value = 'error'
    errorMsg.value = e?.message || '请先登录'
  }
}

onShow(() => {
  syncTabBarByAuth()
  routeToWorkbench()
})
</script>

<style scoped>
.page-workbench-router {
  min-height: 100vh;
  background: #F7F5F2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}
.page-workbench-router.records-mode {
  display: block;
  padding: 0;
  background: #F4F6F8;
}
.card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 72rpx 40rpx;
  text-align: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.04);
}
.patient-card { padding-top: 56rpx; }
.patient-emoji {
  display: block;
  font-size: 88rpx;
  margin-bottom: 24rpx;
  line-height: 1.2;
}
.spinner {
  width: 64rpx; height: 64rpx; border-radius: 50%;
  border: 6rpx solid #E8E4DE; border-top-color: #3D5A4E;
  margin: 0 auto 32rpx;
  animation: spin 0.9s linear infinite;
}
.title { display: block; font-size: 34rpx; font-weight: 600; color: #2C2C2C; }
.desc { display: block; font-size: 26rpx; color: #8A8A8A; margin-top: 12rpx; line-height: 1.6; }
.patient-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
  justify-content: center;
}
.ghost-btn {
  flex: 1;
  max-width: 280rpx;
  background: #F0EDE8;
  color: #3D5A4E;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}
.login-btn {
  margin-top: 48rpx;
  background: #3D5A4E; color: #fff;
  height: 88rpx; line-height: 88rpx;
  border-radius: 12rpx; font-size: 30rpx; font-weight: 600; border: none;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
