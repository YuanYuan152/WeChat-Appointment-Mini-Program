<template>
  <view class="page-counselor-detail">
    <view v-if="loading" class="empty">加载中...</view>
    <template v-else-if="detail">
      <view class="profile-header">
        <image
          v-if="detail.avatarUrl"
          :src="detail.avatarUrl"
          class="avatar"
          mode="aspectFill"
        />
        <view v-else class="avatar placeholder">{{ (detail.name || '?').slice(0, 1) }}</view>
        <view class="profile-meta">
          <view class="profile-title-row">
            <text class="profile-name">{{ detail.name }}</text>
            <text v-if="detail.typeLabel" class="type-badge">{{ detail.typeLabel }}</text>
          </view>
          <text v-if="detail.title" class="profile-title">{{ detail.title }}</text>
        </view>
      </view>

      <!-- 数据看板 -->
      <view class="stats-grid">
        <view class="stat-card">
          <text class="stat-num upcoming">{{ detail.stats.activeBookingCount }}</text>
          <text class="stat-label">当前预约</text>
        </view>
        <view class="stat-card">
          <text class="stat-num cancelled">{{ detail.stats.cancelledCount }}</text>
          <text class="stat-label">已取消</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{ detail.stats.scheduleCount }}</text>
          <text class="stat-label">未来排期</text>
        </view>
        <view class="stat-card">
          <text class="stat-num done">{{ detail.stats.recordedCount }}</text>
          <text class="stat-label">已填记录</text>
        </view>
        <view class="stat-card">
          <text class="stat-num warn">{{ detail.stats.missingRecordCount }}</text>
          <text class="stat-label">未填记录</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{ detail.stats.visitorCount }}</text>
          <text class="stat-label">来访人数</text>
        </view>
      </view>

      <view class="filter-bar">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeTab === tab.value }"
          @tap="activeTab = tab.value"
        >{{ tab.label }}</view>
      </view>

      <!-- 介绍页资料 -->
      <view v-if="showSection('profile')" class="section">
        <view class="section-header" @tap="toggleExpand('profile')">
          <text class="section-title">介绍页资料</text>
          <text class="chevron" :class="{ open: expandedSections.has('profile') }">›</text>
        </view>
        <view v-if="expandedSections.has('profile')" class="section-body">
          <view class="form-item">
            <text class="label">姓名</text>
            <input class="input" v-model="form.name" />
          </view>
          <view class="form-item">
            <text class="label">头像 URL</text>
            <input class="input" v-model="form.avatarUrl" />
          </view>
          <view class="form-item">
            <text class="label">职称/头衔</text>
            <input class="input" v-model="form.title" />
          </view>
          <view class="form-item">
            <text class="label">从业年限</text>
            <input class="input" type="number" v-model.number="form.workYears" />
          </view>
          <view class="form-item">
            <text class="label">咨询时数</text>
            <input class="input" type="number" v-model.number="form.consultHours" />
          </view>
          <view class="form-item">
            <text class="label">培训经历（段数）</text>
            <input class="input" v-model="form.career" placeholder="如 4" />
          </view>
          <view class="form-item">
            <text class="label">咨询方式</text>
            <picker :range="modeOptions" :value="modeIndex" @change="onModeChange">
              <view class="picker">{{ form.mode || '请选择' }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="label">专业领域</text>
            <input class="input" v-model="form.field" placeholder="逗号分隔" />
          </view>
          <view class="form-item">
            <text class="label">服务人群</text>
            <input class="input" v-model="form.targetGroup" placeholder="逗号分隔" />
          </view>
          <view class="form-item">
            <text class="label">擅长方向</text>
            <textarea class="textarea" v-model="form.specialty" />
          </view>
          <view class="form-item">
            <text class="label">简介</text>
            <textarea class="textarea" v-model="form.introduce" />
          </view>
          <view class="form-item">
            <text class="label">资质证书</text>
            <textarea class="textarea" v-model="form.qualification" />
          </view>
        </view>
      </view>

      <!-- 排期情况 -->
      <view v-if="showSection('schedule')" class="section">
        <view class="section-header" @tap="toggleExpand('schedule')">
          <text class="section-title">排期情况</text>
          <text class="section-count">{{ detail.schedules.length }} 条</text>
          <text class="chevron" :class="{ open: expandedSections.has('schedule') }">›</text>
        </view>
        <view v-if="expandedSections.has('schedule')" class="section-body">
          <view class="schedule-link-row" @tap="openFullSchedule">
            <text class="schedule-link-text">查看完整排期（普通/日历模式）</text>
            <text class="schedule-link-arrow">›</text>
          </view>
          <view v-if="!detail.schedules.length" class="mini-empty">暂无近期排期</view>
          <view v-for="s in detail.schedules" :key="s.scheduleId" class="row-card">
            <text class="row-main">{{ formatDT(s.startTime) }} - {{ formatTime(s.endTime) }}</text>
            <text class="row-sub">{{ s.statusLabel }}{{ s.patientName ? ` · ${s.patientName}` : '' }}</text>
            <text v-if="s.location" class="row-loc">{{ s.location }}</text>
          </view>
        </view>
      </view>

      <!-- 未填咨询记录 -->
      <view v-if="showSection('unrecorded')" class="section">
        <view class="section-header" @tap="toggleExpand('unrecorded')">
          <text class="section-title warn-title">未填写咨询记录</text>
          <text class="section-count warn">{{ detail.unrecordedConsultations.length }} 条</text>
          <text class="chevron" :class="{ open: expandedSections.has('unrecorded') }">›</text>
        </view>
        <view v-if="expandedSections.has('unrecorded')" class="section-body">
          <view v-if="!detail.unrecordedConsultations.length" class="mini-empty">暂无未填记录</view>
          <view v-for="c in detail.unrecordedConsultations" :key="c.consultationId" class="row-card warn">
            <text class="row-main">{{ c.patientName }}</text>
            <text class="row-sub">{{ formatDT(c.startTime) }} · {{ c.statusLabel }}</text>
          </view>
        </view>
      </view>

      <!-- 已填咨询记录 -->
      <view v-if="showSection('recorded')" class="section">
        <view class="section-header" @tap="toggleExpand('recorded')">
          <text class="section-title">已填写咨询记录</text>
          <text class="section-count">{{ detail.recordedConsultations.length }} 条</text>
          <text class="chevron" :class="{ open: expandedSections.has('recorded') }">›</text>
        </view>
        <view v-if="expandedSections.has('recorded')" class="section-body">
          <view v-if="!detail.recordedConsultations.length" class="mini-empty">暂无已填记录</view>
          <view v-for="c in detail.recordedConsultations" :key="c.consultationId" class="row-card">
            <text class="row-main">{{ c.patientName }}</text>
            <text class="row-sub">{{ formatDT(c.startTime) }} · 已填写</text>
          </view>
        </view>
      </view>

      <!-- 来访者列表 -->
      <view v-if="showSection('visitors')" class="section">
        <view class="section-header" @tap="toggleExpand('visitors')">
          <text class="section-title">来访者</text>
          <text class="section-count">{{ detail.visitors.length }} 人</text>
          <text class="chevron" :class="{ open: expandedSections.has('visitors') }">›</text>
        </view>
        <view v-if="expandedSections.has('visitors')" class="section-body">
          <view v-if="!detail.visitors.length" class="mini-empty">暂无来访者</view>
          <view v-for="v in detail.visitors" :key="v.patientId" class="row-card">
            <text class="row-main">{{ v.patientName }}</text>
            <text class="row-sub">咨询 {{ v.consultationCount }} 次{{ v.mobile ? ` · ${v.mobile}` : '' }}</text>
          </view>
        </view>
      </view>

      <button
        v-if="showSection('profile')"
        class="save-btn"
        :loading="saving"
        @click="save"
      >保存资料修改</button>
      <view style="height: 40rpx;"></view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const modeOptions = ['线上', '线下', '线上/线下']

type SectionKey = 'profile' | 'schedule' | 'unrecorded' | 'recorded' | 'visitors'
type TabValue = 'ALL' | SectionKey

const ALL_SECTION_KEYS: SectionKey[] = ['profile', 'schedule', 'unrecorded', 'recorded', 'visitors']

const tabs: { value: TabValue; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'profile', label: '介绍资料' },
  { value: 'schedule', label: '排期' },
  { value: 'unrecorded', label: '未填记录' },
  { value: 'recorded', label: '已填记录' },
  { value: 'visitors', label: '来访者' },
]

