/**
 * 用户相关API服务
 */

import { http } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

// 用户信息类型
export interface UserInfo {
  id?: string
  name: string
  phone: string
  email: string
  avatar: string
  gender: string
  age: number
}

// 用户API服务类
export class UserApi {
  /**
   * 获取用户信息
   */
  static async getUserInfo(): Promise<UserInfo> {
    const response = await http.get<UserInfo>(API_ENDPOINTS.user.getUserInfo)
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || '获取用户信息失败')
  }

  /**
   * 更新用户信息
   */
  static async updateUserInfo(userInfo: Partial<UserInfo>): Promise<boolean> {
    const response = await http.post<boolean>(API_ENDPOINTS.user.updateUserInfo, userInfo)
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || '更新用户信息失败')
  }
} 