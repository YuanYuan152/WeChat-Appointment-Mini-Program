<template>
  <view class="page-approvals">
    <view class="hero-card">
      <text class="hero-title">审批管理</text>
      <text class="hero-sub">咨询助理、咨询主任、管理员可审批退款申请与咨询师请假</text>
    </view>

    <view class="category-bar">
      <view
        v-for="c in categories"
        :key="c.value"
        class="category-tab"
        :class="{ active: activeCategory === c.value }"
        @tap="switchCategory(c.value)"
      >{{ c.label }}</view>
    </view>

    <view class="filter-bar">
      <view
        v-for="tab in statusTabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ active: activeStatus === tab.value }"
        @tap="switchStatus(tab.value)"
      >{{ tab.label }}</view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="displayItems.length === 0" class="empty">暂无{{ activeStatusLabel }}记录</view>
    <view v-else class="list">
      <view
        v-for="item in displayItems"
        :key="`${item.kind}-${item.id}`"
        class="card"
        @tap="openDetail(item)"
      >
        <view class="card-head">
          <view class="head-left">
            <text class="type-tag" :class="item.kind === 'EXEMPTION' ? 'tag-exemption' : 'tag-leave'">
              {{ item.kind === 'EXEMPTION' ? '退款申请' : '咨询师请假' }}
            </text>
            <text class="title">{{ item.title }}</text>
          </view>
          <text class="status" :class="item.status.toLowerCase()">{{ statusLabel(item.status) }}</text>
        </view>
        <text v-for="(line, idx) in item.lines" :key="idx" class="line">{{ line }}</text>
        <text class="reason-preview">原因：{{ item.reason }}</text>
        <text class="time">提交于 {{ formatTime(item.createdAt) }}</text>
      </view>
    </view>

    <!-- 退款详情 -->
    <view v-if="showExemptionDetail && exemptionDetail" class="overlay" @touchmove.stop.prevent>
      <view class="detail-card" @tap.stop>
        <view class="detail-header">
          <text class="detail-title">退款申请详情</text>
          <view class="detail-close-btn" @tap="closeExemptionDetail">×</view>
        </view>
        <view class="detail-body">
          <view class="detail-row"><text class="label">来访者</text><text class="value">{{ exemptionDetail.patientName }}</text></view>
          <view class="detail-row"><text class="label">手机号</text><text class="value">{{ exemptionDetail.patientMobile || '-' }}</text></view>
          <view class="detail-row"><text class="label">咨询师</text><text class="value">{{ exemptionDetail.counselorName }}</text></view>
          <view class="detail-row"><text class="label">咨询时段</text><text class="value">{{ formatTime(exemptionDetail.consultationStartTime) }}</text></view>
          <view class="detail-row"><text class="label">申请金额</text><text class="value highlight">￥{{ formatYuan(exemptionDetail.amount) }}</text></view>
          <view class="reason-box">
            <text class="reason-label">申请原因</text>
            <text class="reason-text">{{ exemptionDetail.reason }}</text>
          </view>
          <view v-if="exemptionDetail.status === 'REJECTED' && exemptionDetail.rejectReason" class="reject-box">
            <text class="reason-label">拒绝理由</text>
            <text class="reason-text">{{ exemptionDetail.rejectReason }}</text>
          </view>
        </view>
        <view v-if="exemptionDetail.status === 'PENDING'" class="actions">
          <button class="btn reject" :disabled="processing" @tap="showRejectInput = true">拒绝</button>
          <button class="btn approve" :loading="processing" @tap="approveExemption">同意退款</button>
        </view>
        <button v-else class="btn close" @tap="closeExemptionDetail">关闭</button>
        <view v-if="showRejectInput" class="reject-form">
          <text class="reject-form-title">填写拒绝理由（来访者可见）</text>
          <textarea v-model="rejectReason" class="reject-textarea" placeholder="请说明不予退款的原因" maxlength="500" />
          <view class="reject-actions">
            <button class="btn ghost" @tap="showRejectInput = false">取消</button>
            <button class="btn reject" :loading="processing" @tap="rejectExemption">确认拒绝</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 请假详情 -->
    <view v-if="showLeaveDetail && leaveDetail" class="overlay overlay-sheet" @touchmove.stop.prevent>
      <view class="detail-card sheet-card" @tap.stop>
        <view class="detail-header">
          <text class="detail-title">咨询师请假审批</text>
          <view class="detail-close-btn" @tap="closeLeaveDetail">×</view>
        </view>
        <view class="detail-body">
          <view class="detail-row"><text class="label">咨询师</text><text class="value">{{ leaveDetail.counselorName }}</text></view>
          <view class="detail-row"><text class="label">请假时段</text><text class="value">{{ formatTime(leaveDetail.startTime) }} - {{ formatEndTime(leaveDetail.endTime) }}</text></view>
          <view class="detail-row"><text class="label">预约地点</text><text class="value">{{ leaveDetail.location || '-' }}</text></view>
          <view class="detail-row"><text class="label">审批状态</text><text class="value">{{ statusLabel(leaveDetail.status) }}</text></view>
          <view class="reason-box">
            <text class="reason-label">请假原因</text>
            <text class="reason-text">{{ leaveDetail.reason }}</text>
          </view>
          <view v-if="leaveDetail.screenshotUrl" class="screenshot-box">
            <text class="reason-label">沟通截图</text>
            <image class="screenshot" :src="resolveAssetUrl(leaveDetail.screenshotUrl)" mode="aspectFit" @tap="previewScreenshot" />
          </view>
          <view v-if="leaveDetail.affectedPatients?.length" class="section-title">涉及预约与来访联系方式</view>
          <view v-for="(patient, idx) in leaveDetail.affectedPatients || []" :key="idx" class="sub-card">
            <view class="detail-row"><text class="label">来访者</text><text class="value">{{ patient.patientName }}</text></view>
            <view class="detail-row"><text class="label">联系电话</text><text class="value">{{ patient.patientPhone || '未填写' }}</text></view>
            <view v-if="patient.emergencyContact" class="detail-row">
              <text class="label">紧急联系人</text>
              <text class="value">{{ patient.emergencyContact }} {{ patient.emergencyPhone }}</text>
            </view>
            <view class="detail-row"><text class="label">预约时间</text><text class="value">{{ formatTime(patient.startTime) }}</text></view>
            <view class="detail-row"><text class="label">退款说明</text><text class="value">{{ patient.refundText }}</text></view>
          </view>
        </view>
        <view v-if="leaveDetail.status === 'PENDING'" class="actions">
          <button class="btn reject" :disabled="processing" @tap="rejectLeave">拒绝</button>
          <button class="btn approve" :loading="processing" @tap="approveLeave">通过请假</button>
        </view>
        <button v-else class="btn close" @tap="closeLeaveDetail">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS, getApiV2Url } from '@/config/api'

