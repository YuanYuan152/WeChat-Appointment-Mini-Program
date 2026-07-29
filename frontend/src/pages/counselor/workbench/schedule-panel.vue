<template>
  <view class="page-workbench">
    <view class="header-card">
      <view>
        <text class="greeting">咨询师工作台</text>
        <text class="date-text">{{ viewMode === 'list' ? `近${LIST_WINDOW_DAYS}天：${rollingRangeText}` : `${calendarMonthLabel} 排期日历` }}</text>
      </view>
    </view>

    <view class="mode-switch">
      <view
        class="mode-chip"
        :class="{ active: viewMode === 'list' }"
        @tap="switchViewMode('list')"
      >普通模式</view>
      <view
        class="mode-chip"
        :class="{ active: viewMode === 'calendar' }"
        @tap="switchViewMode('calendar')"
      >日历模式</view>
    </view>

    <view class="legend-card">
      <view v-for="item in legend" :key="item.key" class="legend-item">
        <text class="legend-icon">{{ item.icon }}</text>
        <text class="legend-text">{{ item.label }}</text>
      </view>
    </view>

    <view class="toolbar">
      <view class="toolbar-btns">
        <button class="add-btn toolbar-btn" @tap="openAddModal">+ 新建排期</button>
        <button class="proxy-btn toolbar-btn" @tap="openProxyModal">代理预约</button>
      </view>
      <text class="toolbar-tip">{{ toolbarTip }}</text>
    </view>

    <view v-if="viewMode === 'list'" class="filter-section">
      <view class="filter-bar" @tap="showListFilter = !showListFilter">
        <text class="filter-bar-text">筛选</text>
        <text v-if="listFilterActive" class="filter-bar-badge">已启用</text>
        <text class="filter-bar-arrow">{{ showListFilter ? '▲' : '▼' }}</text>
      </view>
      <view v-if="showListFilter" class="filter-panel">
        <text class="filter-label">时间段</text>
        <view class="filter-chips">
          <view
            v-for="opt in listTimeOptions"
            :key="opt.value"
            class="filter-chip"
            :class="{ active: listTimeFilter === opt.value }"
            @tap="listTimeFilter = opt.value"
          >{{ opt.label }}</view>
        </view>
        <text class="filter-label">状态</text>
        <view class="filter-chips">
          <view
            v-for="opt in listStatusOptions"
            :key="opt.value"
            class="filter-chip"
            :class="{ active: listStatusFilter === opt.value }"
            @tap="listStatusFilter = opt.value"
          >{{ opt.label }}</view>
        </view>
        <text v-if="listFilterActive" class="filter-reset" @tap="resetListFilters">重置筛选</text>
      </view>
    </view>

    <view v-if="loading" class="empty-card"><text class="empty-text">加载中...</text></view>

    <template v-else>
      <view v-if="viewMode === 'calendar'" class="calendar-section">
        <view class="calendar-nav">
          <text class="cal-nav-btn" @tap="shiftMonth(-1)">‹</text>
          <text class="cal-month-title">{{ calendarMonthLabel }}</text>
          <text class="cal-nav-btn" @tap="shiftMonth(1)">›</text>
        </view>
        <view class="cal-weekdays">
          <text v-for="w in weekdayHeaders" :key="w" class="cal-weekday">{{ w }}</text>
        </view>
        <view class="cal-grid">
          <view
            v-for="(cell, idx) in calendarCells"
            :key="idx"
            class="cal-cell"
            :class="{
              empty: cell.empty,
              today: cell.isToday,
              selected: cell.isSelected,
            }"
            @tap="!cell.empty && selectCalendarDate(cell.date)"
          >
            <template v-if="!cell.empty">
              <text class="cal-day-num">{{ cell.day }}</text>
              <view v-if="cell.dots.length" class="cal-dots">
                <view
                  v-for="(dot, di) in cell.dots"
                  :key="di"
                  class="cal-dot"
                  :style="{ background: dotColor(dot) }"
                />
              </view>
            </template>
          </view>
        </view>
        <text v-if="selectedCalendarDate" class="cal-selected-label">{{ weekdayLabel(selectedCalendarDate) }} 排班</text>
      </view>

      <view v-for="day in displayDaySections" :key="day.date" class="day-section">
      <text v-if="viewMode === 'list'" class="day-title">{{ day.label }}</text>
      <view v-if="day.slots.length === 0" class="empty-slot-row">
        <text class="empty-slot-icon">⬜</text>
        <text class="empty-slot-text">本日暂无排期</text>
      </view>
      <view
        v-for="slot in day.slots"
        :key="slot.id"
        class="slot-card"
        :class="{ 'slot-card--clickable': !!slot.leaveRequestId }"
        :style="{ background: meta(slot.displayStatus).bg }"
        @tap="onSlotTap(slot)"
      >
        <view class="slot-left">
          <text class="slot-icon">{{ meta(slot.displayStatus).icon }}</text>
          <view>
            <text class="slot-time">{{ formatTime(slot.startTime) }} – {{ formatTime(slot.endTime) }}</text>
            <text v-if="slot.centerName" class="slot-center">{{ slot.centerName }}</text>
            <text v-if="slotRoomText(slot)" class="slot-room">{{ slotRoomText(slot) }}</text>
            <text v-if="slot.patientName" class="slot-patient">来访者：{{ formatPatientInline(slot.patientName, slot.patientContractTag) }}</text>
          </view>
        </view>
        <view class="slot-right">
          <text class="slot-status" :style="{ color: slotStatusColor(slot) }">{{ slot.displayLabel }}</text>
          <text v-if="slot.leaveRequestId" class="slot-detail-hint">点击查看请假详情</text>
          <text v-if="showCaseRecordAction(slot)" class="slot-record-btn" @tap.stop="openCaseRecord(slot)">
            {{ slot.hasCaseRecord ? '查看咨询记录' : '填写咨询记录' }}
          </text>
          <text v-if="showCancelAction(slot)" class="slot-cancel" @tap.stop="handleCancelSlot(slot)">
            {{ cancelActionLabel(slot) }}
          </text>
        </view>
      </view>
    </view>
    <view
      v-if="viewMode === 'list' && !loading && groupedDays.length === 0"
      class="empty-card"
    >
      <text class="empty-text">{{ emptyListText }}</text>
    </view>
    </template>

    <!-- 新建排期 -->
    <view v-if="showAdd" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">新建排期</text>
        <text class="modal-sub">{{ addModalSub }}</text>

        <view class="form-item">
          <text class="form-label">预约中心</text>
          <view class="center-row">
            <view
              v-for="c in centers"
              :key="c.id"
              class="center-chip"
              :class="{ active: form.centerId === c.id }"
              @tap="onCenterChange(c.id)"
            >{{ c.name }}</view>
          </view>
        </view>

        <view class="form-item" @tap.stop>
          <text class="form-label">日期</text>
          <picker mode="date" :value="form.date" :start="minDate" :end="maxDate" @change="onDateChange">
            <view class="picker-row" hover-class="none">{{ form.date || '选择日期' }}</view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">开始时间</text>
          <view v-if="slotOptionsLoading" class="picker-row">加载时段...</view>
          <view v-else class="slot-grid">
            <view
              v-for="ts in timeSlotOptions"
              :key="ts.key"
              class="slot-chip"
              :class="{
                active: form.slotKey === ts.key,
                disabled: ts.past || ts.allRoomsFull || ts.counselorOccupied,
              }"
              @tap="selectTimeSlot(ts)"
            >{{ ts.key }}{{ ts.counselorOccupied ? '（已排期）' : '' }}</view>
          </view>
          <text class="form-hint">支持整点和半点开始；咨询 50 分钟，随后预留 10 分钟打扫</text>
        </view>

        <view v-if="selectedTimeSlot" class="duration-card">
          <text class="duration-title">本次排期</text>
          <text class="duration-text">{{ bookingDurationText(selectedTimeSlot.startTime) }}</text>
        </view>

        <view v-if="!isVideoCenterSelected" class="form-item">
          <text class="form-label">咨询室偏好</text>
          <view class="center-row">
            <view
              class="center-chip"
              :class="{ active: form.roomId === NO_PREF }"
              @tap="selectNoPref"
            >无偏好</view>
            <view
              v-for="room in roomOptionsForSlot"
              :key="room.roomId"
              class="center-chip"
              :class="{
                active: form.roomId === room.roomId,
                disabled: !room.available,
              }"
              @tap="selectRoom(room)"
            >{{ room.roomName }}{{ roomLabel(room) }}</view>
          </view>
        </view>

        <view v-else class="form-item video-center-hint">
          <text class="form-label">咨询室</text>
          <text class="video-hint-text">视频咨询无需选择咨询室，预约成功后也不占用线下咨询室。</text>
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap.stop="showAdd = false">取消</button>
          <button class="modal-btn confirm" :disabled="submitting" @tap.stop="submitSlot">
            {{ submitting ? '保存中...' : '保存排期' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 代理预约 -->
    <view v-if="showProxy" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">代理预约</text>
        <text class="modal-sub">为已签约来访推送待支付订单，{{ proxyOrderPayHint }}</text>

        <view class="form-item">
          <text class="form-label">选择来访 <text class="required">*</text></text>
          <input
            class="patient-input"
            placeholder="输入姓名/手机号搜索"
            :value="proxyPatientKeyword"
            @input="onProxyPatientInput"
            @focus="showProxyPatientDropdown = true"
          />
          <view v-if="showProxyPatientDropdown && proxyPatientSuggestions.length" class="patient-dropdown">
            <view
              v-for="p in proxyPatientSuggestions"
              :key="p.id"
              class="patient-dropdown-item"
              :class="{ disabled: p.canProxyPush === false }"
              @tap="selectProxyPatient(p)"
            >{{ p.label || formatPatientInline(p.name, p.contractTag) }}</view>
          </view>
          <text v-if="proxySelectedPatient" class="selected-patient-tag">
            已选：{{ formatPatientInline(proxySelectedPatient.name, proxySelectedPatient.contractTag) }}
          </text>
          <text v-else class="proxy-patient-hint">仅可选择已绑定您且已签约的来访</text>
        </view>

        <view class="form-item">
          <text class="form-label">预约中心</text>
          <view class="center-row">
            <view
              v-for="c in centers"
              :key="c.id"
              class="center-chip"
              :class="{ active: proxyForm.centerId === c.id }"
              @tap="onProxyCenterChange(c.id)"
            >{{ c.name }}</view>
          </view>
        </view>

        <view class="form-item" @tap.stop>
          <text class="form-label">日期</text>
          <picker mode="date" :value="proxyForm.date" :start="minDate" :end="maxDate" @change="onProxyDateChange">
            <view class="picker-row" hover-class="none">{{ proxyForm.date || '选择日期' }}</view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">开始时间</text>
          <view v-if="proxySlotOptionsLoading" class="picker-row">加载时段...</view>
          <view v-else class="slot-grid">
            <view
              v-for="ts in proxyTimeSlotOptions"
              :key="ts.key"
              class="slot-chip"
              :class="{
                active: proxyForm.slotKey === ts.key,
                disabled: !ts.selectable,
                available: ts.selectable && !!ts.existingAvailableScheduleId,
              }"
              @tap="selectProxyTimeSlot(ts)"
            >{{ ts.key }}{{ proxySlotChipHint(ts) }}</view>
          </view>
          <text class="form-hint">支持整点和半点开始；咨询 50 分钟，随后预留 10 分钟打扫</text>
        </view>

        <view v-if="selectedProxyTimeSlot" class="duration-card">
          <text class="duration-title">本次预约</text>
          <text class="duration-text">{{ bookingDurationText(selectedProxyTimeSlot.startTime) }}</text>
        </view>

        <view v-if="!isProxyVideoCenterSelected" class="form-item">
          <text class="form-label">咨询室（必选）</text>
          <view class="center-row">
            <view
              v-for="room in proxyRoomOptionsForSlot"
              :key="room.roomId"
              class="center-chip"
              :class="{
                active: proxyForm.roomId === room.roomId,
                disabled: !room.available,
              }"
              @tap="selectProxyRoom(room)"
            >{{ room.roomName }}{{ room.occupiedByOther ? '（已占用）' : '' }}</view>
          </view>
        </view>
        <view v-else class="form-item video-center-hint">
          <text class="video-hint-text">视频咨询无需选择咨询室</text>
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap.stop="showProxy = false">取消</button>
          <button class="modal-btn confirm" :disabled="proxySubmitting || !canPushProxyOrder" @tap.stop="submitProxyOrder">
            {{ proxySubmitting ? '推送中...' : '推送订单' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 请假详情 -->
    <view v-if="showLeaveDetail" class="notice-overlay" @touchmove.stop.prevent>
      <view class="detail-card" @tap.stop>
        <text class="notice-title">请假详情</text>
        <view class="detail-block">
          <text class="detail-label">咨询时段</text>
          <text class="detail-value">{{ leaveDetailSlotText }}</text>
        </view>
        <view v-if="leaveDetailCenterRoom" class="detail-block">
          <text class="detail-label">地点</text>
          <text class="detail-value">{{ leaveDetailCenterRoom }}</text>
        </view>
        <view v-if="leaveDetailPatient" class="detail-block">
          <text class="detail-label">来访者</text>
          <text class="detail-value">{{ leaveDetailPatient }}</text>
        </view>
        <view class="detail-block">
          <text class="detail-label">请假原因</text>
          <text class="detail-value detail-reason">{{ leaveDetailReason }}</text>
        </view>
        <view class="detail-block">
          <text class="detail-label">提交时间</text>
          <text class="detail-value">{{ leaveDetailSubmittedAt }}</text>
        </view>
        <view class="detail-block">
          <text class="detail-label">状态</text>
          <text class="detail-value">{{ leaveDetailStatusLabel }}</text>
        </view>
        <button class="notice-btn primary detail-close" @tap="showLeaveDetail = false">关闭</button>
      </view>
    </view>

    <!-- 已预约请假/取消：须上传沟通截图 -->
    <view v-if="showCancelBooked" class="notice-overlay" @touchmove.stop.prevent>
      <view class="cancel-booked-card" @tap.stop>
        <text class="notice-title">请假申请</text>
        <text class="cancel-booked-tip">{{ cancelBookedTip }}</text>
        <view v-if="cancelBookedSlotText" class="detail-block">
          <text class="detail-label">咨询时段</text>
          <text class="detail-value">{{ cancelBookedSlotText }}</text>
        </view>
        <view v-if="cancelBookedPatient" class="detail-block">
          <text class="detail-label">来访者</text>
          <text class="detail-value">{{ cancelBookedPatient }}</text>
        </view>
        <view class="reason-section">
          <text class="detail-label">请假理由（必填）</text>
          <textarea
            v-model="cancelLeaveReason"
            class="leave-reason-input"
            placeholder="请说明无法履约的原因"
            maxlength="1000"
            :disabled="cancellingBooked"
          />
          <text class="reason-counter">{{ cancelLeaveReason.length }}/1000</text>
        </view>
        <view class="upload-section">
          <text class="detail-label">沟通截图（必填）</text>
          <view v-if="cancelScreenshotUrl" class="screenshot-preview" @tap="pickCancelScreenshot">
            <image :src="cancelScreenshotPreview" mode="aspectFit" class="screenshot-img" />
            <text class="screenshot-repick">点击更换</text>
          </view>
          <view v-else class="screenshot-upload" @tap="pickCancelScreenshot">
            <text class="screenshot-upload-text">
              {{ cancelScreenshotUploading ? '上传中...' : '+ 上传沟通截图' }}
            </text>
          </view>
        </view>
        <view class="notice-btns">
          <button class="notice-btn secondary" @tap="closeCancelBooked">返回</button>
          <button
            class="notice-btn primary"
            :disabled="!canSubmitCancelBooked || cancellingBooked"
            :loading="cancellingBooked"
            @tap="confirmCancelBooked"
          >{{ cancellingBooked ? '提交中...' : '提交请假申请' }}</button>
        </view>
      </view>
    </view>

    <!-- 已预约请假须知 -->
    <view v-if="showLeaveNotice" class="notice-overlay" @touchmove.stop.prevent>
      <view class="notice-card" @tap.stop>
        <text class="notice-title">请假须知</text>
        <text class="notice-content">{{ leaveNoticeText }}</text>
        <view class="notice-btns">
          <button class="notice-btn secondary" @tap="closeLeaveNotice">再想想</button>
          <button class="notice-btn primary" @tap="confirmLeaveNotice">已沟通，继续请假</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineExpose } from 'vue'
import { httpV2 } from '@/utils/http'
import { fixImageUrl } from '@/utils/image'
import { API_ENDPOINTS } from '@/config/api'
import { APPOINTMENT_CENTERS, isVideoCenter } from '@/constants/appointmentCenters'
import { SCHEDULE_DISPLAY_META, type ScheduleDisplayStatus } from '@/constants/scheduleDisplay'
import { formatDateLocal, ROLLING_WINDOW_DAYS, PAST_WINDOW_DAYS, LIST_WINDOW_DAYS, addDays } from '@/constants/scheduleSlots'
import { openCounselorCaseRecord } from '@/utils/case-record'
import { formatPatientInline } from '@/utils/patientContract'
import { fetchSystemSettings, formatProxyOrderPushHint } from '@/utils/systemSettings'
import { refreshSubscribeHint, tryOfficialRoleSubscribeInGesture } from '@/utils/subscribePrompt'

const proxyOrderTtlMinutes = ref(120)
const proxyOrderPayHint = computed(() => formatProxyOrderPushHint(proxyOrderTtlMinutes.value))

interface RoomOpt {
  roomId: string
  roomName: string
  available: boolean
  occupiedBySelf: boolean
  occupiedByOther: boolean
}

interface TimeSlotOpt {
  key: string
  startTime: string
  endTime: string
  label: string
  past: boolean
  counselorOccupied: boolean
  allRoomsFull?: boolean
  rooms: RoomOpt[]
}

interface ProxyPatientItem {
  id: number
  name: string
  label?: string
  contractTag?: string | null
  isBoundToCounselor?: boolean
  isContractSigned?: boolean
  canProxyPush?: boolean
}

const PROXY_PATIENT_BLOCKED_MSG = '该来访并非您签约且绑定的来访，无法推送订单'

const showProxyPatientBlockedModal = () => {
  uni.showModal({
    title: '无法推送订单',
    content: PROXY_PATIENT_BLOCKED_MSG,
    showCancel: false,
  })
}

interface ProxyTimeSlotOpt {
  key: string
  label: string
  selectable: boolean
  past?: boolean
  counselorOccupied?: boolean
  existingAvailableScheduleId?: number | null
  startTime: string
  endTime: string
  rooms?: RoomOpt[]
}

interface CalendarSlot {
  id: number
  startTime: string
  endTime: string
  displayStatus: ScheduleDisplayStatus
  displayLabel: string
  centerName?: string
  centerId?: string
  roomName?: string
  patientName?: string
  patientContractTag?: string
  consultationId?: number
  hasCaseRecord?: boolean
  caseRecordId?: number | null
  canCancel?: boolean
  requiresLeave?: boolean
  cancelHint?: string
  leaveRequestId?: number
  leaveReason?: string
  leaveSubmittedAt?: string
  leaveStatus?: string
}

type ViewMode = 'list' | 'calendar'
type ListTimeFilter = 'all' | 'today' | 'week' | 'month'
type ListStatusFilter = 'ALL' | 'OPEN' | 'BOOKED' | 'DONE' | 'UNRECORDED' | 'RECORDED' | 'ON_LEAVE' | 'EXPIRED'
type CalendarDotStatus = ScheduleDisplayStatus | 'RECORDED'

const listTimeOptions: { value: ListTimeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '近7天' },
  { value: 'month', label: '本月' },
]

