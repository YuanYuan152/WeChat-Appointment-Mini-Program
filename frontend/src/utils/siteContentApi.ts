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
}

export interface PublicSiteContent {
  pages: Record<string, SitePagePayload>
  guideItems: SiteGuideItemPayload[]
}

export function bodyToParagraphs(body: string): string[] {
  return (body || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
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
      subtitle: fallback.subtitle,
      paragraphs: bodyToParagraphs(page.body),
    }
  }
  return fallback
}
