<template>
  <view class="page-leave">
    <view class="info-card">
      <text class="info-title">请假申请</text>
      <text class="info-line">请返回咨询师工作台，在对应已预约时段点击「请假」，上传与来访者的沟通截图后确认取消。</text>
      <text v-if="slotText" class="info-line">时段：{{ slotText }}</text>
      <text v-if="centerRoom" class="info-line">地点：{{ centerRoom }}</text>
    </view>

    <view class="form-card">
      <view class="form-item">
        <text class="label">请假原因</text>
        <textarea
          v-model="reason"
          class="textarea"
          placeholder="请说明无法履约的原因，提交后将通知运营并协助来访者改约"
          maxlength="1000"
        />
        <text class="counter">{{ reason.length }}/1000</text>
      </view>
    </view>

    <button class="submit-btn" :loading="submitting" @tap="submit">提交请假申请</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const scheduleId = ref(0)
const slotText = ref('')
const centerRoom = ref('')
const reason = ref('')
const submitting = ref(false)

onLoad((options: Record<string, string | undefined>) => {
  scheduleId.value = Number(options?.scheduleId || 0)
  slotText.value = decodeURIComponent(options?.slotText || '')
  centerRoom.value = decodeURIComponent(options?.centerRoom || '')
  if (!scheduleId.value) {
    uni.showToast({ title: '缺少排班信息', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1200)
  }
})

const submit = async () => {
  const text = reason.value.trim()
  if (!text) {
    uni.showToast({ title: '请填写请假原因', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await httpV2.post(
      API_ENDPOINTS.counselor.scheduleLeaveRequest(scheduleId.value),
      { reason: text },
    )
    if (res.code === 0) {
      uni.showToast({
        title: (res.data as any)?.message || '请假申请已提交',
        icon: 'none',
        duration: 2500,
      })
      setTimeout(() => uni.navigateBack(), 1500)
    } else {
      uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page-leave { min-height: 100vh; background: #F4F6F8; padding: 32rpx; }
.info-card {
  background: #FFFBEB; border: 1rpx solid #FDE68A; border-radius: 24rpx;
  padding: 28rpx 32rpx; margin-bottom: 24rpx;
}
.info-title { display: block; font-size: 32rpx; font-weight: 700; color: #92400E; margin-bottom: 12rpx; }
.info-line { display: block; font-size: 26rpx; color: #B45309; line-height: 1.7; }
.form-card { background: #fff; border-radius: 24rpx; padding: 32rpx; }
.label { display: block; font-size: 28rpx; font-weight: 600; color: #374151; margin-bottom: 12rpx; }
.textarea {
  width: 100%; box-sizing: border-box; min-height: 240rpx; font-size: 30rpx;
  background: #F9FAFB; border-radius: 12rpx; padding: 20rpx;
}
.counter { display: block; text-align: right; font-size: 22rpx; color: #9CA3AF; margin-top: 8rpx; }
.submit-btn {
  margin-top: 40rpx; background: #0D9488; color: #fff; height: 88rpx; line-height: 88rpx;
  border-radius: 100rpx; font-size: 30rpx; border: none;
}
.submit-btn::after { border: none; }
</style>
