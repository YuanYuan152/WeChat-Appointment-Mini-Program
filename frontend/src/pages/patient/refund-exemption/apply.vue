<template>
  <view class="page-exemption">
    <view class="tip-card">
      <text class="tip-title">申请退款豁免</text>
      <text class="tip-desc">距咨询开始不足24小时时，可提交豁免申请由管理员审核。审核通过前预约与订单维持不变。</text>
    </view>

    <view v-if="counselorName || slotText" class="info-card">
      <text class="info-title">关联预约</text>
      <text v-if="counselorName" class="info-line">咨询师：{{ counselorName }}</text>
      <text v-if="slotText" class="info-line">咨询时段：{{ slotText }}</text>
      <text v-if="orderAmountYuan" class="info-line">订单金额：￥{{ orderAmountYuan }}</text>
    </view>

    <view class="form-card">
      <view class="form-item">
        <text class="label">申请豁免金额（元）</text>
        <input
          class="input"
          type="digit"
          v-model="form.amountYuan"
          placeholder="请输入申请豁免退款的金额"
        />
      </view>

      <view class="form-item">
        <text class="label">无法前来咨询的原因</text>
        <textarea
          class="textarea"
          v-model="form.reason"
          placeholder="请详细说明无法前来咨询的原因，便于人工审核"
          maxlength="1000"
        />
        <text class="counter">{{ form.reason.length }}/1000</text>
      </view>
    </view>

    <button class="submit-btn" :loading="submitting" :disabled="submitting" @tap="submit">
      提交申请
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface ConsultationItem {
  id: number
  counselorName?: string
  startTime?: string
  endTime?: string
  orderAmount?: number
}

const consultationId = ref(0)
const counselorName = ref('')
const slotText = ref('')
const orderAmountYuan = ref('')

const form = ref({ amountYuan: '', reason: '' })
const submitting = ref(false)

const formatSlotRange = (start?: string, end?: string) => {
  if (!start) return ''
  const startNorm = start.replace('T', ' ')
  const datePart = startNorm.slice(0, 10)
  const startClock = startNorm.slice(11, 16)
  if (!end) return `${datePart} ${startClock}`
  const endNorm = end.replace('T', ' ')
  const endClock = endNorm.slice(11, 16)
  return `${datePart} ${startClock} – ${endClock}`
}

const formatYuan = (cents?: number) => {
  if (!cents) return ''
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}

const applyConsultation = (item: ConsultationItem) => {
  consultationId.value = item.id
  counselorName.value = item.counselorName || ''
  slotText.value = formatSlotRange(item.startTime, item.endTime)
  if (item.orderAmount) {
    orderAmountYuan.value = formatYuan(item.orderAmount)
    if (!form.value.amountYuan) {
      form.value.amountYuan = orderAmountYuan.value
    }
  }
}

const loadConsultation = async (id: number) => {
  try {
    const res = await httpV2.get<ConsultationItem[]>(API_ENDPOINTS.patient.consultations)
    if (res.code === 0 && Array.isArray(res.data)) {
      const found = res.data.find(c => c.id === id)
      if (found) applyConsultation(found)
    }
  } catch {
    // 忽略，保留 URL 参数展示
  }
}

onLoad(async (options: Record<string, string | undefined>) => {
  const id = Number(options?.consultationId || 0)
  if (!id) {
    uni.showToast({ title: '缺少预约信息', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1200)
    return
  }

  consultationId.value = id
  counselorName.value = decodeURIComponent(options?.counselorName || '')
  slotText.value = decodeURIComponent(options?.slotText || '')
  const cents = Number(options?.orderAmount || 0)
  if (cents > 0) {
    orderAmountYuan.value = formatYuan(cents)
    form.value.amountYuan = orderAmountYuan.value
  }

  if (!counselorName.value || !slotText.value) {
    await loadConsultation(id)
  }
})

const submit = async () => {
  if (!consultationId.value) {
    uni.showToast({ title: '预约信息无效', icon: 'none' })
    return
  }
  const amountYuan = parseFloat(form.value.amountYuan)
  if (!amountYuan || amountYuan <= 0) {
    uni.showToast({ title: '请填写有效的申请豁免金额', icon: 'none' })
    return
  }
  const reason = form.value.reason.trim()
  if (!reason) {
    uni.showToast({ title: '请填写无法前来咨询的原因', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.patient.refundExemption(consultationId.value), {
      amount: Math.round(amountYuan * 100),
      reason,
    })
    if (res.code === 0) {
      uni.showToast({ title: '申请已提交，请等待审核', icon: 'success', duration: 2000 })
      setTimeout(() => uni.navigateBack(), 1000)
    } else {
      uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page-exemption {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
  padding-bottom: 48rpx;
}

.tip-card {
  background: linear-gradient(135deg, #FFFBEB, #FEF3C7);
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #FDE68A;
}

.tip-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #92400E;
  margin-bottom: 8rpx;
}

.tip-desc {
  display: block;
  font-size: 24rpx;
  color: #B45309;
  line-height: 1.6;
}

.info-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.info-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 16rpx;
}

.info-line {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  line-height: 1.7;
}

.form-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 8rpx 32rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.form-item {
  padding: 28rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}

.form-item:last-child {
  border-bottom: none;
}

.label {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 14rpx;
}

.input {
  font-size: 30rpx;
  color: #1F2937;
  height: 72rpx;
  background: #F9FAFB;
  border-radius: 12rpx;
  padding: 0 20rpx;
}

.textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 240rpx;
  font-size: 30rpx;
  color: #1F2937;
  background: #F9FAFB;
  border-radius: 12rpx;
  padding: 20rpx;
}

.counter {
  display: block;
  text-align: right;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-top: 8rpx;
}

.submit-btn {
  margin-top: 48rpx;
  background: #0D9488;
  color: #fff;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
}

.submit-btn::after {
  border: none;
}
</style>
