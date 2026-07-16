import { defineStore } from 'pinia'
import { AuthApi, type UserInfo } from '@/apis/auth'
import { resolveAccountRole } from '@/constants/roles'
import { setToken, clearToken, getToken } from '@/utils/auth'
import { updateTabBarForRole } from '@/utils/tabBar'

export const useUserStore = defineStore('user', {
  state: () => ({
    userInfo: null as UserInfo | null,
    token: getToken() || '',
    roles: [] as string[],
    activeRole: '' as string,
    isLogin: !!getToken(),
  }),

  getters: {
    userId: (state) => state.userInfo?.id,
    userName: (state) => state.userInfo?.nickname || '未登录',
    userAvatar: (state) => state.userInfo?.avatarUrl || '/static/images-opt/default-doctor.jpg',
    hasRole: (state) => (role: string) => state.roles.includes(role),
  },

  actions: {
    async login() {
      const loginRes: any = await new Promise((resolve, reject) => {
        uni.login({ provider: 'weixin', success: resolve, fail: reject })
      })
      const code: string = loginRes?.code
      if (!code) throw new Error('获取微信授权码失败')

      const result = await AuthApi.wxLogin(code)
      this.token = getToken() || ''
      this.isLogin = true

      await this.fetchUserInfo()
      return result
    },

    async fetchUserInfo() {
      const me = await AuthApi.getMe()
      this.userInfo = me
      this.roles = me.roles || []
      this.activeRole = me.activeRole || resolveAccountRole(this.roles)
      uni.setStorageSync('user_roles', JSON.stringify([this.activeRole]))
      if (me.activeRole) uni.setStorageSync('active_role', this.activeRole)
      updateTabBarForRole(this.activeRole)
    },

    async switchRole(role: string) {
      if (role !== this.activeRole) {
        throw new Error('单账号仅支持一个角色，如需变更请联系管理员')
      }
      return { message: '当前角色未变更', activeRole: role }
    },

    logout() {
      this.userInfo = null
      this.token = ''
      this.roles = []
      this.activeRole = ''
      this.isLogin = false
      clearToken()
      uni.removeStorageSync('user_roles')
      uni.removeStorageSync('active_role')
      updateTabBarForRole([])
      uni.switchTab({ url: '/pages/index/index' })
    },

    checkLoginStatus(): boolean {
      const token = getToken()
      if (token) {
        this.token = token
        this.isLogin = true
        return true
      }
      return false
    },
  },
})
