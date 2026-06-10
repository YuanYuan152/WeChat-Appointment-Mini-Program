<template>
  <view class="page-profile">
    <!-- 顶部用户信息区域 -->
    <view class="header-section">
      <view class="header-bg"></view>
      <view class="user-card">
        <view class="avatar-wrap" @click="handleAvatarClick">
          <image 
            :src="userInfo.avatar || '/static/images/default-avatar.png'" 
            class="avatar-img" 
            mode="aspectFill" 
          />
          <view class="edit-badge">
            <text class="edit-icon">✎</text>
          </view>
        </view>
        <view class="user-info" @click="handleUserInfoClick">
          <text class="user-name">{{ isLoggedIn ? (userInfo.name || '已登录') : '未登录用户' }}</text>
          <text class="user-role" v-if="isLoggedIn && activeRole">{{ roleLabel(activeRole) }}</text>
          <text class="user-phone" v-if="isLoggedIn">{{ formatPhone(userInfo.phone) }}</text>
          <text class="user-phone login-hint" v-else>点击登录/注册</text>
        </view>
        <view class="settings-btn" @click="goToSettings">
          <text class="settings-icon">⚙</text>
        </view>
      </view>

      <!-- 数据统计卡片 -->
      <view class="stats-card">
        <view class="stat-item" @click="navigateTo('/pages/patient/orders/list')">
          <text class="stat-num">{{ stats.appointmentCount || 0 }}</text>
          <text class="stat-label">我的预约</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item" @click="navigateTo('/pages/user/activities')">
          <text class="stat-num">{{ stats.activityCount || 0 }}</text>
          <text class="stat-label">我的活动</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item" @click="navigateTo('/pages/user/favorites')">
          <text class="stat-num">{{ stats.favoriteCount || 0 }}</text>
          <text class="stat-label">我的收藏</text>
        </view>
      </view>
    </view>

    <!-- 菜单列表区域 -->
    <view class="menu-section">
      <view class="menu-group">
        <view class="menu-item" @click="goPersonalInfo">
          <view class="menu-icon-wrap bg-teal-light">
            <text class="menu-icon text-teal">👤</text>
          </view>
          <text class="menu-text">个人信息</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @click="navigateTo('/pages/patient/records/list')">
          <view class="menu-icon-wrap bg-blue-light">
            <text class="menu-icon text-blue">📋</text>
          </view>
          <text class="menu-text">咨询记录</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @click="navigateTo('/pages/user/wallet')">
          <view class="menu-icon-wrap bg-orange-light">
            <text class="menu-icon text-orange">💰</text>
          </view>
          <text class="menu-text">我的钱包</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item" @click="handleFeedbackClick">
          <view class="menu-icon-wrap bg-purple-light">
            <text class="menu-icon text-purple">✉</text>
          </view>
          <text class="menu-text">意见反馈</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @click="navigateTo('/pages/legal/agreement')">
          <view class="menu-icon-wrap bg-blue-light">
            <text class="menu-icon text-blue">📄</text>
          </view>
          <text class="menu-text">用户协议</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @click="navigateTo('/pages/legal/privacy')">
          <view class="menu-icon-wrap bg-teal-light">
            <text class="menu-icon text-teal">🔒</text>
          </view>
          <text class="menu-text">隐私政策</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @click="navigateTo('/pages/about/index')">
          <view class="menu-icon-wrap bg-gray-light">
            <text class="menu-icon text-gray">ℹ</text>
          </view>
          <text class="menu-text">关于我们</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 登录按钮（未登录时显示） -->
    <view class="login-section" v-if="!isLoggedIn">
      <button class="login-btn" @click="goLogin">微信一键登录</button>
    </view>

    <!-- 退出登录按钮 -->
    <view class="logout-section" v-if="isLoggedIn">
      <button class="logout-btn" @click="handleLogout">退出登录</button>
      <text class="delete-account-link" @click="handleDeleteAccount">注销账号</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import LoginModal from '@/components/LoginModal.vue'
import { isLoggedIn as checkIsLoggedIn, handleRequireLogin, logout as authLogout, clearToken } from '@/utils/auth'
import { UserApi } from '@/apis/user'
import { AuthApi } from '@/apis/auth'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface UserInfo {
  name: string
  phone: string
  email: string
  avatar: string
  gender: string
  age: number
}

const emptyUserInfo = (): UserInfo => ({
  name: '',
  phone: '',
  email: '',
  avatar: '',
  gender: '',
  age: 0,
})

const isLoggedIn = ref(false)
const activeRole = ref('')
const profileExpanded = ref(false)
const showModal = ref(false)
const loginMode = ref<'login' | 'register'>('login')
const userInfo = ref<UserInfo>(emptyUserInfo())
const stats = ref({ appointmentCount: 0, activityCount: 0, favoriteCount: 0 })

const ROLE_LABELS: Record<string, string> = {
  Patient: '来访者',
  Counselor: '咨询师',
  Assistant: '助理',
  Ops: '运营',
  Admin: '管理员',
}