const listStatusOptions: { value: ListStatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部状态' },
  { value: 'OPEN', label: '已排期' },
  { value: 'BOOKED', label: '已预约' },
  { value: 'DONE', label: '已完成' },
  { value: 'UNRECORDED', label: '未填咨询记录' },
  { value: 'RECORDED', label: '咨询已填写' },
  { value: 'ON_LEAVE', label: '已请假' },
  { value: 'EXPIRED', label: '已过期' },
]

const weekdayHeaders = ['一', '二', '三', '四', '五', '六', '日']

const DOT_COLORS: Record<string, string> = {
  OPEN: '#7A5C3A',
  BOOKED: '#1F4034',
  ON_LEAVE: '#C2410C',
  DONE: '#6B7280',
  RECORDED: '#0D9488',
  EXPIRED: '#9CA3AF',
  CANCELLED: '#D1D5DB',
  PENDING_PAYMENT: '#9CA3AF',
}

const NO_PREF = '__none__'
const MS_24H = 24 * 60 * 60 * 1000

const DEFAULT_BOOKED_LEAVE_HINT =
  '取消前请与来访者提前沟通，填写请假理由并上传沟通截图。提交后须等待管理员审核通过；审核通过后将释放咨询室、通知来访者并协助改约。'

const parseStartTime = (iso: string) => new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))

