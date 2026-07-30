<template>
  <view class="page-room-detail">
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="!detail" class="empty">加载失败，请返回重试</view>
    <template v-else>
      <view class="hero">
        <text class="name">{{ detail.name }}</text>
        <text class="loc">{{ detail.centerName }}</text>
        <text class="range-text">未来一周：{{ detail.startDate }} ~ {{ detail.endDate }}</text>
        <text class="current-tag" :class="statusClass(currentStatus)">{{ currentLabel }}</text>
      </view>

      <view v-if="detail.current?.counselorName" class="info-card">
        <text class="info-title">当前时段</text>
        <text class="info-row">咨询师：{{ detail.current.counselorName }}</text>
        <text v-if="detail.current.patientName" class="info-row">来访者：{{ formatPatientInline(detail.current.patientName, detail.current.patientContractTag) }}</text>
        <text v-if="detail.current.startTime" class="info-row">
          时段：{{ formatTime(detail.current.startTime) }} - {{ formatTime(detail.current.endTime) }}
        </text>
      </view>

      <view class="tip-card">
        <text class="tip-text">点击可编辑的时段设置「可用 / 停用」，已预约时段仅可查看详情；修改后请点击底部「保存」生效</text>
      </view>

      <view class="legend-card">
        <view v-for="item in legend" :key="item.value" class="legend-item">
          <view class="legend-dot" :class="item.dotClass" />
          <text class="legend-text">{{ item.label }}</text>
        </view>
      </view>

      <view v-for="day in detail.days" :key="day.date" class="day-section">
        <view class="day-head">
          <text class="day-title">{{ dayLabel(day.date) }}</text>
          <text class="day-date">{{ day.date }}</text>
        </view>
        <view class="slot-grid">
          <view
            v-for="slot in day.slots"
            :key="`${day.date}-${slot.key}`"
            class="slot-card"
            :class="[slotClass(day.date, slot), { draft: isSlotDraft(day.date, slot), editable: slot.editable, 'in-session': slot.occupancy === 'IN_SESSION' }]"
            @tap="onSlotTap(slot, day.date)"
          >
            <text v-if="slot.patientName" class="slot-patient">
              来访：{{ formatPatientInline(slot.patientName, slot.patientContractTag) }}
            </text>
            <text class="slot-time">{{ slot.timeLabel }}</text>
            <text class="slot-status">{{ slotStatusText(day.date, slot) }}</text>
            <text v-if="slot.counselorName && slot.occupancy !== 'IN_SESSION'" class="slot-meta">{{ slot.counselorName }}</text>
            <text v-if="isSlotDraft(day.date, slot)" class="slot-draft">未保存</text>
          </view>
        </view>
      </view>

      <view class="save-bar">
        <text v-if="hasDraft" class="save-hint">有 {{ pendingChanges.length }} 处修改待保存</text>
        <button
          class="save-btn"
          :disabled="!hasDraft || saving"
          :loading="saving"
          @tap="saveChanges"
        >{{ saving ? '保存中...' : '保存时段状态' }}</button>
      </view>
    </template>

    <!-- 已预约详情 -->
    <view v-if="showSession" class="picker-overlay" @touchmove.stop.prevent @tap="closeSession">
      <view class="picker-card session-card" @tap.stop>
        <text class="picker-title">预约详情</text>
        <text class="picker-sub">{{ sessionSlotText }}</text>
        <view class="session-block">
          <text class="session-label">当前咨询室</text>
          <text class="session-name">{{ sessionSlot?.roomName || '—' }}</text>
        </view>
        <view class="session-block">
          <text class="session-label">咨询师</text>
          <text class="session-name">{{ sessionSlot?.counselorName || '—' }}</text>
          <text
            class="session-contact"
            :class="{ link: !!sessionSlot?.counselorMobile }"
            @tap="callPhone(sessionSlot?.counselorMobile)"
          >联系方式：{{ sessionSlot?.counselorMobile || '暂无' }}</text>
        </view>
        <view class="session-block">
          <text class="session-label">来访者</text>
          <text class="session-name">{{ formatPatientInline(sessionSlot?.patientName, sessionSlot?.patientContractTag) || '—' }}</text>
          <text
            class="session-contact"
            :class="{ link: !!sessionSlot?.patientMobile }"
            @tap="callPhone(sessionSlot?.patientMobile)"
          >联系方式：{{ sessionSlot?.patientMobile || '暂无' }}</text>
        </view>

        <view class="session-block">
          <text class="session-label">更换咨询室</text>
          <view v-if="roomOptionsLoading" class="room-options-hint">加载可用咨询室...</view>
          <view v-else-if="roomOptions.length === 0" class="room-options-hint">当前时段暂无其他可用咨询室</view>
          <view v-else class="room-options">
            <view
              v-for="opt in roomOptions"
              :key="opt.roomCode"
              class="room-option"
              :class="{ active: selectedRoomCode === opt.roomCode, current: opt.isCurrent }"
              @tap="selectedRoomCode = opt.roomCode"
            >
              <text class="room-option-name">{{ opt.name }}</text>
              <text v-if="opt.isCurrent" class="room-option-tag">当前</text>
            </view>
          </view>
        </view>

        <view class="picker-btns session-btns">
          <button class="picker-btn cancel" @tap="closeSession">关闭</button>
          <button
            class="picker-btn confirm"
            :disabled="!canChangeRoom || changingRoom"
            :loading="changingRoom"
            @tap="confirmChangeRoom"
          >更换咨询室</button>
        </view>
      </view>
    </view>

    <!-- 时段状态选择 -->
    <view v-if="showPicker" class="picker-overlay" @touchmove.stop.prevent @tap="closePicker">
      <view class="picker-card" @tap.stop>
        <text class="picker-title">设置时段状态</text>
        <text class="picker-sub">{{ pickerSlotText }}</text>
        <view class="status-row">
          <view
            v-for="opt in statusOptions"
            :key="opt.value"
            class="status-chip"
            :class="{ active: pickerStatus === opt.value }"
            @tap="pickerStatus = opt.value"
          >{{ opt.label }}</view>
        </view>
        <view class="picker-btns">
          <button class="picker-btn cancel" @tap="closePicker">取消</button>
          <button class="picker-btn confirm" @tap="confirmPicker">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { formatDateLocal } from '@/constants/scheduleSlots'
