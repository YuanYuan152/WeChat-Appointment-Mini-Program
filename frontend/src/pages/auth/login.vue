<template>
  <view class="login-page">
    <view class="background-decoration">
      <view class="decoration-circle circle-1"></view>
      <view class="decoration-circle circle-2"></view>
      <view class="decoration-circle circle-3"></view>
    </view>

    <view class="main-content">
      <view class="center-panel">
        <view class="header-section">
          <text class="app-title">连心心理</text>
          <text class="app-subtitle">专业的心理咨询服务平台</text>
        </view>

        <view class="form-container">
        <view v-if="devMode" class="dev-entrance">
          <view class="dev-entrance-row" @tap="toggleDevEntrance">
            <text class="dev-entrance-title">开发者入口</text>
            <text class="dev-entrance-toggle">{{ showMockPanel ? '收起模拟登录' : '展开模拟登录' }}</text>
          </view>
          <text class="dev-entrance-hint">
            {{ showMockPanel ? '当前为模拟登录：先选角色再点下方按钮' : '正式流程：勾选协议后微信登录注册' }}
          </text>
        </view>

        <view v-if="devMode && !showMockPanel && !wechatReady" class="config-warn">
          <text class="config-warn-title">尚未配置真实微信凭证</text>
          <text class="config-warn-text">
            请在 backend-python/.env 填写 WECHAT_APPID / WECHAT_SECRET，并将小程序 AppID 改为同一值后重启后端。
          </text>
        </view>

        <DevRolePicker v-if="showMockPanel" @change="onDevRoleChange" />

        <text class="form-desc">
          {{
            showMockPanel
              ? '测试版请先选择上方角色，再点击下方按钮登录对应演示账号。'
              : '请先勾选协议，再使用手机号快捷登录完成注册/登录。'
          }}
        </text>

        <!-- 必须勾选协议：整行作为一个居中块，避免小程序 text 嵌套导致勾选框上移、右偏 -->
        <view class="agree-block">
          <view class="agree-row" @tap="toggleAgreeService">
            <view class="checkbox" :class="{ checked: agreeService }">
              <text v-if="agreeService" class="check-mark">✓</text>
            </view>
            <view class="agree-text">
              <text>我已阅读并同意</text>
              <text class="footer-link" @tap.stop="openLegal('agreement')">《用户服务协议》</text>
            </view>
          </view>
          <view class="agree-row" @tap="toggleAgreePrivacy">
            <view class="checkbox" :class="{ checked: agreePrivacy }">
              <text v-if="agreePrivacy" class="check-mark">✓</text>
            </view>
            <view class="agree-text">
              <text>我已阅读并同意</text>
              <text class="footer-link" @tap.stop="openLegal('privacy')">《隐私政策》</text>
            </view>
          </view>
        </view>

        <!-- 未勾选：灰色 view，避免微信 button[disabled] 被洗成看不见；勾选后才用真实 button -->
        <view
          v-if="!agreementsOk"
          class="wx-login-btn is-gray"
          @tap="guardAgreements"
        >
          <text class="wx-btn-text">{{ showMockPanel ? loginBtnText : '手机号快捷登录' }}</text>
        </view>
        <button
          v-else-if="!showMockPanel"
          class="wx-login-btn"
          :loading="loading"
          :disabled="loading"
          open-type="getPhoneNumber"
          @getphonenumber="handlePhoneRegister"
        >
          <text class="wx-btn-text">手机号快捷登录</text>
        </button>
        <button
          v-else
          class="wx-login-btn"
          :loading="loading"
          :disabled="loading"
          @click="handleMockLogin"
        >
          <text class="wx-btn-text">{{ loginBtnText }}</text>
        </button>

        <text v-if="showMockPanel" class="form-tip">
          将以「{{ loginRoleLabel }}」身份登录（对接 seed_demo_data.py）
        </text>
        </view>
      </view>
    </view>

    <view class="footer-decoration">
      <view class="decoration-circle circle-4"></view>
      <view class="decoration-circle circle-5"></view>
    </view>

    <view class="back-btn" @click="goBack">
      <text class="back-icon">←</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { AuthApi, type WxLoginResponse } from '@/apis/auth'
import DevRolePicker from '@/components/DevRolePicker.vue'
import { applyRoleAfterLogin, navigateToRoleHome } from '@/utils/roleLogin'
import {
  DEV_LOGIN_ROLES,
  getDevLoginCode,
  getDevLoginRole,
  isDevEntranceOpen,
  isDevMode,
  isLoggedIn,
  resolveWxLoginCode,
  setDevEntranceOpen,
  type DevLoginRole,
} from '@/utils/auth'

const loading = ref(false)
const wechatReady = ref(false)
const agreeService = ref(false)
const agreePrivacy = ref(false)
const agreementsOk = computed(() => agreeService.value && agreePrivacy.value)