const isBookedSlot = (slot: CalendarSlot) => {
  if (slot.displayStatus === 'DONE' || slot.displayStatus === 'ON_LEAVE' || slot.displayStatus === 'EXPIRED') {
    return false
  }
  return slot.displayStatus === 'BOOKED' || !!slot.patientName || !!slot.consultationId
}

const hasPendingLeave = (slot: CalendarSlot) => !!slot.leaveRequestId

const msUntilStart = (slot: CalendarSlot) => parseStartTime(slot.startTime).getTime() - Date.now()

/** 当前时间是否已到或超过开始时间 */
const slotHasStarted = (slot: CalendarSlot) => msUntilStart(slot) <= 0

/** 是否显示取消/请假操作 */
const showCancelAction = (slot: CalendarSlot) => {
  if (slot.displayStatus === 'EXPIRED' || hasPendingLeave(slot) || slotHasStarted(slot)) return false
  if (isBookedSlot(slot)) return true
  return !!slot.canCancel
}

const cancelActionLabel = (slot: CalendarSlot) => (isBookedSlot(slot) ? '请假' : '取消排期')

const loading = ref(true)
const viewMode = ref<ViewMode>('list')
const showListFilter = ref(false)
const listTimeFilter = ref<ListTimeFilter>('all')
const listStatusFilter = ref<ListStatusFilter>('ALL')
const calendarMonth = ref(formatDateLocal().slice(0, 7))
const selectedCalendarDate = ref(formatDateLocal())
const monthSlots = ref<CalendarSlot[]>([])
const slots = ref<CalendarSlot[]>([])
const showAdd = ref(false)
const showProxy = ref(false)
const proxyPatientKeyword = ref('')
const proxyPatientSuggestions = ref<ProxyPatientItem[]>([])
const proxySelectedPatient = ref<ProxyPatientItem | null>(null)
const showProxyPatientDropdown = ref(false)
const proxySubmitting = ref(false)
const proxySlotOptionsLoading = ref(false)
const proxyTimeSlotOptions = ref<ProxyTimeSlotOpt[]>([])
let proxyPatientSearchTimer: ReturnType<typeof setTimeout> | null = null
const proxyForm = ref({
  centerId: 'yangpu',
  date: formatDateLocal(),
  slotKey: '',
  roomId: '',
  startTime: '',
  endTime: '',
  scheduleId: null as number | null,
})
const isProxyVideoCenterSelected = computed(() => isVideoCenter(proxyForm.value.centerId))
const proxyRoomOptionsForSlot = computed(() => {
  const ts = proxyTimeSlotOptions.value.find((t) => t.key === proxyForm.value.slotKey)
  return ts?.rooms || []
})
const canPushProxyOrder = computed(() => {
  if (!proxySelectedPatient.value) return false
  if (!proxyForm.value.slotKey) return false
  if (!isProxyVideoCenterSelected.value && !proxyForm.value.roomId) return false
  return true
})
const showLeaveNotice = ref(false)
const leaveNoticeText = ref('')
const leaveNoticeSlot = ref<CalendarSlot | null>(null)
const showLeaveDetail = ref(false)
const leaveDetailSlotText = ref('')
const leaveDetailCenterRoom = ref('')
const leaveDetailPatient = ref('')
const leaveDetailReason = ref('')
const leaveDetailSubmittedAt = ref('')
const leaveDetailStatusLabel = ref('')
const cancelBookedTip = ref('')
const showCancelBooked = ref(false)
const cancelBookedSlot = ref<CalendarSlot | null>(null)
const cancelBookedSlotText = ref('')
const cancelBookedPatient = ref('')
const cancelScreenshotUrl = ref('')
const cancelLeaveReason = ref('')
const cancelScreenshotUploading = ref(false)
const cancellingBooked = ref(false)
const submitting = ref(false)
const slotOptionsLoading = ref(false)
const timeSlotOptions = ref<TimeSlotOpt[]>([])
const centers = APPOINTMENT_CENTERS
const defaultCenterId = 'yangpu'

