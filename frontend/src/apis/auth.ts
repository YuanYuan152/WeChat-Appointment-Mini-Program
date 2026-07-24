/**
 * 认证相关 API 服务（对接新 Python 后端 /api/mini/auth/*）
 */

import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { saveSession, clearSession } from '@/utils/session'
import { resolveAccountRole } from '@/constants/roles'

// ---- 请求/响应类型 ----

export interface WxLoginRequest {
  code: string
}

export interface WxLoginResponse {
  token: string
  is_new_user: boolean
  openId?: string
  activeRole?: string
  roles?: string[]
  nickname?: string
  avatarUrl?: string
  id?: number
  mobile?: string
  isMockAuth?: boolean
  needProfileSetup?: boolean
  needSubscribeGuide?: boolean
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
  profileCompleted?: boolean
  subscribeOptIn?: boolean
  needProfileSetup?: boolean
  needSubscribeGuide?: boolean
}

export interface WechatStatus {
  configured: boolean
  appIdConfigured: boolean
}

// ---- API 方法 ----

export class AuthApi {
  /** 后端是否已配置真实微信 AppID/Secret */
  static async getWechatStatus(): Promise<WechatStatus> {
    const res = await httpV2.get<WechatStatus>(API_ENDPOINTS.auth.wechatStatus, undefined, {
      showLoading: false,
      showError: false,
    })
    if (res.code === 0 && res.data) return res.data
    return { configured: false, appIdConfigured: false }
  }

  /**
   * 微信小程序一键登录：用 wx.login 返回的 code 换 JWT
   * 成功后写入统一 userInfo（并同步旧字段 token / active_role / user_roles）
   */
  static async wxLogin(code: string): Promise<WxLoginResponse> {
    const res = await httpV2.post<WxLoginResponse>(
      API_ENDPOINTS.auth.login,
      { code },
      { showLoading: false },
    )
    if (res.code === 0 && res.data?.token) {
      const role = resolveAccountRole(res.data.roles, res.data.activeRole)
      saveSession({
        token: res.data.token,
        openid: res.data.openId,
        role,
        nickname: res.data.nickname,
        avatar: res.data.avatarUrl,
        id: res.data.id,
        mobile: res.data.mobile,
      })
      return res.data
    }
    throw new Error(res.msg || '微信登录失败')
  }

  /**
   * 绑定手机号（正式注册流程必需）
   */
  static async bindMobile(phoneCode: string): Promise<{ message: string; mobile: string; isMockAuth?: boolean }> {
    const res = await httpV2.post(
      API_ENDPOINTS.auth.bindMobile,
      { phoneCode },
      { showLoading: false },
    )
    if (res.code === 0 && res.data) {
      const token = String(uni.getStorageSync('token') || '')
      if (token && res.data.mobile) {
        saveSession({ token, mobile: res.data.mobile })
      }
      return res.data
    }
    throw new Error(res.msg || '绑定手机号失败')
  }

  /**
   * 获取当前用户信息及角色
   */
  static async getMe(): Promise<UserInfo> {
    const res = await httpV2.get<UserInfo>(API_ENDPOINTS.auth.me)
    if (res.code === 0 && res.data) {
      const role = resolveAccountRole(res.data.roles, res.data.activeRole)
      const token = uni.getStorageSync('token') || ''
      if (token) {
        saveSession({
          token: String(token),
          openid: res.data.openId,
          role,
          nickname: res.data.nickname,
          avatar: res.data.avatarUrl,
          id: res.data.id,
          mobile: res.data.mobile,
        })
      }
      return res.data
    }
    throw new Error(res.msg || '获取用户信息失败')
  }

  /** 更新头像 / 昵称等基本资料 */
  static async updateMe(payload: {
    nickname?: string
    avatarUrl?: string
    realName?: string
    gender?: string
    markProfileCompleted?: boolean
  }): Promise<UserInfo> {
    const res = await httpV2.put<UserInfo>(API_ENDPOINTS.auth.updateMe, payload)
    if (res.code === 0 && res.data) {
      const role = resolveAccountRole(res.data.roles, res.data.activeRole)
      const token = uni.getStorageSync('token') || ''
      if (token) {
        saveSession({
          token: String(token),
          openid: res.data.openId,
          role,
          nickname: res.data.nickname,
          avatar: res.data.avatarUrl,
          id: res.data.id,
          mobile: res.data.mobile,
        })
      }
      return res.data
    }
    throw new Error(res.msg || '保存资料失败')
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
   * 注销当前账号（软删除：清空身份字段，保留预约/订单等业务数据）
   * 优先 POST deactivate（兼容性更好），失败再试 DELETE。
   */
  static async deleteAccount(): Promise<{ message: string; accountId?: number }> {
    const tryDeactivate = await httpV2.post(
      API_ENDPOINTS.auth.deactivateAccount,
      {},
      { showLoading: false, showError: false },
    )
    if (tryDeactivate.code === 0 && tryDeactivate.data) {
      clearSession()
      return tryDeactivate.data
    }

    const res = await httpV2.delete(API_ENDPOINTS.auth.deleteAccount, {
      showLoading: false,
      showError: false,
    })
    if (res.code === 0 && res.data) {
      clearSession()
      return res.data
    }
    throw new Error(tryDeactivate.msg || res.msg || '注销失败')
  }
}
