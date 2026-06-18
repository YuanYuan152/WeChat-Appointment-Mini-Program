<template>
  <view class="page-workbench">
    <view class="header-card">
      <view>
        <text class="greeting">咨询师工作台</text>
        <text class="date-text">滚动7天：{{ rollingRangeText }}</text>
      </view>
    </view>

    <view class="legend-card">
      <view v-for="item in legend" :key="item.key" class="legend-item">
        <text class="legend-icon">{{ item.icon }}</text>
        <text class="legend-text">{{ item.label }}</text>
      </view>
    </view>

    <view class="toolbar">
      <button class="add-btn" @tap="openAddModal">+ 新建挂课</button>
      <text class="toolbar-tip">{{ toolbarTip }}</text>
    </view>

    <view v-if="loading" class="empty-card"><text class="empty-text">加载中...</text></view>

    <view v-for="day in groupedDays" v-else :key="day.date" class="day-section">
      <text class="day-title">{{ day.label }}</text>
      <view v-if="day.slots.length === 0" class="empty-slot-row">
        <text class="empty-slot-icon">⬜</text>
        <text class="empty-slot-text">本日暂无挂课</text>
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
            <text v-if="slot.patientName" class="slot-patient">来访者：{{ slot.patientName }}</text>
          </view>
        </view>
        <view class="slot-right">
          <text class="slot-status" :style="{ color: meta(slot.displayStatus).color }">{{ slot.displayLabel }}</text>
          <text v-if="slot.leaveRequestId" class="slot-detail-hint">点击查看请假详情</text>
          <text v-if="showCancelAction(slot)" class="slot-cancel" @tap.stop="handleCancelSlot(slot)">
            {{ cancelActionLabel(slot) }}
          </text>
        </view>
      </view>
    </view>

    <!-- 新建挂课 -->
    <view v-if="showAdd" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">新建挂课</text>
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
          <text class="form-label">时间槽</text>
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
            >{{ ts.label }}{{ ts.counselorOccupied ? '（已挂）' : '' }}</view>
          </view>
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
            {{ submitting ? '保存中...' : '保存挂课' }}
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
        <text class="notice-title">{{ cancelBookedIsLeave ? '请假（取消已预约）' : '取消已预约挂课' }}</text>
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
          >{{ cancellingBooked ? '提交中...' : (cancelBookedIsLeave ? '确认请假' : '确认取消') }}</button>
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
import { formatDateLocal, ROLLING_WINDOW_DAYS, addDays } from '@/constants/scheduleSlots'

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
  consultationId?: number
  canCancel?: boolean
  requiresLeave?: boolean
  cancelHint?: string
  leaveRequestId?: number
  leaveReason?: string
  leaveSubmittedAt?: string
  leaveStatus?: string
}

const NO_PREF = '__none__'
const MS_24H = 24 * 60 * 60 * 1000

const DEFAULT_BOOKED_LEAVE_HINT =
  '取消前请与来访者提前沟通，填写请假理由并上传沟通截图。取消成功后将释放咨询室、通知来访者并协助改约。'

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

const cancelActionLabel = (slot: CalendarSlot) => (isBookedSlot(slot) ? '请假' : '取消挂课')

const loading = ref(true)
const slots = ref<CalendarSlot[]>([])
const showAdd = ref(false)
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
const cancelBookedIsLeave = ref(false)
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
    ? '标准时间槽 50 分钟/节；视频咨询不占咨询室，来访者预约成功后线上进行'
    : '标准时间槽 50 分钟/节；线下中心挂课可设咨询室偏好，付款后才占用咨询室',
)