const isVideoCenterSelected = computed(() => isVideoCenter(form.value.centerId))

const toolbarTip = computed(() =>
  isVideoCenterSelected.value
    ? '支持整点/半点开始；咨询 50 分钟并预留 10 分钟打扫，视频咨询不占咨询室'
    : '支持整点/半点开始；咨询 50 分钟并预留 10 分钟打扫，付款后才占用咨询室',
)

const addModalSub = computed(() =>
  isVideoCenterSelected.value
    ? '选择一个月内未开始的整点或半点开始时间（视频咨询）'
    : '选择一个月内未开始的整点或半点开始时间',
)

const slotRoomText = (slot: CalendarSlot) => {
  if (slot.roomName) return slot.roomName
  if (isVideoCenter(slot.centerId) && isBookedSlot(slot)) return '线上视频（不占咨询室）'
  return ''
}

/** 滚动窗口须每次按当前日期计算，避免 Tab 页常驻导致日期过期、日历加载失败 */
const minDate = computed(() => formatDateLocal())
const maxDate = computed(() => addDays(minDate.value, ROLLING_WINDOW_DAYS - 1))

const form = ref({
  centerId: defaultCenterId,
  date: formatDateLocal(),
  slotKey: '',
  roomId: NO_PREF,
  startTime: '',
  endTime: '',
})

const legend = [
  ...Object.entries(SCHEDULE_DISPLAY_META).map(([key, v]) => ({
    key,
    icon: v.icon,
    label: v.label,
  })),
  { key: 'RECORDED', icon: '📝', label: '咨询已填写' },
]

const meta = (status: ScheduleDisplayStatus) =>
  SCHEDULE_DISPLAY_META[status] || SCHEDULE_DISPLAY_META.OPEN

const listWindowStart = computed(() => addDays(minDate.value, -PAST_WINDOW_DAYS))
const listWindowEnd = computed(() => addDays(minDate.value, ROLLING_WINDOW_DAYS - 1))
const rollingRangeText = computed(() => `${listWindowStart.value} ~ ${listWindowEnd.value}`)

const cancelScreenshotPreview = computed(() => fixImageUrl(cancelScreenshotUrl.value))

const canSubmitCancelBooked = computed(
  () => !!cancelScreenshotUrl.value && !!cancelLeaveReason.value.trim(),
)

const formatTime = (iso: string) => (iso ? iso.replace('T', ' ').slice(11, 16) : '')

const formatDateTime = (iso?: string) => {
  if (!iso) return '—'
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return iso.replace('T', ' ').slice(0, 16)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

const leaveStatusText = (status?: string) => {
  if (status === 'PENDING') return '待审核'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  return status || '待审核'
}

const openLeaveDetail = (slot: CalendarSlot) => {
  leaveDetailSlotText.value = `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`
  leaveDetailCenterRoom.value = `${slot.centerName || ''}${slot.roomName ? ` · ${slot.roomName}` : ''}`
  leaveDetailPatient.value = slot.patientName || ''
  leaveDetailReason.value = slot.leaveReason || '—'
  leaveDetailSubmittedAt.value = formatDateTime(slot.leaveSubmittedAt)
  leaveDetailStatusLabel.value = leaveStatusText(slot.leaveStatus)
  showLeaveDetail.value = true
}

const onSlotTap = (slot: CalendarSlot) => {
  if (slot.leaveRequestId) openLeaveDetail(slot)
}

const weekdayLabel = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`)
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${dateStr} ${names[d.getDay()]}`
}

const listFilterActive = computed(
  () => listTimeFilter.value !== 'all' || listStatusFilter.value !== 'ALL',
)

const emptyListText = computed(() => {
  if (listStatusFilter.value === 'UNRECORDED') return '暂无待填写的咨询记录'
  if (listFilterActive.value) return '暂无符合筛选条件的排期'
  return '暂无排期'
})

const resetListFilters = () => {
  listTimeFilter.value = 'all'
  listStatusFilter.value = 'ALL'
}

const slotMatchesTimeFilter = (slot: CalendarSlot, filter: ListTimeFilter) => {
  if (filter === 'all') return true
  const date = slot.startTime.slice(0, 10)
  const today = minDate.value
  if (filter === 'today') return date === today
  if (filter === 'week') return date >= today && date <= addDays(today, 6)
  if (filter === 'month') return date.slice(0, 7) === today.slice(0, 7)
  return true
}

const slotMatchesStatusFilter = (slot: CalendarSlot, filter: ListStatusFilter) => {
  if (filter === 'ALL') return true
  if (filter === 'RECORDED') return slot.displayStatus === 'DONE' && !!slot.hasCaseRecord
  if (filter === 'UNRECORDED') {
    return slot.displayStatus === 'DONE' && !!slot.consultationId && !slot.hasCaseRecord
  }
  if (filter === 'DONE') return slot.displayStatus === 'DONE'
  return slot.displayStatus === filter
}

interface ScheduleListFilter {
  time?: ListTimeFilter
  status?: ListStatusFilter
  expand?: boolean
}

const applyListFilter = (opts?: ScheduleListFilter) => {
  viewMode.value = 'list'
  if (opts?.time) listTimeFilter.value = opts.time
  if (opts?.status) listStatusFilter.value = opts.status
  if (opts?.expand !== false) showListFilter.value = true
}

const getUnrecordedCount = () =>
  slots.value.filter(
    s => s.displayStatus === 'DONE' && !!s.consultationId && !s.hasCaseRecord,
  ).length

const slotPassesListFilters = (slot: CalendarSlot) =>
  slotMatchesTimeFilter(slot, listTimeFilter.value)
  && slotMatchesStatusFilter(slot, listStatusFilter.value)

const groupedDays = computed(() => {
  const startDate = listWindowStart.value
  const endDate = listWindowEnd.value
  const byDate = new Map<string, CalendarSlot[]>()
  for (const s of slots.value) {
    if (s.displayStatus === 'CANCELLED' && !s.leaveRequestId) continue
    if (!slotPassesListFilters(s)) continue
    const date = s.startTime.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(s)
  }
  const days: { date: string; label: string; slots: CalendarSlot[] }[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    const daySlots = (byDate.get(cursor) || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime))
    if (listFilterActive.value && daySlots.length === 0) {
      cursor = addDays(cursor, 1)
      continue
    }
    days.push({ date: cursor, label: weekdayLabel(cursor), slots: daySlots })
    cursor = addDays(cursor, 1)
  }
  return days
})

