// 图片URL处理工具
import { CURRENT_CONFIG } from '@/config/config'
import { API_V2_CONFIG } from '@/config/api'

/** 仍保留 png 的本地资源（tab/icon）；其余大图压缩后多为 jpg */
const KEEP_PNG_BASENAMES = new Set([
  'bottom1', 'bottom2', 'bottom3', 'bottom4',
  'tab11', 'tab12', 'sei', 'zyzxs',
])

/**
 * 旧包路径 /static/images/xxx.png → 压缩后 /static/images-opt/xxx.jpg（或 png）
 * 数据库 Banner/Activity.CoverUrl 仍可能写着已删除的 images 路径。
 */
const rewriteLegacyLocalImage = (imagePath: string): string => {
  if (!imagePath.startsWith('/static/images/') || imagePath.startsWith('/static/images-opt/')) {
    return imagePath
  }
  const file = imagePath.slice('/static/images/'.length)
  const base = file.replace(/\.[^.]+$/, '')
  const keepPng = KEEP_PNG_BASENAMES.has(base.toLowerCase())
  return `/static/images-opt/${base}.${keepPng ? 'png' : 'jpg'}`
}

/**
 * FastAPI 上传目录：无论返回相对路径还是带错误域名的绝对 URL，
 * 都改写到当前 V2 后端，避免 BASE_URL 占位符导致头像无法显示。
 */
const toCurrentUploadUrl = (value: string): string | null => {
  let pathname = value
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      pathname = new URL(value).pathname
    } catch {
      return null
    }
  }
  if (pathname.startsWith('/static/uploads/') || pathname.startsWith('/api/static/')) {
    return `${API_V2_CONFIG.baseURL.replace(/\/$/, '')}${pathname}`
  }
  return null
}

/**
 * 上传接口返回的地址统一存相对路径，展示时再拼当前后端。
 */
export const toStoredUploadPath = (url?: string, filename?: string): string => {
  if (filename && /^[A-Za-z0-9._-]+$/.test(filename)) {
    return `/static/uploads/${filename}`
  }
  if (!url) return ''
  if (url.startsWith('/static/uploads/') || url.startsWith('/api/static/')) {
    return url.split('?')[0]
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const pathname = new URL(url).pathname
      if (pathname.startsWith('/static/uploads/') || pathname.startsWith('/api/static/')) {
        return pathname
      }
    } catch {
      return url
    }
  }
  return url
}

/**
 * 修复图片URL路径
 * - 本地前端资源 (/static/images-opt/*、/static/*) 直接返回，由小程序本地加载
 * - 旧 /static/images/* 自动映射到 images-opt
 * - FastAPI 上传/静态目录 (/static/uploads/*、/api/static/*) 走 V2 baseURL
 * - 其它绝对路径（如旧 C# 后端 /Uploadfile/*）继续拼 V1 baseURL，保持兼容
 * - 完整 http(s) URL 原样返回；其中上传目录会改写到当前 V2 地址
 */
export const fixImageUrl = (imagePath: string): string => {
  if (!imagePath) {
    return '/static/images-opt/place21.jpg'
  }

  const uploadUrl = toCurrentUploadUrl(imagePath)
  if (uploadUrl) {
    return uploadUrl
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  // FastAPI 上传文件 → 新 Python 后端
  if (imagePath.startsWith('/static/uploads/') || imagePath.startsWith('/api/static/')) {
    return `${API_V2_CONFIG.baseURL}${imagePath}`
  }

  // 旧 images 目录已删除，映射到压缩目录
  if (imagePath.startsWith('/static/images/') && !imagePath.startsWith('/static/images-opt/')) {
    return rewriteLegacyLocalImage(imagePath)
  }

  // 前端本地静态资源（小程序本地包里）→ 直接返回
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
