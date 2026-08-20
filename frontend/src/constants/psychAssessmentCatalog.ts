/** 外链心理测评（跳转 front_site /assessment） */

export type AssessmentHubKey = 'reports' | 'professional' | 'fun'

export interface AssessmentHubEntry {
  key: AssessmentHubKey
  title: string
  subtitle: string
  path: string
}

/** 测评站基础地址，与 front_site 部署域名一致 */
export const ASSESSMENT_WEB_BASE = (
  import.meta.env.VITE_ASSESSMENT_WEB_URL || 'https://eap.ji-psy.com'
).replace(/\/$/, '')

/** 心理测评页三个入口：测评报告 / 专业测评 / 趣味测评 */
export const ASSESSMENT_HUB_ENTRIES: AssessmentHubEntry[] = [
  {
    key: 'reports',
    title: '测评报告',
    subtitle: '查看已完成的心理测评记录与详细评估结果',
    path: '/assessment/reports',
  },
  {
    key: 'professional',
    title: '专业测评',
    subtitle: '基于国际认可的心理量表，了解近期心理健康状况',
    path: '/assessment/professional',
  },
  {
    key: 'fun',
    title: '趣味测评',
    subtitle: '轻松有趣的心理探索，在玩乐中发现自己',
    path: '/assessment/fun',
  },
]

export const buildAssessmentHubUrl = (entry: AssessmentHubEntry): string =>
  `${ASSESSMENT_WEB_BASE}${entry.path}`

export const buildAssessmentReportsUrl = (): string =>
  `${ASSESSMENT_WEB_BASE}/assessment/reports`

export const buildAssessmentProfessionalUrl = (): string =>
  `${ASSESSMENT_WEB_BASE}/assessment/professional`

export const buildAssessmentFunUrl = (): string =>
  `${ASSESSMENT_WEB_BASE}/assessment/fun`
