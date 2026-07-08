<template>
  <view class="page-schedule-detail">
    <view class="header-card">
      <text class="counselor-name">{{ counselorName }}</text>
      <text class="date-text">
        {{ viewMode === 'list' ? `近${LIST_WINDOW_DAYS}天：${rollingRangeText}` : `${calendarMonthLabel} 排期日历` }}
      </text>
    </view>

    <view class="mode-switch">
      <view class="mode-chip" :class="{ active: viewMode === 'list' }" @tap="switchViewMode('list')">普通模式</view>
      <view class="mode-chip" :class="{ active: viewMode === 'calendar' }" @tap="switchViewMode('calendar')">日历模式</view>
    </view>

    <view class="legend-card">
      <view v-for="item in legend" :key="item.key" class="legend-item">
        <text class="legend-icon">{{ item.icon }}</text>
        <text class="legend-text">{{ item.label }}</text>
      </view>
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
            @tap="!cell.empty && selectCalendarDate(cell.date!)"
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
              <text v-if="slot.patientName" class="slot-patient">来访者：{{ slot.patientName }}</text>
            </view>
          </view>
          <view class="slot-right">
            <text class="slot-status" :style="{ color: slotStatusColor(slot) }">{{ slot.displayLabel }}</text>
            <text v-if="slot.leaveRequestId" class="slot-detail-hint">点击查看请假详情</text>
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

    <view v-if="showLeaveDetail" class="modal-overlay" @touchmove.stop.prevent @tap="showLeaveDetail = false">
      <view class="modal-card" @tap.stop>
        <text class="modal-title">请假详情</text>
        <view class="detail-row"><text class="detail-label">时段</text><text>{{ leaveDetailSlotText }}</text></view>
        <view class="detail-row"><text class="detail-label">地点</text><text>{{ leaveDetailCenterRoom || '—' }}</text></view>
        <view class="detail-row"><text class="detail-label">来访者</text><text>{{ leaveDetailPatient || '—' }}</text></view>
        <view class="detail-row"><text class="detail-label">理由</text><text>{{ leaveDetailReason }}</text></view>
        <view class="detail-row"><text class="detail-label">提交时间</text><text>{{ leaveDetailSubmittedAt }}</text></view>
        <view class="detail-row"><text class="detail-label">状态</text><text>{{ leaveDetailStatusLabel }}</text></view>
        <button class="modal-close-btn" @tap="showLeaveDetail = false">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { SCHEDULE_DISPLAY_META, type ScheduleDisplayStatus } from '@/constants/scheduleDisplay'
import {
  formatDateLocal,
  ROLLING_WINDOW_DAYS,
  PAST_WINDOW_DAYS,
  LIST_WINDOW_DAYS,
  addDays,
} from '@/constants/scheduleSlots'
import { isVideoCenter } from '@/constants/appointmentCenters'

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
  hasCaseRecord?: boolean
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

const counselorId = ref(0)
const counselorName = ref('咨询师')
const initialDate = ref('')

const loading = ref(true)
const viewMode = ref<ViewMode>('list')
const showListFilter = ref(false)
const listTimeFilter = ref<ListTimeFilter>('all')
const listStatusFilter = ref<ListStatusFilter>('ALL')
const calendarMonth = ref(formatDateLocal().slice(0, 7))
const selectedCalendarDate = ref(formatDateLocal())
const monthSlots = ref<CalendarSlot[]>([])
const slots = ref<CalendarSlot[]>([])

const showLeaveDetail = ref(false)
const leaveDetailSlotText = ref('')
const leaveDetailCenterRoom = ref('')
const leaveDetailPatient = ref('')
const leaveDetailReason = ref('')
const leaveDetailSubmittedAt = ref('')
const leaveDetailStatusLabel = ref('')

const minDate = computed(() => formatDateLocal())
const listWindowStart = computed(() => addDays(minDate.value, -PAST_WINDOW_DAYS))
const listWindowEnd = computed(() => addDays(minDate.value, ROLLING_WINDOW_DAYS - 1))
const rollingRangeText = computed(() => `${listWindowStart.value} ~ ${listWindowEnd.value}`)

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

const isBookedSlot = (slot: CalendarSlot) => {
  if (slot.displayStatus === 'DONE' || slot.displayStatus === 'ON_LEAVE' || slot.displayStatus === 'EXPIRED') {
    return false
  }
  return slot.displayStatus === 'BOOKED' || !!slot.patientName || !!slot.consultationId
}

const slotRoomText = (slot: CalendarSlot) => {
  if (slot.roomName) return slot.roomName
  if (isVideoCenter(slot.centerId) && isBookedSlot(slot)) return '线上视频（不占咨询室）'
  return ''
}

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
    dots: CalendarDotStatus[]
  }> = []
  for (let i = 0; i < startPad; i++) cells.push({ empty: true, dots: [] })
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

