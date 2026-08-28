/**
 * 认证相关工具函数
 */

import { clearSession, getStoredToken, saveSession } from '@/utils/session'

import { isPrivateLanApiBase, isWechatDevtoolsRuntime, resolveApiV2BaseUrl } from '@/config/apiBase'

/** 开发联调角色（与 backend-python/auth.py DEV_MOCK_CODE_OPENIDS 对齐） */
export type DevLoginRole =
  | 'patient'
  | 'patient_gang'
  | 'patient_li'
  | 'patient_charity'
  | 'patient_professional_milestone'
  | 'counselor'
  | 'counselor_zhang'
  | 'counselor_wang'
  | 'counselor_chen'
  | 'assistant'
  | 'ops'
  | 'admin'

export const DEV_LOGIN_ROLE_STORAGE_KEY = 'dev_login_role'
export const DEV_ENTRANCE_OPEN_KEY = 'dev_entrance_open'

const isPrivateLanV2Backend = (): boolean => {
  const base = String(import.meta.env.VITE_API_V2_BASE_URL || '').trim()
  return isPrivateLanApiBase(base)
}

/** 是否在微信开发者工具内（非真机） */
export const isWechatDevtools = isWechatDevtoolsRuntime

/**
 * 是否显示模拟登录 / 开发者入口。
 * 只认 VITE_ENABLE_MOCK_LOGIN=true，不跟 Vite 的 DEV 模式绑定。
 * 开发：.env.development 或 .env.development.local 设 true
 * 生产构建 / 本地测正式登录：不写或设 false（须重启编译）
 */
export const isDevMode = (): boolean =>
  import.meta.env.VITE_ENABLE_MOCK_LOGIN === 'true'

/**
 * 真机无法访问电脑上的 HTTP 局域网地址：
 * - 127.0.0.1 / localhost 只存在于电脑本机
 * - 公司 Wi‑Fi 常有 AP 隔离，手机访问不到 192.168.x.x
 * 启动时提示一次，引导改用 HTTPS 远程后端。
 */
export const warnIfDeviceCannotReachLocalApi = (): void => {
  if (!isDevMode() || isWechatDevtools() || !isPrivateLanV2Backend()) return
  const resolved = resolveApiV2BaseUrl()
  const configured = String(import.meta.env.VITE_API_V2_BASE_URL || '').trim()
  if (resolved !== configured.replace(/\/$/, '')) {
    console.info('[MockLogin] 真机已自动切换 V2 后端:', resolved)
    return
  }
  const tip =
    '真机无法访问电脑局域网后端。请在 .env.development.local 配置 VITE_API_V2_REMOTE_FALLBACK=https://dev.eap.ji-psy.com，或直接把 VITE_API_V2_BASE_URL 改为该 HTTPS 地址后重启 npm run dev:mp-weixin。'
  console.warn('[MockLogin]', tip)
  uni.showModal({
    title: '真机联调提示',
    content: tip,
    showCancel: false,
  })
}

/** 测试/开发联调：登录页「开发者入口」展开后可用模拟登录 */
export const isMockLoginEnabled = (): boolean => isDevMode()

export const isDevEntranceOpen = (): boolean => {
  if (!isDevMode()) return false
  return uni.getStorageSync(DEV_ENTRANCE_OPEN_KEY) === '1'
}

export const setDevEntranceOpen = (open: boolean): void => {
  uni.setStorageSync(DEV_ENTRANCE_OPEN_KEY, open ? '1' : '0')
}

export const DEV_LOGIN_ROLE_GROUPS: {
  title: string
  roles: DevLoginRole[]
}[] = [
  { title: '来访', roles: ['patient', 'patient_gang', 'patient_li', 'patient_charity', 'patient_professional_milestone'] },
  { title: '咨询师', roles: ['counselor', 'counselor_zhang', 'counselor_wang', 'counselor_chen'] },
  { title: '咨询助理', roles: ['assistant'] },
  { title: '运营', roles: ['ops'] },
  { title: '管理员', roles: ['admin'] },
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
  { role: 'patient_charity', label: '来访·公益测试', code: 'dev_patient_charity_test', seedHint: 'seed_charity_milestone_test.py（周公益）' },
  { role: 'patient_professional_milestone', label: '来访·正价测试', code: 'dev_patient_professional_milestone_test', seedHint: 'seed_charity_milestone_test.py（周正价）' },
  { role: 'counselor', label: '咨询师·李心怡', code: 'dev_counselor', seedHint: 'seed_demo_data.py' },
  { role: 'counselor_zhang', label: '咨询师·张明远', code: 'dev_counselor_zhangmingyuan', seedHint: 'seed_demo_data.py' },
  { role: 'counselor_wang', label: '咨询师·王婉清', code: 'dev_counselor_wangwanqing', seedHint: 'seed_demo_data.py' },
  { role: 'counselor_chen', label: '咨询师·陈启明', code: 'dev_counselor_chenqiming', seedHint: 'seed_demo_data.py' },
  { role: 'assistant', label: '咨询助理', code: 'dev_assistant', seedHint: 'seed_demo_data.py' },
  { role: 'ops', label: '运营', code: 'dev_ops', seedHint: 'seed_demo_data.py' },
  { role: 'admin', label: '管理员', code: 'dev_admin', seedHint: 'seed_demo_data.py' },
]

