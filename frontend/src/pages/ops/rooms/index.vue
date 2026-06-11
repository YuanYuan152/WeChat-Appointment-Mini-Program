<template>
  <view class="page-rooms">
    <view class="header">
      <text class="title">咨询室情况</text>
      <text class="subtitle">查看各咨询室占用与状态</text>
    </view>

    <view class="filter-row">
      <picker mode="date" :value="filterDate" @change="onDateChange">
        <view class="filter-chip">{{ filterDate }}</view>
      </picker>
      <picker :range="slotLabels" :value="slotIndex" @change="onSlotChange">
        <view class="filter-chip">{{ slotLabels[slotIndex] || '选择时段' }}</view>
      </picker>
    </view>

    <button class="add-btn" @tap="openAdd">+ 新增咨询室</button>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="rooms.length === 0" class="empty">暂无咨询室</view>

    <view
      v-for="room in rooms"
      :key="`${room.centerId}-${room.roomCode}`"
      class="room-card"
      @tap="goDetail(room)"
    >
      <view class="room-head">
        <text class="room-name">{{ room.name }}</text>
        <text class="status-tag" :class="tagClass(room)">{{ room.label }}</text>
      </view>
      <text class="room-loc">{{ room.centerName }}</text>
      <text v-if="room.counselorName" class="room-extra">咨询师：{{ room.counselorName }}</text>
      <text v-if="room.patientName" class="room-extra">来访者：{{ room.patientName }}</text>
      <text v-if="room.manualStatus !== 'AVAILABLE' && room.occupancy === 'IDLE'" class="room-extra">
        管理状态：{{ manualLabel(room.manualStatus) }}
      </text>
    </view>

    <!-- 新增咨询室 -->
    <view v-if="showAdd" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">新增咨询室</text>
        <view class="form-group">
          <text class="form-label">所属中心</text>
          <picker :range="centerLabels" :value="centerIndex" @change="onCenterChange">
            <view class="picker-row">{{ centerLabels[centerIndex] }}</view>
          </picker>
        </view>
        <view class="form-group" @tap.stop>
          <text class="form-label">咨询室名称 *</text>
          <input class="input" v-model="addForm.name" placeholder="如：咨询室 D" placeholder-class="input-ph" />
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
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { APPOINTMENT_CENTERS } from '@/constants/appointmentCenters'

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
}

const loading = ref(true)
const saving = ref(false)
const showAdd = ref(false)
const filterDate = ref('')
const timeSlot = ref('')
const rooms = ref<RoomSnapshot[]>([])
const slotOptions = ref<string[]>([])
const slotIndex = ref(0)

const addForm = ref({ name: '' })
const centerOptions = APPOINTMENT_CENTERS
const centerLabels = centerOptions.map(c => c.name)
const centerIndex = ref(0)
const slotLabels = computed(() =>
  slotOptions.value.length ? slotOptions.value : ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
)

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const manualLabel = (s: string) =>
  ({ AVAILABLE: '可用', MAINTENANCE: '维护中', DISABLED: '已停用' }[s] || s)

const tagClass = (room: RoomSnapshot) => {
  const map: Record<string, string> = {
    IDLE: 'idle',
    RESERVED: 'reserved',
    IN_SESSION: 'busy',
    MAINTENANCE: 'maint',
    DISABLED: 'disabled',
  }
  return map[room.occupancy] || 'other'
}

const load = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = { date: filterDate.value }
    if (timeSlot.value) params.time_slot = timeSlot.value
    const res = await httpV2.get<{ rooms: RoomSnapshot[]; timeSlot: string }>(
      API_ENDPOINTS.ops.roomsStatus,
      params
    )
    if (res.code === 0 && res.data) {
      rooms.value = res.data.rooms || []
      if (res.data.timeSlot && !timeSlot.value) {
        timeSlot.value = res.data.timeSlot
        const idx = slotLabels.value.indexOf(res.data.timeSlot)
        if (idx >= 0) slotIndex.value = idx
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
  load()
}

const onSlotChange = (e: any) => {
  slotIndex.value = Number(e.detail.value)
  timeSlot.value = slotLabels.value[slotIndex.value]
  load()
}

const goDetail = (room: RoomSnapshot) => {
  if (!room.id) {
    uni.showToast({ title: '请先初始化咨询室数据', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/ops/rooms/detail?id=${room.id}&date=${filterDate.value}` })
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
  filterDate.value = todayStr()
  slotOptions.value = slotLabels.value.slice()
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = '00'
  timeSlot.value = `${hh}:${mm}`
  const nearest = slotLabels.value.find(s => s >= timeSlot.value) || slotLabels.value[0]
  timeSlot.value = nearest
  slotIndex.value = Math.max(0, slotLabels.value.indexOf(nearest))
  load()
})
</script>

<style scoped>
.page-rooms { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.header { margin-bottom: 20rpx; }
.title { display: block; font-size: 40rpx; font-weight: 800; color: #1F2937; }
.subtitle { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B7280; }
.filter-row { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.filter-chip {
  flex: 1; background: #fff; border-radius: 16rpx; padding: 20rpx 24rpx;
  font-size: 26rpx; color: #374151; text-align: center;
}
.add-btn {
  width: 100%; height: 80rpx; line-height: 80rpx; margin-bottom: 24rpx;
  background: #0D9488; color: #fff; border: none; border-radius: 20rpx;
  font-size: 28rpx; font-weight: 700;
}
.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; }
.room-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.room-head { display: flex; justify-content: space-between; align-items: center; }
.room-name { font-size: 32rpx; font-weight: 700; color: #1F2937; }
.status-tag { font-size: 22rpx; font-weight: 700; padding: 6rpx 16rpx; border-radius: 100rpx; }
.status-tag.idle { background: #D1FAE5; color: #065F46; }
.status-tag.reserved { background: #FEF3C7; color: #92400E; }
.status-tag.busy { background: #DBEAFE; color: #1E40AF; }
.status-tag.maint { background: #F3F4F6; color: #6B7280; }
.status-tag.disabled { background: #FEE2E2; color: #B91C1C; }
.room-loc { display: block; margin-top: 10rpx; font-size: 26rpx; color: #6B7280; }
.room-extra { display: block; margin-top: 6rpx; font-size: 24rpx; color: #9CA3AF; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: flex-end; z-index: 9999;
}
.modal-card {
  width: 100%; background: #fff; border-radius: 40rpx 40rpx 0 0;
  padding: 48rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
}
.modal-title { display: block; font-size: 36rpx; font-weight: 800; margin-bottom: 32rpx; }
.form-group { margin-bottom: 24rpx; }
.form-label { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 10rpx; }
.input, .picker-row {
  width: 100%; box-sizing: border-box; background: #F9FAFB; border-radius: 16rpx;
  padding: 20rpx 24rpx; font-size: 28rpx;
}
.input-ph { font-size: 26rpx; color: #9CA3AF; }
.modal-btns { display: flex; gap: 20rpx; margin-top: 32rpx; }
.btn { flex: 1; height: 84rpx; line-height: 84rpx; border-radius: 100rpx; font-size: 30rpx; border: none; }
.btn.cancel { background: #F3F4F6; color: #6B7280; }
.btn.confirm { background: #0D9488; color: #fff; }
</style>
