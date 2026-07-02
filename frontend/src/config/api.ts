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
    counselorTimeSlots: (id: number | string) => `/api/mini/common/counselors/${id}/time-slots`,
    search: '/api/mini/common/search',
  },

  // 患者
  patient: {
    orders: '/api/mini/patient/orders',
    orderDetail: (id: number | string) => `/api/mini/patient/orders/${id}`,
    consultations: '/api/mini/patient/consultations',
    consultationCancel: (id: number | string) => `/api/mini/patient/consultations/${id}/cancel`,
    consultationFeedback: (id: number | string) => `/api/mini/patient/consultations/${id}/feedback`,
    refundExemption: (id: number | string) => `/api/mini/patient/consultations/${id}/refund-exemption`,
    me: '/api/mini/patient/me',
    registration: '/api/mini/patient/registration',
    scales: '/api/mini/patient/scales',
    favorites: '/api/mini/patient/favorites',
    favoriteCheck: (id: number | string) => `/api/mini/patient/favorites/check/${id}`,
    favoriteItem: (id: number | string) => `/api/mini/patient/favorites/${id}`,
    favoritesCount: '/api/mini/patient/favorites/count',
  },

  // 消息中心（Batch B 后续填充）
  message: {
    list: '/api/mini/message/list',
    detail: (id: number | string) => `/api/mini/message/${id}`,
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
    caseRecordFormDefaults: (consultationId: number | string) =>
      `/api/mini/counselor/case-records/form-defaults?consultation_id=${consultationId}`,
    caseRecordAmendmentRequest: (id: number | string) =>
      `/api/mini/counselor/case-records/${id}/amendment-requests`,
    profile: '/api/mini/counselor/profile',
    profileAuthenticityCommitment: '/api/mini/counselor/profile/authenticity-commitment',
    stats: '/api/mini/counselor/stats',
    statsDetails: '/api/mini/counselor/stats/details',
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
    roomSlotStatuses: (id: number | string) => `/api/mini/ops/rooms/${id}/slot-statuses`,
    scheduleRoomOptions: (scheduleId: number | string) => `/api/mini/ops/schedules/${scheduleId}/room-options`,
    changeScheduleRoom: (scheduleId: number | string) => `/api/mini/ops/schedules/${scheduleId}/room`,
  },

  // 管理员
  admin: {
    users: '/api/mini/admin/users',
    createUserByMobile: '/api/mini/admin/users/by-mobile',
    deleteUser: (uid: number | string) => `/api/mini/admin/users/${uid}`,
    bindRole: (uid: number | string) => `/api/mini/admin/users/${uid}/roles`,
    refundExemptions: '/api/mini/admin/refund-exemptions',
    refundExemptionApprove: (id: number | string) => `/api/mini/admin/refund-exemptions/${id}/approve`,
    refundExemptionReject: (id: number | string) => `/api/mini/admin/refund-exemptions/${id}/reject`,
    caseRecordAmendments: '/api/mini/admin/case-record-amendments',
    caseRecordAmendmentApprove: (id: number | string) =>
      `/api/mini/admin/case-record-amendments/${id}/approve`,
    caseRecordAmendmentReject: (id: number | string) =>
      `/api/mini/admin/case-record-amendments/${id}/reject`,
    leaveRequests: '/api/mini/admin/leave-requests',
    leaveRequestDetail: (id: number | string) => `/api/mini/admin/leave-requests/${id}`,
    leaveRequestApprove: (id: number | string) => `/api/mini/admin/leave-requests/${id}/approve`,
    leaveRequestReject: (id: number | string) => `/api/mini/admin/leave-requests/${id}/reject`,
    consultationRecordCounselors: '/api/mini/admin/consultation-records/counselors',
    consultationRecordDetail: (id: number | string) => `/api/mini/admin/consultation-records/counselors/${id}`,
    consultationRecordView: (id: number | string) => `/api/mini/admin/consultation-records/records/${id}`,
    consultationRecordRevisions: (id: number | string) => `/api/mini/admin/consultation-records/records/${id}/revisions`,
    patients: '/api/mini/admin/patients',
    patientDetail: (id: number | string) => `/api/mini/admin/patients/${id}`,
    counselors: '/api/mini/admin/counselors',
    counselorDetail: (id: number | string) => `/api/mini/admin/counselors/${id}`,
    consultationFeedbacks: '/api/mini/admin/consultation-feedbacks',
    pricingCounselors: '/api/mini/admin/pricing/counselors',
    pricingCounselorBase: (counselorId: number | string) =>
      `/api/mini/admin/pricing/counselors/${counselorId}`,
    pricingCounselorPatients: (counselorId: number | string) =>
      `/api/mini/admin/pricing/counselors/${counselorId}/patients`,
    pricingCounselorPatientUpdate: (counselorId: number | string, patientId: number | string) =>
      `/api/mini/admin/pricing/counselors/${counselorId}/patients/${patientId}`,
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