import { formatPatientInline } from '@/utils/patientContract'

type ManualStatus = 'AVAILABLE' | 'DISABLED'

interface SlotItem {
  key: string
  startTime: string
  endTime: string
  timeLabel: string
  past: boolean
  occupancy: string
  statusLabel: string
  manualStatus: ManualStatus
  editable: boolean
  counselorName?: string
  counselorMobile?: string
  patientName?: string
  patientContractTag?: string
  patientMobile?: string
  roomCode?: string
  roomName?: string
  scheduleId?: number
}

interface RoomOption {
  roomCode: string
  roomDbId?: number
  name: string
  isCurrent: boolean
}

interface DayItem {
  date: string
  slots: SlotItem[]
}

interface RoomDetail {
  id: number
  name: string
  centerName: string
  status: string
  startDate: string
  endDate: string
  current: {
    occupancy: string
    label: string
    counselorName?: string
    counselorMobile?: string
    patientName?: string
    patientContractTag?: string
    patientMobile?: string
    startTime?: string
    endTime?: string
  }
  days: DayItem[]
}

const roomId = ref(0)
const loading = ref(true)
const saving = ref(false)
const detail = ref<RoomDetail | null>(null)
const draftStatuses = ref<Record<string, ManualStatus>>({})
const showPicker = ref(false)
const showSession = ref(false)
const sessionSlot = ref<SlotItem | null>(null)
const sessionDate = ref('')
const roomOptions = ref<RoomOption[]>([])
const roomOptionsLoading = ref(false)
const selectedRoomCode = ref('')
const changingRoom = ref(false)
const pickerSlot = ref<SlotItem | null>(null)
const pickerDate = ref('')
const pickerStatus = ref<ManualStatus>('AVAILABLE')

const statusOptions = [
  { label: '可用', value: 'AVAILABLE' as ManualStatus },
  { label: '停用', value: 'DISABLED' as ManualStatus },
]

const statusClass = (status: ManualStatus | 'IN_SESSION') => ({
  AVAILABLE: 'available',
  DISABLED: 'disabled',
  IN_SESSION: 'in-session',
}[status] || 'available')

const manualStatusLabel = (status: ManualStatus) => ({
  AVAILABLE: '可用',
  DISABLED: '停用',
}[status] || status)

const legend = [
  ...statusOptions.map(opt => ({ ...opt, dotClass: statusClass(opt.value) })),
  { label: '已预约', value: 'IN_SESSION', dotClass: 'in-session' },
]

