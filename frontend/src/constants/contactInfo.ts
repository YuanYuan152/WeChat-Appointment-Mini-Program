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
    name: '杨浦预约中心',
    address: '上海市杨浦区国权路525号豪生国际大酒店辅楼2楼',
  },
  {
    id: 'pudong',
    name: '浦东预约中心',
    address: '上海市浦东新区浦东南路1085号南塔15楼',
  },
]

export const ASSISTANT_CONTACT: AssistantContact = {
  name: '咨询助理',
  phone: '021-5858-0123',
  phoneDial: '02158580123',
  qrcodeSrc: '/static/images/assistant-qrcode.png',
  hint: '扫码添加咨询助理微信，预约咨询、改期与疑问均可联系',
  workHours: '工作日 9:00–18:00',
}
