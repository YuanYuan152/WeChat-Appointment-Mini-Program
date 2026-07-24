<template>
  <view class="wrap">
    <text class="tip">点击下方按钮，由微信官方弹出订阅消息授权（与完善资料页相同）。</text>
    <button class="btn" :loading="loading" :disabled="loading" @tap="handleEnable">打开微信授权</button>
    <button class="ghost" :disabled="loading" @tap="finishToHome">跳过</button>
  </view>
</template>

<script setup lang="ts">
/**
 * 兼容页：旧包可能仍会 redirect 到本路径。
 * 仅允许用户点击后调起官方 requestSubscribeMessage，禁止自定义「开启服务通知」Modal。
 */
import { ref, onMounted } from 'vue'
import { AuthApi } from '@/apis/auth'
import { isLoggedIn } from '@/utils/auth'
import { applyRoleAfterLogin, navigateToRoleHome } from '@/utils/roleLogin'
import {
  ROLE_EVENT_KEYS,
  requestOfficialSubscribeInGesture,
} from '@/utils/subscribeMessage'
import { getStoredRole } from '@/utils/session'

const loading = ref(false)

const finishToHome = async () => {
  try {
    const me = await AuthApi.getMe()
    const role = await applyRoleAfterLogin(me)
    const redirectUrl = uni.getStorageSync('redirectAfterLogin') as string | undefined
    navigateToRoleHome(role || 'Patient', redirectUrl || undefined)
  } catch {
    uni.switchTab({ url: '/pages/index/index' })
  }
}

const handleEnable = () => {
  if (loading.value) return
  loading.value = true
  const role = getStoredRole() || 'Patient'
  const keys = ROLE_EVENT_KEYS[role] || ROLE_EVENT_KEYS.Patient
  // 手势内同步官方授权
  void requestOfficialSubscribeInGesture(keys).finally(() => {
    loading.value = false
    setTimeout(() => finishToHome(), 400)
  })
}

onMounted(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: '/pages/auth/login' })
  }
})
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  padding: 120rpx 48rpx;
  background: #f7f5f2;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 24rpx;
}
.tip {
  text-align: center;
  font-size: 28rpx;
  color: #6b7280;
  margin-bottom: 40rpx;
  line-height: 1.6;
}
.btn {
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 100rpx;
  background: #07c160;
  color: #fff;
  font-size: 32rpx;
  font-weight: 700;
  border: none;
}
.ghost {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  background: transparent;
  color: #6b7280;
  font-size: 28rpx;
  border: 1px solid #e5e7eb;
}
</style>
