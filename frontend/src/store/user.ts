import { defineStore } from 'pinia'
import { AuthApi, type UserInfo } from '@/apis/auth'
import { setToken, clearToken, getToken } from '@/utils/auth'

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
    userAvatar: (state) => state.userInfo?.avatarUrl || '/static/images/default-doctor.png',
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
      this.activeRole = me.activeRole || ''
      uni.setStorageSync('user_roles', JSON.stringify(this.roles))
    },

    async switchRole(role: string) {
      const res = await AuthApi.switchRole(role)
      this.activeRole = res.activeRole || role
      return res
    },

    logout() {
      this.userInfo = null
      this.token = ''
      this.roles = []
      this.activeRole = ''
      this.isLogin = false
      clearToken()
      uni.removeStorageSync('user_roles')
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
