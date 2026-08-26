/** 咨询中心与助理联系方式（展示用，运营可在后台配置扩展后替换） */

export interface ContactCenter {
  id: string
  name: string
  address: string
}

export interface AssistantContact {
  name: string
  phone: string
  /** uni.makePhoneCall 用，仅数字 */
  phoneDial: string
  qrcodeSrc: string
  hint: string
  workHours: string
}

export const CONTACT_CENTERS: ContactCenter[] = [
  {
    id: 'yangpu',
    name: '杨浦咨询中心',
    address: '上海市杨浦区国康路46号同济科技大厦',
  },
  {
    id: 'pudong',
    name: '浦东咨询中心',
    address: '上海市浦东新区浦东大道138号永华大厦',
  },
]

export const ASSISTANT_CONTACT: AssistantContact = {
  name: '咨询助理',
  phone: '15316025286',
  phoneDial: '15316025286',
  qrcodeSrc: '/static/images-opt/assistant-qrcode.jpg',
  hint: '扫码添加咨询助理微信，预约咨询、改期与疑问均可联系',
  workHours: '工作时间：周一到周日9:00-21:00，法定节假日除外',
}