const slotStatusColor = (slot: CalendarSlot) => {
  if (slot.displayStatus === 'DONE' && slot.hasCaseRecord) return '#0D9488'
  return meta(slot.displayStatus).color
}

const loadList = async () => {
  if (!counselorId.value) {
    uni.showToast({ title: '缺少咨询师信息', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await httpV2.get<{ slots: CalendarSlot[] }>(
      API_ENDPOINTS.ops.counselorScheduleCalendar(counselorId.value),
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
    uni.showToast({ title: '加载排班失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const loadMonthCalendar = async () => {
  if (!counselorId.value) return
  loading.value = true
  try {
    const res = await httpV2.get<{ slots: CalendarSlot[] }>(
      API_ENDPOINTS.ops.counselorScheduleCalendar(counselorId.value),
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
    uni.showToast({ title: '加载月历失败', icon: 'none' })
  } finally {
    loading.value = false
  }
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
    if (!selectedCalendarDate.value) selectedCalendarDate.value = initialDate.value || formatDateLocal()
    if (selectedCalendarDate.value) {
      calendarMonth.value = selectedCalendarDate.value.slice(0, 7)
    }
    await loadMonthCalendar()
  } else {
    await loadList()
  }
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

const reload = async () => {
  if (viewMode.value === 'calendar') await loadMonthCalendar()
  else await loadList()
}

onLoad((options) => {
  counselorId.value = Number(options?.counselorId || 0)
  counselorName.value = decodeURIComponent(String(options?.counselorName || '咨询师'))
  const date = String(options?.date || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    initialDate.value = date
    selectedCalendarDate.value = date
    calendarMonth.value = date.slice(0, 7)
  }
  uni.setNavigationBarTitle({ title: `${counselorName.value} · 排期` })
})

onShow(reload)
</script>

<style scoped>
.page-schedule-detail {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 28rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}

.header-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
}

.counselor-name {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}

.date-text {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.mode-switch {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.mode-chip {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 100rpx;
  font-size: 26rpx;
  color: #6B7280;
  background: #fff;
  border: 1rpx solid #E8E4DE;
}

.mode-chip.active {
  background: #3D5A4E;
  color: #fff;
  border-color: #3D5A4E;
  font-weight: 600;
}

.legend-card {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 20rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.legend-icon { font-size: 22rpx; }
.legend-text { font-size: 22rpx; color: #6B7280; }

.filter-section { margin-bottom: 20rpx; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.filter-bar-text { font-size: 28rpx; font-weight: 600; color: #374151; flex: 1; }
.filter-bar-badge { font-size: 22rpx; color: #0D9488; }
.filter-bar-arrow { font-size: 22rpx; color: #9CA3AF; }

.filter-panel {
  margin-top: 12rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.filter-label {
  display: block;
  font-size: 24rpx;
  color: #6B7280;
  margin: 12rpx 0 8rpx;
}

.filter-chips { display: flex; flex-wrap: wrap; gap: 12rpx; }

.filter-chip {
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #6B7280;
  background: #F7F5F2;
  border: 1rpx solid #E8E4DE;
}

.filter-chip.active {
  background: #E8E4DE;
  color: #3D5A4E;
  font-weight: 600;
  border-color: #3D5A4E;
}

.filter-reset {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #0D9488;
}

.empty-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 60rpx;
  text-align: center;
}

.empty-text { font-size: 28rpx; color: #9CA3AF; }

.day-section { margin-bottom: 24rpx; }

.day-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12rpx;
}

.empty-slot-row {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  text-align: center;
}

.empty-slot-text { font-size: 26rpx; color: #9CA3AF; }

.slot-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  margin-bottom: 12rpx;
}

.slot-card--clickable { cursor: pointer; }

.slot-left {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
}

.slot-icon { font-size: 28rpx; flex-shrink: 0; }

.slot-time {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.slot-center, .slot-room, .slot-patient {
  display: block;
  font-size: 22rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

.slot-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.slot-status { font-size: 24rpx; font-weight: 600; }

.slot-detail-hint {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #9CA3AF;
}

.calendar-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.calendar-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.cal-nav-btn { font-size: 40rpx; color: #3D5A4E; padding: 0 24rpx; }
.cal-month-title { font-size: 30rpx; font-weight: 600; }

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
}

.cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
}

.cal-cell.today { background: #E8F5E9; }
.cal-cell.selected { background: #3D5A4E; }
.cal-cell.selected .cal-day-num { color: #fff; }

.cal-day-num { font-size: 26rpx; color: #374151; }

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

.cal-selected-label {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6B7280;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}

.modal-card {
  width: 100%;
  max-width: 640rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
}

.modal-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
  font-size: 26rpx;
  color: #374151;
}

.detail-label {
  color: #9CA3AF;
  flex-shrink: 0;
}

.modal-close-btn {
  margin-top: 28rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 28rpx;
}

.modal-close-btn::after { border: none; }
</style>
