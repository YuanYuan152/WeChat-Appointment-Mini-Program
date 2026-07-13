<template>
  <view class="page-rooms">
    <view class="header-card">
      <text class="title">咨询室情况</text>
      <text class="subtitle">按预约中心查看，点击咨询室可管理未来一周各时段状态</text>
    </view>

    <view class="filter-hint">可点击设置查询时段</view>
    <view class="filter-row">
      <picker mode="date" :value="filterDate" @change="onDateChange">
        <view class="filter-chip">{{ filterDate }}</view>
      </picker>
      <picker :range="slotLabels" :value="slotIndex" @change="onSlotChange">
        <view class="filter-chip">{{ slotLabels[slotIndex] || '选择时段' }}</view>
      </picker>
    </view>
    <view v-if="isCurrentSlot" class="current-slot-tip">当前查看：此刻所属标准时段</view>

    <button class="add-btn" @tap="openAdd">+ 新增咨询室</button>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="rooms.length === 0" class="empty">暂无咨询室</view>

    <view
      v-for="group in groupedCenters"
      :key="group.id"
      class="center-section"
      :class="`center-section--${group.id}`"
    >
      <view class="center-banner">
        <view class="center-banner-main">
          <text class="center-name">{{ group.name }}</text>
          <text class="center-count">{{ group.rooms.length }} 间咨询室</text>
        </view>
        <text class="center-slot-hint">{{ filterDate }} {{ timeSlot }} 时段</text>
      </view>

      <view v-if="group.rooms.length === 0" class="center-empty">该中心暂无咨询室</view>

      <view
        v-for="room in group.rooms"
        :key="`${room.centerId}-${room.roomCode}`"
        class="room-card"
        @tap="goDetail(room)"
      >
        <view class="room-head">
          <text class="room-name">{{ room.name }}</text>
          <text class="status-tag" :class="tagClass(room)">{{ roomStatusLabel(room) }}</text>
        </view>
        <text v-if="room.counselorName" class="room-extra">咨询师：{{ room.counselorName }}</text>
        <text v-if="room.patientName" class="room-extra">来访者：{{ formatPatientInline(room.patientName, room.patientContractTag) }}</text>
      </view>
    </view>

    <!-- 新增咨询室 -->
    <view v-if="showAdd" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">新增咨询室</text>
        <view class="form-group">
          <text class="form-label">所属预约中心</text>
          <picker :range="centerLabels" :value="centerIndex" @change="onCenterChange">
            <view class="picker-row">{{ centerLabels[centerIndex] }}</view>
          </picker>
        </view>
        <view class="form-group form-group--input" @tap.stop>
          <text class="form-label">咨询室名称 *</text>
          <input
            class="input input-name"
            v-model="addForm.name"
            type="text"
            maxlength="50"
            :adjust-position="true"
            :cursor-spacing="120"
            placeholder="如：咨询室 D"
            placeholder-class="input-ph"
          />
        </view>
        <view class="modal-btns">
          <button class="btn cancel" @tap.stop="showAdd = false">取消</button>
          <button class="btn confirm" :loading="saving" @tap.stop="submitAdd">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { APPOINTMENT_CENTERS } from '@/constants/appointmentCenters'
import { currentStandardSlot, SLOT_START_HOURS } from '@/constants/scheduleSlots'
import { formatPatientInline } from '@/utils/patientContract'

interface RoomSnapshot {
  id?: number
  centerId: string
  centerName: string
  roomCode: string
  name: string
  manualStatus: string
  occupancy: string
  label: string
  counselorName?: string
  patientName?: string
  patientContractTag?: string
}

const loading = ref(true)
const saving = ref(false)
const showAdd = ref(false)
const filterDate = ref('')
const timeSlot = ref('')
const isCurrentSlot = ref(true)
const rooms = ref<RoomSnapshot[]>([])
const slotIndex = ref(0)

const addForm = ref({ name: '' })
const centerOptions = APPOINTMENT_CENTERS
const centerLabels = centerOptions.map(c => c.name)
const centerIndex = ref(0)

const slotLabels = computed(() =>
  SLOT_START_HOURS.map(h => `${String(h).padStart(2, '0')}:00`)
)

