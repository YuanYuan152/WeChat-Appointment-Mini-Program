<template>
  <view class="wrap">
    <text class="tip">正在准备微信官方消息授权…</text>
    <button class="btn" :loading="loading" :disabled="loading" @tap="handleEnable">继续授权</button>
    <button class="ghost" :disabled="loading" @tap="finishToHome">跳过</button>
  </view>
</template>

<script setup lang="ts">
/**
 * 兼容页：旧包可能仍会 redirect 到本路径。
 * 不再展示「开启消息通知」自定义引导 UI，只触发微信官方 requestSubscribeMessage。
 */
import { ref, onMounted } from 'vue'
import { AuthApi } from '@/apis/auth'
import { isLoggedIn } from '@/utils/auth'
import { applyRoleAfterLogin, navigateToRoleHome } from '@/utils/roleLogin'
import {
  ROLE_EVENT_KEYS,
  FALLBACK_TEMPLATE_BY_EVENT,
  requestSubscribe,
  requestAndSaveSubscribe,
} from '@/utils/subscribeMessage'
import { getStoredRole } from '@/utils/session'
import { MessageApi } from '@/apis/message'

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

const handleEnable = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const role = getStoredRole() || 'Patient'
    const keys = ROLE_EVENT_KEYS[role] || ROLE_EVENT_KEYS.Patient
    const { accepted } = await requestAndSaveSubscribe(keys)
    uni.showToast({
      title: accepted ? '已授权服务通知' : '已记录你的选择',
      icon: 'none',
    })
  } catch (e: any) {
    console.warn('[subscribe-guide compat]', e)
  } finally {
    loading.value = false
    setTimeout(() => finishToHome(), 400)
  }
}

onMounted(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }
  // 进入即弹出系统确认，确认按钮手势内立刻调官方授权（避免停留在自定义引导页）
  uni.showModal({
    title: '开启服务通知',
    content: '点击「去授权」后，将由微信官方弹出订阅消息授权框。',
    confirmText: '去授权',
    cancelText: '暂不',
    success: async (res) => {
      if (!res.confirm) {
        try {
          await MessageApi.saveSubscribePreference({ accepted: false })
        } catch {
          /* ignore */
        }
        finishToHome()
        return
      }
      loading.value = true
      try {
        const role = getStoredRole() || 'Patient'
        const keys = ROLE_EVENT_KEYS[role] || ROLE_EVENT_KEYS.Patient
        // 手势内立刻用真实模板 ID 调官方接口
        const ids = keys
          .map((k) => FALLBACK_TEMPLATE_BY_EVENT[k])
          .filter(Boolean)
          .slice(0, 3)
        const results = await requestSubscribe(ids)
        await MessageApi.saveSubscribePreference({
          accepted: Object.values(results).some((v) => v === 'accept'),
          results,
          event_keys: keys,
        })
      } catch (e) {
        console.warn('[subscribe-guide modal]', e)
      } finally {
        loading.value = false
        finishToHome()
      }
    },
  })
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
}
.btn {
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 100rpx;
  background: #07c160;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
}
.ghost {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 28rpx;
  border: none;
}
</style>