const slotsForDate = (source: CalendarSlot[], date: string) =>
  source
    .filter(s => s.startTime.slice(0, 10) === date && !(s.displayStatus === 'CANCELLED' && !s.leaveRequestId))
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

const displayDaySections = computed(() => {
  if (viewMode.value === 'list') return groupedDays.value
  if (!selectedCalendarDate.value) return []
  return [{
    date: selectedCalendarDate.value,
    label: weekdayLabel(selectedCalendarDate.value),
    slots: slotsForDate(monthSlots.value, selectedCalendarDate.value),
  }]
})

const calendarMonthLabel = computed(() => {
  const [y, m] = calendarMonth.value.split('-').map(Number)
  return `${y}年${m}月`
})

const dotsForDate = (date: string) => {
  const daySlots = slotsForDate(monthSlots.value, date)
  const statuses = new Set<CalendarDotStatus>()
  for (const s of daySlots) {
    if (s.displayStatus === 'DONE' && s.hasCaseRecord) statuses.add('RECORDED')
    else statuses.add(s.displayStatus)
  }
  return Array.from(statuses).slice(0, 4)
}

const dotColor = (status: string) => DOT_COLORS[status] || '#9CA3AF'

const calendarCells = computed(() => {
  const [y, m] = calendarMonth.value.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0).getDate()
  const startPad = (first.getDay() + 6) % 7
  const today = formatDateLocal()
  const cells: Array<{
    empty: boolean
    date?: string
    day?: number
    isToday?: boolean
    isSelected?: boolean
    dots?: CalendarDotStatus[]
  }> = []
  for (let i = 0; i < startPad; i++) cells.push({ empty: true })
  for (let d = 1; d <= lastDay; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      empty: false,
      date,
      day: d,
      isToday: date === today,
      isSelected: date === selectedCalendarDate.value,
      dots: dotsForDate(date),
    })
  }
  return cells
})

const showCaseRecordAction = (slot: CalendarSlot) =>
  slot.displayStatus === 'DONE' && !!slot.consultationId

const slotStatusColor = (slot: CalendarSlot) => {
  if (slot.displayStatus === 'DONE' && slot.hasCaseRecord) return '#0D9488'
  return meta(slot.displayStatus).color
}

const openCaseRecord = (slot: CalendarSlot) => {
  if (!slot.consultationId) return
  openCounselorCaseRecord({
    consultationId: slot.consultationId,
    recordId: slot.caseRecordId,
    hasRecord: slot.hasCaseRecord,
  })
}

const selectCalendarDate = (date: string) => {
  selectedCalendarDate.value = date
}

const shiftMonth = async (delta: number) => {
  const [y, m] = calendarMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  calendarMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  await loadMonthCalendar()
  const [ny, nm] = calendarMonth.value.split('-').map(Number)
  const lastDay = new Date(ny, nm, 0).getDate()
  const dayNum = Math.min(
    Number((selectedCalendarDate.value || '').slice(8, 10)) || 1,
    lastDay,
  )
  selectedCalendarDate.value = `${ny}-${String(nm).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
}

const switchViewMode = async (mode: ViewMode) => {
  if (viewMode.value === mode) return
  viewMode.value = mode
  if (mode === 'calendar') {
    if (!selectedCalendarDate.value) selectedCalendarDate.value = formatDateLocal()
    await loadMonthCalendar()
  } else {
    await loadCalendar()
  }
}

const selectedTimeSlot = computed(() =>
  timeSlotOptions.value.find(t => t.key === form.value.slotKey) || null,
)

const selectedProxyTimeSlot = computed(() =>
  proxyTimeSlotOptions.value.find(t => t.key === proxyForm.value.slotKey) || null,
)

const bookingDurationText = (startTime: string) => {
  const start = new Date(startTime)
  if (Number.isNaN(start.getTime())) return startTime
  const consultationEnd = new Date(start.getTime() + 50 * 60_000)
  const cleaningEnd = new Date(start.getTime() + 60 * 60_000)
  const hhmm = (value: Date) =>
    `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
  return `咨询 ${hhmm(start)}–${hhmm(consultationEnd)}，打扫 ${hhmm(consultationEnd)}–${hhmm(cleaningEnd)}`
}

const roomOptionsForSlot = computed(() => selectedTimeSlot.value?.rooms || [])