type ApprovalKind = 'EXEMPTION' | 'LEAVE'
type CategoryFilter = 'ALL' | ApprovalKind

interface ExemptionItem {
  id: number
  patientName: string
  patientMobile?: string
  counselorName: string
  amount: number
  reason: string
  status: string
  rejectReason?: string
  consultationStartTime?: string
  createdAt: string
}

interface AffectedPatient {
  patientName: string
  patientPhone?: string
  emergencyContact?: string
  emergencyPhone?: string
  startTime?: string
  refundText?: string
}

interface LeaveItem {
  id: number
  counselorName: string
  reason: string
  status: string
  startTime?: string
  endTime?: string
  location?: string
  screenshotUrl?: string
  affectedPatients?: AffectedPatient[]
  createdAt: string
}

interface DisplayItem {
  kind: ApprovalKind
  id: number
  title: string
  status: string
  reason: string
  createdAt: string
  lines: string[]
  raw: ExemptionItem | LeaveItem
}

const categories = [
  { label: '全部', value: 'ALL' as CategoryFilter },
  { label: '退款申请', value: 'EXEMPTION' as CategoryFilter },
  { label: '咨询师请假', value: 'LEAVE' as CategoryFilter },
]

const statusTabs = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
  { label: '全部', value: 'ALL' },
]

const activeCategory = ref<CategoryFilter>('ALL')
const activeStatus = ref('PENDING')
const loading = ref(true)
const processing = ref(false)
const displayItems = ref<DisplayItem[]>([])

