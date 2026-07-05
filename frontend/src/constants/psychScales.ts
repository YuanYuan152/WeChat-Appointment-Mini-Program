/** PHQ-9 / GAD-7 心理量表 */

export type ScaleType = 'PHQ9' | 'GAD7'

export interface ScaleLevelInterpretation {
  min: number
  max: number
  levelLabel: string
  description: string
  suggestions: string[]
}

export interface ScaleMeta {
  type: ScaleType
  title: string
  subtitle: string
  desc: string
  questionCount: number
  duration: number
  disclaimer: string
  questions: string[]
  levels: ScaleLevelInterpretation[]
}

export const SCALE_DISCLAIMER =
  '本测评结果仅供参考，不能替代专业医学诊断。如有需要，请寻求专业心理咨询或医疗帮助。'

const PHQ9_LEVELS: ScaleLevelInterpretation[] = [
  {
    min: 0,
    max: 4,
    levelLabel: '无或极轻微',
    description:
      '您目前的抑郁症状很轻微或几乎没有，心理状态整体较为平稳。请继续保持规律作息与积极的生活方式。',
    suggestions: ['保持规律运动与充足睡眠', '维持社交联系与兴趣爱好', '关注情绪变化，必要时可再次自评'],
  },
  {
    min: 5,
    max: 9,
    levelLabel: '轻度',
    description:
      '您可能存在轻度的抑郁情绪或相关症状，对生活有一定影响但尚属可控范围。建议关注自我照顾与压力管理。',
    suggestions: [
      '尝试正念、呼吸放松等自我调节方法',
      '与信任的家人或朋友倾诉',
      '若症状持续两周以上，建议预约心理咨询',
    ],
  },
  {
    min: 10,
    max: 14,
    levelLabel: '中度',
    description:
      '您目前抑郁症状达到中度水平，可能已影响日常功能与情绪体验。建议尽快寻求专业心理支持。',
    suggestions: [
      '预约专业心理咨询师进行评估',
      '减少独处时间，寻求社会支持',
      '如有自伤念头，请立即联系危机热线或就医',
    ],
  },
  {
    min: 15,
    max: 19,
    levelLabel: '中重度',
    description:
      '您的抑郁症状较为明显，对生活、工作与人际可能产生较大困扰。强烈建议尽快接受专业评估与干预。',
    suggestions: [
      '尽快联系心理咨询师或精神科医生',
      '告知家人或紧急联系人当前状况',
      '避免独处，确保身边有人可联络',
    ],
  },
  {
    min: 20,
    max: 27,
    levelLabel: '重度',
    description:
      '您目前的抑郁症状达到重度水平，需要高度重视。请尽快寻求专业医疗与心理帮助。',
    suggestions: [
      '立即联系精神科医生或前往医疗机构',
      '告知家人，安排陪伴与支持',
      '如有自伤或自杀念头，请拨打心理危机热线或 120',
    ],
  },
]

const GAD7_LEVELS: ScaleLevelInterpretation[] = [
  {
    min: 0,
    max: 4,
    levelLabel: '无或极轻微',
    description:
      '您目前的焦虑症状很轻微或几乎没有，情绪调节能力良好。请继续保持健康的生活习惯。',
    suggestions: ['保持规律作息与适度运动', '练习放松技巧以预防压力积累', '关注身心状态变化'],
  },
  {
    min: 5,
    max: 9,
    levelLabel: '轻度',
    description:
      '您可能存在轻度的焦虑情绪，偶尔感到紧张或担忧。通过自我调节通常可以得到缓解。',
    suggestions: [
      '尝试深呼吸、渐进式肌肉放松',
      '减少咖啡因摄入，保证睡眠',
      '若焦虑持续，可考虑心理咨询',
    ],
  },
  {
    min: 10,
    max: 14,
    levelLabel: '中度',
    description:
      '您目前焦虑症状达到中度水平，可能已影响注意力、睡眠或日常功能。建议寻求专业支持。',
    suggestions: [
      '预约心理咨询师进行系统评估',
      '学习认知行为技巧管理担忧',
      '避免过度使用酒精或其他物质缓解焦虑',
    ],
  },
  {
    min: 15,
    max: 21,
    levelLabel: '重度',
    description:
      '您目前的焦虑症状较为严重，可能显著影响生活质量。请尽快寻求专业心理或医疗帮助。',
    suggestions: [
      '尽快联系心理咨询师或精神科医生',
      '告知家人当前状况，获得支持',
      '减少高强度压力源，优先自我照顾',
    ],
  },
]

