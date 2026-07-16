// 图片URL处理工具
import { CURRENT_CONFIG } from '@/config/config'
import { API_V2_CONFIG } from '@/config/api'

/**
 * 修复图片URL路径
 * - 本地前端资源 (/static/images-opt/*、/static/*) 直接返回，由小程序本地加载
 * - FastAPI 上传/静态目录 (/static/uploads/*、/api/static/*) 走 V2 baseURL
 * - 其它绝对路径（如旧 C# 后端 /Uploadfile/*）继续拼 V1 baseURL，保持兼容
 * - 完整 http(s) URL 原样返回
 */
export const fixImageUrl = (imagePath: string): string => {
  if (!imagePath) {
    return '/static/images-opt/place21.jpg'
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  // FastAPI 上传文件 → 新 Python 后端
  if (imagePath.startsWith('/static/uploads/') || imagePath.startsWith('/api/static/')) {
    return `${API_V2_CONFIG.baseURL}${imagePath}`
  }

  // 前端本地静态资源（小程序本地包里）→ 直接返回，由 uniapp/微信运行时解析
  if (imagePath.startsWith('/static/')) {
    return imagePath
  }

  if (imagePath.startsWith('/')) {
    return `${CURRENT_CONFIG.API_BASE_URL}${imagePath}`
  }

  return `${CURRENT_CONFIG.API_BASE_URL}/${imagePath}`
}

/**
 * 批量修复图片URL数组
 */
export const fixImageUrls = (imagePaths: string[]): string[] => {
  return imagePaths.map(path => fixImageUrl(path))
}

/**
 * 修复对象中的图片URL字段
 */
export const fixObjectImageUrls = <T>(
  obj: T,
  imageFields: string[] = ['image', 'url', 'avatar', 'banner', 'cover']
): T => {
  const result = { ...obj } as any

  imageFields.forEach(field => {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = fixImageUrl(result[field])
    }
  })

  return result
}

/**
 * 修复数组对象中的图片URL字段
 */
export const fixArrayImageUrls = <T>(
  items: T[],
  imageFields: string[] = ['image', 'url', 'avatar', 'banner', 'cover']
): T[] => {
  return items.map(item => fixObjectImageUrls(item, imageFields))
}
