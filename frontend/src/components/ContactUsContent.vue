<template>
  <view class="contact-us" :class="{ compact: compact }">
    <view v-if="showCenters" class="block">
      <text class="block-title">咨询中心地址</text>
      <view v-for="center in centers" :key="center.id" class="center-item">
        <text class="center-name">{{ center.name }}</text>
        <view class="center-address site-prose-paragraph">
          {{ center.address }}
        </view>
      </view>
    </view>

    <view class="block">
      <text class="block-title">助理微信二维码</text>
      <view v-if="assistant.hint" class="qr-hint site-prose-paragraph">
        {{ assistant.hint }}
      </view>
      <view class="qr-wrap">
        <image
          class="qr-image"
          :src="qrSrc"
          mode="aspectFit"
          show-menu-by-longpress
          @error="onQrError"
        />
        <view v-if="qrLoadFailed" class="qr-fallback">
          <text class="qr-fallback-text">二维码暂未配置</text>
          <text class="qr-fallback-sub">请致电助理或前往咨询中心</text>
        </view>
      </view>
      <text class="qr-tip">长按识别二维码添加助理微信</text>
      <text class="work-hours">{{ assistant.workHours }}</text>
    </view>

    <view class="block">
      <text class="block-title">助理联系电话</text>
      <view class="phone-row" @tap="callAssistant">
        <text class="phone-number">{{ assistant.phone }}</text>
        <text class="phone-action">点击拨打</text>
      </view>
      <text class="work-hours">{{ assistant.workHours }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ASSISTANT_CONTACT, CONTACT_CENTERS, type ContactCenter } from '@/constants/contactInfo'
import { fetchPublicSiteContent } from '@/utils/siteContentApi'
import { fixImageUrl } from '@/utils/image'

const props = withDefaults(
  defineProps<{
    showCenters?: boolean
    compact?: boolean
    centers?: ContactCenter[]
    qrcodeSrc?: string
  }>(),
  {
    showCenters: true,
    compact: false,
    centers: () => CONTACT_CENTERS,
  },
)

const assistant = ASSISTANT_CONTACT
const qrLoadFailed = ref(false)
const remoteQrcodeSrc = ref('')

onMounted(async () => {
  if (props.qrcodeSrc?.trim()) {
    return
  }
  const payload = await fetchPublicSiteContent()
  const url = payload?.pages?.contact?.assistantQrcodeUrl
  if (url?.trim()) {
    remoteQrcodeSrc.value = url.trim()
  }
})

const qrSrc = computed(() => {
  const raw = props.qrcodeSrc?.trim() || remoteQrcodeSrc.value || assistant.qrcodeSrc
  return fixImageUrl(raw)
})

watch(qrSrc, () => {
  qrLoadFailed.value = false
})

const callAssistant = () => {
  uni.makePhoneCall({ phoneNumber: assistant.phoneDial })
}

const onQrError = () => {
  qrLoadFailed.value = true
}
</script>

<style scoped lang="scss">
@import '@/styles/site-prose.scss';

.contact-us {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.block {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);
}

.compact .block {
  padding: 24rpx;
  box-shadow: none;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
}

.block-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #3D5A4E;
  margin-bottom: 20rpx;
}

.center-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F0EDE8;
}

.center-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.center-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #2C2C2C;
  margin-bottom: 8rpx;
}

.center-address {
  font-size: 26rpx;
  color: #6b6560;
  line-height: 1.7;
}

.qr-hint {
  font-size: 26rpx;
  color: #6b6560;
  line-height: 1.6;
  margin-bottom: 20rpx;
}

.phone-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background: #F7F5F2;
  border-radius: 16rpx;
}

.phone-number {
  font-size: 36rpx;
  font-weight: 700;
  color: #3D5A4E;
  letter-spacing: 1rpx;
}

.phone-action {
  font-size: 24rpx;
  color: #0D9488;
  font-weight: 600;
}

.qr-wrap {
  position: relative;
  width: 360rpx;
  height: 360rpx;
  margin: 0 auto;
  background: #F7F5F2;
  border-radius: 20rpx;
  overflow: hidden;
}

.qr-image {
  width: 100%;
  height: 100%;
}

.qr-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  background: #F7F5F2;
}

.qr-fallback-text {
  font-size: 28rpx;
  color: #6B6560;
  font-weight: 600;
}

.qr-fallback-sub {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8A8A8A;
  text-align: center;
}

.qr-tip {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 24rpx;
  color: #8A8A8A;
}

.work-hours {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #8A8A8A;
  line-height: 1.6;
}
</style>
