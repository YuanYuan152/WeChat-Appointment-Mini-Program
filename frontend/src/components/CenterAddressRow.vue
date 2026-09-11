<template>
  <view v-if="address" class="center-address-row" :class="{ compact, 'as-detail-row': asDetailRow }">
    <text v-if="asDetailRow" class="label">中心地址</text>
    <view class="address-body">
      <text class="address-text">{{ address }}</text>
      <text class="copy-btn" @tap.stop="onCopy">复制</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { copyContactCenterAddress, getContactCenterAddress } from '@/constants/contactInfo'

const props = withDefaults(
  defineProps<{
    centerId?: string | null
    /** 直接传入地址时优先使用 */
    addressText?: string | null
    compact?: boolean
    /** 订单详情等左右布局 */
    asDetailRow?: boolean
  }>(),
  {
    compact: false,
    asDetailRow: false,
  },
)

const address = computed(
  () => (props.addressText || '').trim() || getContactCenterAddress(props.centerId),
)

const onCopy = () => copyContactCenterAddress(address.value)
</script>

<style scoped>
.center-address-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 8rpx;
}

.center-address-row.compact {
  margin-top: 4rpx;
}

.center-address-row.as-detail-row {
  justify-content: space-between;
  gap: 24rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
  margin-top: 0;
}

.label {
  font-size: 28rpx;
  color: #6B7280;
  flex-shrink: 0;
}

.address-body {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  flex: 1;
  min-width: 0;
}

.as-detail-row .address-body {
  justify-content: flex-end;
}

.address-text {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  line-height: 1.5;
  color: #6B7280;
  word-break: break-all;
}

.as-detail-row .address-text {
  font-size: 28rpx;
  color: #1F2937;
  font-weight: 500;
  text-align: right;
}

.copy-btn {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #0D9488;
  padding: 0 4rpx;
  line-height: 1.5;
}

.as-detail-row .copy-btn {
  font-size: 26rpx;
  padding-top: 2rpx;
}
</style>
