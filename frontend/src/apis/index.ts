import { http, httpV2 } from '@/utils/http'
import type { RequestConfig } from '@/utils/http'
import type { ApiResponse, Banner, Doctor, Activity, LiveStream, Feature, HomeData } from '@/types'
import { API_ENDPOINTS } from '@/config/api'
import { fixImageUrl, resolveCounselorPublicAvatar } from '@/utils/image'

const ok = <T>(data: T, msg = '请求成功'): ApiResponse<T> => ({ code: 0, msg, data })

const mapDoctor = (item: any): Doctor & {
    title?: string
    workYears?: number
    consultHours?: number
    needsNegotiation?: boolean
    _source?: string
} => ({
    id: Number(item.id || item.Id || item.accountId || 0),
    name: item.name || item.Name || item.nickname || '咨询师',
    avatar: resolveCounselorPublicAvatar(item.avatarUrl || item.AvatarUrl || item.avatar),
    specialty: item.specialty || item.Specialty || item.field || item.Field || '心理咨询',
    experience: `${item.workYears || item.WorkYears || 0}年+`,
    rating: item.rating || 5,
    province: item.province || item.Province || item.city || item.City || '线下/线上',
    description: item.introduce || item.Introduce || item.description || '暂无介绍',
    price: Math.round(Number(item.billing || item.Billing || 0) / 100) || item.price || 500,
    priceNegotiation: !!(item.priceNegotiation || item.billingLabel === '议价'),
    billingLabel: item.billingLabel || '',
    title: item.title || item.Title || '心理咨询师',
    workYears: Number(item.workYears || item.WorkYears || 0),
    consultHours: Number(item.consultHours || item.ConsultHours || 0),
    needsNegotiation: !!(item.needsNegotiation ?? item.needs_negotiation),
    _source: item._source,
})

const mapActivity = (item: any): Activity => ({
    id: Number(item.id || item.Id || 0),
    title: item.title || item.Title || '活动',
    description: item.summary || item.Content || item.content || '',
    image: fixImageUrl(item.coverUrl || item.CoverUrl || item.image || '/static/images-opt/huodong11.jpg'),
    date: item.startAt || item.StartAt || item.createdAt || item.CreatedAt || '',
    status: item.IsActive === false || item.isActive === false ? '已结束' : '进行中',
})

const mapBanner = (item: any): Banner => ({
    id: Number(item.id || item.Id || 0),
    title: item.title || item.Title || '',
    image: fixImageUrl(item.imageUrl || item.ImageUrl || '/static/images-opt/slide11.jpg'),
    buttonText: '查看详情',
    date: '',
})

// 首页相关API
export const homeApi = {
    getIndexData: async () => {
        // 单项失败不拖垮整页；真机连不上 V2 时至少能出空列表而不是整页白屏
        const [bannerRes, doctorRes, activityRes] = await Promise.all([
            httpV2.get<any[]>(API_ENDPOINTS.common.banners, undefined, { showError: false }).catch(() => ({ code: -1, data: [] as any[] })),
            httpV2.get<any>(API_ENDPOINTS.common.counselors, { page: 1, page_size: 8 }, { showError: false }).catch(() => ({ code: -1, data: { items: [] } })),
            httpV2.get<any[]>(API_ENDPOINTS.ops.activities, undefined, { showError: false }).catch(() => ({ code: -1, data: [] as any[] })),
        ])
        const data: HomeData = {
            banners: (bannerRes.data || []).map(mapBanner),
            features: [],
            doctors: ((doctorRes.data as any)?.items || []).map(mapDoctor),
            activities: (activityRes.data || []).map(mapActivity),
            liveStreams: [],
        }
        return ok(data)
    },

    getBanners: async () => {
        const res = await httpV2.get<any[]>(API_ENDPOINTS.common.banners)
        return ok((res.data || []).map(mapBanner))
    },

    getRecommendedDoctors: async () => {
        const res = await httpV2.get<any>(API_ENDPOINTS.common.counselors, { page: 1, page_size: 8 })
        return ok(((res.data as any)?.items || []).map(mapDoctor))
    },

    getActivities: async () => {
        const res = await httpV2.get<any[]>(API_ENDPOINTS.ops.activities)
        return ok((res.data || []).map(mapActivity))
    },

    getLiveStreams: () => {
        return http.get<ApiResponse<LiveStream[]>>(API_ENDPOINTS.HOME.LIVE_STREAMS)
    }
}

