/** PHQ-9 / GAD-7 心理量表 */

export type ScaleType = 'PHQ9' | 'GAD7'

export interface ScaleMeta {
  type: ScaleType
  title: string
  desc: string
  questions: string[]
}

export const PHQ9: ScaleMeta = {
  type: 'PHQ9',
  title: 'PHQ-9 抑郁量表',
  desc: '过去两周内，以下问题困扰您的频率？0=完全没有，3=几乎每天',
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
}

export const GAD7: ScaleMeta = {
  type: 'GAD7',
  title: 'GAD-7 焦虑量表',
  desc: '过去两周内，以下问题困扰您的频率？0=完全没有，3=几乎每天',
  questions: [
    '感到紧张、焦虑或急切',
    '不能停止或控制担忧',
    '对各种事情担忧过多',
    '很难放松下来',
    '由于不安而无法静坐',
    '变得容易烦恼或急躁',
    '感到好像有什么可怕的事会发生',
  ],
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
  answers: number[]
  createdAt: string
}
