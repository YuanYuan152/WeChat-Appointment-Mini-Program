<template>
  <view class="page">
    <text class="title">服务通知</text>
    <text class="desc">点击下方按钮后，由微信官方弹出订阅授权框。授权后提醒会出现在微信「服务通知」。</text>
    <button class="btn" :loading="loading" :disabled="loading" @tap="handleEnable">
      打开微信授权
    </button>
    <button class="ghost" :disabled="loading" @tap="goBack">返回</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AuthApi } from '@/apis/auth'
import { MessageApi } from '@/apis/message'
import { isLoggedIn } from '@/utils/auth'
import {
  ROLE_EVENT_KEYS,
  FALLBACK_TEMPLATE_BY_EVENT,
} from '@/utils/subscribeMessage'
import { getStoredRole } from '@/utils/session'

const loading = ref(false)
const role = ref(getStoredRole() || 'Patient')

const handleEnable = () => {
  if (loading.value) return
  loading.value = true
  const keys = ROLE_EVENT_KEYS[role.value] || ROLE_EVENT_KEYS.Patient
  const tmplIds = keys
    .map((k) => FALLBACK_TEMPLATE_BY_EVENT[k])
    .filter(Boolean)
    .slice(0, 3)

  uni.requestSubscribeMessage({
    tmplIds,
    success: async (res: any) => {
      const results: Record<string, string> = {}
      tmplIds.forEach((id) => {
        results[id] = String(res?.[id] || 'reject')
      })
      try {
        await MessageApi.saveSubscribePreference({
          accepted: Object.values(results).some((v) => v === 'accept'),
          results,
          event_keys: keys,
        })
        uni.showToast({ title: '已记录授权结果', icon: 'none' })
      } catch (e: any) {
        uni.showToast({ title: e?.message || '保存失败', icon: 'none' })
      } finally {
        loading.value = false
        setTimeout(() => goBack(), 500)
      }
    },
    fail: async () => {
      try {
        await MessageApi.ackSubscribePrompt()
      } catch {
        /* ignore */
      }
      loading.value = false
      goBack()
    },
  })
}

const goBack = async () => {
  try {
    await MessageApi.ackSubscribePrompt()
  } catch {
    /* ignore */
  }
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/index/index' })
}

onMounted(async () => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }
  try {
    const me = await AuthApi.getMe()
    role.value = me.activeRole || me.roles?.[0] || role.value
  } catch {
    /* ignore */
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f5f2;
  padding: 64rpx 40rpx;
}
.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #2c2c2c;
}
.desc {
  display: block;
  margin: 16rpx 0 48rpx;
  font-size: 26rpx;
  color: #8a8a8a;
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
  margin-top: 20rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 28rpx;
  border: none;
}
</style>
