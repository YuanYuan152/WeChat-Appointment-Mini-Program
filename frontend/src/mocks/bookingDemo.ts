/**
 * 预约演示用死数据 — 与后端约定对齐：
 * - GetDoctorList：code / msg / data.doctors / data.pagination（query: keyword, province, specialty, page, pageSize）
 * - GetConsultantFilterMeta（建议的扩展接口）：筛选栏选项，当前 C# 未实现，仅演示用死数据格式
 * - GetDoctorDetail：见 getMockDoctorDetailJson
 * - POST /we/appointment 成功体：见 getMockAppointmentSubmitResponse
 *
 * 开启：VITE_USE_BOOKING_MOCK=true 后重启 dev
 */

import type { ApiResponse } from '@/utils/http'

export function isBookingDemoMock(): boolean {
  return import.meta.env.VITE_USE_BOOKING_MOCK === 'true'
}

/** 演示用咨询师源数据（含仅 mock 使用的字段，便于筛选演示） */
export const MOCK_SOURCE_DOCTORS: Array<{
  id: number
  name: string
  avatar: string
  specialty: string
  experience: string
  rating: number
  province: string
  description: string
  price: number
  gender: '男' | '女'
  consultMethod: '面询' | '视频' | '面询/视频'
}> = [
  {
    id: 101,
    name: '演示咨询师·林心',
    avatar: '/static/images/tc59.png',
    specialty: '情绪压力 | 人际关系',
    experience: '9年经验',
    rating: 4.9,
    province: '上海',
    description: '【演示】情绪与人际方向。',
    price: 600,
    gender: '女',
    consultMethod: '面询/视频'
  },
  {
    id: 102,
    name: '演示咨询师·陈悦',
    avatar: '/static/images/zixunshi11.png',
    specialty: '青少年心理 | 家庭养育',
    experience: '6年经验',
    rating: 4.8,
    province: '北京',
    description: '【演示】青少年与家庭方向。',
    price: 550,
    gender: '女',
    consultMethod: '视频'
  },
  {
    id: 103,
    name: '演示咨询师·周远',
    avatar: '/static/images/tc59.png',
    specialty: '职场压力 | 个人成长',
    experience: '12年经验',
    rating: 4.7,
    province: '上海',
    description: '【演示】职场与个人成长。',
    price: 720,
    gender: '男',
    consultMethod: '面询'
  },
  {
    id: 104,
    name: '演示咨询师·何宁',
    avatar: '/static/images/tc59.png',
    specialty: '婚姻情感 | 家庭治疗',
    experience: '8年经验',
    rating: 4.85,
    province: '广东',
    description: '【演示】婚姻与家庭治疗。',
    price: 480,
    gender: '女',
    consultMethod: '面询/视频'
  },
  {
    id: 105,
    name: '演示咨询师·吴岚',
    avatar: '/static/images/zixunshi11.png',
    specialty: '焦虑抑郁 | 睡眠困扰',
    experience: '10年经验',
    rating: 4.9,
    province: '北京',
    description: '【演示】情绪与睡眠方向。',
    price: 680,
    gender: '男',
    consultMethod: '视频'
  }
]

/** 建议的后端筛选元数据 JSON（当前项目可新增 GET /api/frontend/GetConsultantFilterMeta 对齐此结构） */
export function getMockConsultantFilterMetaResponse(): ApiResponse<{
  sortOptions: { label: string; value: string }[]
  provinces: { label: string; value: string }[]
  priceRanges: { label: string; value: string }[]
  consultationMethods: { label: string; value: string }[]
  genders: { label: string; value: string }[]
}> {
  return {
    code: 0,
    msg: 'success',
    data: {
      sortOptions: [
        { label: '综合排序', value: 'default' },
        { label: '价格从低到高', value: 'price_asc' },
        { label: '价格从高到低', value: 'price_desc' },
      ],
      provinces: [
        { label: '全部城市', value: '' },
        { label: '上海', value: '上海' },
        { label: '北京', value: '北京' },
        { label: '广东', value: '广东' }
      ],
      priceRanges: [
        { label: '不限', value: '' },
        { label: '500元以下', value: 'lt500' },
        { label: '500-650元', value: '500-650' },
        { label: '650元以上', value: 'gt650' }
      ],
      consultationMethods: [
        { label: '不限', value: '' },
        { label: '面询', value: '面询' },
        { label: '视频', value: '视频' },
        { label: '面询/视频', value: '面询/视频' }
      ],
      genders: [
        { label: '不限', value: '' },
        { label: '男咨询师', value: '男' },
        { label: '女咨询师', value: '女' }
      ]
    }
  }
}

export type MockDoctorListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  province?: string
  specialty?: string
  priceRange?: string
  sort?: string
  gender?: string
  consultMethod?: string
}

