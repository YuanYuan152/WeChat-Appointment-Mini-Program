/**
 * 认证相关 API 服务（对接新 Python 后端 /api/mini/auth/*）
 */

import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { setToken } from '@/utils/auth'

// ---- 请求/响应类型 ----

export interface WxLoginRequest {
  code: string
}

export interface WxLoginResponse {
  token: string
  is_new_user: boolean
}

export interface BindMobileRequest {
  phoneCode: string
}

export interface UserInfo {
  id: number
  openId?: string
  mobile?: string
  nickname?: string
  avatarUrl?: string
  roles: string[]
  activeRole?: string
}

// ---- API 方法 ----

export class AuthApi {
  /**
   * 微信小程序一键登录：用 wx.login 返回的 code 换 JWT
   */
  static async wxLogin(code: string): Promise<WxLoginResponse> {
    const res = await httpV2.post<WxLoginResponse>(
      API_ENDPOINTS.auth.login,
      { code },
      { showLoading: false },
    )
    if (res.code === 0 && res.data) {
      setToken(res.data.token)
      return res.data
    }
    throw new Error(res.msg || '微信登录失败')
  }

  /**
   * 绑定手机号
   */
  static async bindMobile(phoneCode: string): Promise<{ message: string; mobile: string }> {
    const res = await httpV2.post(API_ENDPOINTS.auth.bindMobile, { phoneCode })
    if (res.code === 0 && res.data) return res.data
    throw new Error(res.msg || '绑定手机号失败')
  }

  /**
   * 获取当前用户信息及角色
   */
  static async getMe(): Promise<UserInfo> {
    const res = await httpV2.get<UserInfo>(API_ENDPOINTS.auth.me)
    if (res.code === 0 && res.data) return res.data
    throw new Error(res.msg || '获取用户信息失败')
  }

  /**
   * 切换当前活跃角色
   */
  static async switchRole(role: string): Promise<{ message: string; activeRole: string }> {
    const res = await httpV2.post(API_ENDPOINTS.auth.switchRole, { role })
    if (res.code === 0 && res.data) return res.data
    throw new Error(res.msg || '角色切换失败')
  }

  /**
   * 注销当前账号（软删除，符合微信小程序合规要求）
   * 成功后调用方应负责清空本地 token 并跳转。
   */
  static async deleteAccount(): Promise<{ message: string }> {
    const res = await httpV2.delete(API_ENDPOINTS.auth.deleteAccount)
    if (res.code === 0 && res.data) return res.data
    throw new Error(res.msg || '注销失败')
  }
}
