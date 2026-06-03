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
    const { url, method = 'GET', data, params, headers = {}, showLoading = true, showError = true } = config

    // 显示加载提示
    if (showLoading) {
      uni.showLoading({ title: '加载中...' })
    }

    try {
      // 构建完整URL - 如果是相对路径，拼接baseURL
      let fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`
      
      // 添加查询参数
      if (params && Object.keys(params).length > 0) {
        const queryString = Object.keys(params)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
          .join('&')
        fullUrl += `?${queryString}`
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
        timeout: this.timeout
      })

      // 隐藏加载提示
      if (showLoading) {
        uni.hideLoading()
      }

      // 处理响应
      return this.handleResponse(response)
    } catch (error) {
      // 隐藏加载提示
      if (showLoading) {
        uni.hideLoading()
      }

      // 处理错误
      return this.handleError(error, showError)
    }
  }

  /**
   * 处理响应
   */
  private handleResponse(response: any): ApiResponse {
    const { statusCode, data } = response

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
        // 处理后端返回的 {code, msg, data} 格式
        else if (data.hasOwnProperty('code') && data.hasOwnProperty('msg')) {
          return {
            code: data.code || 0,
            msg: data.msg || '请求成功',
            data: data.data || data,
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
      // HTTP错误
      return {
        code: statusCode,
        msg: `HTTP错误: ${statusCode}`,
        data: undefined,
        url: undefined
      }
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: any, showError: boolean): ApiResponse {
    let message = '网络请求失败'
    let code = -1

    if (error.errMsg) {
      if (error.errMsg.includes('timeout')) {
        message = '请求超时，请检查网络连接'
        code = -2
      } else if (error.errMsg.includes('fail')) {
        message = '网络连接失败，请检查网络设置'
        code = -3
      }
    }

    // 显示错误提示
    if (showError) {
      uni.showToast({
        title: message,
        icon: 'none',
        duration: 2000
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