function applyMockDoctorFilters(rows: typeof MOCK_SOURCE_DOCTORS, q: MockDoctorListQuery) {
  let list = [...rows]
  const kw = (q.keyword || '').trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (d) =>
        d.name.toLowerCase().includes(kw) ||
        d.specialty.toLowerCase().includes(kw) ||
        d.province.toLowerCase().includes(kw) ||
        d.description.toLowerCase().includes(kw)
    )
  }
  if (q.province) {
    list = list.filter((d) => d.province.includes(q.province!))
  }
  if (q.specialty) {
    list = list.filter((d) => d.specialty.includes(q.specialty!))
  }
  if (q.gender) {
    list = list.filter((d) => d.gender === q.gender)
  }
  if (q.consultMethod) {
    list = list.filter((d) => {
      if (q.consultMethod === '面询/视频') return d.consultMethod === '面询/视频'
      if (d.consultMethod === '面询/视频') return true
      return d.consultMethod === q.consultMethod
    })
  }
  if (q.priceRange === 'lt500') {
    list = list.filter((d) => d.price < 500)
  } else if (q.priceRange === '500-650') {
    list = list.filter((d) => d.price >= 500 && d.price <= 650)
  } else if (q.priceRange === 'gt650') {
    list = list.filter((d) => d.price > 650)
  }

  const sort = q.sort || 'default'
  if (sort === 'price_asc') {
    list.sort((a, b) => a.price - b.price)
  } else if (sort === 'price_desc') {
    list.sort((a, b) => b.price - a.price)
  } else if (sort === 'rating_desc') {
    list.sort((a, b) => b.rating - a.rating)
  }

  return list
}

/** 与 GetDoctorList 中 data 结构一致；支持 query + 演示用扩展筛选 */
export function getMockDoctorListResponse(q: MockDoctorListQuery = {}): ApiResponse<{
  doctors: any[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}> {
  const page = Math.max(1, q.page || 1)
  const pageSize = Math.min(50, Math.max(1, q.pageSize || 10))
  const filtered = applyMockDoctorFilters(MOCK_SOURCE_DOCTORS, q)
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const slice = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
  const doctors = slice.map(({ gender, consultMethod, ...rest }) => rest)

  return {
    code: 0,
    msg: 'success',
    data: {
      doctors,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    }
  }
}

/**
 * 与 GetDoctorDetail 返回的 data 结构一致：doctor + timeSlots + hasAvailableTime
 */
export function getMockDoctorDetailJson(doctorId: string | number) {
  const id = Number(doctorId) || 101
  const src = MOCK_SOURCE_DOCTORS.find((d) => d.id === id) || MOCK_SOURCE_DOCTORS[0]
  const years = Number(String(src.experience).match(/\d+/)?.[0]) || 8
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const d2 = new Date()
  d2.setDate(d2.getDate() + 2)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekOf = (d: Date) => weeks[d.getDay()]

  return {
    code: 0,
    msg: '获取成功',
    data: {
      doctor: {
        id: src.id,
        name: src.name,
        specialty: src.specialty,
        experience: years,
        price: src.price,
        avatar: src.avatar,
        description: src.description,
        profile: '咨询是一段共同走过的路程；演示数据。',
        qualification: '国家二级心理咨询师（演示）',
        field: '心理健康,人际关系,个人成长',
        targetGroup: '成年人,青少年,家庭',
        consultHours: 1200,
        workYears: years,
        mode: src.consultMethod,
        career: '4',
        infoAuthenticityCommitted: true,
        infoAuthenticityCommittedAt: '2026-01-15T10:00:00',
      },
      /** 咨询师可约中心（后续由咨询师端排班 API 注入） */
      availableCenterIds: ['yangpu', 'pudong'],
      timeSlots: [
        {
          ID: 9000 + src.id,
          gId: `mock-g-${src.id}-1`,
          centerId: 'yangpu',
          Price: src.price,
          maxSign: 1,
          numSign: 0,
          startDate: fmt(tomorrow),
          startHH: '10:00',
          endHH: '10:50',
          startTime: `${fmt(tomorrow)} 10:00`,
          endTime: `${fmt(tomorrow)} 10:50`,
          createTime: '2026-01-01 10:00:00',
          time: '50分钟',
          week: weekOf(tomorrow)
        },
        {
          ID: 9050 + src.id,
          gId: `mock-g-${src.id}-1b`,
          centerId: 'yangpu',
          Price: src.price,
          maxSign: 1,
          numSign: 0,
          startDate: fmt(d2),
          startHH: '09:30',
          endHH: '10:20',
          startTime: `${fmt(d2)} 09:30`,
          endTime: `${fmt(d2)} 10:20`,
          createTime: '2026-01-01 10:00:00',
          time: '50分钟',
          week: weekOf(d2)
        },
        {
          ID: 9100 + src.id,
          gId: `mock-g-${src.id}-2`,
          centerId: 'pudong',
          Price: src.price,
          maxSign: 1,
          numSign: 0,
          startDate: fmt(d2),
          startHH: '14:00',
          endHH: '14:50',
          startTime: `${fmt(d2)} 14:00`,
          endTime: `${fmt(d2)} 14:50`,
          createTime: '2026-01-01 10:00:00',
          time: '50分钟',
          week: weekOf(d2)
        }
      ],
      hasAvailableTime: true
    }
  }
}

/**
 * 对应 expertsController.appointment 成功时的 JSON
 */
export function getMockAppointmentSubmitResponse(): {
  code: number
  msg: string
  url: string
} {
  return {
    code: 0,
    msg: '预约成功',
    url: '/TenPayV3/PublicPay?code=lxxlcode&state=MOCK_OPENID,mock-order-gid-demo'
  }
}