interface CounselorDetail {
  counselorId: number
  name: string
  avatarUrl?: string
  title?: string
  roleLabel?: string
  typeLabel?: string
  specialty?: string
  field?: string
  introduce?: string
  career?: string
  qualification?: string
  targetGroup?: string
  mode?: string
  workYears: number
  consultHours: number
  stats: {
    activeBookingCount: number
    cancelledCount: number
    scheduleCount: number
    recordedCount: number
    missingRecordCount: number
    visitorCount: number
  }
  visitors: Array<{ patientId: number; patientName: string; mobile?: string; consultationCount: number }>
  schedules: Array<{ scheduleId: number; startTime?: string; endTime?: string; statusLabel: string; patientName?: string; location?: string }>
  recordedConsultations: Array<{ consultationId: number; patientName: string; startTime?: string; statusLabel: string }>
  unrecordedConsultations: Array<{ consultationId: number; patientName: string; startTime?: string; statusLabel: string }>
}

const loading = ref(true)
const saving = ref(false)
const counselorId = ref(0)
const detail = ref<CounselorDetail | null>(null)
const activeTab = ref<TabValue>('ALL')
const expandedSections = ref<Set<SectionKey>>(new Set(ALL_SECTION_KEYS))
const form = ref({
  name: '',
  avatarUrl: '',
  title: '',
  specialty: '',
  field: '',
  introduce: '',
  career: '',
  qualification: '',
  targetGroup: '',
  mode: '',
  workYears: 0,
  consultHours: 0,
})

