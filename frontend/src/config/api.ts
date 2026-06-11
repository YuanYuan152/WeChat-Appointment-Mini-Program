/**
 * API 配置文件（统一管理）
 *
 * - API_CONFIG    -> 旧 C# 后端（资讯、咨询师列表等历史接口）
 * - API_V2_CONFIG -> 新 Python FastAPI 后端（统一账号/认证/支付/上传/工作台）
 * - API_ENDPOINTS -> 接口地址常量
 *
 * 备注：所有新功能（common / message / counselor 工作台 / ops 等）只走 V2。
 */

// 旧 C# 后端
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://www.ji-psy.com',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '15000'),
  headers: {
    'Content-Type': 'application/json'
  }
}

// 新 Python FastAPI 后端
export const API_V2_CONFIG = {
  baseURL: import.meta.env.VITE_API_V2_BASE_URL || 'http://localhost:8000',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '15000'),
  headers: {
    'Content-Type': 'application/json'
  }
}

export const API_ENDPOINTS = {
  // 旧后端兼容路径（保留，过渡期某些接口仍走 C# 后端）
  HOME: {
    INDEX: '/api/frontend/GetHomeIndex',
    BANNERS: '/api/frontend/GetBanners',
    RECOMMENDED_DOCTORS: '/api/frontend/GetDoctorList',
    ACTIVITIES: '/api/frontend/GetActivityList',
    LIVE_STREAMS: '/api/frontend/GetLiveList'
  },
  user: {
    getUserInfo: '/api/userCenter/GetUserInfo',
    updateUserInfo: '/api/userCenter/UpdateUserInfo'
  },
  consultation: {
    getConsultants: '/api/consultant/GetList',
    getConsultantDetail: '/api/consultant/GetDetail',
    createOrder: '/api/order/Create',
    getOrders: '/api/order/GetList'
  },
  DOCTORS: {
    LIST: '/api/frontend/GetDoctorList',
    DETAIL: '/api/consultant/GetDetail/:id',
    SEARCH: '/api/frontend/GlobalSearch'
  },
  ACTIVITIES: {
    LIST: '/api/frontend/GetActivityList',
    DETAIL: '/api/activity/GetDetail/:id',
    JOIN: '/api/activity/Join/:id'
  },
  activity: {
    getActivities: '/api/frontend/GetActivityList',
    getActivityDetail: '/api/activity/GetDetail',
    joinActivity: '/api/activity/Join'
  },

  // ========================================================================
  // 新 Python 后端（V2，所有新功能首选）
  // ========================================================================

  // 认证 + 角色
  auth: {
    login: '/api/mini/auth/login',
    bindMobile: '/api/mini/auth/bind-mobile',
    me: '/api/mini/auth/me',
    updateMe: '/api/mini/auth/me',
    switchRole: '/api/mini/auth/switch-role',
    deleteAccount: '/api/mini/auth/account',
  },

  // 支付
  payment: {
    createOrder: '/api/payment/wechat/create',
    /** 开发环境：一键模拟支付到账并完成预约 */
    simulatePay: '/api/payment/wechat/simulate-pay',
    confirmDev: '/api/payment/wechat/confirm-dev',
  },

  // 上传
  upload: {
    file: '/api/upload/file',
  },

  // 公共内容域（首页 / 文章 / 咨询师公开列表 / 搜索）
  common: {
    banners: '/api/mini/common/banners',
    articles: '/api/mini/common/articles',
    articleDetail: (id: number | string) => `/api/mini/common/articles/${id}`,
    counselors: '/api/mini/common/counselors',
    counselorDetail: (id: number | string) => `/api/mini/common/counselors/${id}`,
    search: '/api/mini/common/search',
  },

  // 患者
  patient: {
    orders: '/api/mini/patient/orders',
    orderDetail: (id: number | string) => `/api/mini/patient/orders/${id}`,
    consultations: '/api/mini/patient/consultations',
    consultationCancel: (id: number | string) => `/api/mini/patient/consultations/${id}/cancel`,
    refundExemption: (id: number | string) => `/api/mini/patient/consultations/${id}/refund-exemption`,
    me: '/api/mini/patient/me',
    registration: '/api/mini/patient/registration',
  },

  // 消息中心（Batch B 后续填充）
  message: {
    list: '/api/mini/message/list',
    unreadCount: '/api/mini/message/unread-count',
    markRead: (id: number | string) => `/api/mini/message/${id}/read`,
    subscribe: '/api/mini/message/subscribe',
    templates: '/api/mini/message/templates',
  },

  // 咨询师工作台
  counselor: {
    schedules: '/api/mini/counselor/schedules',
    scheduleCalendar: '/api/mini/counselor/schedules/calendar',
    scheduleSlotOptions: '/api/mini/counselor/schedules/slot-options',
    scheduleLeaveRequest: (id: number | string) => `/api/mini/counselor/schedules/${id}/leave-request`,
    consultations: '/api/mini/counselor/consultations',
    caseRecords: '/api/mini/counselor/case-records',
    profile: '/api/mini/counselor/profile',
    stats: '/api/mini/counselor/stats',
  },

  // 助理工作台
  assistant: {
    tasks: '/api/mini/assistant/tasks',
    riskAlerts: '/api/mini/assistant/risk-alerts',
    scheduleOverview: '/api/mini/assistant/schedule-overview',
    contactRecords: '/api/mini/assistant/contact-records',
  },

  // 运营
  ops: {
    banners: '/api/mini/ops/banners',
    bannersManage: '/api/mini/ops/banners/manage',
    activities: '/api/mini/ops/activities',
    articles: '/api/mini/ops/articles',
    users: '/api/mini/ops/users',
    dashboard: '/api/mini/ops/dashboard',
    schedulesOverview: '/api/mini/ops/schedules/overview',
    rooms: '/api/mini/ops/rooms',
    roomsStatus: '/api/mini/ops/rooms/status',
    roomDetail: (id: number | string) => `/api/mini/ops/rooms/${id}`,
  },

  // 管理员
  admin: {
    users: '/api/mini/admin/users',
    bindRole: (uid: number | string) => `/api/mini/admin/users/${uid}/roles`,
  },

  // 意见反馈
  feedback: {
    submit: '/api/mini/feedback',
  },
}

// 获取旧后端完整 URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseURL}${endpoint}`
}

// 获取新 Python 后端完整 URL
export const getApiV2Url = (endpoint: string): string => {
  return `${API_V2_CONFIG.baseURL}${endpoint}`
}
