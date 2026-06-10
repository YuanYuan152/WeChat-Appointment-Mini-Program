/**
 * 认证相关工具函数
 */

/** 开发联调角色（与 backend-python/auth.py DEV_MOCK_CODE_OPENIDS 对齐） */
export type DevLoginRole = 'patient' | 'counselor' | 'assistant' | 'ops' | 'admin'

export const DEV_LOGIN_ROLE_STORAGE_KEY = 'dev_login_role'

export const DEV_LOGIN_ROLES: {
  role: DevLoginRole
  label: string
  code: string
  seedHint: string
}[] = [
  { role: 'patient', label: '来访者', code: 'dev_patient', seedHint: 'seed_demo_data.py' },
  { role: 'counselor', label: '咨询师', code: 'dev_counselor', seedHint: 'seed_demo_data.py（李心怡）' },
  { role: 'assistant', label: '助理', code: 'dev_assistant', seedHint: 'seed_demo_data.py' },
  { role: 'ops', label: '运营', code: 'dev_ops', seedHint: 'seed_demo_data.py' },
  { role: 'admin', label: '管理员', code: 'dev_admin', seedHint: 'seed_demo_data.py' },
]

const DEV_ROLE_TO_CODE: Record<DevLoginRole, string> = {
  patient: 'dev_patient',
  counselor: 'dev_counselor',
  assistant: 'dev_assistant',
  ops: 'dev_ops',
  admin: 'dev_admin',
}

const isDevLoginRole = (value: string): value is DevLoginRole =>
  Object.prototype.hasOwnProperty.call(DEV_ROLE_TO_CODE, value)

/** 读取开发联调角色：优先本地 storage，其次环境变量，默认来访者 */
export const getDevLoginRole = (): DevLoginRole => {
  const stored = String(uni.getStorageSync(DEV_LOGIN_ROLE_STORAGE_KEY) || '').toLowerCase()
  if (isDevLoginRole(stored)) return stored

  const fromEnv = String(import.meta.env.VITE_DEV_LOGIN_ROLE || 'patient').toLowerCase()
  if (isDevLoginRole(fromEnv)) return fromEnv

  return 'patient'
}

export const setDevLoginRole = (role: DevLoginRole): void => {
  uni.setStorageSync(DEV_LOGIN_ROLE_STORAGE_KEY, role)
}

export const getDevLoginCode = (): string => DEV_ROLE_TO_CODE[getDevLoginRole()]

/**
 * 获取微信登录 code。
 * 开发构建返回 dev_* mock code，与 seed 演示账号对齐；生产环境走 uni.login。
 */
export const resolveWxLoginCode = async (): Promise<string> => {
  if (import.meta.env.DEV) {
    return getDevLoginCode()
  }
  try {
    const loginRes: any = await new Promise((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject })
    })
    return loginRes?.code || ''
  } catch {
    return ''
  }
}

/**
 * 检查用户是否已登录
 */
export const isLoggedIn = (): boolean => {
  const token = uni.getStorageSync('token')
  return !!token
}

/**
 * 获取用户token
 */
export const getToken = (): string | null => {
  return uni.getStorageSync('token')
}

/**
 * 设置用户token
 */
export const setToken = (token: string): void => {
  uni.setStorageSync('token', token)
}

/**
 * 清除用户token
 */
export const clearToken = (): void => {
  uni.removeStorageSync('token')
}

/**
 * 处理需要登录的功能点击
 * @param action 需要执行的操作
 * @param redirectUrl 登录成功后跳转的页面
 */
export const handleRequireLogin = (
  action: () => void,
  redirectUrl?: string
): void => {
  if (isLoggedIn()) {
    // 已登录，直接执行操作
    action()
  } else {
    // 未登录，显示登录提示
    uni.showModal({
      title: '需要登录',
      content: '此功能需要登录后才能使用，是否立即登录？',
      success: (res) => {
        if (res.confirm) {
          // 跳转到登录页面，不传递跳转地址，登录后返回原页面
          uni.navigateTo({ url: '/pages/auth/login' })
        }
      }
    })
  }
}

/**
 * 跳转到登录页面
 * @param redirectUrl 登录成功后跳转的页面
 */
export const goToLogin = (redirectUrl?: string): void => {
  const url = redirectUrl ? `/pages/auth/login?redirect=${encodeURIComponent(redirectUrl)}` : '/pages/auth/login'
  uni.navigateTo({ url })
}

/**
 * 退出登录
 */
export const logout = (): void => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        clearToken()
        uni.showToast({
          title: '已退出登录',
          icon: 'success'
        })
        
        // 跳转到个人中心页面
        setTimeout(() => {
          uni.switchTab({
            url: '/pages/user/profile'
          })
        }, 1000)
      }
    }
  })
}

/**
 * 检查登录状态并跳转
 * @param redirectUrl 登录成功后跳转的页面
 */
export const checkLoginAndRedirect = (redirectUrl?: string): void => {
  if (!isLoggedIn()) {
    goToLogin(redirectUrl)
  }
} 