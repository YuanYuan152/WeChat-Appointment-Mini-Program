<template>
  <view class="dashboard-panel">
    <view class="header-section">
      <view class="profile-card">
        <view class="avatar-wrap">
          <image
            :src="profileHeader.avatar"
            class="avatar-img"
            mode="aspectFill"
          />
        </view>
        <view class="user-info">
          <text class="user-name">{{ profileHeader.name || '咨询师' }}</text>
          <text v-if="profileHeader.title" class="user-role">{{ profileHeader.title }}</text>
          <text v-if="profileHeader.phone" class="user-phone">{{ formatPhone(profileHeader.phone) }}</text>
          <text v-if="profileHeader.meta" class="user-meta">{{ profileHeader.meta }}</text>
        </view>
      </view>

      <view class="intro-card">
        <text class="intro-title">咨询师介绍</text>
        <text class="intro-notice">对外展示资料由平台统一维护</text>
        <text class="intro-text">{{ profileHeader.introduce || '暂无介绍，如需更新请联系运营' }}</text>
      </view>
      <view class="contract-patients-card">
        <view class="contract-patients-head">
          <text class="intro-title">目前签约来访</text>
          <text class="contract-patients-count">{{ stats.currentContractPatients.length }} 人</text>
        </view>
        <view v-if="stats.currentContractPatients.length" class="contract-patients-list">
          <text
            v-for="patient in stats.currentContractPatients"
            :key="patient.id"
            class="contract-patient-name"
          >{{ patient.name }}</text>
        </view>
        <text v-else class="intro-notice">暂无当前签约来访</text>
      </view>
      <view class="section-head">
        <text class="section-title">个人看板</text>
        <text class="section-sub">累计成单、咨询记录与预约履约概览</text>
      </view>
    </view>

    <view class="dashboard-body">
    <view class="filter-section">
      <view class="filter-bar" @tap="showFilter = !showFilter">
        <text class="filter-bar-text">筛选</text>
        <text class="filter-bar-hint">{{ periodLabel }}</text>
        <text class="filter-bar-arrow">{{ showFilter ? '▲' : '▼' }}</text>
      </view>
      <view v-if="showFilter" class="filter-panel">
        <text class="filter-label">时间段</text>
        <view class="filter-chips">
          <view
            v-for="opt in periodOptions"
            :key="opt.value"
            class="filter-chip"
            :class="{ active: periodFilter === opt.value }"
            @tap="setPeriod(opt.value)"
          >{{ opt.label }}</view>
        </view>
      </view>
    </view>

    <view v-if="loading" class="empty-box">
      <text class="empty-text">加载中...</text>
    </view>

    <view v-else class="grid">
      <view class="stat-card" @tap="openDetail('orders')">
        <text class="num">{{ stats.completedOrderCount }}</text>
        <text class="label">成单数量</text>
        <text class="tap-hint">点击查看明细</text>
      </view>
      <view class="stat-card highlight" @tap="openDetail('orders')">
        <text class="num">¥{{ formatYuan(stats.completedOrderRevenue) }}</text>
        <text class="label">成单收入</text>
        <text class="tap-hint">点击查看明细</text>
      </view>
      <view class="stat-card" @tap="openDetail('case-records')">
        <text class="num">{{ stats.caseRecordCount }}</text>
        <text class="label">已填咨询记录</text>
        <text class="tap-hint">点击查看明细</text>
      </view>
      <view class="stat-card" @tap="openDetail('appointments')">
        <text class="num">{{ stats.totalAppointments }}</text>
        <text class="label">预约总量</text>
        <text class="tap-hint">点击查看明细</text>
      </view>
    </view>

    <view v-if="showDetail" class="detail-overlay" @touchmove.stop.prevent>
      <view class="detail-sheet" @tap.stop>
        <view class="detail-head">
          <text class="detail-title">{{ detailTitle }}</text>
          <text class="detail-close" @tap="closeDetail">关闭</text>
        </view>
        <text class="detail-period">{{ periodLabel }} · 共 {{ detailList.length }} 条</text>

        <view v-if="detailLoading" class="detail-empty">
          <text>加载中...</text>
        </view>
        <view v-else-if="detailList.length === 0" class="detail-empty">
          <text>暂无相关记录</text>
        </view>
        <scroll-view v-else class="detail-scroll" scroll-y>
          <view
            v-for="item in detailList"
            :key="item.id"
            class="detail-item"
            @tap="onDetailItemTap(item)"
          >
            <view class="detail-item-main">
              <text class="detail-item-title">{{ item.title }}</text>
              <text v-if="item.subtitle" class="detail-item-sub">{{ item.subtitle }}</text>
            </view>
            <view class="detail-item-side">
              <text v-if="item.amount != null" class="detail-amount">¥{{ formatYuan(item.amount) }}</text>
              <text v-if="item.extra" class="detail-extra">{{ item.extra }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineExpose } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { openCounselorCaseRecord } from '@/utils/case-record'
import { fixImageUrl, resolveUserAvatar, DEFAULT_USER_AVATAR } from '@/utils/image'

