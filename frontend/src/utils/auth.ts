/**
 * 认证相关工具函数
 */

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