/**
 * 全局分享：任意页面右上角「转发」可分享到聊天，点击卡片回到当前页（含 query）。
 * 页面若自行定义 onShareAppMessage / onShareTimeline，会覆盖本 mixin 的默认行为。
 */
import { getCurrentPagePath } from '@/utils/auth'

const DEFAULT_SHARE_TITLE = '连心心理'

function resolveSharePath(): string {
  const path = getCurrentPagePath()
  if (path && path.startsWith('/pages/')) return path
  return '/pages/index/index'
}

function resolveShareTitle(): string {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1] as {
      $page?: { meta?: { navigationBarTitleText?: string } }
      navigationBarTitleText?: string
    } | undefined
    const title =
      current?.$page?.meta?.navigationBarTitleText ||
      current?.navigationBarTitleText ||
      ''
    const trimmed = String(title).trim()
    if (trimmed && trimmed !== '连心心理') {
      return `${trimmed} · ${DEFAULT_SHARE_TITLE}`
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SHARE_TITLE
}

function enableShareMenus() {
  // #ifdef MP-WEIXIN
  try {
    uni.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  } catch {
    /* ignore */
  }
  // #endif
}

export const shareMixin = {
  onLoad() {
    enableShareMenus()
  },
  onShow() {
    enableShareMenus()
  },
  onShareAppMessage() {
    return {
      title: resolveShareTitle(),
      path: resolveSharePath(),
    }
  },
  onShareTimeline() {
    const fullPath = resolveSharePath()
    const query = fullPath.includes('?') ? fullPath.split('?').slice(1).join('?') : ''
    return {
      title: resolveShareTitle(),
      query,
    }
  },
}

export default shareMixin