const devMode = isDevMode()
const showMockPanel = ref(devMode && isDevEntranceOpen())
const loginRoleLabel = ref(
  DEV_LOGIN_ROLES.find(r => r.role === getDevLoginRole())?.label || '来访·小美',
)
const loginBtnText = computed(() =>
  showMockPanel.value ? `模拟登录（${loginRoleLabel.value}）` : '手机号快捷登录',
)

const toggleDevEntrance = () => {
  showMockPanel.value = !showMockPanel.value
  setDevEntranceOpen(showMockPanel.value)
}

const onDevRoleChange = (role: DevLoginRole) => {
  const item = DEV_LOGIN_ROLES.find(r => r.role === role)
  loginRoleLabel.value = item?.label || '来访·小美'
}

const toggleAgreeService = () => {
  agreeService.value = !agreeService.value
}
const toggleAgreePrivacy = () => {
  agreePrivacy.value = !agreePrivacy.value
}

const guardAgreements = () => {
  if (!agreementsOk.value) {
    uni.showToast({ title: '请先勾选服务协议与隐私政策', icon: 'none' })
  }
}

const doWxLogin = async () => {
  const code = (await resolveWxLoginCode()) || (showMockPanel.value ? getDevLoginCode() : '')
  if (!code) throw new Error('获取微信授权码失败，请用真机并确认 AppID 配置正确')
  return await AuthApi.wxLogin(code)
}

const explainPhoneError = (detail: any) => {
  const errMsg = String(detail?.errMsg || detail?.errno || '')
  if (errMsg.includes('未绑定手机') || errMsg.includes('bind')) {
    return '当前微信账号未绑定手机号。请先在微信 App「我 → 设置 → 个人信息 → 手机号」完成绑定后再试。'
  }
  if (errMsg.includes('deny') || errMsg.includes('cancel') || detail?.errno === 1400001) {
    return '您已取消手机号授权。正式注册需要授权手机号，请重新点击并允许。'
  }
  return `获取手机号失败：${detail?.errMsg || '请确认小程序已开通手机号快速验证能力，并用真机调试'}`
}

/**
 * 正式注册/登录：
 * 1) 勾选协议
 * 2) getPhoneNumber + wx.login → openid + JWT
 * 3) bind-mobile
 * 4) 新用户 → 完善资料 → 消息引导；老用户 → 首页
 */
const handlePhoneRegister = async (e: any) => {
  if (!agreementsOk.value) {
    guardAgreements()
    return
  }
  if (loading.value) return
  const detail = e?.detail || {}
  const phoneCode: string | undefined = detail.code

  if (!phoneCode) {
    uni.showModal({
      title: '需要授权手机号',
      content: explainPhoneError(detail),
      showCancel: false,
    })
    return
  }

  loading.value = true
  try {
    const result = await doWxLogin()

    if (result.isMockAuth) {
      uni.showModal({
        title: '仍在 Mock 登录',
        content:
          '后端未配置真实 WECHAT_APPID / WECHAT_SECRET，当前 openid 为本地模拟值。请先配置 .env 后重启后端再测。',
        showCancel: false,
      })
    }

    const bindRes = await AuthApi.bindMobile(phoneCode)
    const finalResult: WxLoginResponse = bindRes.token
      ? {
          ...result,
          ...bindRes,
          token: bindRes.token,
          is_new_user: bindRes.is_new_user ?? false,
        }
      : result
    uni.showToast({
      title: finalResult.is_new_user ? '注册成功' : '登录成功',
      icon: 'success',
    })
    console.info('[Auth] openid=', finalResult.openId, 'token已保存, mobile=', bindRes.mobile)
    afterLoginSuccess(finalResult)
  } catch (err: any) {
    uni.showModal({
      title: '登录失败',
      content: err?.message || '微信登录或手机号绑定失败',
      showCancel: false,
    })
  } finally {
    loading.value = false
  }
}

const handleMockLogin = async () => {
  if (!agreementsOk.value) {
    guardAgreements()
    return
  }
  if (loading.value) return
  loading.value = true
  try {
    const result = await doWxLogin()
    uni.showToast({ title: result.is_new_user ? '注册成功' : '登录成功', icon: 'success' })
    afterLoginSuccess(result)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const afterLoginSuccess = async (loginResult: WxLoginResponse) => {
  try {
    const me = await AuthApi.getMe().catch(() => null)
    if (me) {
      await applyRoleAfterLogin(me)
    }

    const needProfile =
      loginResult.needProfileSetup ||
      loginResult.is_new_user ||
      me?.needProfileSetup ||
      (!me?.nickname && !me?.profileCompleted)

    setTimeout(() => {
      // 新用户先完善昵称；保存按钮手势内会直接调起微信官方订阅授权（不再进自定义引导页）
      if (needProfile) {
        uni.redirectTo({ url: '/pages/auth/profile-setup' })
        return
      }
      const redirectUrl = uni.getStorageSync('redirectAfterLogin') as string | undefined
      navigateToRoleHome(
        loginResult.activeRole || me?.activeRole || me?.roles?.[0] || 'Patient',
        redirectUrl || undefined,
      )
    }, 600)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '登录后获取账号信息失败', icon: 'none' })
    setTimeout(() => goBack(), 600)
  }
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }
}

