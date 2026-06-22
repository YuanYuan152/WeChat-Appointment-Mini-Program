<template>
  <view class="page-leave-requests">
    <view class="filter-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ active: activeTab === tab.value }"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="items.length === 0" class="empty">暂无{{ activeTabLabel }}请假记录</view>
    <view v-else class="list">
      <view v-for="item in items" :key="item.id" class="card" @click="openDetail(item)">
        <view class="card-head">
          <text class="counselor">{{ item.counselorName }}</text>
          <text class="status" :class="item.status.toLowerCase()">{{ statusLabel(item.status) }}</text>
        </view>
        <text class="line">时段：{{ formatTime(item.startTime) }}</text>
        <text class="line">地点：{{ item.location || '-' }}</text>
        <text class="reason-preview">原因：{{ item.reason }}</text>
        <text class="time">提交于 {{ formatTime(item.createdAt) }}</text>
      </view>
    </view>

    <view v-if="showDetail" class="overlay" @touchmove.stop.prevent>
      <view class="detail-card" @tap.stop>
        <text class="detail-title">咨询师请假审批</text>
        <view class="detail-body">
          <view class="detail-row">
            <text class="label">咨询师</text>
            <text class="value">{{ detail?.counselorName }}</text>
          </view>
          <view class="detail-row">
            <text class="label">请假时段</text>
            <text class="value">{{ formatTime(detail?.startTime) }} - {{ formatEndTime(detail?.endTime) }}</text>
          </view>
          <view class="detail-row">
            <text class="label">预约地点</text>
            <text class="value">{{ detail?.location || '-' }}</text>
          </view>
          <view class="detail-row">
            <text class="label">审批状态</text>
            <text class="value">{{ statusLabel(detail?.status || '') }}</text>
          </view>
          <view class="reason-box">
            <text class="reason-label">请假原因</text>
            <text class="reason-text">{{ detail?.reason }}</text>
          </view>
          <view v-if="detail?.screenshotUrl" class="screenshot-box">
            <text class="reason-label">沟通截图</text>
            <image
              class="screenshot"
              :src="resolveAssetUrl(detail.screenshotUrl)"
              mode="aspectFit"
              @click="previewScreenshot"
            />
          </view>

          <view v-if="detail?.affectedPatients?.length" class="section-title">涉及预约与来访联系方式</view>
          <view
            v-for="(patient, idx) in detail?.affectedPatients || []"
            :key="idx"
            class="sub-card"
          >
            <view class="detail-row">
              <text class="label">来访者</text>
              <text class="value">{{ patient.patientName }}</text>
            </view>
            <view class="detail-row">
              <text class="label">联系电话</text>
              <text class="value">{{ patient.patientPhone || '未填写' }}</text>
            </view>
            <view v-if="patient.emergencyContact" class="detail-row">
              <text class="label">紧急联系人</text>
              <text class="value">{{ patient.emergencyContact }} {{ patient.emergencyPhone }}</text>
            </view>
            <view class="detail-row">
              <text class="label">预约时间</text>
              <text class="value">{{ formatTime(patient.startTime) }}</text>
            </view>
            <view class="detail-row">
              <text class="label">预约地点</text>
              <text class="value">{{ patient.location || '-' }}</text>
            </view>
            <view class="detail-row">
              <text class="label">退款说明</text>
              <text class="value">{{ patient.refundText }}</text>
            </view>
          </view>
        </view>

        <view v-if="detail?.status === 'PENDING'" class="actions">
          <button class="btn reject" :disabled="processing" @click="reject">拒绝</button>
          <button class="btn approve" :loading="processing" @click="approve">通过请假</button>
        </view>
        <button v-else class="btn close" @click="closeDetail">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { getApiV2Url } from '@/config/api'

interface AffectedPatient {
  consultationId?: number
  patientName: string
  patientPhone?: string
  emergencyContact?: string
  emergencyPhone?: string
  startTime?: string
  endTime?: string
  location?: string
  refundText?: string
}

interface LeaveItem {
  id: number
  scheduleId: number
  counselorId: number
  counselorName: string
  reason: string
  status: string
  startTime?: string
  endTime?: string
  location?: string
  screenshotUrl?: string
  affectedPatients: AffectedPatient[]
  createdAt: string
  reviewedAt?: string
}

const tabs = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
  { label: '全部', value: 'ALL' },
]

const activeTab = ref('PENDING')
const items = ref<LeaveItem[]>([])
const loading = ref(true)
const showDetail = ref(false)
const detail = ref<LeaveItem | null>(null)
const processing = ref(false)
const pendingOpenId = ref(0)

const activeTabLabel = computed(() => tabs.find(t => t.value === activeTab.value)?.label || '')

