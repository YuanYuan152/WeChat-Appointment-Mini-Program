<template>
  <view class="page-workbench">
    <view class="header-card">
      <view>
        <text class="greeting">咨询师工作台</text>
        <text class="date-text">{{ weekRangeText }}</text>
      </view>
      <view class="week-nav">
        <text class="nav-btn" @click="shiftWeek(-7)">‹</text>
        <text class="nav-btn today" @click="resetWeek">本周</text>
        <text class="nav-btn" @click="shiftWeek(7)">›</text>
      </view>
    </view>

    <!-- 图例 -->
    <view class="legend-card">
      <view v-for="item in legend" :key="item.key" class="legend-item">
        <text class="legend-icon">{{ item.icon }}</text>
        <text class="legend-text">{{ item.label }}</text>
      </view>
      <view class="legend-item empty-hint">
        <text class="legend-icon">⬜</text>
        <text class="legend-text">未挂课</text>
      </view>
    </view>

    <view class="toolbar">
      <button class="add-btn" @click="openAddModal">+ 新建挂课</button>
      <text class="toolbar-tip">只有挂课后，来访者才能在咨询页预约该时段</text>
    </view>

    <view v-if="loading" class="empty-card"><text class="empty-text">加载中...</text></view>

    <view v-for="day in groupedDays" v-else :key="day.date" class="day-section">
      <text class="day-title">{{ day.label }}</text>
      <view v-if="day.slots.length === 0" class="empty-slot-row">
        <text class="empty-slot-icon">⬜</text>
        <text class="empty-slot-text">未挂课（来访者不可见、不可预约）</text>
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
            <text v-if="slot.centerName" class="slot-center">{{ slot.centerName }}{{ slot.roomName ? ` · ${slot.roomName}` : '' }}</text>
            <text v-if="slot.patientName" class="slot-patient">来访者：{{ slot.patientName }}</text>
          </view>
        </view>
        <view class="slot-right">
          <text class="slot-status" :style="{ color: meta(slot.displayStatus).color }">{{ slot.displayLabel }}</text>
          <text
            v-if="slot.displayStatus === 'OPEN'"
            class="slot-cancel"
            @click="cancelSlot(slot.id)"
          >取消挂课</text>
        </view>
      </view>
    </view>

    <!-- 新建挂课：勿用遮罩 @click.self 关闭，选完日期后点击会误触关闭（微信 picker 特性） -->
    <view v-if="showAdd" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">新建挂课</text>
        <text class="modal-sub">保存后来访者即可在咨询页看到并预约</text>

        <view class="form-item">
          <text class="form-label">预约中心</text>
          <view class="center-row">
            <view
              v-for="c in centers"
              :key="c.id"
              class="center-chip"
              :class="{ active: form.centerId === c.id }"
              @tap="selectCenter(c.id)"
            >{{ c.name }}</view>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">咨询室</text>
          <view class="center-row">
            <view
              v-for="room in roomOptions"
              :key="room.id"
              class="center-chip"
              :class="{ active: form.roomId === room.id }"
              @tap="selectRoom(room.id)"
            >{{ room.name }}</view>
          </view>
        </view>

        <view class="form-item" @tap.stop>
          <text class="form-label">日期</text>
          <picker mode="date" :value="form.date" :start="minSelectableDate" @change="onDateChange">
            <view class="picker-row" hover-class="none">{{ form.date || '选择日期' }}</view>
          </picker>
        </view>

        <view class="form-item" @tap.stop>
          <text class="form-label">开始 / 结束</text>
          <view class="time-row">
            <picker mode="time" :value="form.startTime" @change="onStartTimeChange">
              <view class="picker-row" hover-class="none">{{ form.startTime || '开始' }}</view>
            </picker>
            <text>至</text>
            <picker mode="time" :value="form.endTime" @change="onEndTimeChange">
              <view class="picker-row" hover-class="none">{{ form.endTime || '结束' }}</view>
            </picker>
          </view>
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap.stop="showAdd = false">取消</button>
          <button class="modal-btn confirm" :disabled="submitting" @tap.stop="submitSlot">
            {{ submitting ? '保存中...' : '保存挂课' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { APPOINTMENT_CENTERS } from '@/constants/appointmentCenters'
import { getRoomsByCenter } from '@/constants/consultationRooms'
import { SCHEDULE_DISPLAY_META, type ScheduleDisplayStatus } from '@/constants/scheduleDisplay'

interface CalendarSlot {
  id: number
  startTime: string
  endTime: string
  displayStatus: ScheduleDisplayStatus
  displayLabel: string
  centerName?: string
  roomName?: string
  patientName?: string
}

const loading = ref(true)
const slots = ref<CalendarSlot[]>([])
const weekStart = ref('')
const showAdd = ref(false)
const submitting = ref(false)
const centers = APPOINTMENT_CENTERS
const defaultCenterId = 'yangpu'
const defaultRooms = getRoomsByCenter(defaultCenterId)
const form = ref({
  centerId: defaultCenterId,
  roomId: defaultRooms[0]?.id || '',
  date: '',
  startTime: '10:00',
  endTime: '10:50',
})

const minSelectableDate = computed(() => formatDate(new Date()))
const roomOptions = computed(() => getRoomsByCenter(form.value.centerId))

const selectCenter = (id: string) => {
  form.value.centerId = id
  const rooms = getRoomsByCenter(id)
  form.value.roomId = rooms[0]?.id || ''
}

const selectRoom = (id: string) => {
  form.value.roomId = id
}

const onDateChange = (e: { detail: { value: string } }) => {
  form.value.date = e.detail.value
}

const onStartTimeChange = (e: { detail: { value: string } }) => {
  form.value.startTime = e.detail.value
}

const onEndTimeChange = (e: { detail: { value: string } }) => {
  form.value.endTime = e.detail.value
}

const alignWeekToDate = (dateStr: string) => {
  weekStart.value = dateStr
}

const legend = Object.entries(SCHEDULE_DISPLAY_META).map(([key, v]) => ({
  key,
  icon: v.icon,
  label: v.label,
}))

const meta = (status: ScheduleDisplayStatus) =>
  SCHEDULE_DISPLAY_META[status] || SCHEDULE_DISPLAY_META.OPEN

const formatDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const initWeekStart = () => {
  weekStart.value = formatDate(new Date())
}

const weekRangeText = computed(() => {
  if (!weekStart.value) return ''
  const start = new Date(`${weekStart.value}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${weekStart.value} ~ ${formatDate(end)}`
})

const formatTime = (iso: string) => (iso ? iso.replace('T', ' ').slice(11, 16) : '')

const weekdayLabel = (iso: string) => {
  const d = new Date(iso.replace('T', ' ').slice(0, 19))
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${iso.slice(0, 10)} ${names[d.getDay()]}`
}

const groupedDays = computed(() => {
  if (!weekStart.value) return []
  const byDate = new Map<string, CalendarSlot[]>()
  for (const s of slots.value) {
    const date = s.startTime.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(s)
  }
  const days: { date: string; label: string; slots: CalendarSlot[] }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${weekStart.value}T00:00:00`)
    d.setDate(d.getDate() + i)
    const date = formatDate(d)
    const daySlots = (byDate.get(date) || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime))
    days.push({
      date,
      label: weekdayLabel(`${date}T00:00:00`),
      slots: daySlots,
    })
  }
  return days
})