const groupedCenters = computed(() => {
  const byCenter = new Map<string, RoomSnapshot[]>()
  for (const room of rooms.value) {
    const list = byCenter.get(room.centerId) || []
    list.push(room)
    byCenter.set(room.centerId, list)
  }
  const ordered = APPOINTMENT_CENTERS.map(center => ({
    id: center.id,
    name: center.name,
    rooms: (byCenter.get(center.id) || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')),
  }))
  const extras = [...byCenter.keys()]
    .filter(id => !APPOINTMENT_CENTERS.some(c => c.id === id))
    .map(id => ({
      id,
      name: byCenter.get(id)?.[0]?.centerName || id,
      rooms: (byCenter.get(id) || []).slice(),
    }))
  return [...ordered, ...extras]
})

const statusLabelMap: Record<string, string> = {
  AVAILABLE: '可用',
  DISABLED: '停用',
}

const normalizeManualStatus = (status: string) =>
  status === 'MAINTENANCE' ? 'DISABLED' : status

const roomStatusLabel = (room: RoomSnapshot) => {
  if (room.occupancy === 'IN_SESSION') return '已预约'
  return statusLabelMap[normalizeManualStatus(room.manualStatus)] || '可用'
}

const tagClass = (room: RoomSnapshot) => {
  if (room.occupancy === 'IN_SESSION') return 'booked'
  const map: Record<string, string> = {
    AVAILABLE: 'available',
    DISABLED: 'disabled',
  }
  return map[normalizeManualStatus(room.manualStatus)] || 'available'
}

const applyCurrentSlotFilter = () => {
  const cur = currentStandardSlot()
  filterDate.value = cur.date
  timeSlot.value = cur.timeSlot
  slotIndex.value = Math.max(0, slotLabels.value.indexOf(cur.timeSlot))
  isCurrentSlot.value = true
}

const syncSlotIndex = () => {
  const idx = slotLabels.value.indexOf(timeSlot.value)
  if (idx >= 0) slotIndex.value = idx
}

const load = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = { date: filterDate.value }
    if (timeSlot.value) params.time_slot = timeSlot.value
    const res = await httpV2.get<{
      rooms: RoomSnapshot[]
      timeSlot: string
      isCurrentSlot?: boolean
    }>(API_ENDPOINTS.ops.roomsStatus, params)
    if (res.code === 0 && res.data) {
      rooms.value = res.data.rooms || []
      if (res.data.timeSlot) {
        timeSlot.value = res.data.timeSlot
        syncSlotIndex()
      }
      if (typeof res.data.isCurrentSlot === 'boolean') {
        isCurrentSlot.value = res.data.isCurrentSlot
      }
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const onDateChange = (e: any) => {
  filterDate.value = e.detail.value
  isCurrentSlot.value = false
  load()
}

const onSlotChange = (e: any) => {
  slotIndex.value = Number(e.detail.value)
  timeSlot.value = slotLabels.value[slotIndex.value]
  isCurrentSlot.value = false
  load()
}

const goDetail = (room: RoomSnapshot) => {
  if (!room.id) {
    uni.showToast({ title: '请先初始化咨询室数据', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/ops/rooms/detail?id=${room.id}` })
}

const openAdd = () => {
  addForm.value = { name: '' }
  showAdd.value = true
}

const onCenterChange = (e: any) => {
  centerIndex.value = Number(e.detail.value)
}

const submitAdd = async () => {
  if (!addForm.value.name.trim()) {
    uni.showToast({ title: '请输入咨询室名称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.ops.rooms, {
      center_id: centerOptions[centerIndex.value].id,
      name: addForm.value.name.trim(),
    })
    if (res.code === 0) {
      showAdd.value = false
      await load()
      uni.showToast({ title: '已添加', icon: 'success' })
    } else {
      uni.showToast({ title: res.msg || '添加失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  applyCurrentSlotFilter()
  load()
})

onShow(() => {
  // 仅默认查看当前时段时自动对齐；手动切换过日期/时段则保留选择
  if (isCurrentSlot.value) {
    applyCurrentSlotFilter()
  }
  load()
})
</script>

<style scoped>
.page-rooms { min-height: 100vh; background: #F7F5F2; padding: 32rpx; padding-bottom: 48rpx; }

.header-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx; padding: 40rpx 36rpx; margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);
}
.title { display: block; font-size: 40rpx; font-weight: 600; color: #fff; letter-spacing: 2rpx; }
.subtitle { display: block; margin-top: 12rpx; font-size: 26rpx; color: rgba(255,255,255,0.8); line-height: 1.6; }

.filter-hint {
  margin-bottom: 16rpx; font-size: 24rpx; color: #3D5A4E; text-align: center;
}
.filter-row { display: flex; gap: 16rpx; margin-bottom: 12rpx; }
.filter-chip {
  flex: 1; background: #fff; border-radius: 16rpx; padding: 20rpx 24rpx;
  font-size: 26rpx; color: #374151; text-align: center;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.current-slot-tip {
  margin-bottom: 20rpx; font-size: 24rpx; color: #3D5A4E; text-align: center;
  background: #E8E4DE; border-radius: 12rpx; padding: 12rpx 20rpx;
}
.add-btn {
  width: 100%; height: 84rpx; line-height: 84rpx; margin-bottom: 28rpx;
  background: #3D5A4E; color: #fff; border: none; border-radius: 12rpx;
  font-size: 30rpx; font-weight: 600;
}
.empty { text-align: center; padding: 80rpx 0; color: #8A8A8A; }

.center-section {
  margin-bottom: 28rpx; border-radius: 24rpx; overflow: hidden;
  background: #fff; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.center-section--yangpu { border: 2rpx solid #E8E4DE; }
.center-section--pudong { border: 2rpx solid #F0E6D6; }

.center-banner {
  padding: 28rpx 28rpx 20rpx;
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
}
.center-section--pudong .center-banner {
  background: linear-gradient(135deg, #4A6056, #3D5A4E);
}
.center-banner-main {
  display: flex; justify-content: space-between; align-items: center;
}
.center-name {
  font-size: 32rpx; font-weight: 600; color: #fff; letter-spacing: 1rpx;
}
.center-count {
  font-size: 22rpx; color: #3D5A4E; background: #E8E4DE;
  padding: 6rpx 16rpx; border-radius: 100rpx; font-weight: 600;
}
.center-section--pudong .center-count {
  color: #8A6D3B; background: #F5EFE3;
}
.center-slot-hint {
  display: block; margin-top: 10rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.82);
}
.center-empty {
  margin: 0 24rpx 24rpx; padding: 40rpx 0; text-align: center;
  font-size: 26rpx; color: #8A8A8A; background: #F7F5F2; border-radius: 16rpx;
}
.room-card {
  margin: 0 24rpx 16rpx; background: #F7F5F2; border-radius: 16rpx; padding: 24rpx 28rpx;
}
.center-section .room-card:last-child { margin-bottom: 24rpx; }
.room-head { display: flex; justify-content: space-between; align-items: center; }
.room-name { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.status-tag { font-size: 22rpx; font-weight: 700; padding: 6rpx 16rpx; border-radius: 100rpx; }
.status-tag.available { background: #E8E4DE; color: #3D5A4E; }
.status-tag.disabled { background: #F0EDE8; color: #6B6560; }
.status-tag.booked { background: #DBEAFE; color: #1D4ED8; }
.room-extra { display: block; margin-top: 8rpx; font-size: 24rpx; color: #8A8A8A; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: flex-end; z-index: 9999;
}
.modal-card {
  width: 100%; background: #fff; border-radius: 40rpx 40rpx 0 0;
  padding: 48rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
}
.modal-title { display: block; font-size: 36rpx; font-weight: 800; margin-bottom: 32rpx; color: #2C2C2C; }
.form-group { margin-bottom: 24rpx; }
.form-group--input { position: relative; z-index: 2; }
.form-label { display: block; font-size: 26rpx; color: #8A8A8A; margin-bottom: 10rpx; }
.input, .picker-row {
  width: 100%; box-sizing: border-box; background: #F7F5F2; border-radius: 16rpx;
  padding: 0 24rpx; font-size: 28rpx; color: #2C2C2C;
}
.input-name {
  display: block; height: 88rpx; min-height: 88rpx; line-height: 88rpx;
}
.picker-row {
  display: flex; align-items: center; min-height: 88rpx; padding: 20rpx 24rpx;
}
.input-ph { font-size: 28rpx; color: #8A8A8A; line-height: 88rpx; }
.modal-btns { display: flex; gap: 20rpx; margin-top: 32rpx; }
.btn { flex: 1; height: 84rpx; line-height: 84rpx; border-radius: 12rpx; font-size: 30rpx; border: none; }
.btn.cancel { background: #F0EDE8; color: #6B6560; }
.btn.confirm { background: #3D5A4E; color: #fff; }
</style>