const formatTime = (value?: string) => {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

const formatEndTime = (value?: string) => {
  if (!value) return '-'
  const text = value.replace('T', ' ')
  return text.length > 11 ? text.slice(11, 16) : text.slice(0, 16)
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

const previewScreenshot = () => {
  const url = resolveAssetUrl(detail.value?.screenshotUrl)
  if (url) uni.previewImage({ urls: [url] })
}

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<LeaveItem[]>(
      API_ENDPOINTS.admin.leaveRequests,
      { status: activeTab.value },
      { showLoading: false },
    )
    if (res.code === 0 && Array.isArray(res.data)) {
      items.value = res.data
      tryOpenPending()
    } else {
      items.value = []
      uni.showToast({ title: res.msg || '加载失败', icon: 'none' })
    }
  } catch (err: any) {
    items.value = []
    uni.showToast({ title: err?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const tryOpenPending = () => {
  const id = pendingOpenId.value
  if (!id) return
  pendingOpenId.value = 0
  const found = items.value.find(i => i.id === id)
  if (found) {
    openDetail(found)
    return
  }
  loadDetailById(id)
}

const loadDetailById = async (id: number) => {
  const res = await httpV2.get<LeaveItem>(API_ENDPOINTS.admin.leaveRequestDetail(id))
  if (res.code === 0 && res.data) {
    openDetail(res.data)
  }
}

const switchTab = (value: string) => {
  if (activeTab.value === value) return
  activeTab.value = value
  load()
}

const openDetail = (item: LeaveItem) => {
  detail.value = item
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  detail.value = null
}

const approve = async () => {
  if (!detail.value || processing.value) return
  processing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.admin.leaveRequestApprove(detail.value.id))
    if (res.code === 0) {
      uni.showToast({ title: '已通过', icon: 'success' })
      closeDetail()
      load()
    }
  } finally {
    processing.value = false
  }
}

const reject = async () => {
  if (!detail.value || processing.value) return
  processing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.admin.leaveRequestReject(detail.value.id))
    if (res.code === 0) {
      uni.showToast({ title: '已拒绝', icon: 'success' })
      closeDetail()
      load()
    }
  } finally {
    processing.value = false
  }
}

onLoad((options) => {
  const id = Number(options?.id || 0)
  if (id) pendingOpenId.value = id
})

onShow(load)
</script>

<style scoped>
.page-leave-requests { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }

.filter-bar {
  display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 24rpx;
}
.filter-tab {
  padding: 12rpx 28rpx; border-radius: 100rpx; background: #fff;
  font-size: 26rpx; color: #6B7280; font-weight: 600;
}
.filter-tab.active { background: #3D5A4E; color: #fff; }

.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }

.card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.counselor { font-size: 30rpx; font-weight: 700; color: #1F2937; }
.status { font-size: 24rpx; font-weight: 600; }
.status.pending { color: #D97706; }
.status.approved { color: #059669; }
.status.rejected { color: #DC2626; }
.line { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 8rpx; }
.reason-preview {
  display: block; font-size: 26rpx; color: #374151; margin-top: 8rpx;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.time { display: block; margin-top: 12rpx; font-size: 23rpx; color: #9CA3AF; }

.overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: flex-end; z-index: 100;
}
.detail-card {
  width: 100%; max-height: 88vh; overflow-y: auto;
  background: #fff; border-radius: 32rpx 32rpx 0 0; padding: 36rpx 32rpx 48rpx;
}
.detail-title { display: block; font-size: 34rpx; font-weight: 800; color: #1F2937; margin-bottom: 24rpx; }
.detail-body { display: flex; flex-direction: column; gap: 18rpx; }
.detail-row { display: flex; gap: 20rpx; }
.label { width: 160rpx; flex-shrink: 0; font-size: 26rpx; color: #9CA3AF; }
.value { flex: 1; font-size: 28rpx; color: #1F2937; line-height: 1.6; }
.reason-box, .screenshot-box {
  background: #F9FAFB; border-radius: 20rpx; padding: 24rpx;
}
.reason-label { display: block; font-size: 24rpx; color: #9CA3AF; margin-bottom: 10rpx; }
.reason-text { font-size: 28rpx; color: #374151; line-height: 1.7; white-space: pre-wrap; }
.screenshot { width: 100%; height: 320rpx; border-radius: 16rpx; background: #E5E7EB; }
.section-title { margin-top: 8rpx; font-size: 28rpx; font-weight: 700; color: #374151; }
.sub-card {
  background: #F9FAFB; border-radius: 20rpx; padding: 24rpx;
  display: flex; flex-direction: column; gap: 14rpx;
}

.actions { display: flex; gap: 20rpx; margin-top: 28rpx; }
.btn {
  flex: 1; height: 88rpx; line-height: 88rpx; border-radius: 100rpx;
  font-size: 30rpx; font-weight: 600; border: none;
}
.btn.approve { background: #3D5A4E; color: #fff; }
.btn.reject { background: #FEE2E2; color: #DC2626; }
.btn.close { width: 100%; margin-top: 28rpx; background: #F3F4F6; color: #374151; }
</style>
