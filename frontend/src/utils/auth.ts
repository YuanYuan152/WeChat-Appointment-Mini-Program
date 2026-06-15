/**
 * 认证相关工具函数
 */

/** 开发联调角色（与 backend-python/auth.py DEV_MOCK_CODE_OPENIDS 对齐） */
export type DevLoginRole =
  | 'patient'
  | 'patient_gang'
  | 'patient_li'
  | 'counselor'
  | 'counselor_zhang'
  | 'counselor_wang'
  | 'counselor_chen'
  | 'assistant'
  | 'ops'
  | 'admin'

export const DEV_LOGIN_ROLE_STORAGE_KEY = 'dev_login_role'

/** 测试/开发联调：登录页可选角色，wx.login 走 dev_* mock code */
export const isMockLoginEnabled = (): boolean =>
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_LOGIN === 'true'

export const DEV_LOGIN_ROLE_GROUPS: {
  title: string
  roles: DevLoginRole[]
}[] = [
  { title: '来访者', roles: ['patient', 'patient_gang', 'patient_li'] },
  { title: '咨询师', roles: ['counselor', 'counselor_zhang', 'counselor_wang', 'counselor_chen'] },
  { title: '内部角色', roles: ['assistant', 'ops', 'admin'] },
]

export const DEV_LOGIN_ROLES: {
  role: DevLoginRole
  label: string
  code: string
  seedHint: string
}[] = [
  { role: 'patient', label: '来访·小美', code: 'dev_patient', seedHint: 'seed_demo_data.py（林小美）' },
  { role: 'patient_gang', label: '来访·小刚', code: 'dev_patient_xiaogang', seedHint: 'seed_demo_data.py（赵小刚）' },
  { role: 'patient_li', label: '来访·小丽', code: 'dev_patient_xiaoli', seedHint: 'seed_demo_data.py（何小丽）' },
  { role: 'counselor', label: '咨询师·李心怡', code: 'dev_counselor', seedHint: 'seed_demo_data.py' },
  { role: 'counselor_zhang', label: '咨询师·张明远', code: 'dev_counselor_zhangmingyuan', seedHint: 'seed_demo_data.py' },
  { role: 'counselor_wang', label: '咨询师·王婉清', code: 'dev_counselor_wangwanqing', seedHint: 'seed_demo_data.py' },
  { role: 'counselor_chen', label: '咨询师·陈启明', code: 'dev_counselor_chenqiming', seedHint: 'seed_demo_data.py' },
  { role: 'assistant', label: '助理', code: 'dev_assistant', seedHint: 'seed_demo_data.py' },
  { role: 'ops', label: '运营', code: 'dev_ops', seedHint: 'seed_demo_data.py' },
  { role: 'admin', label: '管理员', code: 'dev_admin', seedHint: 'seed_demo_data.py' },
]

const DEV_ROLE_TO_CODE: Record<DevLoginRole, string> = {
  patient: 'dev_patient',
  patient_gang: 'dev_patient_xiaogang',
  patient_li: 'dev_patient_xiaoli',
  counselor: 'dev_counselor',
  counselor_zhang: 'dev_counselor_zhangmingyuan',
  counselor_wang: 'dev_counselor_wangwanqing',
  counselor_chen: 'dev_counselor_chenqiming',
  assistant: 'dev_assistant',
  ops: 'dev_ops',
  admin: 'dev_admin',
}

/** 开发角色对应的后端 ActiveRole（工作台路由用） */
export const getDevWorkbenchRole = (): string | null => {
  const role = getDevLoginRole()
  if (
    role === 'patient'
    || role === 'patient_gang'
    || role === 'patient_li'
  ) return 'Patient'
  if (
    role === 'counselor'
    || role === 'counselor_zhang'
    || role === 'counselor_wang'
    || role === 'counselor_chen'
  ) return 'Counselor'
  if (role === 'assistant') return 'Assistant'
  if (role === 'ops') return 'Ops'
  if (role === 'admin') return 'Admin'
  return null
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

export const getDevLoginRoleLabel = (): string => {
  const item = DEV_LOGIN_ROLES.find(r => r.role === getDevLoginRole())
  return item?.label || '来访·小美'
}

/**
 * 获取微信登录 code。
 * 测试/开发联调返回 dev_* mock code，与 seed 演示账号对齐；正式版走 uni.login。
 */
export const resolveWxLoginCode = async (): Promise<string> => {
  if (isMockLoginEnabled()) {
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