const currentStatus = computed((): ManualStatus | 'IN_SESSION' => {
  const occ = detail.value?.current?.occupancy
  if (occ === 'IN_SESSION') return 'IN_SESSION'
  if (occ === 'DISABLED') return 'DISABLED'
  return 'AVAILABLE'
})

const currentLabel = computed(() => {
  if (currentStatus.value === 'IN_SESSION') return '已预约'
  return manualStatusLabel(currentStatus.value)
})

const pickerSlotText = computed(() => {
  if (!pickerSlot.value) return ''
  return `${pickerDate.value} ${pickerSlot.value.timeLabel}`
})

const slotDraftKey = (date: string, slot: SlotItem) => `${date}|${slot.key}`

const slotStartIso = (date: string, slot: SlotItem) => `${date}T${slot.key}:00`

const effectiveStatus = (date: string, slot: SlotItem): ManualStatus =>
  draftStatuses.value[slotDraftKey(date, slot)] ?? slot.manualStatus ?? 'AVAILABLE'

const isSlotDraft = (date: string, slot: SlotItem) => {
  const draft = draftStatuses.value[slotDraftKey(date, slot)]
  return draft !== undefined && draft !== slot.manualStatus
}

const pendingChanges = computed(() => {
  const list: { start_time: string; status: ManualStatus }[] = []
  if (!detail.value) return list
  for (const day of detail.value.days) {
    for (const slot of day.slots) {
      if (isSlotDraft(day.date, slot)) {
        list.push({
          start_time: slotStartIso(day.date, slot),
          status: draftStatuses.value[slotDraftKey(day.date, slot)],
        })
      }
    }
  }
  return list
})

const hasDraft = computed(() => pendingChanges.value.length > 0)

const slotClass = (date: string, slot: SlotItem) => {
  if (slot.occupancy === 'IN_SESSION') return slot.past ? 'in-session past' : 'in-session'
  const cls = statusClass(effectiveStatus(date, slot))
  return slot.past ? `${cls} past` : cls
}

const slotStatusText = (date: string, slot: SlotItem) => {
  if (slot.occupancy === 'IN_SESSION') return '已预约点击查看详情'
  return manualStatusLabel(effectiveStatus(date, slot))
}

const weekdayLabel = (dateStr: string) => {
  const wd = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(`${dateStr}T00:00:00`)
  return `周${wd[d.getDay()]}`
}

const dayLabel = (dateStr: string) => {
  const today = formatDateLocal()
  if (dateStr === today) return `今天 · ${weekdayLabel(dateStr)}`
  return weekdayLabel(dateStr)
}

const formatTime = (s?: string) => (s ? s.slice(11, 16) : '')

const sessionSlotText = computed(() => {
  if (!sessionSlot.value) return ''
  return `${sessionDate.value} ${sessionSlot.value.timeLabel}`
})

const canChangeRoom = computed(() => {
  if (!sessionSlot.value?.scheduleId || !selectedRoomCode.value) return false
  return selectedRoomCode.value !== sessionSlot.value.roomCode
})

const loadRoomOptions = async (scheduleId: number) => {
  roomOptionsLoading.value = true
  roomOptions.value = []
  selectedRoomCode.value = ''
  try {
    const res = await httpV2.get<{
      currentRoomCode?: string
      options: RoomOption[]
    }>(API_ENDPOINTS.ops.scheduleRoomOptions(scheduleId))
    if (res.code === 0 && res.data) {
      roomOptions.value = res.data.options || []
      selectedRoomCode.value = res.data.currentRoomCode || roomOptions.value[0]?.roomCode || ''
    }
  } catch {
    uni.showToast({ title: '加载可用咨询室失败', icon: 'none' })
  } finally {
    roomOptionsLoading.value = false
  }
}

const showBookingDetail = async (slot: SlotItem, date: string) => {
  sessionSlot.value = slot
  sessionDate.value = date
  showSession.value = true
  if (slot.scheduleId) {
    await loadRoomOptions(slot.scheduleId)
  }
}

const closeSession = () => {
  showSession.value = false
  sessionSlot.value = null
  sessionDate.value = ''
  roomOptions.value = []
  selectedRoomCode.value = ''
}

