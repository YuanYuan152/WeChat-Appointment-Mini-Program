<template>
  <view v-if="visible" class="sheet-overlay" @touchmove.stop.prevent @tap="onClose">
    <view class="sheet-card" @tap.stop @touchmove.stop.prevent>
      <view class="sheet-header">
        <text class="sheet-title">确认预约与支付</text>
        <text class="sheet-close" @tap="onClose">×</text>
      </view>

      <view v-if="loading" class="sheet-loading">加载订单详情...</view>
      <template v-else-if="order">
        <view class="amount-box">
          <text class="amount-currency">¥</text>
          <text class="amount-value">{{ (order.TotalFee / 100).toFixed(2) }}</text>
        </view>

        <view class="detail-block">
          <text class="block-title">预约信息</text>
          <view class="detail-row">
            <text class="label">咨询师</text>
            <text class="value">{{ order.counselorName || '—' }}</text>
          </view>
          <view class="detail-row">
            <text class="label">预约时间</text>
            <text class="value highlight">{{ formatOrderTime(order.startTime, order.endTime) }}</text>
          </view>
          <view v-if="order.centerName" class="detail-row">
            <text class="label">预约中心</text>
            <text class="value">{{ order.centerName }}</text>
          </view>
          <view v-if="order.roomName" class="detail-row">
            <text class="label">咨询室</text>
            <text class="value">{{ order.roomName }}</text>
          </view>
        </view>

        <view class="detail-block">
          <text class="block-title">订单信息</text>
          <view class="detail-row">
            <text class="label">订单号</text>
            <text class="value mono">{{ order.OutTradeNo }}</text>
          </view>
          <view class="detail-row">
            <text class="label">订单状态</text>
            <text class="value pending">待支付</text>
          </view>
          <view v-if="expireText" class="expire-tip">{{ expireText }}</view>
        </view>

        <view class="tips-block">
          <text class="tips-title">温馨提示</text>
          <text class="tips-line">· 支付成功后预约立即生效；</text>
          <text class="tips-line">· 距咨询开始超过 24 小时可免费取消；</text>
          <text class="tips-line">· 24 小时内取消或爽约，按规定不予退款。</text>
        </view>

        <view class="agree-row" @tap="agreed = !agreed">
          <view class="checkbox" :class="{ checked: agreed }">
            <text v-if="agreed" class="check-icon">✓</text>
          </view>
          <text class="agree-text">我已阅读并同意上述预约与退款规则</text>
        </view>

        <button
          class="confirm-btn"
          :class="{ disabled: !agreed || paying }"
          :disabled="!agreed || paying"
          @tap="onConfirm"
        >{{ paying ? '支付中...' : '确认支付' }}</button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import {
  type PatientOrder,
  executeOrderPayment,
  expireHintText,
  formatOrderTime,
} from '@/utils/orderPayment'

const props = defineProps<{
  visible: boolean
  orderId?: number | null
  /** 若已有完整订单数据可传入，否则按 orderId 拉取详情 */
  initialOrder?: PatientOrder | null
}>()

const emit = defineEmits<{
  close: []
  paid: []
}>()

const order = ref<PatientOrder | null>(null)
const loading = ref(false)
const paying = ref(false)
const agreed = ref(false)

const expireText = computed(() => expireHintText(order.value?.ExpiresAt))

const loadOrder = async () => {
  if (props.initialOrder) {
    order.value = props.initialOrder
    return
  }
  if (!props.orderId) {
    order.value = null
    return
  }
  loading.value = true
  try {
    const res = await httpV2.get<PatientOrder>(API_ENDPOINTS.patient.orderDetail(props.orderId))
    if (res.code === 0 && res.data) {
      order.value = res.data
    } else {
      uni.showToast({ title: res.msg || '加载订单失败', icon: 'none' })
      emit('close')
    }
  } catch {
    uni.showToast({ title: '加载订单失败', icon: 'none' })
    emit('close')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.visible, props.orderId, props.initialOrder] as const,
  ([vis]) => {
    if (vis) {
      agreed.value = false
      loadOrder()
    }
  },
)

const onClose = () => emit('close')

const onConfirm = async () => {
  if (!agreed.value || !order.value || paying.value) return
  paying.value = true
  try {
    const result = await executeOrderPayment(order.value.Id)
    if (result.ok) {
      uni.showToast({ title: '支付成功', icon: 'success' })
      emit('paid')
      emit('close')
    } else {
      uni.showToast({ title: result.msg || '支付失败', icon: 'none' })
    }
  } finally {
    paying.value = false
  }
}
</script>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.sheet-card {
  width: 100%;
  max-height: 88vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1F2937;
}
.sheet-close {
  font-size: 48rpx;
  color: #9CA3AF;
  line-height: 1;
  padding: 0 8rpx;
}
.sheet-loading {
  text-align: center;
  padding: 80rpx 0;
  color: #9CA3AF;
  font-size: 28rpx;
}
.amount-box {
  text-align: center;
  margin-bottom: 32rpx;
}
.amount-currency {
  font-size: 36rpx;
  font-weight: 700;
  color: #0D9488;
}
.amount-value {
  font-size: 72rpx;
  font-weight: 800;
  color: #0D9488;
}
.detail-block {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.block-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16rpx;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 12rpx 0;
}
.label {
  font-size: 26rpx;
  color: #6B7280;
  flex-shrink: 0;
}
.value {
  font-size: 26rpx;
  color: #1F2937;
  font-weight: 500;
  text-align: right;
  flex: 1;
}
.value.highlight {
  color: #3D5A4E;
  font-weight: 600;
}
.value.pending {
  color: #F59E0B;
}
.value.mono {
  font-size: 22rpx;
  word-break: break-all;
}
.expire-tip {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #F59E0B;
}
.tips-block {
  background: #FFFBEB;
  border: 1rpx solid #FDE68A;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}
.tips-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #B45309;
  margin-bottom: 12rpx;
}
.tips-line {
  display: block;
  font-size: 24rpx;
  color: #92400E;
  line-height: 1.6;
}
.agree-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #D1D5DB;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
}
.checkbox.checked {
  background: #3D5A4E;
  border-color: #3D5A4E;
}
.check-icon {
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}
.agree-text {
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.5;
}
.confirm-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #0D9488;
  color: #fff;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 600;
}
.confirm-btn.disabled {
  opacity: 0.5;
}
.confirm-btn::after {
  border: none;
}
</style>