const loadCalendar = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<{ startDate: string; days: number; slots: CalendarSlot[] }>(
      API_ENDPOINTS.counselor.scheduleCalendar,
      { start: weekStart.value, days: 7 },
      { showLoading: false },
    )
    if (res.code === 0 && res.data) {
      slots.value = res.data.slots || []
    } else {
      slots.value = []
    }
  } catch {
    slots.value = []
  } finally {
    loading.value = false
  }
}

const shiftWeek = (delta: number) => {
  const d = new Date(`${weekStart.value}T00:00:00`)
  d.setDate(d.getDate() + delta)
  weekStart.value = formatDate(d)
  loadCalendar()
}

const resetWeek = () => {
  initWeekStart()
  loadCalendar()
}

const openAddModal = () => {
  const today = formatDate(new Date())
  const rooms = getRoomsByCenter(defaultCenterId)
  form.value = {
    centerId: defaultCenterId,
    roomId: rooms[0]?.id || '',
    date: weekStart.value || today,
    startTime: '10:00',
    endTime: '10:50',
  }
  showAdd.value = true
}

const cancelSlot = async (id: number) => {
  uni.showModal({
    title: '取消挂课',
    content: '取消后来访者将无法预约该时段',
    success: async (res) => {
      if (!res.confirm) return
      const r = await httpV2.put(`/api/mini/counselor/schedules/${id}`, { status: 'CANCELLED' })
      if (r.code === 0) {
        uni.showToast({ title: '已取消挂课', icon: 'success' })
        await loadCalendar()
      } else {
        uni.showToast({ title: r.msg || '取消失败', icon: 'none' })
      }
    },
  })
}