const PROFILE_EDIT_ROUTES: Record<string, string> = {
  Patient: '/pages/patient/profile/edit',
  Counselor: '/pages/counselor/profile/edit',
  Assistant: '/pages/user/info',
  Ops: '/pages/user/info',
  Admin: '/pages/user/info',
}

const roleLabel = (role: string) => ROLE_LABELS[role] || role

const getProfileEditUrl = () =>
  PROFILE_EDIT_ROUTES[activeRole.value] || '/pages/user/info'

const resetPageState = () => {
  userInfo.value = emptyUserInfo()
  activeRole.value = ''
  stats.value = { appointmentCount: 0, activityCount: 0, favoriteCount: 0 }
}

const refreshPage = () => {
  if (checkIsLoggedIn()) {
    isLoggedIn.value = true
    loadUserInfo()
    loadStats()
    return
  }
  isLoggedIn.value = false
  resetPageState()
}

// Tab 页切换回来不会重新 onMounted，必须在 onShow 刷新
onShow(refreshPage)

const loadUserInfo = async () => {
  try {
    const silent = { showLoading: false, showError: false }
    const res = await httpV2.get<{
      nickname?: string
      mobile?: string
      avatarUrl?: string
      roles?: string[]
      activeRole?: string
    }>(API_ENDPOINTS.auth.me, undefined, silent)

    if (res.code === 401 || res.code === 403) {
      clearToken()
      isLoggedIn.value = false
      resetPageState()
      return
    }
    if (res.code !== 0 || !res.data) return

    const meData = res.data
    userInfo.value = {
      ...emptyUserInfo(),
      name: meData.nickname || '',
      phone: meData.mobile || '',
      avatar: meData.avatarUrl || '',
    }
    activeRole.value = meData.activeRole || meData.roles?.[0] || ''
    if (meData.roles?.length) {
      uni.setStorageSync('user_roles', JSON.stringify(meData.roles))
    }
  } catch {
    // 网络异常时保留登录态，避免误清 token
  }
}

const loadStats = async () => {
  try {
    const silent = { showLoading: false, showError: false }
    const [ordersRes, consultRes] = await Promise.all([
      httpV2.get<any[]>(API_ENDPOINTS.patient.orders, undefined, silent),
      httpV2.get<any[]>(API_ENDPOINTS.patient.consultations, undefined, silent),
    ])
    stats.value = {
      appointmentCount: Array.isArray(ordersRes.data) ? ordersRes.data.length : 0,
      activityCount: Array.isArray(consultRes.data) ? consultRes.data.length : 0,
      favoriteCount: 0,
    }
  } catch {
    stats.value = { appointmentCount: 0, activityCount: 0, favoriteCount: 0 }
  }
}

const showLoginModal = () => {
  loginMode.value = 'login'
  showModal.value = true
}

const hideModal = () => {
  showModal.value = false
}

const handleLoginSuccess = (data: any) => {
  isLoggedIn.value = true
  loadUserInfo()
  
  // 登录成功后，如果有跳转地址，则跳转过去
  // 这里可以通过全局状态管理或其他方式传递跳转地址
  // 暂时简化处理，直接显示成功提示
  uni.showToast({
    title: '登录成功',
    icon: 'success'
  })
}

const toggleProfileExpanded = () => {
  profileExpanded.value = !profileExpanded.value
}

const saveProfile = async () => {
  try {
    const result = await UserApi.updateUserInfo(userInfo.value)
    if (result) {
      uni.showToast({
        title: '保存成功',
        icon: 'success'
      })
      profileExpanded.value = false
    }
  } catch (error) {
    uni.showToast({
      title: '保存失败',
      icon: 'none'
    })
  }
}

const logout = () => {
  authLogout()
  isLoggedIn.value = false
}

const clearCache = () => {
  uni.showModal({
    title: '确认清空',
    content: '确定要清空缓存吗？',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync()
        uni.showToast({
          title: '缓存已清空',
          icon: 'success'
        })
      }
    }
  })
}

// 处理需要登录的功能点击
const handleFeedbackClick = () => {
  handleRequireLogin(
    () => navigateTo('/pages/user/feedback'),
    '/pages/user/feedback'
  )
}

const goPersonalInfo = () => {
  handleRequireLogin(
    () => navigateTo(getProfileEditUrl()),
    getProfileEditUrl()
  )
}

const navigateTo = (url: string) => {
  uni.navigateTo({ url })
}

// 模板里的几个未定义方法兜底实现
const handleAvatarClick = () => {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  navigateTo(getProfileEditUrl())
}

const handleUserInfoClick = () => {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  navigateTo(getProfileEditUrl())
}

const goLogin = () => {
  uni.navigateTo({ url: '/pages/auth/login' })
}

const goToSettings = () => {
  navigateTo('/pages/legal/agreement')
}

const formatPhone = (phone?: string | number | null) => {
  if (!phone) return ''
  const str = String(phone)
  return str.length >= 11 ? `${str.slice(0, 3)}****${str.slice(-4)}` : str
}

const handleLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (!res.confirm) return
      clearToken()
      uni.removeStorageSync('user_roles')
      isLoggedIn.value = false
      resetPageState()
      uni.showToast({ title: '已退出登录', icon: 'success' })
    },
  })
}

/**
 * 注销账号（升级方案 §6 / 微信小程序合规）
 * 二次确认 → 调用 DELETE /api/mini/auth/account → 清空 token → 跳回首页
 */
const handleDeleteAccount = () => {
  uni.showModal({
    title: '确认注销账号',
    content: '注销后将清空登录信息和角色绑定，已发生的咨询记录会保留作合规追溯。此操作不可撤销。',
    confirmText: '继续注销',
    confirmColor: '#EF4444',
    success: (res) => {
      if (!res.confirm) return
      uni.showModal({
        title: '再次确认',
        content: '请确认你要永久注销当前账号？',
        confirmText: '是的，注销',
        confirmColor: '#EF4444',
        success: async (res2) => {
          if (!res2.confirm) return
          try {
            uni.showLoading({ title: '注销中...' })
            await AuthApi.deleteAccount()
            uni.hideLoading()
            clearToken()
            isLoggedIn.value = false
            uni.showToast({ title: '已注销账号', icon: 'success' })
            setTimeout(() => {
              uni.switchTab({ url: '/pages/index/index' })
            }, 1200)
          } catch (e: any) {
            uni.hideLoading()
            uni.showToast({ title: e?.message || '注销失败', icon: 'none' })
          }
        },
      })
    },
  })
}
</script>

<style>
/* 顶级设计系统变量与重置 */
.page-profile {
  min-height: 100vh;
  background-color: #F4F6F8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding-bottom: 60rpx;
}

/* 顶部区域 */
.header-section {
  position: relative;
  padding: 0 32rpx;
  padding-top: calc(88rpx + var(--status-bar-height, 0px));
  margin-bottom: 80rpx;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 400rpx;
  background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
  border-radius: 0 0 60rpx 60rpx;
  z-index: 0;
}

.user-card {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 32rpx;
  margin-bottom: 48rpx;
}

.avatar-wrap {
  flex-shrink: 0;
  position: relative;
  width: 140rpx;
  height: 140rpx;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 6rpx solid rgba(255, 255, 255, 0.3);
  background: #E5E7EB;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
}

.edit-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.edit-icon {
  font-size: 24rpx;
  color: #0D9488;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.user-name {
  font-size: 40rpx;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
}

.user-phone {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.user-role {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.18);
  align-self: flex-start;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}

.settings-btn {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  backdrop-filter: blur(8px);
}

.settings-icon {
  font-size: 40rpx;
  color: #ffffff;
}

/* 数据统计卡片 */
.stats-card {
  position: relative;
  z-index: 10;
  background: #ffffff;
  border-radius: 32rpx;
  padding: 32rpx 0;
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.04);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 800;
  color: #1F2937;
}

.stat-label {
  font-size: 24rpx;
  color: #6B7280;
  font-weight: 500;
}

.stat-divider {
  width: 2rpx;
  height: 60rpx;
  background: #F3F4F6;
}

/* 菜单列表 */
.menu-section {
  padding: 0 32rpx;
}

.menu-group {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 16rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 32rpx 0;
  border-bottom: 1px solid #F9FAFB;
  transition: opacity 0.2s;
}

.menu-item:active {
  opacity: 0.7;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon-wrap {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.bg-teal-light { background: #F0FDFA; }
.text-teal { color: #0D9488; }

.bg-blue-light { background: #EFF6FF; }
.text-blue { color: #3B82F6; }

.bg-orange-light { background: #FFF7ED; }
.text-orange { color: #F59E0B; }

.bg-purple-light { background: #FAF5FF; }
.text-purple { color: #8B5CF6; }

.bg-gray-light { background: #F3F4F6; }
.text-gray { color: #6B7280; }

.menu-icon {
  font-size: 32rpx;
}

.menu-text {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #1F2937;
}

.menu-arrow {
  font-size: 40rpx;
  color: #D1D5DB;
  font-weight: 300;
}

/* 登录按钮 */
.login-section {
  padding: 40rpx 32rpx;
}

.login-btn {
  background: #0D9488;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 100rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(13, 148, 136, 0.2);
}

.login-btn:active {
  background: #0F766E;
}

.login-hint {
  color: #0D9488;
}

/* 退出登录 */
.logout-section {
  padding: 40rpx 32rpx;
}

.logout-btn {
  background: #ffffff;
  color: #EF4444;
  font-size: 32rpx;
  font-weight: 600;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 100rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
}

.logout-btn:active {
  background: #FEF2F2;
}

.delete-account-link {
  display: block;
  margin-top: 32rpx;
  text-align: center;
  font-size: 24rpx;
  color: #9CA3AF;
  text-decoration: underline;
}
.delete-account-link:active {
  color: #EF4444;
}
</style>