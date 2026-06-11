<template>
  <view class="page-schedule">
    <!-- 新增排班按钮 -->
    <view class="toolbar">
      <button class="add-btn" @tap="openAddModal">+ 新建挂课</button>
    </view>

    <!-- 排班列表 -->
    <view v-if="schedules.length === 0" class="empty-state">
      <text class="empty-text">暂无排班，点击上方按钮添加</text>
    </view>
    <view v-for="s in schedules" :key="s.Id" class="schedule-card">
      <view class="sc-main">
        <text class="sc-date">{{ formatDate(s.StartTime) }}</text>
        <text class="sc-time">{{ formatTime(s.StartTime) }} – {{ formatTime(s.EndTime) }}</text>
        <text class="sc-note" v-if="formatScheduleNote(s.Note)">{{ formatScheduleNote(s.Note) }}</text>
      </view>
      <view class="sc-right">
        <text class="sc-status" :class="s.Status.toLowerCase()">{{ statusLabel(s.Status) }}</text>
        <text
          v-if="s.Status === 'AVAILABLE'"
          class="sc-cancel"
          @click="cancelSchedule(s.Id)"
        >取消</text>
      </view>
    </view>

    <!-- 勿用遮罩 @click.self 关闭，选完日期后 picker 回调会误关弹窗 -->
    <view v-if="showAdd" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">新建挂课</text>

        <view class="form-item">
          <text class="form-label">开始时间</text>
          <picker mode="date" :value="form.startDate" @change="onStartDate">
            <view class="picker-row">
              <text>{{ form.startDate || '选择日期' }}</text>
            </view>
          </picker>
          <picker mode="time" :value="form.startTime" @change="onStartTime">
            <view class="picker-row">
              <text>{{ form.startTime || '选择时间' }}</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">结束时间</text>
          <picker mode="date" :value="form.endDate" @change="onEndDate">
            <view class="picker-row">
              <text>{{ form.endDate || '选择日期' }}</text>
            </view>
          </picker>
          <picker mode="time" :value="form.endTime" @change="onEndTime">
            <view class="picker-row">
              <text>{{ form.endTime || '选择时间' }}</text>
            </view>
          </picker>
        </view>

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

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap.stop="showAdd = false">取消</button>
          <button class="modal-btn confirm" :disabled="submitting" @tap.stop="submitSchedule">
            {{ submitting ? '保存中...' : '保存' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { APPOINTMENT_CENTERS, APPOINTMENT_CENTER_MAP } from '@/constants/appointmentCenters'
import { getRoomName, getRoomsByCenter } from '@/constants/consultationRooms'

interface Schedule {
  Id: number
  StartTime: string
  EndTime: string
  Status: string
  Note?: string
}

const schedules = ref<Schedule[]>([])
const showAdd = ref(false)
const submitting = ref(false)
const defaultCenterId = 'yangpu'
const centers = APPOINTMENT_CENTERS
const form = ref({
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  centerId: defaultCenterId,
  roomId: getRoomsByCenter(defaultCenterId)[0]?.id || '',
})

const roomOptions = computed(() => getRoomsByCenter(form.value.centerId))

const parseNotePart = (note: string, key: string) => {
  for (const part of note.split(';')) {
    const trimmed = part.trim()
    if (trimmed.toLowerCase().startsWith(`${key}:`)) {
      return trimmed.split(':').slice(1).join(':').trim()
    }
  }
  return ''
}

const formatScheduleNote = (note?: string) => {
  if (!note) return ''
  const centerId = parseNotePart(note, 'center')
  const roomId = parseNotePart(note, 'room')
  const centerName = APPOINTMENT_CENTER_MAP[centerId] || centerId
  const roomName = centerId && roomId ? getRoomName(centerId, roomId) : ''
  if (centerName && roomName) return `${centerName} · ${roomName}`
  return centerName || note
}

const selectCenter = (id: string) => {
  form.value.centerId = id
  const rooms = getRoomsByCenter(id)
  form.value.roomId = rooms[0]?.id || ''
}

const selectRoom = (id: string) => {
  form.value.roomId = id
}

const formatToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const statusLabel = (s: string) => ({
  AVAILABLE: '已挂课',
  BOOKED: '已预约',
  CANCELLED: '已取消',
}[s] || s)
const formatDate = (dt: string) => dt ? dt.slice(0, 10) : ''
const formatTime = (dt: string) => dt ? dt.slice(11, 16) : ''

const onStartDate = (e: any) => { form.value.startDate = e.detail.value }
const onStartTime = (e: any) => { form.value.startTime = e.detail.value }
const onEndDate = (e: any) => { form.value.endDate = e.detail.value }
const onEndTime = (e: any) => { form.value.endTime = e.detail.value }

const openAddModal = () => {
  const today = formatToday()
  const rooms = getRoomsByCenter(defaultCenterId)
  form.value = {
    startDate: today,
    startTime: '10:00',
    endDate: today,
    endTime: '10:50',
    centerId: defaultCenterId,
    roomId: rooms[0]?.id || '',
  }
  showAdd.value = true
}

const loadSchedules = async () => {
  const res = await httpV2.get(API_ENDPOINTS.counselor.schedules)
  if (res.code === 0 && res.data) schedules.value = res.data
}

const submitSchedule = async () => {
  if (submitting.value) return
  const { startDate, startTime, endDate, endTime, centerId, roomId } = form.value
  if (!startDate || !startTime || !endDate || !endTime || !centerId || !roomId) {
    uni.showToast({ title: '请选择中心、咨询室并填写时间', icon: 'none' })
    return
  }
  const startAt = new Date(`${startDate}T${startTime}:00`)
  const endAt = new Date(`${endDate}T${endTime}:00`)
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
      start_time: `${startDate}T${startTime}:00`,
      end_time: `${endDate}T${endTime}:00`,
      center_id: centerId,
      room_id: roomId,
    })
    if (res.code === 0) {
      showAdd.value = false
      form.value = {
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        centerId: defaultCenterId,
        roomId: getRoomsByCenter(defaultCenterId)[0]?.id || '',
      }
      await loadSchedules()
      uni.showToast({ title: '挂课成功', icon: 'success' })
    } else {
      uni.showToast({ title: res.msg || '添加失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '添加失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

const cancelSchedule = async (id: number) => {
  uni.showModal({
    title: '确认取消',
    content: '确定要取消这个排班吗？',
    success: async (res) => {
      if (!res.confirm) return
      await httpV2.put(`/api/mini/counselor/schedules/${id}`, { status: 'CANCELLED' })
      await loadSchedules()
      uni.showToast({ title: '已取消', icon: 'success' })
    }
  })
}

onShow(loadSchedules)
onMounted(loadSchedules)
</script>

<style scoped>
.page-schedule { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }

.toolbar { margin-bottom: 32rpx; }
.add-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #0D9488;
  color: #fff;
  border: none;
  border-radius: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }

.schedule-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.sc-date { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 8rpx; }
.sc-time { display: block; font-size: 36rpx; font-weight: 700; color: #1F2937; }
.sc-note { display: block; font-size: 24rpx; color: #9CA3AF; margin-top: 6rpx; }
.sc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 16rpx; }
.sc-status {
  font-size: 24rpx;
  font-weight: 600;
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
}
.sc-status.available { background: #EDE4D4; color: #7A5C3A; }
.sc-status.booked { background: #B8D4C8; color: #1F4034; }
.sc-status.cancelled { background: #F3F4F6; color: #9CA3AF; }
.sc-cancel {
  font-size: 24rpx; color: #8A7560;
  padding: 6rpx 16rpx; border-radius: 8rpx;
  border: 1rpx solid #D4C4B0; background: #FAF7F3;
}

/* 弹窗 */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: flex-end;
  z-index: 9999;
}
.modal-card {
  width: 100%;
  background: #fff;
  border-radius: 40rpx 40rpx 0 0;
  padding: 48rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
}
.modal-title { display: block; font-size: 36rpx; font-weight: 800; color: #1F2937; margin-bottom: 40rpx; }
.form-item { margin-bottom: 32rpx; }
.form-label { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 12rpx; }
.picker-row {
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  font-size: 28rpx;
  color: #1F2937;
}
.form-input {
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1F2937;
  width: 100%;
  box-sizing: border-box;
}
.modal-btns { display: flex; gap: 24rpx; margin-top: 40rpx; }
.modal-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 700;
  margin: 0;
}
.modal-btn.cancel { background: #F3F4F6; color: #6B7280; border: none; }
.modal-btn.confirm { background: #0D9488; color: #fff; border: none; }
.center-row { display: flex; gap: 16rpx; flex-wrap: wrap; }
.center-chip {
  padding: 12rpx 28rpx; border-radius: 100rpx; background: #F3F4F6;
  font-size: 26rpx; color: #374151;
}
.center-chip.active { background: #CCFBF1; color: #0D9488; font-weight: 600; }
</style>
