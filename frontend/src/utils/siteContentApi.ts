import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import {
  ABOUT_CONTENT,
  CHARITY_CONSULTATION_CONTENT,
  CONSULTATION_GUIDE_CARDS,
} from '@/constants/siteContent'

export interface SitePagePayload {
  id?: number
  pageKey: string
  title: string
  subtitle?: string | null
  body: string
  assistantQrcodeUrl?: string | null
  coverImageUrl?: string | null
  coverCrop?: {
    x: number
    y: number
    width: number
    height: number
  } | null
  updatedAt?: string
}

export interface SiteGuideItemPayload {
  id: number
  title: string
  body?: string
  summary?: string
  sortOrder?: number
  isActive?: boolean
  /** 本地兜底文案 key，API 不可用时打开详情用 */
  legacyKey?: string
}

export interface PublicSiteContent {
  pages: Record<string, SitePagePayload>
  guideItems: SiteGuideItemPayload[]
}

export function bodyToParagraphs(body: string): string[] {
  const normalized = (body || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n')
    .trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const paragraphs: string[] = []
  let buffer: string[] = []

  const flushBuffer = () => {
    if (buffer.length) {
      paragraphs.push(buffer.join('\n'))
      buffer = []
    }
  }

  for (const line of lines) {
    if (line.trim() === '') {
      flushBuffer()
      paragraphs.push('')
      continue
    }
    buffer.push(line)
  }
  flushBuffer()

  while (paragraphs.length && paragraphs[paragraphs.length - 1] === '') {
    paragraphs.pop()
  }

  return paragraphs
}

export async function fetchPublicSiteContent(): Promise<PublicSiteContent | null> {
  try {
    const res = await httpV2.get<PublicSiteContent>(
      API_ENDPOINTS.common.siteContent,
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      return res.data
    }
  } catch {
    /* fallback */
  }
  return null
}

export async function fetchSiteGuideItem(id: number): Promise<SiteGuideItemPayload | null> {
  try {
    const res = await httpV2.get<SiteGuideItemPayload>(
      API_ENDPOINTS.common.siteGuideItem(id),
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      return res.data
    }
  } catch {
    /* fallback */
  }
  return null
}

export function fallbackBrandContent() {
  return {
    title: ABOUT_CONTENT.title,
    subtitle: ABOUT_CONTENT.subtitle || '',
    paragraphs: ABOUT_CONTENT.sections.flatMap((section) => section.paragraphs),
  }
}

export function fallbackCharityContent() {
  return {
    title: CHARITY_CONSULTATION_CONTENT.title,
    subtitle: CHARITY_CONSULTATION_CONTENT.subtitle || '',
    paragraphs: CHARITY_CONSULTATION_CONTENT.sections.flatMap((section) => section.paragraphs),
  }
}

export function fallbackContactIntro() {
  return {
    title: '联系我们',
    subtitle: '上海连心心理咨询有限公司',
    paragraphs: [
      '欢迎通过下方咨询中心地址、助理微信或电话与我们取得联系。',
      '咨询助理工作时间为工作日 9:00–18:00，我们会在工作时间内尽快回复您的留言。',
    ],
  }
}

export function fallbackGuideItems(): SiteGuideItemPayload[] {
  return CONSULTATION_GUIDE_CARDS.map((item, index) => ({
    id: index + 1,
    title: item.title,
    summary: item.summary,
    legacyKey: item.id,
  }))
}

export function resolvePageContent(
  pages: Record<string, SitePagePayload> | undefined,
  key: string,
  fallback: { title: string; subtitle: string; paragraphs: string[] },
) {
  const page = pages?.[key]
  if (page?.body?.trim()) {
    return {
      title: page.title || fallback.title,
      subtitle: page.subtitle?.trim() || fallback.subtitle,
      paragraphs: bodyToParagraphs(page.body),
    }
  }
  return fallback
}