const modeIndex = computed(() => {
  const idx = modeOptions.indexOf(form.value.mode)
  return idx >= 0 ? idx : 0
})

const showSection = (key: SectionKey) =>
  activeTab.value === 'ALL' || activeTab.value === key

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '')
const formatTime = (dt?: string) => (dt ? dt.slice(11, 16) : '')

const toggleExpand = (key: SectionKey) => {
  const next = new Set(expandedSections.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedSections.value = next
}

const onModeChange = (e: any) => {
  form.value.mode = modeOptions[Number(e.detail.value)] || modeOptions[0]
}

const applyForm = (data: CounselorDetail) => {
  form.value = {
    name: data.name || '',
    avatarUrl: data.avatarUrl || '',
    title: data.title || '',
    specialty: data.specialty || '',
    field: data.field || '',
    introduce: data.introduce || '',
    career: data.career || '',
    qualification: data.qualification || '',
    targetGroup: data.targetGroup || '',
    mode: data.mode || '线上/线下',
    workYears: data.workYears || 0,
    consultHours: data.consultHours || 0,
  }
}

const load = async () => {
  if (!counselorId.value) return
  loading.value = true
  try {
    const res = await httpV2.get<CounselorDetail>(
      API_ENDPOINTS.admin.counselorDetail(counselorId.value),
    )
    if (res.code === 0 && res.data) {
      detail.value = res.data
      applyForm(res.data)
    }
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!counselorId.value) return
  saving.value = true
  try {
    const res = await httpV2.put(
      API_ENDPOINTS.admin.counselorDetail(counselorId.value),
      form.value,
    )
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' })
      if (res.data) {
        const data = res.data as CounselorDetail
        detail.value = data
        applyForm(data)
      }
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

const openFullSchedule = () => {
  if (!counselorId.value || !detail.value) return
  uni.navigateTo({
    url: `/pages/ops/schedules/detail?counselorId=${counselorId.value}&counselorName=${encodeURIComponent(detail.value.name || '咨询师')}`,
  })
}

onMounted(() => {
  const pages = getCurrentPages()
  const opts = (pages[pages.length - 1] as any).options || {}
  counselorId.value = Number(opts.counselorId || 0)
  load()
})
</script>

<style scoped>
.page-counselor-detail {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 24rpx 32rpx 48rpx;
  box-sizing: border-box;
}
.empty, .mini-empty {
  text-align: center;
  padding: 40rpx 0;
  color: #9CA3AF;
  font-size: 28rpx;
}
.profile-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.03);
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
}
.avatar.placeholder {
  background: #E8F0EC;
  color: #3D5A4E;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
}
.profile-meta { flex: 1; min-width: 0; }
.profile-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}
.profile-name { font-size: 34rpx; font-weight: 700; color: #2C2C2C; }
.type-badge {
  font-size: 22rpx;
  color: #6B6560;
  background: #F0EDE8;
  padding: 4rpx 14rpx;
  border-radius: 100rpx;
  white-space: nowrap;
  flex-shrink: 0;
}
.profile-title { display: block; margin-top: 6rpx; font-size: 24rpx; color: #9CA3AF; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.stat-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 12rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.03);
}
.stat-num { display: block; font-size: 36rpx; font-weight: 700; color: #2C2C2C; }
.stat-num.upcoming { color: #2563EB; }
.stat-num.done { color: #3D5A4E; }
.stat-num.cancelled { color: #9CA3AF; }
.stat-num.warn { color: #DC2626; }
.stat-label { display: block; margin-top: 6rpx; font-size: 20rpx; color: #8A8A8A; }
.filter-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
  overflow-x: auto;
  flex-wrap: nowrap;
}
.filter-tab {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: #fff;
  font-size: 24rpx;
  color: #6B6560;
}
.filter-tab.active { background: #3D5A4E; color: #fff; font-weight: 600; }
.section {
  background: #fff;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.03);
  overflow: hidden;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 28rpx;
}
.section-header:active { background: #FAFAF8; }
.section-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  color: #2C2C2C;
  padding-left: 16rpx;
  border-left: 6rpx solid #3D5A4E;
}
.warn-title { border-left-color: #DC2626; color: #DC2626; }
.section-count {
  font-size: 24rpx;
  color: #9CA3AF;
  flex-shrink: 0;
}
.section-count.warn { color: #DC2626; }
.chevron {
  font-size: 36rpx;
  color: #C9A96E;
  transform: rotate(0deg);
  flex-shrink: 0;
}
.chevron.open { transform: rotate(90deg); }
.section-body {
  padding: 0 28rpx 28rpx;
  border-top: 1rpx solid #F3F4F6;
}
.form-item { padding: 20rpx 0; border-bottom: 1rpx solid #F3F4F6; }
.form-item:last-child { border-bottom: none; }
.label { display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 10rpx; }
.input, .textarea, .picker {
  width: 100%;
  font-size: 28rpx;
  color: #1F2937;
  box-sizing: border-box;
}
.textarea { min-height: 120rpx; line-height: 1.6; }
.row-card {
  background: #FAF7F3;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
}
.row-card.warn { background: #FEF2F2; }
.row-main { display: block; font-size: 28rpx; font-weight: 600; color: #2C2C2C; }
.row-sub { display: block; margin-top: 6rpx; font-size: 24rpx; color: #6B7280; }
.row-loc { display: block; margin-top: 4rpx; font-size: 22rpx; color: #9CA3AF; }
.schedule-link-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
  background: #E8E4DE;
  border-radius: 12rpx;
}
.schedule-link-text { font-size: 26rpx; color: #3D5A4E; font-weight: 600; }
.schedule-link-arrow { font-size: 32rpx; color: #3D5A4E; }
.save-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 32rpx;
  font-weight: 700;
  margin-top: 8rpx;
}
.save-btn::after { border: none; }
</style>
