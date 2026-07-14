<template>
  <view class="page-settings">
    <view class="hero-card">
      <text class="hero-title">系统设置</text>
      <text class="hero-subtitle">调整代理预约待支付订单的有效时限，保存后对新推送的订单立即生效</text>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else class="setting-card">
      <view class="setting-head">
        <text class="setting-title">代理预约待支付时限</text>
        <text class="setting-desc">来访收到推送后，需在此时间内完成支付，逾期订单将自动取消并释放排期</text>
      </view>

      <view class="value-row">
        <text class="value-label">当前设置</text>
        <text class="value-text">{{ currentLabel }}</text>
      </view>

      <view class="picker-panel">
        <view class="picker-labels">
          <text>小时</text>
          <text>分钟</text>
        </view>
        <picker-view
          class="ttl-picker"
          indicator-style="height: 72rpx;"
          :value="pickerIndexes"
          @change="onPickerChange"
        >
          <picker-view-column>
            <view v-for="hour in hourOptions" :key="`h-${hour}`" class="picker-item">
              {{ hour }} 小时
            </view>
          </picker-view-column>
          <picker-view-column>
            <view v-for="minute in minuteOptions" :key="`m-${minute}`" class="picker-item">
              {{ minute }} 分钟
            </view>
          </picker-view-column>
        </picker-view>
      </view>

      <button class="save-btn" :loading="saving" :disabled="!dirty" @tap="save">保存设置</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { resolveAccountRole } from '@/constants/roles'
import {
  buildProxyOrderTtlHourOptions,
  buildProxyOrderTtlMinuteOptions,
  fetchAdminSystemSettings,
  formatProxyOrderTtlDuration,
  invalidateSystemSettingsCache,
  proxyOrderTtlMinutesToPicker,
  proxyOrderTtlPickerToMinutes,
  updateProxyOrderTtlMinutes,
} from '@/utils/systemSettings'

const userStore = useUserStore()
const loading = ref(true)
const saving = ref(false)
const draftMinutes = ref(120)
const savedMinutes = ref(120)
const pickerHour = ref(2)
const pickerMinute = ref(0)

const hourOptions = buildProxyOrderTtlHourOptions()
const minuteOptions = computed(() => buildProxyOrderTtlMinuteOptions(pickerHour.value))

const pickerIndexes = computed(() => {
  const minuteList = minuteOptions.value
  const hourIndex = hourOptions.indexOf(pickerHour.value)
  const minuteIndex = minuteList.indexOf(pickerMinute.value)
  return [
    hourIndex >= 0 ? hourIndex : 0,
    minuteIndex >= 0 ? minuteIndex : 0,
  ]
})

const currentLabel = computed(() => formatProxyOrderTtlDuration(draftMinutes.value))
const dirty = computed(() => draftMinutes.value !== savedMinutes.value)

const syncPickerFromMinutes = (minutes: number) => {
  const picked = proxyOrderTtlMinutesToPicker(minutes)
  pickerHour.value = picked.hour
  pickerMinute.value = picked.minute
  draftMinutes.value = proxyOrderTtlPickerToMinutes(picked.hour, picked.minute)
}

const ensureAdmin = () => {
  const role = userStore.activeRole || resolveAccountRole(userStore.roles)
  if (role !== 'Admin') {
    uni.showToast({ title: '仅管理员可访问', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return false
  }
  return true
}

const load = async () => {
  if (!ensureAdmin()) return
  loading.value = true
  try {
    const data = await fetchAdminSystemSettings()
    savedMinutes.value = data.proxyOrderTtlMinutes
    syncPickerFromMinutes(data.proxyOrderTtlMinutes)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const onPickerChange = (e: { detail: { value: number[] } }) => {
  const [hourIndex, minuteIndex] = e.detail.value
  const hour = hourOptions[hourIndex] ?? 0
  const minuteList = buildProxyOrderTtlMinuteOptions(hour)
  const minute = minuteList[minuteIndex] ?? minuteList[0] ?? 0
  pickerHour.value = hour
  pickerMinute.value = minute
  draftMinutes.value = proxyOrderTtlPickerToMinutes(hour, minute)
}

const save = async () => {
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    const data = await updateProxyOrderTtlMinutes(draftMinutes.value)
    savedMinutes.value = data.proxyOrderTtlMinutes
    syncPickerFromMinutes(data.proxyOrderTtlMinutes)
    invalidateSystemSettingsCache()
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onShow(() => {
  if (userStore.token) {
    userStore.fetchUserInfo().finally(load)
  } else {
    load()
  }
})
</script>

<style scoped>
.page-settings {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  box-sizing: border-box;
}

.hero-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 40rpx 36rpx;
  margin-bottom: 24rpx;
}

.hero-title {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
  color: #fff;
}

.hero-subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.6;
}

.empty {
  padding: 80rpx 0;
  text-align: center;
  color: #8A8A8A;
  font-size: 28rpx;
}

.setting-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.setting-head {
  margin-bottom: 28rpx;
}

.setting-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.setting-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #8A8A8A;
  line-height: 1.6;
}

.value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 20rpx;
}

.value-label {
  font-size: 26rpx;
  color: #6B6560;
  flex-shrink: 0;
}

.value-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #3D5A4E;
  text-align: right;
}

.picker-panel {
  background: #F7F5F2;
  border-radius: 16rpx;
  padding: 16rpx 12rpx 8rpx;
  margin-bottom: 28rpx;
}

.picker-labels {
  display: flex;
  justify-content: space-around;
  font-size: 22rpx;
  color: #8A8A8A;
  margin-bottom: 8rpx;
}

.ttl-picker {
  width: 100%;
  height: 360rpx;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  font-size: 30rpx;
  color: #2C2C2C;
}

.save-btn {
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  line-height: 2.4;
}

.save-btn[disabled] {
  opacity: 0.45;
}

.save-btn::after {
  border: none;
}
</style>
