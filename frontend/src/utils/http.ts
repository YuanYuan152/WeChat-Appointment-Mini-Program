/**
 * HTTP请求封装类
 */

import { API_CONFIG, API_V2_CONFIG, getApiUrl } from '@/config/api'

// 响应数据类型定义
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
  url?: string
}

// 请求配置类型
export interface RequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  params?: Record<string, any>
  headers?: Record<string, string>
  timeout?: number
  showLoading?: boolean
  showError?: boolean
}

/** 并发请求共用 loading，避免 hideLoading 在 toast 已顶掉 loading 时报错 */
let loadingCount = 0

function beginLoading() {
  loadingCount += 1
  if (loadingCount === 1) {
    try {
      uni.showLoading({ title: '加载中...', mask: true })
    } catch {
      /* ignore */
    }
  }
}

function endLoading() {
  if (loadingCount <= 0) return
  loadingCount -= 1
  if (loadingCount === 0) {
    try {
      uni.hideLoading()
    } catch {
      /* ignore: toast can't be found */
    }
  }
}

// HTTP请求类
class HttpRequest {
  private baseURL: string
  private timeout: number
  private defaultHeaders: Record<string, string>

  constructor(config?: typeof API_CONFIG) {
    const c = config || API_CONFIG
    this.baseURL = c.baseURL
    this.timeout = c.timeout
    this.defaultHeaders = c.headers
  }

  /**
   * 发送请求
   */
  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    const { url, method = 'GET', data, params, headers = {}, showLoading = true, showError = true, timeout } = config

    if (showLoading) beginLoading()

    let fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`
    try {
      // 添加查询参数（跳过 undefined / null，避免被序列化成 "undefined"）
      if (params && Object.keys(params).length > 0) {
        const queryString = Object.keys(params)
          .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
          .join('&')
        if (queryString) {
          fullUrl += `?${queryString}`
        }
      }

      // 合并请求头
      const finalHeaders: Record<string, string> = {
        ...this.defaultHeaders,
        ...headers,
        // 添加CORS相关请求头
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }

      // 添加认证token
      const token = uni.getStorageSync('token')
      if (token) {
        finalHeaders.Authorization = `Bearer ${token}`
      }

      // 发送请求
      const response = await uni.request({
        url: fullUrl,
        method,
        data,
        header: finalHeaders,
        timeout: timeout ?? this.timeout
      })

      if (showLoading) endLoading()

      // 处理响应
      return this.handleResponse(response)
    } catch (error) {
      if (showLoading) endLoading()

      // 处理错误
      return this.handleError(error, showError, fullUrl)
    }
  }

  private parseResponseBody(raw: any): any {
    if (raw == null) return raw
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    }
    return raw
  }

  private extractErrorMessage(statusCode: number, data: any): string {
    const body = this.parseResponseBody(data)
    if (body && typeof body === 'object') {
      if (typeof body.detail === 'string') return body.detail
      if (Array.isArray(body.detail) && body.detail.length) {
        return body.detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
      }
      if (typeof body.msg === 'string') return body.msg
      if (typeof body.message === 'string') return body.message
    }
    return `HTTP错误: ${statusCode}`
  }

  /**
   * 处理响应
   */
  private handleResponse(response: any): ApiResponse {
    const { statusCode, data: rawData } = response
    const data = this.parseResponseBody(rawData)

    // 检查HTTP状态码
    if (statusCode >= 200 && statusCode < 300) {
      // 成功响应
      if (data && typeof data === 'object') {
        // 处理后端返回的 {success, message, data} 格式
        if (data.hasOwnProperty('success') && data.hasOwnProperty('message')) {
          return {
            code: data.success ? 0 : -1,
            msg: data.message || '请求成功',
            data: data.data || data,
            url: data.url
          }
        }
        // 处理后端返回的 {code, msg, data} 格式（confirm-dev 等）
        else if (data.hasOwnProperty('code') && data.hasOwnProperty('msg')) {
          const bizCode = typeof data.code === 'number' ? data.code : 0
          return {
            code: bizCode,
            msg: data.msg || '请求成功',
            data: data.data ?? data,
            url: data.url
          }
        }
        // 其他格式，直接返回
        else {
          return {
            code: 0,
            msg: '请求成功',
            data: data,
            url: undefined
          }
        }
      } else {
        return {
          code: 0,
          msg: '请求成功',
          data: data,
          url: undefined
        }
      }
    } else {
      return {
        code: statusCode,
        msg: this.extractErrorMessage(statusCode, data),
        data: undefined,
        url: undefined
      }
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: any, showError: boolean, requestUrl?: string): ApiResponse {
    let message = '网络请求失败'
    let code = -1
    const errMsg = String(error?.errMsg || error?.message || '')
    const target = requestUrl || this.baseURL

    if (errMsg.includes('timeout')) {
      message = `请求超时：${target}`
      code = -2
    } else if (errMsg.includes('fail') || errMsg.includes('Failed') || !errMsg) {
      const isLan = /^https?:\/\/(127\.|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(target)
      message = isLan
        ? `无法连接后端 ${target}（请确认手机与电脑同一 Wi‑Fi，后端已启动，并关闭代理）`
        : '网络连接失败，请检查网络设置'
      code = -3
    }

    console.error('[HTTP]', message, errMsg || error)

    // 显示错误提示
    if (showError) {
      uni.showToast({
        title: message.length > 40 ? `无法连接后端，请检查局域网与后端` : message,
        icon: 'none',
        duration: 3500,
      })
    }

    return {
      code,
      msg: message,
      data: undefined,
      url: undefined
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(url: string, params?: Record<string, any>, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'GET',
      params,
      ...config
    })
  }

  /**
   * POST请求
   */
  async post<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'POST',
      data,
      ...config
    })
  }

  /**
   * PUT请求
   */
  async put<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'PUT',
      data,
      ...config
    })
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'DELETE',
      ...config
    })
  }

  /**
   * 文件上传
   */
  async upload<T = any>(url: string, filePath: string, name = 'file', formData?: Record<string, any>): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`
    const token = uni.getStorageSync('token')
    const header: Record<string, string> = {}
    if (token) header.Authorization = `Bearer ${token}`

    return new Promise((resolve) => {
      uni.uploadFile({
        url: fullUrl,
        filePath,
        name,
        formData,
        header,
        timeout: this.timeout,
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (data.hasOwnProperty('success') && data.hasOwnProperty('message')) {
              resolve({ code: data.success ? 0 : -1, msg: data.message, data: data.data })
            } else if (data.hasOwnProperty('code')) {
              resolve({ code: data.code || 0, msg: data.msg || '上传成功', data: data.data || data })
            } else {
              resolve({ code: 0, msg: '上传成功', data })
            }
          } catch {
            resolve({ code: -1, msg: '解析上传响应失败', data: undefined })
          }
        },
        fail: () => {
          resolve({ code: -1, msg: '上传失败', data: undefined })
        },
      })
    })
  }
}

// 创建旧后端 HTTP 实例
export const http = new HttpRequest()

// 创建新 Python 后端 HTTP 实例（认证/支付/上传等新接口使用）
export const httpV2 = new HttpRequest(API_V2_CONFIG)

// 导出常用方法
export const { get, post, put, delete: del } = http