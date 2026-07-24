<template>
  <view class="page-counselor-profile">
    <view v-if="!profileLoaded" class="loading-box">
      <text>加载中...</text>
    </view>

    <template v-else>
      <view class="notice-bar">
        <text class="notice-text">咨询师对外展示资料由平台统一维护，如需修改请联系运营</text>
      </view>

      <view class="profile-card">
        <image
          class="avatar"
          :src="avatarSrc"
          mode="aspectFill"
        />
        <view class="profile-head">
          <text class="name">{{ profile.name || '—' }}</text>
          <text v-if="profile.title" class="title">{{ profile.title }}</text>
        </view>
      </view>

      <view class="info-card">
        <view class="info-row">
          <text class="label">咨询费用</text>
          <text class="value">￥{{ displayPrice }} / 次</text>
        </view>
        <view class="info-row">
          <text class="label">从业年限</text>
          <text class="value">{{ displayYears(profile.workYears) }}</text>
        </view>
        <view class="info-row">
          <text class="label">咨询时数</text>
          <text class="value">{{ displayHours(profile.consultHours) }}</text>
        </view>
        <view class="info-row">
          <text class="label">培训经历</text>
          <text class="value">{{ profile.career || '—' }}</text>
        </view>
        <view class="info-row">
          <text class="label">咨询方式</text>
          <text class="value">{{ profile.mode || '—' }}</text>
        </view>
        <view class="info-row">
          <text class="label">专业领域</text>
          <text class="value">{{ profile.field || '—' }}</text>
        </view>
        <view class="info-row">
          <text class="label">服务人群</text>
          <text class="value">{{ profile.targetGroup || '—' }}</text>
        </view>
      </view>

      <view class="info-card">
        <text class="section-title">擅长方向</text>
        <text class="section-text">{{ profile.specialty || '—' }}</text>
      </view>

      <view class="info-card">
        <text class="section-title">咨询师简介</text>
        <text class="section-text">{{ profile.introduce || '—' }}</text>
      </view>

      <view class="info-card">
        <text class="section-title">资质证书</text>
        <text class="section-text">{{ profile.qualification || '—' }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { fixImageUrl } from '@/utils/image'

interface CounselorProfileView {
  name?: string
  avatarUrl?: string
  title?: string
  field?: string
  specialty?: string
  introduce?: string
  career?: string
  qualification?: string
  targetGroup?: string
  mode?: string
  billing?: number
  consultHours?: number
  workYears?: number
}

const profileLoaded = ref(false)
const profile = ref<CounselorProfileView>({})

const displayPrice = computed(() => Math.round(Number(profile.value.billing || 0) / 100) || 0)

const avatarSrc = computed(() => {
  const url = profile.value.avatarUrl
  return url ? fixImageUrl(url) : '/static/images-opt/default-avatar.jpg'
})

const displayYears = (years?: number) => {
  if (!years) return '—'
  return `${years} 年`
}

const displayHours = (hours?: number) => {
  if (!hours) return '—'
  return `${hours} 小时`
}

const load = async () => {
  try {
    const res = await httpV2.get<CounselorProfileView>(API_ENDPOINTS.counselor.profile)
    if (res.code === 0 && res.data) {
      profile.value = res.data
    }
  } finally {
    profileLoaded.value = true
  }
}

onMounted(load)
</script>

<style scoped>
.page-counselor-profile {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 28rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}

.loading-box {
  padding: 120rpx 0;
  text-align: center;
  color: #9CA3AF;
  font-size: 28rpx;
}

.notice-bar {
  background: #F0EDE8;
  border: 1rpx solid #E8E4DE;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}

.notice-text {
  font-size: 24rpx;
  color: #3D5A4E;
  line-height: 1.6;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid #E8E4DE;
  background: #F3F4F6;
  flex-shrink: 0;
}

.profile-head {
  flex: 1;
  min-width: 0;
}

.name {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #2C2C2C;
}

.title {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #3D5A4E;
  font-weight: 600;
}

.info-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #F0EDE8;
}

.info-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.label {
  font-size: 26rpx;
  color: #8A8A8A;
  flex-shrink: 0;
}

.value {
  font-size: 26rpx;
  color: #2C2C2C;
  text-align: right;
  line-height: 1.6;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #3D5A4E;
  margin-bottom: 16rpx;
}

.section-text {
  display: block;
  font-size: 28rpx;
  color: #6B6560;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
