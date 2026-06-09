<template>
  <view class="login-page">
    <view class="background-decoration">
      <view class="decoration-circle circle-1"></view>
      <view class="decoration-circle circle-2"></view>
      <view class="decoration-circle circle-3"></view>
    </view>

    <view class="main-content">
      <view class="header-section">
        <view class="logo-container">
          <text class="logo-icon">💙</text>
        </view>
        <text class="app-title">连心心理</text>
        <text class="app-subtitle">专业的心理咨询服务平台</text>
      </view>

      <view class="form-container">
        <text class="form-desc">授权登录后即可使用全部功能，我们严格保护您的隐私。</text>
        <button
          class="wx-login-btn"
          :loading="loading"
          :disabled="loading"
          open-type="getPhoneNumber"
          @getphonenumber="handlePhoneAuth"
          @click="handleWxLoginOnly"
        >
          <text class="wx-btn-text">微信一键登录</text>
        </button>
        <text class="form-tip">点击后将先完成微信登录，再请求绑定手机号。</text>
      </view>

      <view class="footer-section">
        <text class="footer-text">
          登录即代表同意
          <text class="footer-link" @click.stop="openLegal('agreement')">《用户协议》</text>
          和
          <text class="footer-link" @click.stop="openLegal('privacy')">《隐私政策》</text>
        </text>
      </view>
    </view>

    <view class="back-btn" @click="goBack">
      <text class="back-icon">←</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AuthApi } from '@/apis/auth'
import { isLoggedIn, resolveWxLoginCode } from '@/utils/auth'

const loading = ref(false)

/** 实际执行微信登录：用 wx.login code 换 JWT */
const doWxLogin = async () => {
  const code = (await resolveWxLoginCode()) || 'dev_local'
  return await AuthApi.wxLogin(code)
}

/** 仅登录（用户未授权手机号时兜底） */
const handleWxLoginOnly = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const result = await doWxLogin()
    uni.showToast({ title: result.is_new_user ? '注册成功' : '登录成功', icon: 'success' })
    afterLoginSuccess()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

/**
 * 微信 getPhoneNumber 回调：
 *  1) 先 wx.login 拿 token
 *  2) 再用 phoneCode 换手机号绑定到当前账号（方案 §7.1 bind-mobile）
 */
const handlePhoneAuth = async (e: any) => {
  if (loading.value) return
  loading.value = true
  try {
    const phoneCode: string | undefined = e?.detail?.code
    const result = await doWxLogin()

    if (phoneCode) {
      try {
        await AuthApi.bindMobile(phoneCode)
      } catch (bindErr) {
        // 手机号绑定失败不阻断登录
        console.warn('绑定手机号失败', bindErr)
      }
    }

    uni.showToast({
      title: result.is_new_user ? '注册成功' : '登录成功',
      icon: 'success',
    })
    afterLoginSuccess()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const afterLoginSuccess = async () => {
  // 登录后拉取角色信息存入 storage，供路由守卫使用
  try {
    const me = await AuthApi.getMe()
    uni.setStorageSync('user_roles', JSON.stringify(me.roles || []))
  } catch { /* ignore */ }

  setTimeout(() => {
    const redirectUrl = uni.getStorageSync('redirectAfterLogin')
    if (redirectUrl) {
      uni.removeStorageSync('redirectAfterLogin')
      uni.redirectTo({ url: redirectUrl })
    } else {
      goBack()
    }
  }, 1200)
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/user/profile' })
  }
}

const openLegal = (kind: 'agreement' | 'privacy') => {
  uni.navigateTo({ url: `/pages/legal/${kind}` })
}

onMounted(() => {
  if (isLoggedIn()) goBack()
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.background-decoration { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; }
.decoration-circle { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.1); }
.circle-1 { width: 200px; height: 200px; top: -100px; right: -100px; }
.circle-2 { width: 150px; height: 150px; bottom: -75px; left: -75px; }
.circle-3 { width: 100px; height: 100px; top: 50%; left: -50px; }

.main-content {
  position: relative;
  z-index: 10;
  padding: 100rpx 60rpx 80rpx;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.header-section { text-align: center; margin-bottom: 80rpx; }
.logo-container { margin-bottom: 32rpx; }
.logo-icon { font-size: 120rpx; }
.app-title { display: block; font-size: 64rpx; font-weight: 700; color: white; margin-bottom: 16rpx; }
.app-subtitle { display: block; font-size: 32rpx; color: rgba(255,255,255,0.8); }

.form-container {
  width: 100%;
  background: rgba(255,255,255,0.95);
  border-radius: 40rpx;
  padding: 60rpx;
  margin-bottom: 48rpx;
  box-shadow: 0 40rpx 80rpx rgba(0,0,0,0.12);
}

.form-desc {
  display: block;
  font-size: 28rpx;
  color: #6B7280;
  text-align: center;
  margin-bottom: 48rpx;
  line-height: 1.6;
}
.form-tip {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  text-align: center;
  margin-top: 24rpx;
}

.wx-login-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #07C160;
  color: white;
  border-radius: 100rpx;
  border: none;
  font-size: 34rpx;
  font-weight: 700;
  box-shadow: 0 16rpx 40rpx rgba(7,193,96,0.35);
}
.wx-btn-text { color: white; }

.footer-section { text-align: center; }
.footer-text { font-size: 24rpx; color: rgba(255,255,255,0.7); line-height: 1.6; }
.footer-link { color: #ffffff; text-decoration: underline; }

.back-btn {
  position: fixed;
  top: 80rpx;
  left: 40rpx;
  width: 80rpx;
  height: 80rpx;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}
.back-icon { font-size: 40rpx; color: white; font-weight: bold; }
</style> 