const openLegal = (kind: 'agreement' | 'privacy') => {
  uni.navigateTo({ url: `/pages/legal/${kind}` })
}

onMounted(async () => {
  if (!devMode && isLoggedIn()) {
    goBack()
    return
  }
  try {
    const status = await AuthApi.getWechatStatus()
    wechatReady.value = !!status.configured
  } catch {
    wechatReady.value = false
  }
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #4A6B5D 0%, #3D5A4E 48%, #2F4A40 100%);
  position: relative;
  overflow: hidden;
}

.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 420rpx;
  overflow: hidden;
  pointer-events: none;
}
.footer-decoration {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 280rpx;
  overflow: hidden;
  pointer-events: none;
}
.decoration-circle { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.08); }
.circle-1 { width: 280rpx; height: 280rpx; top: -80rpx; right: -60rpx; }
.circle-2 { width: 200rpx; height: 200rpx; bottom: 40rpx; left: -80rpx; }
.circle-3 { width: 120rpx; height: 120rpx; top: 180rpx; left: 40%; }
.circle-4 { width: 220rpx; height: 220rpx; bottom: -80rpx; right: -40rpx; }
.circle-5 { width: 160rpx; height: 160rpx; top: 20rpx; left: -50rpx; }

.main-content {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(120rpx + env(safe-area-inset-top)) 40rpx calc(120rpx + env(safe-area-inset-bottom));
}

.center-panel {
  width: 100%;
  max-width: 670rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-section {
  width: 100%;
  text-align: center;
  margin-bottom: 40rpx;
}
.app-title {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 48rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12rpx;
}
.app-subtitle {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.78);
}

.form-container {
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dev-entrance {
  margin-bottom: 28rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #F7F5F2;
}
.dev-entrance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dev-entrance-title { font-size: 28rpx; font-weight: 600; color: #2C2C2C; }
.dev-entrance-toggle { font-size: 24rpx; color: #3D5A4E; }
.dev-entrance-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #8A8A8A;
  line-height: 1.5;
}

.config-warn {
  margin-bottom: 28rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #F0EDE8;
}
.config-warn-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #3D5A4E;
  margin-bottom: 8rpx;
}
.config-warn-text {
  display: block;
  font-size: 22rpx;
  color: #8A8A8A;
  line-height: 1.5;
}

.form-desc {
  display: block;
  width: 100%;
  font-size: 26rpx;
  color: #8A8A8A;
  text-align: center;
  margin-bottom: 32rpx;
  line-height: 1.6;
}
.form-tip {
  display: block;
  width: 100%;
  font-size: 22rpx;
  color: #8A8A8A;
  text-align: center;
  margin-top: 24rpx;
  line-height: 1.5;
}

.agree-block {
  width: 100%;
  margin: 0 0 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.agree-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  align-self: center;
  margin-bottom: 16rpx;
}
.checkbox {
  width: 32rpx;
  height: 32rpx;
  box-sizing: border-box;
  border-radius: 6rpx;
  border: 2rpx solid #C8C4BC;
  margin-right: 12rpx;
  flex-shrink: 0;
  background: #fff;
}
.checkbox.checked {
  background: #3D5A4E;
  border-color: #3D5A4E;
}
.check-mark {
  display: block;
  width: 28rpx;
  height: 28rpx;
  line-height: 28rpx;
  text-align: center;
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}
.agree-text {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #8A8A8A;
  line-height: 1.5;
}
.agree-text text {
  font-size: 24rpx;
  color: #8A8A8A;
  line-height: 1.5;
}
.footer-link {
  color: #5BA3E0;
}
.agree-text .footer-link {
  color: #5BA3E0;
}

.wx-login-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  border: none;
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
}
.wx-login-btn::after { border: none; }
.wx-btn-text { color: #fff; font-size: 32rpx; font-weight: 600; }

.wx-login-btn.is-gray {
  background: #A8A29E;
  color: #fff;
}
.wx-login-btn.is-gray .wx-btn-text {
  color: #fff;
}

.back-btn {
  position: fixed;
  top: calc(24rpx + env(safe-area-inset-top));
  left: 32rpx;
  z-index: 20;
  width: 72rpx;
  height: 72rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon { font-size: 36rpx; color: #fff; font-weight: 600; }
</style>