const DEV_ROLE_TO_CODE: Record<DevLoginRole, string> = {
  patient: 'dev_patient',
  patient_gang: 'dev_patient_xiaogang',
  patient_li: 'dev_patient_xiaoli',
  patient_charity: 'dev_patient_charity_test',
  patient_professional_milestone: 'dev_patient_professional_milestone_test',
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
    || role === 'patient_charity'
    || role === 'patient_professional_milestone'
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
 * 开发者入口展开时返回 dev_* mock code；否则走 uni.login 真机 code。
 */
export const resolveWxLoginCode = async (): Promise<string> => {
  if (isDevMode() && isDevEntranceOpen()) {
    const code = getDevLoginCode()
    console.info('[MockLogin] 使用演示 code:', code, '角色:', getDevLoginRole())
    return code
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
  return !!getStoredToken()
}

/**
 * 获取用户token
 */
export const getToken = (): string | null => {
  return getStoredToken() || null
}

/**
 * 设置用户token（写入 userInfo 并同步旧字段）
 */
export const setToken = (token: string): void => {
  saveSession({ token })
}

/**
 * 清除用户token 与登录态
 */
export const clearToken = (): void => {
  clearSession()
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
    action()
    return
  }
  goToLogin(redirectUrl || getCurrentPagePath())
}

const TAB_PAGE_PREFIXES = [
  '/pages/index/index',
  '/pages/consultant/list',
  '/pages/tab-slot/index',
  '/pages/user/profile',
]

/** 当前页完整路径（含 query），用于登录后回跳 */
export const getCurrentPagePath = (): string => {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1] as {
      route?: string
      options?: Record<string, string | undefined>
      $page?: { fullPath?: string }
    } | undefined
    if (!current) return ''
    const fullPath = current.$page?.fullPath
    if (fullPath) {
      return fullPath.startsWith('/') ? fullPath : `/${fullPath}`
    }
    const route = current.route ? `/${current.route}` : ''
    if (!route) return ''
    const options = current.options || {}
    const query = Object.keys(options)
      .filter((key) => options[key] != null && options[key] !== '')
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(options[key]))}`)
      .join('&')
    return query ? `${route}?${query}` : route
  } catch {
    return ''
  }
}

export const isTabPagePath = (url?: string): boolean => {
  if (!url) return false
  const path = url.split('?')[0]
  const normalized = path.startsWith('/') ? path : `/${path}`
  return TAB_PAGE_PREFIXES.some((prefix) => normalized === prefix)
}

let authRedirectLockUntil = 0

const isAlreadyOnLoginPage = (): boolean => {
  const path = getCurrentPagePath()
  return path.includes('/pages/auth/login')
}

/**
 * 未登录或鉴权失败时跳转登录页（防抖，避免并发 401 连开多个登录页）。
 * 不弹「未提供有效的 Authorization」类错误，直接引导登录。
 */
export const redirectToLoginForAuth = (redirectUrl?: string): void => {
  const now = Date.now()
  if (now < authRedirectLockUntil) return
  if (isAlreadyOnLoginPage()) return
  authRedirectLockUntil = now + 1600

  const target = redirectUrl || getCurrentPagePath()
  if (target && !target.includes('/pages/auth/login')) {
    try {
      uni.setStorageSync('redirectAfterLogin', target)
    } catch {
      /* ignore */
    }
  }

  uni.navigateTo({
    url: '/pages/auth/login',
    fail: () => {
      uni.reLaunch({ url: '/pages/auth/login' })
    },
  })
}

/**
 * 页面进入时校验登录；未登录则跳转登录并返回 false。
 */
export const ensureLoggedInOrRedirect = (redirectUrl?: string): boolean => {
  if (isLoggedIn()) return true
  redirectToLoginForAuth(redirectUrl || getCurrentPagePath())
  return false
}

/**
 * 跳转到登录页面
 * @param redirectUrl 登录成功后跳转的页面
 */
export const goToLogin = (redirectUrl?: string): void => {
  if (redirectUrl) {
    try {
      uni.setStorageSync('redirectAfterLogin', redirectUrl)
    } catch {
      /* ignore */
    }
  }
  redirectToLoginForAuth(redirectUrl)
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
