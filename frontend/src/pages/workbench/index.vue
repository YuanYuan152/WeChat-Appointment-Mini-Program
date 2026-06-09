<template>
  <view class="page-workbench-router">
    <!-- 未登录状态 -->
    <view v-if="state === 'needLogin'" class="card">
      <text class="title">请先登录</text>
      <text class="desc">登录后将根据您的角色进入对应工作台</text>
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
import { AuthApi } from '@/apis/auth'
import { isLoggedIn, resolveWxLoginCode } from '@/utils/auth'

const state = ref<'loading' | 'needLogin' | 'error'>('loading')
const errorMsg = ref('')

const ROLE_ROUTES: Record<string, string> = {
  Counselor: '/pages/counselor/workbench/index',
  Assistant: '/pages/assistant/workbench/index',
  Ops: '/pages/ops/index/index',
  Admin: '/pages/ops/index/index',
  Patient: '/pages/user/profile',
}

const pickRole = (roles: string[], activeRole?: string) => {
  if (activeRole && ROLE_ROUTES[activeRole]) return activeRole
  const priority = ['Counselor', 'Assistant', 'Ops', 'Admin', 'Patient']
  return priority.find(role => roles.includes(role)) || 'Patient'
}

const goLogin = async () => {
  state.value = 'loading'
  try {
    const code = (await resolveWxLoginCode()) || 'dev_local'
    await AuthApi.wxLogin(code)
    await routeToWorkbench()
  } catch (e: any) {
    state.value = 'error'
    errorMsg.value = e?.message || '登录失败'
  }
}

const routeToWorkbench = async () => {
  if (!isLoggedIn()) {
    state.value = 'needLogin'
    return
  }

  state.value = 'loading'
  try {
    const me = await AuthApi.getMe()
    const role = pickRole(me.roles || [], me.activeRole)
    const target = ROLE_ROUTES[role] || ROLE_ROUTES.Patient

    if (role !== me.activeRole) {
      await AuthApi.switchRole(role)
    }

    uni.setStorageSync('user_roles', JSON.stringify(me.roles || []))

    if (target === '/pages/user/profile') {
      uni.switchTab({ url: target })
    } else {
      uni.redirectTo({ url: target })
    }
  } catch (e: any) {
    state.value = 'error'
    errorMsg.value = e?.message || '请先登录'
  }
}

// 每次 Tab 显示时检查
const onTabShow = () => {
  if (isLoggedIn()) {
    routeToWorkbench()
  } else {
    state.value = 'needLogin'
  }
}

// uni-app 生命周期
import { onShow } from '@dcloudio/uni-app'
onShow(onTabShow)
</script>

<style scoped>
.page-workbench-router {
  min-height: 100vh;
  background: #F4F6F8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}
.card {
  width: 100%;
  background: #fff;
  border-radius: 32rpx;
  padding: 72rpx 40rpx;
  text-align: center;
  box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.08);
}
.spinner {
  width: 64rpx; height: 64rpx; border-radius: 50%;
  border: 6rpx solid #D1FAE5; border-top-color: #0D9488;
  margin: 0 auto 32rpx;
  animation: spin 0.9s linear infinite;
}
.title { display: block; font-size: 34rpx; font-weight: 800; color: #1F2937; }
.desc { display: block; font-size: 26rpx; color: #6B7280; margin-top: 12rpx; }
.login-btn {
  margin-top: 48rpx;
  background: #0D9488; color: #fff;
  height: 88rpx; line-height: 88rpx;
  border-radius: 100rpx; font-size: 30rpx; font-weight: 600; border: none;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