const addModalSub = computed(() =>
  isVideoCenterSelected.value
    ? '仅可挂今天起 7 天内未开始的标准时段（视频咨询）'
    : '仅可挂今天起 7 天内未开始的标准时段',
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

const legend = Object.entries(SCHEDULE_DISPLAY_META).map(([key, v]) => ({
  key,
  icon: v.icon,
  label: v.label,
}))

const meta = (status: ScheduleDisplayStatus) =>
  SCHEDULE_DISPLAY_META[status] || SCHEDULE_DISPLAY_META.OPEN

const rollingRangeText = computed(() => `${minDate.value} ~ ${maxDate.value}`)

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

const groupedDays = computed(() => {
  const today = minDate.value
  const byDate = new Map<string, CalendarSlot[]>()
  for (const s of slots.value) {
    if (s.displayStatus === 'CANCELLED') continue
    const date = s.startTime.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(s)
  }
  const days: { date: string; label: string; slots: CalendarSlot[] }[] = []
  for (let i = 0; i < ROLLING_WINDOW_DAYS; i++) {
    const d = new Date(`${today}T00:00:00`)
    d.setDate(d.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const date = `${y}-${m}-${day}`
    const daySlots = (byDate.get(date) || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime))
    days.push({ date, label: weekdayLabel(date), slots: daySlots })
  }
  return days
})

const selectedTimeSlot = computed(() =>
  timeSlotOptions.value.find(t => t.key === form.value.slotKey) || null,
)

const roomOptionsForSlot = computed(() => selectedTimeSlot.value?.rooms || [])

const loadCalendar = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<{ slots: CalendarSlot[] }>(
      API_ENDPOINTS.counselor.scheduleCalendar,
      { start: minDate.value, days: ROLLING_WINDOW_DAYS },
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
    uni.showToast({ title: '您在该时间槽已有挂课', icon: 'none' })
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
  const within24h = msUntilStart(slot) > 0 && msUntilStart(slot) < MS_24H
  cancelBookedIsLeave.value = within24h
  cancelBookedTip.value = slot.cancelHint || (
    within24h
      ? '距咨询开始不足24小时。取消前请与来访者提前沟通并上传沟通截图；取消后不予退款，将释放咨询室并协助来访者改约。'
      : '距咨询开始超过24小时。取消前请与来访者提前沟通并上传沟通截图；取消后将释放咨询室、通知来访者并协助改约。'
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
    const r = await httpV2.put(`/api/mini/counselor/schedules/${slot.id}`, {
      status: 'CANCELLED',
      leave_reason: reason,
      communication_screenshot_url: cancelScreenshotUrl.value,
    })
    if (r.code === 0) {
      closeCancelBooked()
      uni.showToast({
        title: cancelBookedIsLeave.value ? '请假成功' : '已取消',
        icon: 'success',
      })
      await loadCalendar()
    } else {
      uni.showToast({ title: r.msg || '取消失败', icon: 'none' })
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
    title: '取消挂课',
    content: slot.cancelHint || '确认取消该挂课？',
    success: async (res) => {
      if (!res.confirm) return
      const r = await httpV2.put(`/api/mini/counselor/schedules/${slot.id}`, { status: 'CANCELLED' })
      if (r.code === 0) {
        uni.showToast({ title: '已取消', icon: 'success' })
        await loadCalendar()
      } else {
        uni.showToast({ title: r.msg || '取消失败', icon: 'none' })
      }
    },
  })
}

const submitSlot = async () => {
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

  submitting.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.counselor.schedules, {
      start_time: startTime.slice(0, 19),
      end_time: endTime.slice(0, 19),
      center_id: centerId,
      room_id: isVideoCenter(centerId) ? null : (roomId === NO_PREF ? null : roomId),
    })
    if (res.code === 0) {
      showAdd.value = false
      uni.showToast({ title: '挂课成功', icon: 'success' })
      await loadCalendar()
      await loadSlotOptions()
    } else {
      uni.showToast({ title: res.msg || '挂课失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '挂课失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onMounted(loadCalendar)
defineExpose({ refresh: loadCalendar })
</script>

<style scoped>
.page-workbench { padding: 32rpx; background: #F7F5F2; min-height: 100vh; padding-bottom: 48rpx; }
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
.add-btn {
  width: 100%; background: #3D5A4E; color: #fff;
  border-radius: 12rpx; height: 84rpx; line-height: 84rpx; font-size: 30rpx; border: none;
}
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
.picker-row {
  background: #F9FAFB; padding: 20rpx 24rpx; border-radius: 16rpx; font-size: 28rpx;
}
.modal-btns { display: flex; gap: 20rpx; margin-top: 16rpx; }
.modal-btn { flex: 1; height: 84rpx; line-height: 84rpx; border-radius: 100rpx; font-size: 28rpx; }
.modal-btn.cancel { background: #F3F4F6; color: #6B7280; }
.modal-btn.confirm { background: #3D5A4E; color: #fff; }
</style>