const submitSlot = async () => {
  if (submitting.value) return
  const { centerId, roomId, date, startTime, endTime } = form.value
  if (!centerId || !roomId || !date || !startTime || !endTime) {
    uni.showToast({ title: '请选择中心、咨询室并填写时间', icon: 'none' })
    return
  }
  const startAt = new Date(`${date}T${startTime}:00`)
  const endAt = new Date(`${date}T${endTime}:00`)
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    uni.showToast({ title: '时间格式无效', icon: 'none' })
    return
  }
  if (endAt <= startAt) {
    uni.showToast({ title: '结束时间须晚于开始时间', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.counselor.schedules, {
      start_time: `${date}T${startTime}:00`,
      end_time: `${date}T${endTime}:00`,
      center_id: centerId,
      room_id: roomId,
    })
    if (res.code === 0) {
      showAdd.value = false
      alignWeekToDate(date)
      uni.showToast({ title: '挂课成功', icon: 'success' })
      await loadCalendar()
    } else {
      uni.showToast({ title: res.msg || '挂课失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '挂课失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onShow(() => {
  if (!weekStart.value) initWeekStart()
  loadCalendar()
})
</script>

<style scoped>
.page-workbench { padding: 32rpx; background: #F4F6F8; min-height: 100vh; padding-bottom: 48rpx; }

.header-card {
  display: flex; justify-content: space-between; align-items: flex-start;
  background: linear-gradient(135deg, #0D9488, #0F766E);
  border-radius: 32rpx; padding: 40rpx; margin-bottom: 24rpx;
}
.greeting { display: block; font-size: 36rpx; font-weight: 800; color: #fff; }
.date-text { font-size: 24rpx; color: rgba(255,255,255,0.85); margin-top: 8rpx; }
.week-nav { display: flex; gap: 12rpx; align-items: center; }
.nav-btn {
  color: #fff; font-size: 32rpx; padding: 8rpx 16rpx;
  background: rgba(255,255,255,0.15); border-radius: 12rpx;
}
.nav-btn.today { font-size: 24rpx; }

.legend-card {
  display: flex; flex-wrap: wrap; gap: 16rpx 24rpx;
  background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx;
}
.legend-item { display: flex; align-items: center; gap: 8rpx; }
.legend-icon { font-size: 28rpx; }
.legend-text { font-size: 22rpx; color: #4B5563; }
.empty-hint .legend-text { color: #9CA3AF; }

.toolbar { margin-bottom: 24rpx; }
.add-btn {
  width: 100%; background: #0D9488; color: #fff;
  border-radius: 100rpx; height: 84rpx; line-height: 84rpx; font-size: 30rpx; border: none;
}
.toolbar-tip { display: block; font-size: 22rpx; color: #9CA3AF; margin-top: 12rpx; text-align: center; }

.day-section { margin-bottom: 28rpx; }
.day-title { display: block; font-size: 28rpx; font-weight: 700; color: #374151; margin-bottom: 12rpx; }

.slot-card {
  border-radius: 20rpx; padding: 24rpx; margin-bottom: 12rpx;
  display: flex; justify-content: space-between; align-items: center;
}
.slot-left { display: flex; gap: 16rpx; align-items: flex-start; flex: 1; }
.slot-icon { font-size: 36rpx; }
.slot-time { display: block; font-size: 30rpx; font-weight: 700; color: #1F2937; }
.slot-center, .slot-patient { display: block; font-size: 22rpx; color: #6B7280; margin-top: 4rpx; }
.slot-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; flex-shrink: 0; }
.slot-status { font-size: 24rpx; font-weight: 700; }
.slot-cancel { font-size: 22rpx; color: #EF4444; }
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
  padding: 40rpx 32rpx 48rpx;
}
.modal-title { font-size: 34rpx; font-weight: 800; color: #1F2937; }
.modal-sub { display: block; font-size: 24rpx; color: #9CA3AF; margin: 8rpx 0 24rpx; }
.form-item { margin-bottom: 24rpx; }
.form-label { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 12rpx; }
.center-row { display: flex; gap: 16rpx; flex-wrap: wrap; }
.center-chip {
  padding: 12rpx 28rpx; border-radius: 100rpx; background: #F3F4F6;
  font-size: 26rpx; color: #374151;
}
.center-chip.active { background: #CCFBF1; color: #0D9488; font-weight: 600; }
.picker-row {
  background: #F9FAFB; padding: 20rpx 24rpx; border-radius: 16rpx; font-size: 28rpx;
}
.time-row { display: flex; align-items: center; gap: 16rpx; }
.modal-btns { display: flex; gap: 20rpx; margin-top: 16rpx; }
.modal-btn { flex: 1; height: 84rpx; line-height: 84rpx; border-radius: 100rpx; font-size: 28rpx; }
.modal-btn.cancel { background: #F3F4F6; color: #6B7280; }
.modal-btn.confirm { background: #0D9488; color: #fff; }
</style>