interface ProfileHeader {
  name: string
  avatar: string
  title: string
  phone: string
  meta: string
  introduce: string
}

type PeriodFilter = 'month' | 'quarter' | 'half_year' | 'all'
type DetailCategory = 'orders' | 'case-records' | 'appointments' | 'leaves'

interface DashboardStats {
  completedOrderCount: number
  completedOrderRevenue: number
  caseRecordCount: number
  totalAppointments: number
  currentContractPatients: Array<{ id: number; name: string }>
}

interface DetailItem {
  id: number
  title: string
  subtitle?: string
  extra?: string
  amount?: number
  consultationId?: number
  caseRecordId?: number
  status?: string
}

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '近3个月' },
  { value: 'half_year', label: '近半年' },
  { value: 'all', label: '全部' },
]

const detailTitles: Record<DetailCategory, string> = {
  orders: '成单明细',
  'case-records': '咨询记录明细',
  appointments: '预约明细',
  leaves: '请假明细',
}

const loading = ref(false)
const showFilter = ref(false)
const periodFilter = ref<PeriodFilter>('month')
const profileHeader = ref<ProfileHeader>({
  name: '',
  avatar: DEFAULT_USER_AVATAR,
  title: '',
  phone: '',
  meta: '',
  introduce: '',
})
const stats = ref<DashboardStats>({
  completedOrderCount: 0,
  completedOrderRevenue: 0,
  caseRecordCount: 0,
  totalAppointments: 0,
  currentContractPatients: [],
})

const showDetail = ref(false)
const detailLoading = ref(false)
const detailCategory = ref<DetailCategory>('orders')
const detailList = ref<DetailItem[]>([])

const periodLabel = computed(
  () => periodOptions.find(o => o.value === periodFilter.value)?.label || '本月',
)

const detailTitle = computed(() => detailTitles[detailCategory.value])

const formatYuan = (cents: number) => {
  if (!cents) return '0'
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}

const formatPhone = (phone?: string) => {
  if (!phone) return ''
  const str = String(phone)
  return str.length >= 11 ? `${str.slice(0, 3)}****${str.slice(-4)}` : str
}

const loadProfileHeader = async () => {
  try {
    const silent = { showLoading: false, showError: false }
    const [meRes, profileRes] = await Promise.all([
      httpV2.get<{
        nickname?: string
        mobile?: string
        avatarUrl?: string
      }>(API_ENDPOINTS.auth.me, undefined, silent),
      httpV2.get<{
        name?: string
        avatarUrl?: string
        title?: string
        specialty?: string
        field?: string
        introduce?: string
        workYears?: number
        consultHours?: number
      }>(API_ENDPOINTS.counselor.profile, undefined, silent),
    ])
    const me = meRes.code === 0 ? meRes.data : null
    const profile = profileRes.code === 0 ? profileRes.data : null
    const avatarRaw = profile?.avatarUrl || me?.avatarUrl || ''
    const metaParts: string[] = []
    if (profile?.field) metaParts.push(profile.field)
    if (profile?.specialty) metaParts.push(profile.specialty)
    if (profile?.workYears) metaParts.push(`从业 ${profile.workYears} 年`)
    profileHeader.value = {
      name: profile?.name || me?.nickname || '咨询师',
      avatar: avatarRaw ? fixImageUrl(avatarRaw) : resolveUserAvatar(''),
      title: profile?.title || '咨询师',
      phone: me?.mobile || '',
      meta: metaParts.join(' · '),
      introduce: profile?.introduce || '',
    }
  } catch {
    // 保留已有展示
  }
}

const load = async () => {
  loading.value = true
  try {
    await loadProfileHeader()
    const res = await httpV2.get<DashboardStats>(
      API_ENDPOINTS.counselor.stats,
      { period: periodFilter.value },
      { showLoading: false },
    )
    if (res.code === 0 && res.data) {
      stats.value = {
        completedOrderCount: res.data.completedOrderCount ?? 0,
        completedOrderRevenue: res.data.completedOrderRevenue ?? 0,
        caseRecordCount: res.data.caseRecordCount ?? 0,
        totalAppointments: res.data.totalAppointments ?? 0,
        currentContractPatients: Array.isArray(res.data.currentContractPatients)
          ? res.data.currentContractPatients
          : [],
      }
    }
  } finally {
    loading.value = false
  }
}

const loadDetail = async (category: DetailCategory) => {
  detailLoading.value = true
  try {
    const res = await httpV2.get<DetailItem[]>(
      API_ENDPOINTS.counselor.statsDetails,
      { category, period: periodFilter.value },
      { showLoading: false },
    )
    detailList.value = res.code === 0 && Array.isArray(res.data) ? res.data : []
  } finally {
    detailLoading.value = false
  }
}

const setPeriod = async (value: PeriodFilter) => {
  periodFilter.value = value
  await load()
  if (showDetail.value) await loadDetail(detailCategory.value)
}

const openDetail = async (category: DetailCategory) => {
  detailCategory.value = category
  showDetail.value = true
  await loadDetail(category)
}

const closeDetail = () => {
  showDetail.value = false
  detailList.value = []
}

