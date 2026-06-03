import { http } from '@/utils/http'
import type { 
  ApiResponse, 
  User, 
  Doctor, 
  Banner, 
  DoctorSchedule, 
  Consultation,
  PageParams 
} from '@/types'

// 首页相关API
export const homeApi = {
  // 获取首页数据
  getIndexData: () => {
    return http.get<ApiResponse<{
      banners: Banner[]
      doctors: Doctor[]
    }>>('/we/Index')
  }
}

// 咨询师相关API
export const consultantApi = {
  // 获取咨询师列表
  getList: () => {
    return http.get<ApiResponse<Doctor[]>>('/we/ConsultantLst')
  },

  // 获取咨询师详情
  getDetail: (id: string) => {
    return http.get<ApiResponse<Doctor>>(`/we/ConsultantView?id=${id}`)
  },

  // 获取咨询师排班
  getSchedule: (id: number) => {
    return http.get<ApiResponse<DoctorSchedule[]>>(`/we/getDoctorSchedule?id=${id}`)
  },

  // 获取咨询师信息
  getDoctor: (id: number) => {
    return http.get<ApiResponse<Doctor>>(`/we/getDoctor?id=${id}`)
  }
}

// 用户相关API
export const userApi = {
  // 获取用户信息
  getInfo: () => {
    return http.get<ApiResponse<User>>('/we/getPatient')
  },

  // 获取患者信息
  getPatientInfo: (doctorID: number) => {
    return http.get<ApiResponse<{
      patient: User
      csum: number
      formGid: string
    }>>(`/we/getPatient?doctorID=${doctorID}`)
  }
}

// 预约相关API
export const appointmentApi = {
  // 创建预约
  create: (params: {
    doctorScheduleID: number
    xyID: string
  }) => {
    return http.post<ApiResponse<{
      url?: string
    }>>('/we/appointment', params)
  }
}

// 咨询协议相关API
export const xyApi = {
  // 获取咨询协议页面
  getPage: (params: {
    type: number
    name?: string
    money?: string
    doctor?: string
  }) => {
    return http.get<ApiResponse<any>>('/we/xy', { params })
  }
}

// 个人中心相关API
export const profileApi = {
  // 获取个人中心数据
  getData: () => {
    return http.get<ApiResponse<any>>('/we/me')
  }
} 