const showExemptionDetail = ref(false)
const exemptionDetail = ref<ExemptionItem | null>(null)
const showRejectInput = ref(false)
const rejectReason = ref('')

const showLeaveDetail = ref(false)
const leaveDetail = ref<LeaveItem | null>(null)

const pendingExemptionId = ref(0)
const pendingLeaveId = ref(0)

const activeStatusLabel = computed(() => statusTabs.find(t => t.value === activeStatus.value)?.label || '')

const formatTime = (value?: string) => (value ? value.replace('T', ' ').slice(0, 16) : '-')
const formatEndTime = (value?: string) => {
  if (!value) return '-'
  const text = value.replace('T', ' ')
  return text.length > 11 ? text.slice(11, 16) : text.slice(0, 16)
}
const formatYuan = (cents?: number) => {
  if (!cents) return '0'
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}
const statusLabel = (s: string) => {
  if (s === 'PENDING') return '待审核'
  if (s === 'APPROVED') return '已通过'
  if (s === 'REJECTED') return '已拒绝'
  return s
}

const resolveAssetUrl = (url?: string) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return getApiV2Url(url.startsWith('/') ? url : `/${url}`)
}

const toDisplayItem = (kind: ApprovalKind, raw: ExemptionItem | LeaveItem): DisplayItem => {
  if (kind === 'EXEMPTION') {
    const item = raw as ExemptionItem
    return {
      kind,
      id: item.id,
      title: item.patientName,
      status: item.status,
      reason: item.reason,
      createdAt: item.createdAt,
      lines: [
        `咨询师：${item.counselorName}`,
        `申请金额：￥${formatYuan(item.amount)}`,
        `咨询时段：${formatTime(item.consultationStartTime)}`,
      ],
      raw: item,
    }
  }
  const item = raw as LeaveItem
  return {
    kind,
    id: item.id,
    title: item.counselorName,
    status: item.status,
    reason: item.reason,
    createdAt: item.createdAt,
    lines: [
      `时段：${formatTime(item.startTime)}`,
      `地点：${item.location || '-'}`,
    ],
    raw: item,
  }
}

const mergeItems = (exemptions: ExemptionItem[], leaves: LeaveItem[]) => {
  const merged = [
    ...exemptions.map(e => toDisplayItem('EXEMPTION', e)),
    ...leaves.map(l => toDisplayItem('LEAVE', l)),
  ]
  merged.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
  return merged
}