export const PHQ9: ScaleMeta = {
  type: 'PHQ9',
  title: 'PHQ-9 抑郁量表',
  subtitle: '评估近两周抑郁相关症状',
  desc: '过去两周内，以下问题困扰您的频率？0=完全没有，3=几乎每天',
  questionCount: 9,
  duration: 3,
  disclaimer: SCALE_DISCLAIMER,
  questions: [
    '做事时提不起劲或没有兴趣',
    '感到心情低落、沮丧或绝望',
    '入睡困难、睡不安或睡眠过多',
    '感觉疲倦或没有活力',
    '食欲不振或吃太多',
    '觉得自己很糟，或觉得自己很失败',
    '难以集中注意力',
    '行动或说话缓慢，或坐立不安',
    '有不如死掉或伤害自己的念头',
  ],
  levels: PHQ9_LEVELS,
}

export const GAD7: ScaleMeta = {
  type: 'GAD7',
  title: 'GAD-7 焦虑量表',
  subtitle: '评估近两周焦虑相关症状',
  desc: '过去两周内，以下问题困扰您的频率？0=完全没有，3=几乎每天',
  questionCount: 7,
  duration: 3,
  disclaimer: SCALE_DISCLAIMER,
  questions: [
    '感到紧张、焦虑或急切',
    '不能停止或控制担忧',
    '对各种事情担忧过多',
    '很难放松下来',
    '由于不安而无法静坐',
    '变得容易烦恼或急躁',
    '感到好像有什么可怕的事会发生',
  ],
  levels: GAD7_LEVELS,
}

export const SCALE_LIST: ScaleMeta[] = [PHQ9, GAD7]

export const getScaleMeta = (type: string): ScaleMeta | null => {
  const key = type.toUpperCase().replace('-', '')
  if (key === 'PHQ9' || key === 'PHQ') return PHQ9
  if (key === 'GAD7' || key === 'GAD') return GAD7
  return SCALE_LIST.find(s => s.type === type) || null
}

export const SCORE_OPTIONS = [
  { value: 0, label: '0 完全没有' },
  { value: 1, label: '1 好几天' },
  { value: 2, label: '2 一半以上天数' },
  { value: 3, label: '3 几乎每天' },
]

export interface ScaleResult {
  id: number
  scaleType: ScaleType
  scaleLabel: string
  total: number
  levelLabel: string
  description?: string
  suggestions?: string[]
  resultSummary?: string
  answers: number[]
  createdAt: string
}

export const interpretScaleScore = (
  type: string,
  total: number,
): { levelLabel: string; description: string; suggestions: string[] } => {
  const meta = getScaleMeta(type)
  if (!meta) {
    return { levelLabel: '—', description: '', suggestions: [] }
  }
  const hit = meta.levels.find(l => total >= l.min && total <= l.max)
  if (!hit) {
    return { levelLabel: '—', description: '', suggestions: [] }
  }
  return {
    levelLabel: hit.levelLabel,
    description: hit.description,
    suggestions: hit.suggestions,
  }
}

export const buildResultSummary = (result: Pick<ScaleResult, 'scaleLabel' | 'total' | 'levelLabel'>): string =>
  `${result.scaleLabel} · 总分 ${result.total} · ${result.levelLabel}`

export const enrichScaleResult = (raw: ScaleResult): ScaleResult => {
  const interp = interpretScaleScore(raw.scaleType, raw.total)
  return {
    ...raw,
    levelLabel: raw.levelLabel || interp.levelLabel,
    description: raw.description || interp.description,
    suggestions: raw.suggestions?.length ? raw.suggestions : interp.suggestions,
    resultSummary: raw.resultSummary || buildResultSummary({
      scaleLabel: raw.scaleLabel,
      total: raw.total,
      levelLabel: raw.levelLabel || interp.levelLabel,
    }),
  }
}

export const scoreOptionLabel = (value: number): string =>
  SCORE_OPTIONS.find(o => o.value === value)?.label ?? String(value)
