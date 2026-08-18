<template>
  <view class="setup-page">
    <view class="hero">
      <text class="title">完善个人资料</text>
      <text class="desc">设置头像和昵称后保存，将由微信官方弹出消息授权</text>
    </view>

    <view class="card">
      <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image class="avatar" :src="avatarDisplay" mode="aspectFill" />
        <text class="avatar-tip">点击选择头像</text>
      </button>

      <view class="field">
        <text class="label">昵称</text>
        <input
          class="input"
          type="nickname"
          maxlength="20"
          placeholder="请输入昵称"
          :value="nickname"
          @blur="onNicknameBlur"
          @input="onNicknameInput"
        />
      </view>

      <button class="save-btn" :loading="saving" :disabled="saving" @tap="handleSave">
        保存并授权通知
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AuthApi } from '@/apis/auth'
import { isLoggedIn } from '@/utils/auth'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { applyRoleAfterLogin, navigateToRoleHome } from '@/utils/roleLogin'
import {
  ROLE_EVENT_KEYS,
  FALLBACK_TEMPLATE_BY_EVENT,
  prefetchSubscribeTmplIds,
} from '@/utils/subscribeMessage'
import { fixImageUrl, toStoredUploadPath } from '@/utils/image'

const defaultAvatar = '/static/images-opt/default-avatar.jpg'
const avatarUrl = ref('')
const nickname = ref('')
const saving = ref(false)
const prefetchedTmplIds = ref<string[]>([])
const subscribeKeys = ref<string[]>(ROLE_EVENT_KEYS.Patient)

const avatarDisplay = computed(() => {
  const value = avatarUrl.value
  if (!value) return defaultAvatar
  if (value.startsWith('wxfile://') || value.startsWith('http://tmp') || value.startsWith('tmp://')) {
    return value
  }
  return fixImageUrl(value)
})

const onChooseAvatar = async (e: any) => {
  const localPath = e?.detail?.avatarUrl
  if (!localPath) return
  avatarUrl.value = localPath
  try {
    const uploadRes = await httpV2.upload<{ url?: string; filename?: string }>(
      API_ENDPOINTS.upload.file,
      localPath,
      'file',
    )
    if (uploadRes.code === 0 && (uploadRes.data?.url || uploadRes.data?.filename)) {
      avatarUrl.value = toStoredUploadPath(uploadRes.data?.url, uploadRes.data?.filename)
    }
  } catch (err) {
    console.warn('avatar upload failed, keep local path', err)
  }
}

const onNicknameInput = (e: any) => {
  nickname.value = String(e?.detail?.value || '')
}

const onNicknameBlur = (e: any) => {
  nickname.value = String(e?.detail?.value || nickname.value || '').trim()
}

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

/**
 * 关键：在 @tap 回调里同步调用 uni.requestSubscribeMessage（官方图二），
 * 禁止先 await 任何网络请求，否则微信会判定手势失效，官方弹窗出不来。
 * 也绝不 redirect 到自定义引导页。
 */
const handleSave = () => {
  const name = nickname.value.trim()
  if (!name) {
    uni.showToast({ title: '请填写昵称', icon: 'none' })
    return
  }
  if (saving.value) return
  saving.value = true

  const keys = subscribeKeys.value.length
    ? subscribeKeys.value
    : ROLE_EVENT_KEYS.Patient
  const tmplIds = (
    prefetchedTmplIds.value.length
      ? prefetchedTmplIds.value
      : keys.map((k) => FALLBACK_TEMPLATE_BY_EVENT[k]).filter(Boolean)
  ).slice(0, 3)

  const afterAuth = async (results: Record<string, string>) => {
    try {
      await AuthApi.updateMe({
        nickname: name,
        avatarUrl: avatarUrl.value || undefined,
        markProfileCompleted: true,
      })
      await MessageApi.saveSubscribePreference({
        accepted: Object.values(results).some((v) => v === 'accept'),
        results,
        event_keys: keys,
      })
    } catch (err: any) {
      uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
      saving.value = false
      return
    }
    saving.value = false
    await finishToHome()
  }

  if (!tmplIds.length) {
    afterAuth({})
    return
  }

  // 同步发起官方授权（图二）；成功/失败后再保存资料
  uni.requestSubscribeMessage({
    tmplIds,
    success: (res: any) => {
      const results: Record<string, string> = {}
      tmplIds.forEach((id) => {
        results[id] = String(res?.[id] || 'reject')
      })
      afterAuth(results)
    },
    fail: (err) => {
      console.warn('[profile-setup] requestSubscribeMessage fail', err)
      // 失败仍保存资料，不进入自定义引导页
      afterAuth(Object.fromEntries(tmplIds.map((id) => [id, 'reject'])))
    },
  })
}

onMounted(async () => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }
  try {
    const me = await AuthApi.getMe()
    nickname.value = me.nickname || ''
    avatarUrl.value = me.avatarUrl || ''
    const role = me.activeRole || me.roles?.[0] || getStoredRole() || 'Patient'
    subscribeKeys.value = ROLE_EVENT_KEYS[role] || ROLE_EVENT_KEYS.Patient
    prefetchedTmplIds.value = await prefetchSubscribeTmplIds(subscribeKeys.value)
  } catch {
    try {
      prefetchedTmplIds.value = await prefetchSubscribeTmplIds(subscribeKeys.value)
    } catch {
      prefetchedTmplIds.value = subscribeKeys.value
        .map((k) => FALLBACK_TEMPLATE_BY_EVENT[k])
        .filter(Boolean)
    }
  }
})
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  background: #f7f5f2;
  padding: 48rpx 40rpx 80rpx;
}
.hero { margin-bottom: 40rpx; }
.title {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: #2c2c2c;
}
.desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #8a8a8a;
  line-height: 1.5;
}
.card {
  background: #fff;
  border-radius: 28rpx;
  padding: 48rpx 36rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.04);
}
.avatar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: transparent;
  border: none;
  padding: 0;
  margin-bottom: 40rpx;
  line-height: 1.4;
}
.avatar-btn::after { border: none; }
.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #edeae6;
}
.avatar-tip {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #3d5a4e;
}
.field { margin-bottom: 48rpx; }
.label {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 16rpx;
}
.input {
  height: 88rpx;
  padding: 0 28rpx;
  border-radius: 16rpx;
  background: #f7f5f2;
  font-size: 30rpx;
  color: #2c2c2c;
}
.save-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 100rpx;
  background: #3d5a4e;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
}
</style>
