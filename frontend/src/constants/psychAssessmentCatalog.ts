/** 外链心理测评（跳转 front_site /assessment） */

export type ExternalAssessmentCategory = 'professional' | 'fun'

export interface ExternalAssessmentItem {
  id: string
  category: ExternalAssessmentCategory
  title: string
  subtitle: string
  questionCount: number
  duration: number
  categoryLabel: string
}

/** 测评站基础地址，与 front_site 部署域名一致 */
export const ASSESSMENT_WEB_BASE = (
  import.meta.env.VITE_ASSESSMENT_WEB_URL || 'https://www.ji-psy.com'
).replace(/\/$/, '')

export const EXTERNAL_ASSESSMENT_LIST: ExternalAssessmentItem[] = [
  {
    id: 'bsi-18',
    category: 'professional',
    title: '简明症状量表（BSI-18）',
    subtitle: '评估躯体化、抑郁与焦虑症状',
    questionCount: 18,
    duration: 8,
    categoryLabel: '专业量表',
  },
  {
    id: 'aas',
    category: 'professional',
    title: '成人依恋量表（AAS）',
    subtitle: '了解您的依恋类型',
    questionCount: 18,
    duration: 8,
    categoryLabel: '专业量表',
  },
  {
    id: 'psqi',
    category: 'professional',
    title: '匹兹堡睡眠质量指数（PSQI）',
    subtitle: '评估近1个月的睡眠质量',
    questionCount: 19,
    duration: 10,
    categoryLabel: '专业量表',
  },
  {
    id: 'pbi',
    category: 'professional',
    title: '父母教养方式问卷（PBI）',
    subtitle: '回顾16岁前的父母养育方式',
    questionCount: 50,
    duration: 15,
    categoryLabel: '专业量表',
  },
  {
    id: 'cbcl',
    category: 'professional',
    title: '儿童行为量表（CBCL）',
    subtitle: '筛查6-16岁儿童行为问题',
    questionCount: 113,
    duration: 20,
    categoryLabel: '专业量表',
  },
  {
    id: 'dark-light-personality',
    category: 'fun',
    title: '光明与黑暗人格测试',
    subtitle: '评估伴侣黑暗特质与自身光明人格',
    questionCount: 23,
    duration: 10,
    categoryLabel: '趣味探索',
  },
]

export const buildAssessmentFillUrl = (item: ExternalAssessmentItem): string =>
  `${ASSESSMENT_WEB_BASE}/assessment/${item.category}/${item.id}`

export const buildAssessmentReportsUrl = (): string =>
  `${ASSESSMENT_WEB_BASE}/assessment/reports`
