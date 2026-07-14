<template>
  <view class="page-proxy">
    <view class="header-card">
      <text class="page-title">代理预约</text>
      <text class="page-sub">为来访推送待支付订单，{{ proxyOrderPayHint }}</text>
    </view>

    <view class="selector-card">
      <view class="selector-item">
        <text class="selector-label">当前来访</text>
        <input
          class="selector-input"
          placeholder="输入姓名/手机号搜索"
          :value="patientKeyword"
          @input="onPatientInput"
          @focus="showPatientDropdown = true"
        />
        <view v-if="showPatientDropdown && patientSuggestions.length" class="dropdown">
          <view
            v-for="p in patientSuggestions"
            :key="p.id"
            class="dropdown-item"
            @tap="selectPatient(p)"
          >
            {{ p.label || formatPatientInline(p.name, p.contractTag) }}
          </view>
        </view>
        <text v-if="selectedPatient" class="selected-tag">已选：{{ formatPatientInline(selectedPatient.name, selectedPatient.contractTag) }}</text>
      </view>

      <view v-if="selectedPatient" class="selector-item">
        <text class="selector-label">签约状态</text>
        <text class="contract-status" :class="{ signed: patientContractSigned }">
          {{ patientContractSigned ? '已签约' : '未签约' }}
        </text>
      </view>

      <view class="selector-item">
        <text class="selector-label">绑定咨询师</text>
        <text v-if="selectedCounselor" class="bound-counselor">{{ selectedCounselor.name }}</text>
        <text v-else class="bound-empty">来访尚未绑定咨询师，请先在来访者详情中绑定</text>
      </view>
    </view>

    <view v-if="!canShowSchedule" class="empty-card">
      <text class="empty-text">{{ scheduleEmptyHint }}</text>
    </view>

    <template v-else>
      <view class="mode-switch">
        <view class="mode-chip" :class="{ active: viewMode === 'list' }" @tap="viewMode = 'list'">普通模式</view>
        <view class="mode-chip" :class="{ active: viewMode === 'calendar' }" @tap="switchCalendar">日历模式</view>
      </view>

      <view class="legend-card">
        <view v-for="item in legend" :key="item.key" class="legend-item">
          <text class="legend-icon">{{ item.icon }}</text>
          <text class="legend-text">{{ item.label }}</text>
        </view>
      </view>

      <view class="toolbar">
        <button class="add-btn" @tap="openAddModal">+ 代理预约</button>
      </view>

      <view v-if="loading" class="empty-card">
        <text class="empty-text">加载中...</text>
      </view>
      <view v-else-if="viewMode === 'list' && slots.length === 0" class="empty-card">
        <text class="empty-text">该咨询师暂无排期，可点击「代理预约」新建</text>
      </view>
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
                past: cell.isPast,
              }"
              @tap="!cell.empty && !cell.isPast && selectCalendarDate(cell.date!)"
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
        </view>

        <view v-for="day in displayDaySections" :key="day.date" class="day-section">
          <text v-if="viewMode === 'list'" class="day-title">{{ day.label }}</text>
          <view v-if="day.slots.length === 0" class="empty-slot-row">
            <text class="empty-slot-text">本日暂无排期</text>
          </view>
          <view
            v-for="slot in day.slots"
            :key="slot.id"
            class="slot-card"
            :style="{ background: meta(slot.displayStatus).bg }"
          >
            <view class="slot-left">
              <text class="slot-icon">{{ meta(slot.displayStatus).icon }}</text>
              <view>
                <text class="slot-time">{{ formatTime(slot.startTime) }} – {{ formatTime(slot.endTime) }}</text>
                <text v-if="slot.centerName" class="slot-center">{{ slot.centerName }}</text>
                <text v-if="slot.roomName" class="slot-room">{{ slot.roomName }}</text>
                <text v-if="slot.patientName" class="slot-patient">来访者：{{ formatPatientInline(slot.patientName, slot.patientContractTag) }}</text>
              </view>
            </view>
            <text class="slot-status" :style="{ color: meta(slot.displayStatus).color }">
              {{ slot.displayLabel }}
            </text>
          </view>
        </view>
      </template>
    </template>

    <view v-if="showAdd" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop>
        <text class="modal-title">代理预约</text>
        <text class="modal-sub">选择预约中心、日期、时间槽与咨询室，推送后{{ proxyOrderPayHint }}</text>

        <view class="form-item">
          <text class="form-label">预约中心</text>
          <view class="center-row">
            <view
              v-for="c in centers"
              :key="c.id"
              class="center-chip"
              :class="{ active: form.centerId === c.id }"
              @tap="onCenterChange(c.id)"
            >
              {{ c.name }}
            </view>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">日期</text>
          <picker mode="date" :value="form.date" :start="minDate" :end="maxDate" @change="onDateChange">
            <view class="picker-row">{{ form.date || '选择日期' }}</view>
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
                disabled: !ts.selectable,
                available: ts.selectable && !!ts.existingAvailableScheduleId,
              }"
              @tap="selectTimeSlot(ts)"
            >
              {{ ts.label }}{{ slotChipHint(ts) }}
            </view>
          </view>
        </view>

        <view v-if="!isVideoCenterSelected" class="form-item">
          <text class="form-label">咨询室（必选）</text>
          <view class="center-row">
            <view
              v-for="room in roomOptionsForSlot"
              :key="room.roomId"
              class="center-chip"
              :class="{
                active: form.roomId === room.roomId,
                disabled: !room.available,
              }"
              @tap="selectRoom(room)"
            >
              {{ room.roomName }}{{ room.occupiedByOther ? '（已占用）' : '' }}
            </view>
          </view>
        </view>
        <view v-else class="form-item">
          <text class="video-hint">视频咨询无需选择咨询室</text>
        </view>

        <view v-if="!patientContractSigned" class="form-item">
          <text class="form-label">签约协议 <text class="required">*</text></text>
          <text class="form-hint">未签约来访需选择推送的协议，来访支付前将按此协议签署</text>
          <view class="center-row agreement-row">
            <view
              class="center-chip"
              :class="{ active: form.agreementIsAdult === true }"
              @tap="form.agreementIsAdult = true"
            >{{ tongxinAgreementTitle }}</view>
            <view
              class="center-chip"
              :class="{ active: form.agreementIsAdult === false }"
              @tap="form.agreementIsAdult = false"
            >{{ yangfanAgreementTitle }}</view>
          </view>
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap="showAdd = false">取消</button>
          <button class="modal-btn confirm" :disabled="submitting || !canPushOrder" @tap="submitProxyOrder">
            {{ submitting ? '推送中...' : '推送订单' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { APPOINTMENT_CENTERS, isVideoCenter } from '@/constants/appointmentCenters'
import { SCHEDULE_DISPLAY_META, type ScheduleDisplayStatus } from '@/constants/scheduleDisplay'
import { formatDateLocal, ROLLING_WINDOW_DAYS, addDays } from '@/constants/scheduleSlots'
import { formatPatientInline } from '@/utils/patientContract'
import { fetchSystemSettings, formatProxyOrderPushHint } from '@/utils/systemSettings'
import {
  TONGXIN_AGREEMENT_TITLE,
  YANGFAN_AGREEMENT_TITLE,
} from '@/utils/consultationAgreement'

const tongxinAgreementTitle = TONGXIN_AGREEMENT_TITLE
const yangfanAgreementTitle = YANGFAN_AGREEMENT_TITLE

const proxyOrderTtlMinutes = ref(120)
const proxyOrderPayHint = computed(() => formatProxyOrderPushHint(proxyOrderTtlMinutes.value))

const loadSystemSettings = async () => {
  const data = await fetchSystemSettings()
  proxyOrderTtlMinutes.value = data.proxyOrderTtlMinutes
}

onShow(() => {
  loadSystemSettings()
})

const defaultCenterId = 'yangpu'
const weekdayHeaders = ['一', '二', '三', '四', '五', '六', '日']

const DOT_COLORS: Record<string, string> = {
  OPEN: '#7A5C3A',
  BOOKED: '#1F4034',
  PENDING_PAYMENT: '#9CA3AF',
  ON_LEAVE: '#C2410C',
  DONE: '#6B7280',
  EXPIRED: '#9CA3AF',
  CANCELLED: '#D1D5DB',
}

interface PersonItem {
  id: number
  name: string
  label?: string
  contractTag?: string | null
  isContractSigned?: boolean
  boundCounselorId?: number | null
  boundCounselorName?: string | null
}

interface CalendarSlot {
  id: number
  startTime: string
  endTime: string
  displayStatus: ScheduleDisplayStatus
  displayLabel: string
  centerName?: string
  roomName?: string
  patientName?: string
  patientContractTag?: string
}

interface RoomOption {
  roomId: string
  roomName: string
  available: boolean
  occupiedByOther?: boolean
}

interface TimeSlotOption {
  key: string
  label: string
  selectable: boolean
  past?: boolean
  counselorOccupied?: boolean
  existingAvailableScheduleId?: number | null
  startTime: string
  endTime: string
  rooms?: RoomOption[]
}

interface CalendarCell {
  empty: boolean
  date?: string
  day?: number
  isToday?: boolean
  isSelected?: boolean
  isPast?: boolean
  dots?: ScheduleDisplayStatus[]
}

const centers = APPOINTMENT_CENTERS

const patientKeyword = ref('')
const patientSuggestions = ref<PersonItem[]>([])
const selectedPatient = ref<PersonItem | null>(null)
const selectedCounselor = ref<PersonItem | null>(null)
const showPatientDropdown = ref(false)
const loading = ref(false)
const viewMode = ref<'list' | 'calendar'>('list')
const calendarMonth = ref(formatDateLocal().slice(0, 7))
const selectedCalendarDate = ref(formatDateLocal())
const monthSlots = ref<CalendarSlot[]>([])
const slots = ref<CalendarSlot[]>([])
const showAdd = ref(false)
const submitting = ref(false)
const slotOptionsLoading = ref(false)
const timeSlotOptions = ref<TimeSlotOption[]>([])

const minDate = computed(() => formatDateLocal())
const maxDate = computed(() => addDays(minDate.value, ROLLING_WINDOW_DAYS - 1))
const canShowSchedule = computed(() => !!selectedPatient.value && !!selectedCounselor.value)
const patientContractSigned = computed(() => !!selectedPatient.value?.isContractSigned)
const scheduleEmptyHint = computed(() => {
  if (!selectedPatient.value) return '请先选择来访'
  if (!selectedCounselor.value) return '该来访尚未绑定咨询师，请先在来访者详情中绑定'
  return ''
})
const canPushOrder = computed(() => {
  if (!form.value.slotKey) return false
  if (!isVideoCenterSelected.value && !form.value.roomId) return false
  if (!patientContractSigned.value && form.value.agreementIsAdult === null) return false
  return true
})
const isVideoCenterSelected = computed(() => isVideoCenter(form.value.centerId))

const form = ref({
  centerId: defaultCenterId,
  date: formatDateLocal(),
  slotKey: '',
  roomId: '',
  startTime: '',
  endTime: '',
  scheduleId: null as number | null,
  agreementIsAdult: null as boolean | null,
})

let patientSearchTimer: ReturnType<typeof setTimeout> | null = null

const legend = Object.entries(SCHEDULE_DISPLAY_META).map(([key, v]) => ({
  key,
  icon: v.icon,
  label: v.label,
}))

const meta = (status: ScheduleDisplayStatus) =>
  SCHEDULE_DISPLAY_META[status] || SCHEDULE_DISPLAY_META.OPEN

const formatTime = (iso: string) => (iso ? iso.replace('T', ' ').slice(11, 16) : '')

const weekdayLabel = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`)
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${dateStr} ${names[d.getDay()]}`
}

const calendarMonthLabel = computed(() => {
  const [y, m] = calendarMonth.value.split('-').map(Number)
  return `${y}年${m}月`
})

const groupedDays = computed(() => {
  const today = minDate.value
  const byDate = new Map<string, CalendarSlot[]>()
  for (const s of slots.value) {
    if (s.displayStatus === 'CANCELLED') continue
    const date = s.startTime.slice(0, 10)
    if (date < today) continue
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(s)
  }
  return Array.from(byDate.keys())
    .sort()
    .map((date) => ({
      date,
      label: weekdayLabel(date),
      slots: byDate.get(date)!.slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
})

const slotsForDate = (source: CalendarSlot[], date: string) =>
  source
    .filter((s) => s.startTime.slice(0, 10) === date && s.displayStatus !== 'CANCELLED')
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

const displayDaySections = computed(() => {
  if (viewMode.value === 'list') return groupedDays.value
  if (!selectedCalendarDate.value) return []
  return [
    {
      date: selectedCalendarDate.value,
      label: weekdayLabel(selectedCalendarDate.value),
      slots: slotsForDate(monthSlots.value, selectedCalendarDate.value),
    },
  ]
})

const calendarCells = computed((): CalendarCell[] => {
  const [y, m] = calendarMonth.value.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0).getDate()
  const startPad = (first.getDay() + 6) % 7
  const today = formatDateLocal()
  const cells: CalendarCell[] = []
  for (let i = 0; i < startPad; i++) cells.push({ empty: true })
  for (let d = 1; d <= lastDay; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      empty: false,
      date,
      day: d,
      isToday: date === today,
      isSelected: date === selectedCalendarDate.value,
      isPast: date < today,
      dots: Array.from(
        new Set(slotsForDate(monthSlots.value, date).map((s) => s.displayStatus))
      ).slice(0, 4),
    })
  }
  return cells
})

const dotColor = (status: ScheduleDisplayStatus) => DOT_COLORS[status] || '#9CA3AF'

const roomOptionsForSlot = computed(() => {
  const ts = timeSlotOptions.value.find((t) => t.key === form.value.slotKey)
  return ts?.rooms || []
})

const slotChipHint = (ts: TimeSlotOption) => {
  if (ts.past) return '（已过）'
  if (ts.counselorOccupied && !ts.existingAvailableScheduleId) return '（已预约）'
  if (ts.existingAvailableScheduleId) return '（可约）'
  return ''
}

const syncBoundCounselor = (p: PersonItem) => {
  if (p.boundCounselorId && p.boundCounselorName) {
    selectedCounselor.value = {
      id: p.boundCounselorId,
      name: p.boundCounselorName,
    }
    loadSchedules()
  } else {
    selectedCounselor.value = null
    slots.value = []
    monthSlots.value = []
  }
}

const searchPatients = async (keyword: string) => {
  const res = await httpV2.get(
    API_ENDPOINTS.admin.proxyBookingPatients,
    { keyword: keyword || undefined },
    { showLoading: false }
  )
  if (res.code === 0 && res.data?.items) patientSuggestions.value = res.data.items
}

const onPatientInput = (e: { detail: { value: string } }) => {
  patientKeyword.value = e.detail.value
  showPatientDropdown.value = true
  if (patientSearchTimer) clearTimeout(patientSearchTimer)
  patientSearchTimer = setTimeout(() => searchPatients(patientKeyword.value.trim()), 300)
}

const selectPatient = (p: PersonItem) => {
  selectedPatient.value = p
  patientKeyword.value = p.name
  showPatientDropdown.value = false
  syncBoundCounselor(p)
}

const applyPatient = async (id: number, fallbackName?: string) => {
  try {
    const res = await httpV2.get<{
      name?: string
      isContractSigned?: boolean
      boundCounselorId?: number | null
      boundCounselorName?: string | null
      contractTag?: string | null
    }>(API_ENDPOINTS.admin.patientDetail(id), undefined, { showLoading: false, showError: false })
    if (res.code === 0 && res.data) {
      const d = res.data
      selectPatient({
        id,
        name: d.name || fallbackName || `来访#${id}`,
        contractTag: d.contractTag,
        isContractSigned: !!d.isContractSigned,
        boundCounselorId: d.boundCounselorId ?? null,
        boundCounselorName: d.boundCounselorName ?? null,
      })
      return
    }
  } catch {
    // fallback below
  }
  selectPatient({
    id,
    name: fallbackName || `来访#${id}`,
    isContractSigned: false,
    boundCounselorId: null,
    boundCounselorName: null,
  })
}

const loadSchedules = async () => {
  if (!selectedCounselor.value) return
  loading.value = true
  try {
    const res = await httpV2.get(
      API_ENDPOINTS.admin.proxyBookingCalendar,
      { counselor_id: selectedCounselor.value.id, start: minDate.value },
      { showLoading: false, showError: false }
    )
    if (res.code === 0 && res.data) {
      slots.value = res.data.slots || []
    } else {
      slots.value = []
      uni.showToast({ title: res.msg || '加载排期失败', icon: 'none' })
    }
  } catch {
    slots.value = []
    uni.showToast({ title: '加载排期失败，请重启后端后重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const loadMonthSlots = async () => {
  if (!selectedCounselor.value) return
  const res = await httpV2.get(
    API_ENDPOINTS.admin.proxyBookingCalendar,
    { counselor_id: selectedCounselor.value.id, month: calendarMonth.value },
    { showLoading: false }
  )
  if (res.code === 0 && res.data) monthSlots.value = res.data.slots || []
}

const switchCalendar = async () => {
  viewMode.value = 'calendar'
  await loadMonthSlots()
}

const shiftMonth = async (delta: number) => {
  const [y, m] = calendarMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  calendarMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  await loadMonthSlots()
}

const selectCalendarDate = (date: string) => {
  selectedCalendarDate.value = date
}

const loadSlotOptions = async () => {
  if (!selectedCounselor.value || !form.value.date || !form.value.centerId) return
  slotOptionsLoading.value = true
  try {
    const res = await httpV2.get(
      API_ENDPOINTS.admin.proxyBookingSlotOptions,
      {
        counselor_id: selectedCounselor.value.id,
        date: form.value.date,
        center_id: form.value.centerId,
      }
    )
    if (res.code === 0 && res.data) timeSlotOptions.value = res.data.slots || []
  } finally {
    slotOptionsLoading.value = false
  }
}

const openAddModal = () => {
  if (!selectedPatient.value || !selectedCounselor.value) {
    uni.showToast({ title: '请先选择已绑定咨询师的来访', icon: 'none' })
    return
  }
  form.value = {
    centerId: defaultCenterId,
    date: formatDateLocal(),
    slotKey: '',
    roomId: '',
    startTime: '',
    endTime: '',
    scheduleId: null,
    agreementIsAdult: null,
  }
  showAdd.value = true
  loadSlotOptions()
}

const onCenterChange = (id: string) => {
  form.value.centerId = id
  form.value.slotKey = ''
  form.value.roomId = ''
  loadSlotOptions()
}

const onDateChange = (e: { detail: { value: string } }) => {
  form.value.date = e.detail.value
  form.value.slotKey = ''
  form.value.roomId = ''
  loadSlotOptions()
}

const selectTimeSlot = (ts: TimeSlotOption) => {
  if (!ts.selectable) return
  form.value.slotKey = ts.key
  form.value.startTime = ts.startTime
  form.value.endTime = ts.endTime
  form.value.scheduleId = ts.existingAvailableScheduleId || null
  form.value.roomId = ''
}

const selectRoom = (room: RoomOption) => {
  if (!room.available) return
  form.value.roomId = room.roomId
}

const submitProxyOrder = async () => {
  if (!selectedPatient.value || !selectedCounselor.value) return
  if (!form.value.slotKey) {
    uni.showToast({ title: '请选择时间槽', icon: 'none' })
    return
  }
  if (!isVideoCenterSelected.value && !form.value.roomId) {
    uni.showToast({ title: '请选择咨询室', icon: 'none' })
    return
  }
  if (!patientContractSigned.value && form.value.agreementIsAdult === null) {
    uni.showToast({ title: '请选择签署协议类型', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const payload: Record<string, unknown> = {
      patient_id: selectedPatient.value.id,
      counselor_id: selectedCounselor.value.id,
      center_id: form.value.centerId,
      start_time: form.value.startTime,
      end_time: form.value.endTime,
      room_id: isVideoCenterSelected.value ? null : form.value.roomId,
      schedule_id: form.value.scheduleId,
    }
    if (!patientContractSigned.value) {
      payload.agreement_is_adult = form.value.agreementIsAdult
    }
    const res = await httpV2.post(API_ENDPOINTS.admin.proxyBookingPushOrder, payload)
    if (res.code !== 0) {
      uni.showToast({ title: res.msg || '推送失败', icon: 'none' })
      return
    }
    uni.showToast({ title: '订单已推送', icon: 'success' })
    showAdd.value = false
    await loadSchedules()
    if (viewMode.value === 'calendar') await loadMonthSlots()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '推送失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    submitting.value = false
  }
}

watch(canShowSchedule, (ok) => {
  if (ok && selectedCounselor.value && slots.value.length === 0 && !loading.value) {
    loadSchedules()
  }
})

onLoad(async (opts) => {
  await searchPatients('')
  const patientId = Number(opts?.patientId || 0)

  if (patientId) {
    const p = patientSuggestions.value.find((x) => x.id === patientId)
    if (p) selectPatient(p)
    else await applyPatient(patientId)
  }
})
</script>

<style scoped>
.page-proxy {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 24rpx 32rpx 48rpx;
}

.header-card {
  margin-bottom: 24rpx;
}

.page-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #2C2C2C;
}

.page-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}

.selector-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.selector-item {
  position: relative;
  margin-bottom: 20rpx;
}

.selector-item:last-child {
  margin-bottom: 0;
}

.selector-label {
  display: block;
  font-size: 26rpx;
  color: #6B6560;
  margin-bottom: 8rpx;
}

.selector-input {
  width: 100%;
  height: 72rpx;
  padding: 0 24rpx;
  background: #F9FAFB;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 20;
  background: #fff;
  border: 1rpx solid #E5E7EB;
  border-radius: 12rpx;
  max-height: 320rpx;
  overflow-y: auto;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);
}

.dropdown-item {
  padding: 20rpx 24rpx;
  font-size: 26rpx;
  color: #374151;
  border-bottom: 1rpx solid #F3F4F6;
}

.dropdown-item:active {
  background: #F3F4F6;
}

.selected-tag {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #047857;
}

.mode-switch {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.mode-chip {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: #fff;
  font-size: 26rpx;
  color: #6B6560;
}

.mode-chip.active {
  background: #3D5A4E;
  color: #fff;
  font-weight: 600;
}

.legend-card {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  color: #6B6560;
}

.toolbar {
  margin-bottom: 16rpx;
}

.add-btn {
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 28rpx;
  height: 72rpx;
  line-height: 72rpx;
}

.add-btn::after {
  border: none;
}

.empty-card,
.empty-slot-row {
  text-align: center;
  padding: 48rpx;
  color: #9CA3AF;
  font-size: 26rpx;
}

.day-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #374151;
  margin: 16rpx 0 12rpx;
}

.slot-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-radius: 16rpx;
  margin-bottom: 12rpx;
}

.slot-left {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  flex: 1;
}

.slot-icon {
  font-size: 28rpx;
}

.slot-time {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.slot-center,
.slot-room,
.slot-patient {
  display: block;
  font-size: 22rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

.slot-status {
  font-size: 24rpx;
  font-weight: 600;
  flex-shrink: 0;
}

.calendar-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.cal-nav-btn {
  font-size: 40rpx;
  color: #3D5A4E;
  padding: 0 24rpx;
}

.cal-month-title {
  font-size: 30rpx;
  font-weight: 600;
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-bottom: 8rpx;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4rpx;
  margin-bottom: 16rpx;
}

.cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
}

.cal-cell.today {
  background: #E8F5E9;
}

.cal-cell.selected {
  background: #3D5A4E;
}

.cal-cell.selected .cal-day-num {
  color: #fff;
}

.cal-cell.past {
  opacity: 0.35;
}

.cal-day-num {
  font-size: 26rpx;
  color: #374151;
}

.cal-dots {
  display: flex;
  gap: 4rpx;
  margin-top: 4rpx;
}

.cal-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.modal-card {
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 36rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
}

.modal-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
}

.modal-sub {
  display: block;
  margin: 8rpx 0 24rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #6B6560;
  margin-bottom: 12rpx;
}

.center-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.agreement-row .center-chip {
  flex: 1;
  min-width: 240rpx;
  text-align: center;
}

.center-chip {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: #F3F4F6;
  font-size: 24rpx;
  color: #374151;
}

.center-chip.active {
  background: #3D5A4E;
  color: #fff;
}

.center-chip.disabled {
  opacity: 0.4;
}

.picker-row {
  padding: 20rpx;
  background: #F9FAFB;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.slot-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.slot-chip {
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: #F3F4F6;
  font-size: 22rpx;
}

.slot-chip.active {
  background: #3D5A4E;
  color: #fff;
}

.slot-chip.disabled {
  opacity: 0.4;
}

.slot-chip.available {
  border: 2rpx solid #10B981;
}

.video-hint {
  font-size: 24rpx;
  color: #6B7280;
}

.contract-status {
  font-size: 28rpx;
  font-weight: 600;
  color: #F59E0B;
}

.contract-status.signed {
  color: #10B981;
}

.bound-counselor {
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2937;
}

.bound-empty {
  font-size: 26rpx;
  color: #EF4444;
  line-height: 1.5;
}

.form-hint {
  display: block;
  font-size: 24rpx;
  color: #6B7280;
  margin-bottom: 12rpx;
  line-height: 1.5;
}

.required {
  color: #EF4444;
}

.modal-btns {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 100rpx;
  font-size: 28rpx;
}

.modal-btn.cancel {
  background: #F3F4F6;
  color: #374151;
}

.modal-btn.confirm {
  background: #3D5A4E;
  color: #fff;
}

.modal-btn::after {
  border: none;
}
</style>