const onDetailItemTap = (item: DetailItem) => {
  if (detailCategory.value === 'case-records' && item.consultationId) {
    openCounselorCaseRecord({
      consultationId: item.consultationId,
      recordId: item.caseRecordId,
      hasRecord: item.status === 'FILLED' || !!item.caseRecordId,
    })
    return
  }
  if (detailCategory.value === 'orders' && item.consultationId) {
    uni.showToast({ title: `咨询单 #${item.consultationId}`, icon: 'none' })
  }
}

onMounted(load)
onShow(load)
defineExpose({ refresh: load })
</script>

<style scoped>
.dashboard-panel {
  min-height: 100vh;
  background: #F7F5F2;
}

.header-section {
  padding: 8rpx 32rpx 0;
  background: linear-gradient(
    180deg,
    #EEF2EF 0%,
    #F3F1ED 45%,
    #F7F5F2 100%
  );
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.06);
  border: 1rpx solid rgba(232, 228, 222, 0.9);
}

.intro-card {
  margin-top: 20rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
  border: 1rpx solid rgba(232, 228, 222, 0.9);
}

.contract-patients-card {
  margin-top: 20rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
  border: 1rpx solid rgba(232, 228, 222, 0.9);
}

.contract-patients-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.contract-patients-count {
  font-size: 24rpx;
  color: #8A8A8A;
}

.contract-patients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.contract-patient-name {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #EEF2EF;
  color: #3D5A4E;
  font-size: 24rpx;
}

.intro-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #3D5A4E;
}

.intro-notice {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8A8A8A;
}

.intro-text {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #6B6560;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.avatar-wrap {
  flex-shrink: 0;
  position: relative;
  width: 120rpx;
  height: 120rpx;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4rpx solid #E8E4DE;
  background: #F3F4F6;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.user-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #2C2C2C;
}

.user-role {
  font-size: 24rpx;
  color: #3D5A4E;
  font-weight: 600;
}

.user-phone {
  font-size: 24rpx;
  color: #8A8A8A;
}

.user-meta {
  font-size: 22rpx;
  color: #9CA3AF;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.section-head {
  padding: 28rpx 4rpx 20rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #2C2C2C;
}

.section-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8A8A8A;
  line-height: 1.5;
}

.dashboard-body {
  padding: 0 32rpx 48rpx;
}

.filter-section { margin-bottom: 24rpx; }
.filter-bar {
  display: flex; align-items: center; gap: 12rpx;
  background: #fff; border-radius: 16rpx; padding: 20rpx 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.filter-bar-text { font-size: 28rpx; font-weight: 600; color: #3D5A4E; }
.filter-bar-hint { flex: 1; text-align: right; font-size: 24rpx; color: #6B7280; }
.filter-bar-arrow { font-size: 22rpx; color: #9CA3AF; }
.filter-panel {
  margin-top: 16rpx; background: #fff; border-radius: 16rpx;
  padding: 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.filter-label { display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 12rpx; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.filter-chip {
  padding: 10rpx 24rpx; border-radius: 999rpx; font-size: 24rpx;
  color: #6B7280; background: #F3F4F6;
}
.filter-chip.active {
  background: #E8E4DE; color: #3D5A4E; font-weight: 600;
}

.empty-box {
  text-align: center;
  padding: 120rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: #9CA3AF;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.stat-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.stat-card.highlight {
  background: linear-gradient(135deg, #F0FDFA, #fff);
  border: 1rpx solid #CCFBF1;
}

.stat-card.wide {
  grid-column: span 2;
}

.num {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #3D5A4E;
  line-height: 1.2;
}

.label {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #6B7280;
}

.hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9CA3AF;
}

.tap-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #0D9488;
}

.detail-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 300; display: flex; align-items: flex-end;
}
.detail-sheet {
  width: 100%; max-height: 78vh; background: #fff;
  border-radius: 32rpx 32rpx 0 0; padding: 32rpx 32rpx 48rpx;
  display: flex; flex-direction: column;
}
.detail-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8rpx;
}
.detail-title { font-size: 34rpx; font-weight: 700; color: #1F2937; }
.detail-close { font-size: 28rpx; color: #6B7280; padding: 8rpx 16rpx; }
.detail-period {
  display: block; font-size: 24rpx; color: #9CA3AF; margin-bottom: 20rpx;
}
.detail-scroll { flex: 1; max-height: 56vh; }
.detail-empty {
  text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx;
}
.detail-item {
  display: flex; justify-content: space-between; gap: 16rpx;
  padding: 24rpx 0; border-bottom: 1rpx solid #F3F4F6;
}
.detail-item-main { flex: 1; min-width: 0; }
.detail-item-title {
  display: block; font-size: 28rpx; font-weight: 600; color: #1F2937;
}
.detail-item-sub {
  display: block; margin-top: 8rpx; font-size: 24rpx; color: #9CA3AF;
}
.detail-item-side { text-align: right; flex-shrink: 0; }
.detail-amount {
  display: block; font-size: 28rpx; font-weight: 700; color: #0D9488;
}
.detail-extra {
  display: block; margin-top: 6rpx; font-size: 22rpx; color: #6B7280;
}
</style>