const confirmChangeRoom = async () => {
  const slot = sessionSlot.value
  if (!slot?.scheduleId || !canChangeRoom.value || changingRoom.value) return
  changingRoom.value = true
  try {
    const res = await httpV2.put(
      API_ENDPOINTS.ops.changeScheduleRoom(slot.scheduleId),
      { room_code: selectedRoomCode.value },
    )
    if (res.code === 0) {
      uni.showToast({ title: '咨询室已更换', icon: 'success' })
      closeSession()
      await load()
    } else {
      uni.showToast({ title: res.msg || '更换失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '更换失败', icon: 'none' })
  } finally {
    changingRoom.value = false
  }
}

const callPhone = (mobile?: string) => {
  if (!mobile) return
  uni.makePhoneCall({ phoneNumber: mobile })
}

const onSlotTap = (slot: SlotItem, date: string) => {
  if (slot.occupancy === 'IN_SESSION') {
    showBookingDetail(slot, date)
    return
  }
  if (!slot.editable) {
    uni.showToast({ title: '该时段不可编辑', icon: 'none' })
    return
  }
  pickerSlot.value = slot
  pickerDate.value = date
  pickerStatus.value = effectiveStatus(date, slot)
  showPicker.value = true
}

const closePicker = () => {
  showPicker.value = false
  pickerSlot.value = null
}

const confirmPicker = () => {
  const slot = pickerSlot.value
  if (!slot) return
  const key = slotDraftKey(pickerDate.value, slot)
  if (pickerStatus.value === slot.manualStatus) {
    const next = { ...draftStatuses.value }
    delete next[key]
    draftStatuses.value = next
  } else {
    draftStatuses.value = {
      ...draftStatuses.value,
      [key]: pickerStatus.value,
    }
  }
  closePicker()
}

const load = async () => {
  if (!roomId.value) {
    loading.value = false
    uni.showToast({ title: '咨询室参数无效', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await httpV2.get<RoomDetail>(
      API_ENDPOINTS.ops.roomDetail(roomId.value),
      { days: 7 },
    )
    if (res.code === 0 && res.data) {
      detail.value = res.data
      draftStatuses.value = {}
    } else {
      detail.value = null
      uni.showToast({ title: res.msg || '加载失败', icon: 'none' })
    }
  } catch {
    detail.value = null
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const saveChanges = async () => {
  if (!hasDraft.value || saving.value) return
  saving.value = true
  try {
    const res = await httpV2.put(
      API_ENDPOINTS.ops.roomSlotStatuses(roomId.value),
      { slots: pendingChanges.value },
    )
    if (res.code === 0) {
      uni.showToast({ title: '已保存', icon: 'success' })
      await load()
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onLoad((opts) => {
  roomId.value = Number(opts?.id || 0)
  load()
})
</script>

<style scoped>
.page-room-detail {
  min-height: 100vh; background: #F4F6F8;
  padding: 28rpx; padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}
.empty { text-align: center; padding: 60rpx 0; color: #9CA3AF; font-size: 28rpx; }
.hero {
  background: linear-gradient(135deg, #0D9488, #0F766E);
  border-radius: 28rpx; padding: 40rpx 32rpx; margin-bottom: 24rpx;
}
.name { display: block; font-size: 40rpx; font-weight: 800; color: #fff; }
.loc { display: block; margin-top: 8rpx; font-size: 26rpx; color: rgba(255,255,255,.85); }
.range-text { display: block; margin-top: 8rpx; font-size: 24rpx; color: rgba(255,255,255,.7); }
.current-tag {
  display: inline-block; margin-top: 20rpx; padding: 8rpx 20rpx; border-radius: 100rpx;
  font-size: 24rpx; font-weight: 700; background: rgba(255,255,255,.2); color: #fff;
}
.current-tag.available { background: #D1FAE5; color: #065F46; }
.current-tag.disabled { background: #FEE2E2; color: #B91C1C; }
.current-tag.in-session { background: #DBEAFE; color: #1D4ED8; }
.info-card, .tip-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 24rpx;
}
.info-title { display: block; font-size: 26rpx; color: #9CA3AF; margin-bottom: 12rpx; }
.info-row { display: block; font-size: 28rpx; color: #374151; margin-bottom: 8rpx; }
.tip-text { font-size: 26rpx; color: #6B7280; line-height: 1.6; }
.legend-card {
  display: flex; flex-wrap: wrap; gap: 20rpx 28rpx;
  background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx;
}
.legend-item { display: flex; align-items: center; gap: 10rpx; }
.legend-dot { width: 20rpx; height: 20rpx; border-radius: 6rpx; }
.legend-dot.available { background: #D1FAE5; }
.legend-dot.disabled { background: #FECACA; }
.legend-dot.in-session { background: #BFDBFE; }
.legend-text { font-size: 22rpx; color: #6B7280; }
.day-section { margin-bottom: 28rpx; }
.day-head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 12rpx; padding: 0 4rpx;
}
.day-title { font-size: 30rpx; font-weight: 700; color: #1F2937; }
.day-date { font-size: 24rpx; color: #9CA3AF; }
.slot-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.slot-card {
  width: calc(50% - 6rpx); box-sizing: border-box;
  border-radius: 16rpx; padding: 18rpx 20rpx;
  background: #fff; border: 2rpx solid #E5E7EB; position: relative;
}
.slot-card.editable { border-style: dashed; }
.slot-card.available { background: #ECFDF5; border-color: #A7F3D0; }
.slot-card.disabled { background: #FEF2F2; border-color: #FECACA; }
.slot-card.in-session { background: #EFF6FF; border-color: #93C5FD; }
.slot-card.in-session .slot-status { color: #1D4ED8; font-weight: 600; }
.slot-card.past { opacity: 0.65; }
.slot-card.draft { box-shadow: 0 0 0 2rpx #F59E0B inset; }
.slot-time { display: block; font-size: 26rpx; font-weight: 700; color: #374151; }
.slot-patient {
  display: block; margin-bottom: 6rpx; font-size: 22rpx; font-weight: 700; color: #047857;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.slot-status { display: block; margin-top: 6rpx; font-size: 22rpx; color: #6B7280; }
.slot-meta {
  display: block; margin-top: 4rpx; font-size: 20rpx; color: #9CA3AF;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.slot-draft {
  position: absolute; top: 8rpx; right: 10rpx;
  font-size: 18rpx; color: #B45309; background: #FEF3C7;
  padding: 2rpx 8rpx; border-radius: 6rpx;
}
.save-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: #fff; padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 24rpx rgba(15, 23, 42, 0.08); z-index: 100;
}
.save-hint {
  display: block; text-align: center; font-size: 24rpx; color: #B45309;
  margin-bottom: 12rpx;
}
.save-btn {
  width: 100%; height: 88rpx; line-height: 88rpx;
  background: #0D9488; color: #fff; border: none; border-radius: 100rpx;
  font-size: 30rpx; font-weight: 700;
}
.save-btn[disabled] { opacity: 0.45; }
.picker-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display: flex; align-items: flex-end; z-index: 200;
}
.picker-card {
  width: 100%; background: #fff; border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
}
.picker-title { display: block; font-size: 34rpx; font-weight: 800; color: #1F2937; }
.picker-sub { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B7280; margin-bottom: 28rpx; }
.status-row { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 32rpx; }
.status-chip {
  padding: 14rpx 28rpx; border-radius: 100rpx; font-size: 26rpx;
  border: 2rpx solid #E5E7EB; color: #6B7280;
}
.status-chip.active { background: #0D9488; color: #fff; border-color: #0D9488; }
.picker-btns { display: flex; gap: 20rpx; }
.picker-btn {
  flex: 1; height: 84rpx; line-height: 84rpx; border-radius: 100rpx;
  font-size: 30rpx; border: none;
}
.picker-btn.cancel { background: #F3F4F6; color: #6B7280; }
.picker-btn.confirm { background: #0D9488; color: #fff; }
.session-card { max-height: 80vh; overflow-y: auto; }
.session-block {
  background: #F9FAFB; border-radius: 20rpx; padding: 24rpx 28rpx; margin-bottom: 20rpx;
}
.session-label {
  display: block; font-size: 24rpx; color: #9CA3AF; margin-bottom: 8rpx;
}
.session-name {
  display: block; font-size: 32rpx; font-weight: 700; color: #1F2937; margin-bottom: 8rpx;
}
.session-contact {
  display: block; font-size: 28rpx; color: #6B7280;
}
.session-contact.link { color: #0D9488; }
.room-options-hint {
  font-size: 26rpx; color: #9CA3AF; padding: 8rpx 0;
}
.room-options { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 8rpx; }
.room-option {
  display: flex; align-items: center; gap: 8rpx;
  padding: 14rpx 22rpx; border-radius: 100rpx;
  border: 2rpx solid #E5E7EB; background: #fff;
}
.room-option.active { border-color: #0D9488; background: #ECFDF5; }
.room-option.current { opacity: 0.85; }
.room-option-name { font-size: 26rpx; color: #374151; }
.room-option-tag { font-size: 20rpx; color: #0D9488; }
.session-btns { margin-top: 8rpx; }
</style>