// 咨询师相关API
export const doctorApi = {
    getList: (params?: {
        keyword?: string
        province?: string
        specialty?: string
        page?: number
        pageSize?: number
        sort?: string
        gender?: string
        consultMethod?: string
    }, config?: Partial<RequestConfig>) => {
        const apiParams = params || {}
        return httpV2.get<any>(
            API_ENDPOINTS.common.counselors,
            {
                keyword: apiParams.keyword,
                page: apiParams.page || 1,
                page_size: apiParams.pageSize || 20,
                sort: apiParams.sort,
                gender: apiParams.gender,
                consult_method: apiParams.consultMethod,
            },
            { showLoading: false, ...config },
        ).then((res) => {
            if (res.code !== 0) {
                return {
                    code: res.code,
                    msg: res.msg || '加载失败',
                    data: { list: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
                }
            }
            const payload = (res.data || {}) as Record<string, any>
            const rawItems = payload.items || payload.list || payload.doctors || []
            const pageSize = Number(payload.pageSize || payload.page_size) || 20
            const total = Number(payload.total) || rawItems.length
            return ok({
                list: rawItems.map(mapDoctor),
                total,
                page: Number(payload.page) || 1,
                pageSize,
                totalPages: Math.ceil(total / pageSize) || 1,
            })
        })
    },

    getDetail: (id: string | number, params?: { source?: string }) => {
        return httpV2.get<any>(API_ENDPOINTS.common.counselorDetail(id), params)
    },

    getTimeSlots: (id: string | number) => {
        return httpV2.get<any>(API_ENDPOINTS.common.counselorTimeSlots(id))
    },

    search: (keyword: string) => {
        return httpV2.get<any>(API_ENDPOINTS.common.search, { q: keyword, type: 'counselor' })
            .then((res) => ok(((res.data as any)?.counselors || []).map(mapDoctor)))
    }
}

// 活动相关API
export const activityApi = {
    getList: (params?: { page?: number; pageSize?: number }) => {
        return httpV2.get<any[]>(API_ENDPOINTS.ops.activities, params).then((res) => ok((res.data || []).map(mapActivity)))
    },

    getDetail: (id: string | number) => {
        return http.get<ApiResponse<Activity>>(API_ENDPOINTS.ACTIVITIES.DETAIL.replace(':id', String(id)))
    },

    join: (id: string | number) => {
        return http.post<ApiResponse<any>>(API_ENDPOINTS.ACTIVITIES.JOIN.replace(':id', String(id)))
    }
}

// 直播相关API
export const liveApi = {
    getList: (params?: { page?: number; pageSize?: number }) => {
        return http.get<ApiResponse<LiveStream[]>>(API_ENDPOINTS.LIVE_STREAMS.LIST, { params })
    },

    getDetail: (id: string | number) => {
        return http.get<ApiResponse<LiveStream>>(API_ENDPOINTS.LIVE_STREAMS.DETAIL.replace(':id', String(id)))
    },

    reserve: (id: string | number) => {
        return http.post<ApiResponse<any>>(API_ENDPOINTS.LIVE_STREAMS.RESERVE.replace(':id', String(id)))
    }
}

// 用户相关API
export const userApi = {
    login: (data: { username: string; password: string }) => {
        return http.post<ApiResponse<{ token: string }>>(API_ENDPOINTS.USER.LOGIN, data)
    },

    getInfo: () => {
        return http.get<ApiResponse<any>>(API_ENDPOINTS.USER.INFO)
    },

    updateInfo: (data: any) => {
        return http.put<ApiResponse<any>>(API_ENDPOINTS.USER.UPDATE, data)
    }
}

// 搜索相关API
export const searchApi = {
    globalSearch: (keyword: string) => {
        return httpV2.get<any>(API_ENDPOINTS.common.search, { q: keyword }).then((res) => ok({
            doctors: ((res.data as any)?.counselors || []).map(mapDoctor),
            activities: ((res.data as any)?.activities || []).map(mapActivity),
            liveStreams: [],
        } as {
            doctors: Doctor[]
            activities: Activity[]
            liveStreams: LiveStream[]
        }))
    },

    getHotSearch: () => {
        return http.get<ApiResponse<string[]>>(API_ENDPOINTS.SEARCH.HOT)
    },

    getSuggestions: (keyword: string) => {
        return http.get<ApiResponse<string[]>>(API_ENDPOINTS.SEARCH.SUGGESTIONS, { params: { keyword } })
    }
}

// 测试相关API
export const testApi = {
    test: () => {
        return http.get<ApiResponse<any>>(API_ENDPOINTS.TEST.TEST)
    },

    health: () => {
        return http.get<ApiResponse<any>>(API_ENDPOINTS.TEST.HEALTH)
    }
} 