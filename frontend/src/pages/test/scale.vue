<template>
  <view class="page-scale">
    <view v-if="!meta" class="empty">量表不存在</view>
    <template v-else>
      <view class="header-card">
        <text class="title">{{ meta.title }}</text>
      </view>
      <view class="form-card">
        <ScaleQuestionnaire v-model:answers="answers" :meta="meta" />
      </view>
      <button class="submit-btn" :loading="submitting" @click="submit">提交测评</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { isLoggedIn } from '@/utils/auth'
import { getScaleMeta } from '@/constants/psychScales'
import ScaleQuestionnaire from '@/components/ScaleQuestionnaire.vue'

const scaleType = ref('')
const answers = ref<number[]>([])
const submitting = ref(false)

const meta = computed(() => getScaleMeta(scaleType.value))

const initAnswers = () => {
  const m = meta.value
  if (!m) return
  answers.value = Array(m.questions.length).fill(-1)
}

onLoad((opts) => {
  if (!isLoggedIn()) {
    uni.showModal({
      title: '需要登录',
      content: '请先登录后再进行量表测评',
      showCancel: false,
      success: () => {
        uni.redirectTo({
          url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/test/scale?type=' + (opts?.type || 'PHQ9')),
        })
      },
    })
    return
  }
  scaleType.value = String(opts?.type || 'PHQ9')
  initAnswers()
  if (meta.value) {
    uni.setNavigationBarTitle({ title: meta.value.title })
  }
})

const submit = async () => {
  const m = meta.value
  if (!m) return
  if (answers.value.some(v => v < 0)) {
    uni.showToast({ title: '请完成全部题目', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.patient.scales, {
      scaleType: m.type,
      answers: answers.value,
    })
    if (res.code === 0 && res.data) {
      uni.setStorageSync('last_scale_result', res.data)
      uni.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => {
        uni.redirectTo({ url: `/pages/test/result-detail?id=${res.data.id}` })
      }, 800)
    } else {
      uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page-scale {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}
.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; }
.header-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
}
.title { font-size: 34rpx; font-weight: 700; color: #2C2C2C; }
.form-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx 28rpx 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.submit-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 32rpx;
  font-weight: 700;
}
.submit-btn::after { border: none; }
</style>