const loadMonthCalendar = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<{ slots: CalendarSlot[] }>(
      API_ENDPOINTS.counselor.scheduleCalendar,
      { month: calendarMonth.value },
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      monthSlots.value = res.data.slots || []
    } else {
      monthSlots.value = []
      uni.showToast({ title: res.msg || '加载月历失败', icon: 'none' })
    }
  } catch {
    monthSlots.value = []
    uni.showToast({ title: '加载月历失败，请检查后端服务', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const loadCalendar = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<{ slots: CalendarSlot[] }>(
      API_ENDPOINTS.counselor.scheduleCalendar,
      {
        start: listWindowStart.value,
        past_days: PAST_WINDOW_DAYS,
        days: LIST_WINDOW_DAYS,
      },
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      slots.value = res.data.slots || []
    } else {
      slots.value = []
      uni.showToast({ title: res.msg || '加载排班失败', icon: 'none' })
    }
  } catch {
    slots.value = []
    uni.showToast({ title: '加载排班失败，请检查后端服务', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const loadSlotOptions = async () => {
  const { centerId, date } = form.value
  if (!centerId || !date) return
  slotOptionsLoading.value = true
  try {
    const res = await httpV2.get<{ slots: TimeSlotOpt[] }>(
      API_ENDPOINTS.counselor.scheduleSlotOptions,
      { date, center_id: centerId },
      { showLoading: false },
    )
    timeSlotOptions.value = res.code === 0 && res.data ? res.data.slots || [] : []
    if (form.value.slotKey) {
      const still = timeSlotOptions.value.find(t => t.key === form.value.slotKey)
      if (!still || still.past || still.allRoomsFull || still.counselorOccupied) {
        form.value.slotKey = ''
        form.value.roomId = NO_PREF
      }
    }
  } catch {
    timeSlotOptions.value = []
  } finally {
    slotOptionsLoading.value = false
  }
}

const onCenterChange = async (id: string) => {
  form.value.centerId = id
  form.value.slotKey = ''
  form.value.roomId = isVideoCenter(id) ? '' : NO_PREF
  await loadSlotOptions()
}

const onDateChange = async (e: { detail: { value: string } }) => {
  form.value.date = e.detail.value
  form.value.slotKey = ''
  form.value.roomId = NO_PREF
  await loadSlotOptions()
}

const roomLabel = (room: RoomOpt) => {
  if (room.occupiedByOther) return '（已约满）'
  return ''
}

const selectNoPref = () => {
  form.value.roomId = NO_PREF
}

const selectTimeSlot = (ts: TimeSlotOpt) => {
  if (ts.past) {
    uni.showToast({ title: '该时段已开始或已过', icon: 'none' })
    return
  }
  if (ts.allRoomsFull) {
    uni.showToast({ title: '该中心该时段所有咨询室均已约满', icon: 'none' })
    return
  }
  if (ts.counselorOccupied) {
    uni.showToast({ title: '您在该时间槽已有排期', icon: 'none' })
    return
  }
  form.value.slotKey = ts.key
  form.value.startTime = ts.startTime
  form.value.endTime = ts.endTime
  form.value.roomId = NO_PREF
}

const selectRoom = (room: RoomOpt) => {
  if (!room.available) {
    uni.showToast({ title: '该咨询室暂不可用', icon: 'none' })
    return
  }
  form.value.roomId = room.roomId
}

const openAddModal = async () => {
  form.value = {
    centerId: defaultCenterId,
    date: minDate.value,
    slotKey: '',
    roomId: NO_PREF,
    startTime: '',
    endTime: '',
  }
  showAdd.value = true
  await loadSlotOptions()
}

const searchProxyPatients = async (keyword: string) => {
  const res = await httpV2.get(
    API_ENDPOINTS.counselor.proxyBookingPatients,
    { keyword: keyword || undefined },
    { showLoading: false },
  )
  if (res.code === 0 && res.data?.items) {
    proxyPatientSuggestions.value = res.data.items
  }
}

const onProxyPatientInput = (e: { detail: { value: string } }) => {
  proxyPatientKeyword.value = e.detail.value
  if (proxySelectedPatient.value && e.detail.value !== proxySelectedPatient.value.name) {
    proxySelectedPatient.value = null
  }
  showProxyPatientDropdown.value = true
  if (proxyPatientSearchTimer) clearTimeout(proxyPatientSearchTimer)
  proxyPatientSearchTimer = setTimeout(() => searchProxyPatients(proxyPatientKeyword.value.trim()), 300)
}

const selectProxyPatient = (p: ProxyPatientItem) => {
  proxySelectedPatient.value = p
  proxyPatientKeyword.value = p.name
  showProxyPatientDropdown.value = false
}

const isProxyPatientEligible = (p: ProxyPatientItem | null) => {
  if (!p) return false
  if (p.canProxyPush === false) return false
  if (p.canProxyPush === true) return true
  return p.isBoundToCounselor !== false && p.isContractSigned !== false
}

const loadProxySlotOptions = async () => {
  const { centerId, date } = proxyForm.value
  if (!centerId || !date) return
  proxySlotOptionsLoading.value = true
  try {
    const res = await httpV2.get<{ slots: ProxyTimeSlotOpt[] }>(
      API_ENDPOINTS.counselor.proxyBookingSlotOptions,
      { date, center_id: centerId },
      { showLoading: false },
    )
    proxyTimeSlotOptions.value = res.code === 0 && res.data ? res.data.slots || [] : []
  } catch {
    proxyTimeSlotOptions.value = []
  } finally {
    proxySlotOptionsLoading.value = false
  }
}

const proxySlotChipHint = (ts: ProxyTimeSlotOpt) => {
  if (ts.past) return '（已过）'
  if (ts.counselorOccupied && !ts.existingAvailableScheduleId) return '（已预约）'
  if (ts.existingAvailableScheduleId) return '（可约）'
  return ''
}

const openProxyModal = async () => {
  proxySelectedPatient.value = null
  proxyPatientKeyword.value = ''
  proxyPatientSuggestions.value = []
  showProxyPatientDropdown.value = false
  proxyForm.value = {
    centerId: defaultCenterId,
    date: minDate.value,
    slotKey: '',
    roomId: '',
    startTime: '',
    endTime: '',
    scheduleId: null,
  }
  showProxy.value = true
  await Promise.all([searchProxyPatients(''), loadProxySlotOptions()])
}

const onProxyCenterChange = async (id: string) => {
  proxyForm.value.centerId = id
  proxyForm.value.slotKey = ''
  proxyForm.value.roomId = ''
  proxyForm.value.scheduleId = null
  await loadProxySlotOptions()
}

const onProxyDateChange = async (e: { detail: { value: string } }) => {
  proxyForm.value.date = e.detail.value
  proxyForm.value.slotKey = ''
  proxyForm.value.roomId = ''
  proxyForm.value.scheduleId = null
  await loadProxySlotOptions()
}

const selectProxyTimeSlot = (ts: ProxyTimeSlotOpt) => {
  if (!ts.selectable) return
  proxyForm.value.slotKey = ts.key
  proxyForm.value.startTime = ts.startTime
  proxyForm.value.endTime = ts.endTime
  proxyForm.value.scheduleId = ts.existingAvailableScheduleId || null
  proxyForm.value.roomId = ''
}

const selectProxyRoom = (room: RoomOpt) => {
  if (!room.available) return
  proxyForm.value.roomId = room.roomId
}

const submitProxyOrder = async () => {
  if (!proxySelectedPatient.value || proxySubmitting.value) return
  if (!isProxyPatientEligible(proxySelectedPatient.value)) {
    showProxyPatientBlockedModal()
    return
  }
  if (!proxyForm.value.slotKey) {
    uni.showToast({ title: '请选择时间槽', icon: 'none' })
    return
  }
  if (!isProxyVideoCenterSelected.value && !proxyForm.value.roomId) {
    uni.showToast({ title: '请选择咨询室', icon: 'none' })
    return
  }
  proxySubmitting.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.counselor.proxyBookingPushOrder, {
      patient_id: proxySelectedPatient.value.id,
      center_id: proxyForm.value.centerId,
      start_time: proxyForm.value.startTime,
      end_time: proxyForm.value.endTime,
      room_id: isProxyVideoCenterSelected.value ? null : proxyForm.value.roomId,
      schedule_id: proxyForm.value.scheduleId,
    })
    if (res.code !== 0) {
      const msg = res.msg || '推送失败'
      if (msg.includes('签约') || msg.includes('绑定')) {
        showProxyPatientBlockedModal()
      } else {
        uni.showToast({ title: msg, icon: 'none' })
      }
      return
    }
    uni.showToast({ title: '订单已推送', icon: 'success' })
    showProxy.value = false
    await refresh()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '推送失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    proxySubmitting.value = false
  }
}

const closeLeaveNotice = () => {
  showLeaveNotice.value = false
  leaveNoticeSlot.value = null
}

const confirmLeaveNotice = () => {
  const slot = leaveNoticeSlot.value
  closeLeaveNotice()
  if (slot) openCancelBooked(slot)
}

const openCancelBooked = (slot: CalendarSlot) => {
  cancelBookedSlot.value = slot
  cancelBookedSlotText.value = `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`
  cancelBookedPatient.value = slot.patientName || ''
  cancelScreenshotUrl.value = ''
  cancelLeaveReason.value = ''
  cancelBookedTip.value = slot.cancelHint || (
    msUntilStart(slot) > 0 && msUntilStart(slot) < MS_24H
      ? '距咨询开始不足24小时。取消前请与来访者提前沟通并上传沟通截图；提交后须等待管理员审核通过，审核通过后来访者将全额退款，请协助改约。'
      : '距咨询开始超过24小时。取消前请与来访者提前沟通并上传沟通截图；提交后须等待管理员审核通过，审核通过后将释放咨询室、通知来访者并协助改约。'
  )
  showCancelBooked.value = true
}

const closeCancelBooked = () => {
  showCancelBooked.value = false
  cancelBookedSlot.value = null
  cancelScreenshotUrl.value = ''
  cancelLeaveReason.value = ''
}

const pickCancelScreenshot = () => {
  if (cancelScreenshotUploading.value) return
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      cancelScreenshotUploading.value = true
      try {
        const uploadRes = await httpV2.upload(API_ENDPOINTS.upload.file, res.tempFilePaths[0], 'file')
        if (uploadRes.code === 0 && uploadRes.data?.url) {
          cancelScreenshotUrl.value = uploadRes.data.url
        } else {
          uni.showToast({ title: uploadRes.msg || '上传失败', icon: 'none' })
        }
      } finally {
        cancelScreenshotUploading.value = false
      }
    },
  })
}

const confirmCancelBooked = async () => {
  const slot = cancelBookedSlot.value
  const reason = cancelLeaveReason.value.trim()
  if (!slot || !reason) {
    uni.showToast({ title: '请填写请假理由', icon: 'none' })
    return
  }
  if (!cancelScreenshotUrl.value) {
    uni.showToast({ title: '请上传沟通截图', icon: 'none' })
    return
  }
  cancellingBooked.value = true
  try {
    const r = await httpV2.post(API_ENDPOINTS.counselor.scheduleLeaveRequest(slot.id), {
      reason,
      communication_screenshot_url: cancelScreenshotUrl.value,
    })
    if (r.code === 0) {
      closeCancelBooked()
      uni.showToast({
        title: (r.data as { message?: string })?.message || '请假申请已提交，请等待审核',
        icon: 'none',
        duration: 2500,
      })
      await refresh()
    } else {
      uni.showToast({ title: r.msg || '提交失败', icon: 'none' })
    }
  } finally {
    cancellingBooked.value = false
  }
}

