// 用户相关类型
export interface User {
  id: number
  gId: string
  name: string
  tel: string
  mail: string
  openid: string
  isDelete: boolean
}

// 咨询师相关类型
export interface Doctor {
  id: number
  name: string
  avatar: string
  specialty: string
  experience: string
  rating: number
  province: string
  description?: string
  price?: number
  needsNegotiation?: boolean
  priceLabel?: string
  priceNegotiation?: boolean
  billingLabel?: string
}

// 轮播图类型
export interface Banner {
  id: number
  title: string
  subtitle?: string
  image: string
  buttonText: string
  date: string
}

// 功能卡片类型
export interface Feature {
  id: number
  title: string
  description: string
  image: string
  buttonText: string
  height: number
}

// 咨询师排班类型
export interface DoctorSchedule {
  id: number
  gId: string
  doctorID: number
  price: number
  maxSign: number
  numSign: number
  startTime: string
  endTime: string
  address: string
  createTime: string
  isDelete: boolean
}

// 咨询预约类型
export interface Consultation {
  id: number
  gId: string
  userID: number
  doctorID: number
  payCost: number
  state: number
  expectedTime: string
  duration: number
  openid: string
  name: string
  address: string
  tel: string
  email: string
  createTime: string
}

// 订单类型
export interface Order {
  id: number
  gId: string
  createTime: string
  userGId: string
  type: number
  title: string
  consultationGId: string
  amount: number
  discount: number
  remark: string
  state: number
  overTime: string
}

// API响应类型
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
  url?: string
}

// 分页参数类型
export interface PageParams {
  page: number
  pageSize: number
  keyword?: string
}

// 分页响应类型
export interface PageResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 活动类型
export interface Activity {
  id: number
  title: string
  description: string
  image: string
  date: string
  status?: string
}

// 直播类型
export interface LiveStream {
  id: number
  title: string
  description: string
  image: string
  time: string
  status?: string
}

// 首页数据类型
export interface HomeData {
  banners: Banner[]
  features: Feature[]
  doctors: Doctor[]
  activities: Activity[]
  liveStreams: LiveStream[]
}