const load = async () => {
  loading.value = true
  try {
    const status = activeStatus.value
    const needExemption = activeCategory.value === 'ALL' || activeCategory.value === 'EXEMPTION'
    const needLeave = activeCategory.value === 'ALL' || activeCategory.value === 'LEAVE'
    const tasks: Promise<void>[] = []
    let exemptions: ExemptionItem[] = []
    let leaves: LeaveItem[] = []

    if (needExemption) {
      tasks.push(
        httpV2.get<ExemptionItem[]>(API_ENDPOINTS.admin.refundExemptions, { status }, { showLoading: false })
          .then(res => { if (res.code === 0 && Array.isArray(res.data)) exemptions = res.data })
      )
    }
    if (needLeave) {
      tasks.push(
        httpV2.get<LeaveItem[]>(API_ENDPOINTS.admin.leaveRequests, { status }, { showLoading: false })
          .then(res => { if (res.code === 0 && Array.isArray(res.data)) leaves = res.data })
      )
    }
    await Promise.all(tasks)
    displayItems.value = mergeItems(exemptions, leaves)
    tryOpenPending()
  } catch {
    displayItems.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const tryOpenPending = () => {
  if (pendingExemptionId.value) {
    const found = displayItems.value.find(i => i.kind === 'EXEMPTION' && i.id === pendingExemptionId.value)
    pendingExemptionId.value = 0
    if (found) openDetail(found)
  }
  if (pendingLeaveId.value) {
    const found = displayItems.value.find(i => i.kind === 'LEAVE' && i.id === pendingLeaveId.value)
    if (found) {
      pendingLeaveId.value = 0
      openDetail(found)
      return
    }
    loadLeaveDetailById(pendingLeaveId.value)
    pendingLeaveId.value = 0
  }
}

const loadLeaveDetailById = async (id: number) => {
  const res = await httpV2.get<LeaveItem>(API_ENDPOINTS.admin.leaveRequestDetail(id))
  if (res.code === 0 && res.data) openLeaveDetail(res.data)
}

const switchCategory = (value: CategoryFilter) => {
  if (activeCategory.value === value) return
  activeCategory.value = value
  load()
}

const switchStatus = (value: string) => {
  if (activeStatus.value === value) return
  activeStatus.value = value
  load()
}

const openDetail = (item: DisplayItem) => {
  if (item.kind === 'EXEMPTION') openExemptionDetail(item.raw as ExemptionItem)
  else openLeaveDetail(item.raw as LeaveItem)
}

const openExemptionDetail = (item: ExemptionItem) => {
  exemptionDetail.value = item
  showRejectInput.value = false
  rejectReason.value = ''
  showExemptionDetail.value = true
}

const closeExemptionDetail = () => {
  showExemptionDetail.value = false
  exemptionDetail.value = null
  showRejectInput.value = false
  rejectReason.value = ''
}

const openLeaveDetail = (item: LeaveItem) => {
  leaveDetail.value = item
  showLeaveDetail.value = true
}

const closeLeaveDetail = () => {
  showLeaveDetail.value = false
  leaveDetail.value = null
}

const previewScreenshot = () => {
  const url = resolveAssetUrl(leaveDetail.value?.screenshotUrl)
  if (url) uni.previewImage({ urls: [url] })
}

const approveExemption = async () => {
  if (!exemptionDetail.value || processing.value) return
  processing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.admin.refundExemptionApprove(exemptionDetail.value.id))
    if (res.code === 0) {
      uni.showToast({ title: '已同意退款', icon: 'success' })
      closeExemptionDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } finally {
    processing.value = false
  }
}

const rejectExemption = async () => {
  if (!exemptionDetail.value || processing.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    uni.showToast({ title: '请填写拒绝理由', icon: 'none' })
    return
  }
  processing.value = true
  try {
    const res = await httpV2.post(
      API_ENDPOINTS.admin.refundExemptionReject(exemptionDetail.value.id),
      { reject_reason: reason },
    )
    if (res.code === 0) {
      uni.showToast({ title: '已拒绝', icon: 'success' })
      closeExemptionDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } finally {
    processing.value = false
  }
}

const approveLeave = async () => {
  if (!leaveDetail.value || processing.value) return
  processing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.admin.leaveRequestApprove(leaveDetail.value.id))
    if (res.code === 0) {
      uni.showToast({ title: '已通过', icon: 'success' })
      closeLeaveDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } finally {
    processing.value = false
  }
}

const rejectLeave = async () => {
  if (!leaveDetail.value || processing.value) return
  processing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.admin.leaveRequestReject(leaveDetail.value.id))
    if (res.code === 0) {
      uni.showToast({ title: '已拒绝', icon: 'success' })
      closeLeaveDetail()
      await load()
    } else {
      uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    }
  } finally {
    processing.value = false
  }
}

onLoad((options) => {
  const category = String(options?.category || '').toUpperCase()
  if (category === 'EXEMPTION' || category === 'LEAVE') activeCategory.value = category
  const status = String(options?.status || '').toUpperCase()
  if (statusTabs.some(t => t.value === status)) activeStatus.value = status
  pendingLeaveId.value = Number(options?.leaveId || options?.id || 0)
  pendingExemptionId.value = Number(options?.exemptionId || 0)
})

onShow(load)
</script>