const handleCancelSlot = (slot: CalendarSlot) => {
  if (isBookedSlot(slot)) {
    leaveNoticeSlot.value = slot
    leaveNoticeText.value = slot.cancelHint || DEFAULT_BOOKED_LEAVE_HINT
    showLeaveNotice.value = true
    return
  }

  uni.showModal({
    title: '取消排期',
    content: slot.cancelHint || '确认取消该排期？',
    success: async (res) => {
      if (!res.confirm) return
      const r = await httpV2.put(`/api/mini/counselor/schedules/${slot.id}`, { status: 'CANCELLED' })
      if (r.code === 0) {
        uni.showToast({ title: '已取消', icon: 'success' })
        await refresh()
      } else {
        uni.showToast({ title: r.msg || '取消失败', icon: 'none' })
      }
    },
  })
}

const submitSlot = () => {
  if (submitting.value) return
  const { centerId, roomId, startTime, endTime, slotKey } = form.value
  if (!centerId || !slotKey || !startTime || !endTime) {
    uni.showToast({ title: '请选择中心、日期、时间槽和咨询室偏好', icon: 'none' })
    return
  }
  if (!isVideoCenter(centerId) && !roomId) {
    uni.showToast({ title: '请选择咨询室偏好', icon: 'none' })
    return
  }

  // 手势内同步官方订阅（咨询提醒），禁止业务成功后再弹自定义框
  const subscribeDone = tryOfficialRoleSubscribeInGesture('schedule')
  submitting.value = true
  void (async () => {
    try {
      const res = await httpV2.post(API_ENDPOINTS.counselor.schedules, {
        start_time: startTime.slice(0, 19),
        end_time: endTime.slice(0, 19),
        center_id: centerId,
        room_id: isVideoCenter(centerId) ? null : (roomId === NO_PREF ? null : roomId),
      })
      await subscribeDone
      if (res.code === 0) {
        showAdd.value = false
        uni.showToast({ title: '排期成功', icon: 'success' })
        await refresh()
        await loadSlotOptions()
      } else {
        uni.showToast({ title: res.msg || '排期失败', icon: 'none' })
      }
    } catch (err: any) {
      uni.showToast({ title: err?.message || '排期失败', icon: 'none' })
    } finally {
      submitting.value = false
    }
  })()
}

onMounted(() => {
  loadCalendar()
  void refreshSubscribeHint()
  fetchSystemSettings().then(data => {
    proxyOrderTtlMinutes.value = data.proxyOrderTtlMinutes
  })
})

const refresh = async () => {
  if (viewMode.value === 'calendar') await loadMonthCalendar()
  else await loadCalendar()
}

const focusScheduleId = async (scheduleId: number) => {
  if (!scheduleId) return
  await refresh()
  const pool = viewMode.value === 'calendar' ? monthSlots.value : slots.value
  const slot = pool.find(s => s.id === scheduleId)
  if (slot) {
    selectedCalendarDate.value = slot.startTime.slice(0, 10)
    if (viewMode.value === 'calendar' && slot.startTime.slice(0, 7) !== calendarMonth.value) {
      calendarMonth.value = slot.startTime.slice(0, 7)
      await loadMonthCalendar()
    }
  }
  const found = (viewMode.value === 'calendar' ? monthSlots.value : slots.value).find(s => s.id === scheduleId)
  if (found?.leaveRequestId) openLeaveDetail(found)
}

defineExpose({ refresh, focusScheduleId, applyListFilter, getUnrecordedCount })
</script>