<style scoped>
.page-approvals { min-height: 100vh; background: #F7F5F2; padding: 24rpx; box-sizing: border-box; }
.hero-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 20rpx; padding: 32rpx; margin-bottom: 20rpx;
}
.hero-title { display: block; font-size: 36rpx; font-weight: 700; color: #fff; }
.hero-sub { display: block; margin-top: 10rpx; font-size: 24rpx; color: rgba(255,255,255,0.82); line-height: 1.6; }
.category-bar, .filter-bar { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 16rpx; }
.category-tab, .filter-tab {
  padding: 12rpx 24rpx; border-radius: 999rpx; font-size: 24rpx;
  background: #fff; color: #6B6560; border: 1rpx solid #E8E4DE; font-weight: 600;
}
.category-tab.active, .filter-tab.active { background: #3D5A4E; color: #fff; border-color: #3D5A4E; }
.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }
.list { display: flex; flex-direction: column; gap: 18rpx; }
.card {
  background: #fff; border-radius: 20rpx; padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; margin-bottom: 12rpx; }
.head-left { display: flex; flex-direction: column; gap: 8rpx; flex: 1; min-width: 0; }
.type-tag {
  align-self: flex-start; font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 999rpx; font-weight: 600;
}
.tag-exemption { background: #FEF3C7; color: #B45309; }
.tag-leave { background: #E0F2FE; color: #0369A1; }
.title { font-size: 30rpx; font-weight: 700; color: #2C2C2C; }
.status { font-size: 22rpx; font-weight: 600; flex-shrink: 0; }
.status.pending { color: #D97706; }
.status.approved { color: #059669; }
.status.rejected { color: #DC2626; }
.line { display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 6rpx; }
.reason-preview {
  display: block; margin-top: 8rpx; font-size: 24rpx; color: #374151;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.time { display: block; margin-top: 12rpx; font-size: 22rpx; color: #9CA3AF; }
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; padding: 32rpx; z-index: 1000;
}
.overlay-sheet { align-items: flex-end; padding: 0; }
.detail-card {
  width: 100%; max-width: 680rpx; background: #fff; border-radius: 24rpx; padding: 32rpx; box-sizing: border-box;
}
.sheet-card {
  max-width: none; max-height: 88vh; overflow-y: auto;
  border-radius: 32rpx 32rpx 0 0; padding: 36rpx 32rpx 48rpx;
}
.detail-header {
  position: relative;
  margin-bottom: 24rpx;
}
.detail-title {
  display: block;
  text-align: center;
  font-size: 34rpx;
  font-weight: 700;
  color: #1F2937;
  padding: 0 64rpx;
}
.detail-close-btn {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 64rpx;
  height: 64rpx;
  background: #F3F4F6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: #6B7280;
  line-height: 1;
}
.detail-close-btn:active { opacity: 0.75; }
.detail-body { display: flex; flex-direction: column; gap: 16rpx; }
.detail-row { display: flex; gap: 20rpx; }
.label { width: 160rpx; flex-shrink: 0; font-size: 26rpx; color: #9CA3AF; }
.value { flex: 1; font-size: 28rpx; color: #1F2937; line-height: 1.6; }
.value.highlight { color: #B45309; font-weight: 600; }
.reason-box, .reject-box, .screenshot-box {
  background: #F9FAFB; border-radius: 16rpx; padding: 20rpx;
}
.reject-box { background: #FEF2F2; border: 1rpx solid #FECACA; }
.reason-label { display: block; font-size: 24rpx; color: #9CA3AF; margin-bottom: 8rpx; }
.reason-text { font-size: 26rpx; color: #374151; line-height: 1.7; white-space: pre-wrap; }
.screenshot { width: 100%; height: 320rpx; border-radius: 16rpx; background: #E5E7EB; }
.section-title { margin-top: 8rpx; font-size: 28rpx; font-weight: 700; color: #374151; }
.sub-card { background: #F9FAFB; border-radius: 16rpx; padding: 20rpx; display: flex; flex-direction: column; gap: 12rpx; }
.actions { display: flex; gap: 16rpx; margin-top: 28rpx; }
.btn {
  flex: 1; height: 80rpx; line-height: 80rpx; border-radius: 100rpx;
  font-size: 28rpx; font-weight: 600; border: none;
}
.btn::after { border: none; }
.btn.approve { background: #3D5A4E; color: #fff; }
.btn.reject { background: #FEE2E2; color: #DC2626; }
.btn.close { width: 100%; margin-top: 28rpx; background: #F3F4F6; color: #374151; }
.reject-form { margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #F3F4F6; }
.reject-form-title { display: block; font-size: 26rpx; color: #374151; margin-bottom: 12rpx; }
.reject-textarea {
  width: 100%; box-sizing: border-box; min-height: 160rpx; background: #F9FAFB;
  border-radius: 12rpx; padding: 16rpx; font-size: 28rpx;
}
.reject-actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
.btn.ghost { background: #fff; color: #6B6560; border: 1rpx solid #E8E4DE; }
</style>