<style scoped>
.page-workbench { padding: 32rpx; background: #F7F5F2; min-height: 100vh; padding-bottom: 48rpx; }
.filter-section { margin-bottom: 24rpx; }
.filter-bar {
  display: flex; align-items: center; gap: 12rpx;
  background: #fff; border-radius: 16rpx; padding: 20rpx 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.filter-bar-text { font-size: 28rpx; font-weight: 600; color: #3D5A4E; flex: 1; }
.filter-bar-badge {
  font-size: 22rpx; color: #0D9488; background: #F0FDFA;
  padding: 4rpx 12rpx; border-radius: 999rpx;
}
.filter-bar-arrow { font-size: 22rpx; color: #9CA3AF; }
.filter-panel {
  margin-top: 16rpx; background: #fff; border-radius: 16rpx;
  padding: 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.filter-label {
  display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 12rpx;
}
.filter-label + .filter-chips { margin-bottom: 20rpx; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.filter-chip {
  padding: 10rpx 24rpx; border-radius: 999rpx; font-size: 24rpx;
  color: #6B7280; background: #F3F4F6; border: 1rpx solid transparent;
}
.filter-chip.active {
  background: #E8E4DE; color: #3D5A4E; border-color: #3D5A4E; font-weight: 600;
}
.filter-reset {
  display: block; text-align: center; font-size: 24rpx; color: #8A7560; margin-top: 8rpx;
}
.mode-switch {
  display: flex; gap: 16rpx; margin-bottom: 24rpx;
}
.mode-chip {
  flex: 1; text-align: center; padding: 18rpx 0; border-radius: 999rpx;
  font-size: 26rpx; font-weight: 600; color: #6B6560; background: #fff;
  border: 1rpx solid #E8E4DE;
}
.mode-chip.active {
  background: #3D5A4E; color: #fff; border-color: #3D5A4E;
}
.calendar-section {
  background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.calendar-nav {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx;
}
.cal-nav-btn {
  width: 64rpx; height: 64rpx; line-height: 64rpx; text-align: center;
  font-size: 40rpx; color: #3D5A4E; background: #F0EDE8; border-radius: 50%;
}
.cal-month-title { font-size: 30rpx; font-weight: 700; color: #2C2C2C; }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 8rpx; }
.cal-weekday { text-align: center; font-size: 22rpx; color: #9CA3AF; padding: 8rpx 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8rpx; }
.cal-cell {
  min-height: 88rpx; border-radius: 12rpx; padding: 8rpx 4rpx;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
}
.cal-cell.empty { background: transparent; }
.cal-cell.today { background: #F0FDFA; }
.cal-cell.selected { background: #E8E4DE; border: 2rpx solid #3D5A4E; }
.cal-day-num { font-size: 26rpx; font-weight: 600; color: #374151; }
.cal-dots { display: flex; gap: 4rpx; margin-top: 8rpx; flex-wrap: wrap; justify-content: center; }
.cal-dot { width: 10rpx; height: 10rpx; border-radius: 50%; }
.cal-selected-label {
  display: block; margin-top: 20rpx; font-size: 26rpx; font-weight: 600; color: #3D5A4E;
}
.slot-record-btn {
  font-size: 22rpx; color: #fff; background: #3D5A4E;
  padding: 8rpx 16rpx; border-radius: 8rpx; white-space: nowrap;
}
.header-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx; padding: 40rpx; margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);
}
.greeting { display: block; font-size: 36rpx; font-weight: 600; color: #fff; letter-spacing: 2rpx; }
.date-text { font-size: 24rpx; color: rgba(255,255,255,0.8); margin-top: 8rpx; }
.legend-card {
  display: flex; flex-wrap: wrap; gap: 16rpx 24rpx;
  background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.legend-item { display: flex; align-items: center; gap: 8rpx; }
.legend-icon { font-size: 28rpx; }
.legend-text { font-size: 22rpx; color: #5A5A5A; }
.toolbar { margin-bottom: 24rpx; }
.toolbar-btns {
  display: flex;
  gap: 16rpx;
}
.toolbar-btn {
  flex: 1;
  border-radius: 12rpx;
  height: 84rpx;
  line-height: 84rpx;
  font-size: 28rpx;
  border: none;
}
.add-btn {
  background: #3D5A4E;
  color: #fff;
}
.proxy-btn {
  background: #fff;
  color: #3D5A4E;
  border: 2rpx solid #3D5A4E;
}
.toolbar-btn::after { border: none; }
.toolbar-tip { display: block; font-size: 22rpx; color: #8A8A8A; margin-top: 12rpx; text-align: center; line-height: 1.5; }
.day-section { margin-bottom: 28rpx; }
.day-title { display: block; font-size: 28rpx; font-weight: 600; color: #2C2C2C; margin-bottom: 12rpx; }
.slot-card {
  border-radius: 20rpx; padding: 24rpx; margin-bottom: 12rpx;
  display: flex; justify-content: space-between; align-items: center;
}
.slot-card--clickable { cursor: pointer; }
.slot-left { display: flex; gap: 16rpx; align-items: flex-start; flex: 1; }
.slot-icon { font-size: 36rpx; }
.slot-time { display: block; font-size: 30rpx; font-weight: 700; color: #1F2937; }
.slot-center, .slot-patient { display: block; font-size: 22rpx; color: #6B7280; margin-top: 4rpx; }
.slot-room { display: block; font-size: 22rpx; color: #0D9488; margin-top: 4rpx; font-weight: 600; }
.slot-right {
  display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx;
  flex-shrink: 0; min-width: 120rpx;
}
.slot-status { font-size: 24rpx; font-weight: 700; }
.slot-cancel {
  font-size: 22rpx; color: #8A7560;
  padding: 6rpx 16rpx; border-radius: 8rpx;
  border: 1rpx solid #D4C4B0; background: #FAF7F3;
}
.slot-detail-hint { font-size: 20rpx; color: #C2410C; }
.detail-card {
  width: 100%; max-width: 640rpx; background: #fff;
  border-radius: 32rpx; padding: 48rpx 40rpx 40rpx;
}
.detail-block { margin-bottom: 24rpx; text-align: left; }
.detail-label { display: block; font-size: 24rpx; color: #9CA3AF; margin-bottom: 8rpx; }
.detail-value { display: block; font-size: 28rpx; color: #374151; line-height: 1.6; }
.detail-reason { white-space: pre-wrap; }
.detail-close { margin-top: 16rpx; width: 100%; }
.cancel-booked-card {
  width: 100%; max-width: 640rpx; background: #fff;
  border-radius: 32rpx; padding: 48rpx 40rpx 40rpx;
}
.cancel-booked-tip {
  display: block; font-size: 28rpx; color: #4B5563; line-height: 1.6;
  margin-bottom: 24rpx; text-align: left;
}
.reason-section { margin-bottom: 24rpx; text-align: left; }
.leave-reason-input {
  width: 100%; box-sizing: border-box; min-height: 180rpx; margin-top: 12rpx;
  font-size: 28rpx; background: #F9FAFB; border-radius: 12rpx; padding: 20rpx;
  border: 1rpx solid #E5E7EB;
}
.reason-counter {
  display: block; text-align: right; font-size: 22rpx; color: #9CA3AF; margin-top: 8rpx;
}
.upload-section { margin-bottom: 32rpx; text-align: left; }
.screenshot-upload {
  margin-top: 12rpx; padding: 48rpx 24rpx; background: #F9FAFB;
  border: 2rpx dashed #D1D5DB; border-radius: 16rpx; text-align: center;
}
.screenshot-upload-text { font-size: 28rpx; color: #3D5A4E; }
.screenshot-preview { margin-top: 12rpx; text-align: center; }
.screenshot-img {
  width: 100%; max-height: 360rpx; border-radius: 12rpx; background: #F3F4F6;
}
.screenshot-repick { display: block; font-size: 24rpx; color: #6B7280; margin-top: 12rpx; }
.notice-btn[disabled] { opacity: 0.45; }
.notice-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 48rpx 32rpx;
}
.notice-card {
  width: 100%; max-width: 600rpx; background: #fff;
  border-radius: 32rpx; padding: 48rpx 40rpx 40rpx; text-align: center;
}
.notice-title { display: block; font-size: 34rpx; font-weight: 800; color: #1F2937; margin-bottom: 24rpx; }
.notice-content { display: block; font-size: 28rpx; color: #4B5563; line-height: 1.6; margin-bottom: 40rpx; text-align: left; }
.notice-btns { display: flex; gap: 20rpx; }
.notice-btn {
  flex: 1; height: 84rpx; line-height: 84rpx;
  border-radius: 100rpx; font-size: 28rpx; border: none;
}
.notice-btn.primary { background: #3D5A4E; color: #fff; }
.notice-btn.secondary { background: #F3F4F6; color: #6B7280; }
.empty-slot-row {
  display: flex; align-items: center; gap: 12rpx;
  background: #F9FAFB; border-radius: 16rpx; padding: 20rpx 24rpx; margin-bottom: 12rpx;
  border: 2rpx dashed #E5E7EB;
}
.empty-slot-icon { font-size: 28rpx; }
.empty-slot-text { font-size: 24rpx; color: #9CA3AF; }
.empty-card { background: #fff; border-radius: 20rpx; padding: 48rpx; text-align: center; }
.empty-text { font-size: 26rpx; color: #9CA3AF; }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: flex-end; z-index: 100;
}
.modal-card {
  width: 100%; background: #fff; border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 32rpx 48rpx; max-height: 85vh; overflow-y: auto;
}
.modal-title { font-size: 34rpx; font-weight: 800; color: #1F2937; }
.modal-sub { display: block; font-size: 24rpx; color: #9CA3AF; margin: 8rpx 0 24rpx; }
.form-item { margin-bottom: 24rpx; }
.form-label { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 12rpx; }
.video-hint-text {
  display: block; font-size: 26rpx; color: #6B7280; line-height: 1.6;
  background: #F0FDFA; border-radius: 12rpx; padding: 20rpx;
}
.center-row { display: flex; gap: 16rpx; flex-wrap: wrap; }
.center-chip, .slot-chip {
  padding: 12rpx 28rpx; border-radius: 100rpx; background: #F3F4F6;
  font-size: 26rpx; color: #374151;
}
.center-chip.active, .slot-chip.active { background: #E8E4DE; color: #3D5A4E; font-weight: 600; }
.center-chip.disabled, .slot-chip.disabled { opacity: 0.45; }
.slot-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.form-hint { display: block; margin-top: 12rpx; font-size: 23rpx; color: #6B7280; line-height: 1.5; }
.duration-card {
  margin-bottom: 24rpx; padding: 22rpx 24rpx; border-radius: 16rpx;
  background: #ECFDF5; border: 2rpx solid #A7F3D0;
}
.duration-title { display: block; font-size: 24rpx; color: #047857; margin-bottom: 6rpx; }
.duration-text { display: block; font-size: 26rpx; font-weight: 600; color: #065F46; }
.picker-row {
  background: #F9FAFB; padding: 20rpx 24rpx; border-radius: 16rpx; font-size: 28rpx;
}
.modal-btns { display: flex; gap: 20rpx; margin-top: 16rpx; }
.modal-btn { flex: 1; height: 84rpx; line-height: 84rpx; border-radius: 100rpx; font-size: 28rpx; }
.modal-btn.cancel { background: #F3F4F6; color: #6B7280; }
.modal-btn.confirm { background: #3D5A4E; color: #fff; }
.patient-input {
  width: 100%;
  box-sizing: border-box;
  height: 72rpx;
  padding: 0 20rpx;
  background: #F9FAFB;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: 1rpx solid #E5E7EB;
}
.patient-dropdown {
  margin-top: 8rpx;
  background: #fff;
  border: 1rpx solid #E5E7EB;
  border-radius: 12rpx;
  max-height: 320rpx;
  overflow-y: auto;
}
.patient-dropdown-item {
  padding: 20rpx 24rpx;
  font-size: 26rpx;
  color: #374151;
  border-bottom: 1rpx solid #F3F4F6;
}
.patient-dropdown-item:active { background: #F9FAFB; }
.patient-dropdown-item.disabled { color: #9CA3AF; }
.selected-patient-tag {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #0D9488;
}
.proxy-patient-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9CA3AF;
}
.required { color: #EF4444; }
.slot-chip.available { border: 2rpx solid #10B981; }
</style>
