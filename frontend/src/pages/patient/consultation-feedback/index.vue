<template>
  <view class="page-feedback">
    <view class="info-card">
      <text class="info-label">咨询师</text>
      <text class="info-value">{{ counselorName || '—' }}</text>
      <text v-if="slotText" class="info-sub">{{ slotText }}</text>
    </view>

    <view class="form-card">
      <!-- 问题1：目标达成 -->
      <view class="form-block">
        <text class="question">{{ GOAL_QUESTION }}</text>
        <FeedbackStarRating v-model="goalScore" />
        <text v-if="goalScore && goalScoreHint(goalScore)" class="score-hint">
          {{ goalScoreHint(goalScore) }}
        </text>
      </view>

      <!-- 问题2：议题节奏 -->
      <view class="form-block">
        <text class="question">{{ RHYTHM_QUESTION }}</text>
        <FeedbackStarRating v-model="rhythmScore" />
        <text v-if="rhythmScore && rhythmScoreHint(rhythmScore)" class="score-hint">
          {{ rhythmScoreHint(rhythmScore) }}
        </text>
      </view>

      <!-- 问题3：改进方面（多选） -->
      <view class="form-block">
        <text class="question">【多选】{{ IMPROVEMENT_QUESTION }}</text>
        <view class="option-list">
          <view
            v-for="opt in IMPROVEMENT_OPTIONS"
            :key="opt"
            class="option-item"
            :class="{ selected: improvements.includes(opt) }"
            @tap="toggleImprovement(opt)"
          >
            <view class="checkbox" :class="{ checked: improvements.includes(opt) }">
              <text v-if="improvements.includes(opt)" class="check-icon">✓</text>
            </view>
            <text class="option-label">{{ opt }}</text>
          </view>
        </view>
      </view>
    </view>

    <button class="submit-btn" :loading="submitting" @click="submit">提交反馈</button>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import {
  GOAL_QUESTION,
  RHYTHM_QUESTION,
  IMPROVEMENT_QUESTION,
  IMPROVEMENT_OPTIONS,
  goalScoreHint,
  rhythmScoreHint,
  PATIENT_RECORDS_AFTER_FEEDBACK,
} from '@/constants/consultationFeedback'
import FeedbackStarRating from '@/components/FeedbackStarRating.vue'

const NONE_IMPROVEMENT = '暂无需要改进的地方'

const consultationId = ref(0)
const counselorName = ref('')
const slotText = ref('')
const goalScore = ref<number | null>(null)
const rhythmScore = ref<number | null>(null)
const improvements = ref<string[]>([])
const submitting = ref(false)

const toggleImprovement = (opt: string) => {
  if (opt === NONE_IMPROVEMENT) {
    improvements.value = improvements.value.includes(opt) ? [] : [opt]
    return
  }
  const next = improvements.value.filter(x => x !== NONE_IMPROVEMENT)
  const idx = next.indexOf(opt)
  if (idx >= 0) {
    next.splice(idx, 1)
  } else {
    next.push(opt)
  }
  improvements.value = next
}

const submit = async () => {
  if (!consultationId.value) return

  submitting.value = true
  try {
    const res = await httpV2.post(
      API_ENDPOINTS.patient.consultationFeedback(consultationId.value),
      {
        goalScore: goalScore.value || null,
        rhythmScore: rhythmScore.value || null,
        improvements: improvements.value,
      },
    )
    if (res.code === 0) {
      uni.setStorageSync(PATIENT_RECORDS_AFTER_FEEDBACK, '1')
      uni.showToast({ title: '反馈已提交', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 900)
    } else {
      uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
    }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  const pages = getCurrentPages()
  const opts = (pages[pages.length - 1] as any).options || {}
  consultationId.value = Number(opts.consultationId || 0)
  counselorName.value = decodeURIComponent(opts.counselorName || '')
  slotText.value = decodeURIComponent(opts.slotText || '')
})
</script>

<style scoped>
.page-feedback {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}
.info-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.info-label { display: block; font-size: 24rpx; color: #9CA3AF; margin-bottom: 8rpx; }
.info-value { display: block; font-size: 32rpx; font-weight: 700; color: #1F2937; }
.info-sub { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B7280; }
.form-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 16rpx 32rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.form-block {
  padding: 28rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}
.form-block:last-child { border-bottom: none; }
.question {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2937;
  line-height: 1.6;
  margin-bottom: 24rpx;
}
.score-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #9CA3AF;
}
.option-list { display: flex; flex-direction: column; gap: 16rpx; }
.option-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: #FAFAF8;
  border: 2rpx solid transparent;
}
.option-item.selected {
  background: #F0FDFA;
  border-color: #A7F3D0;
}
.checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid #D1D5DB;
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
.check-icon { color: #fff; font-size: 24rpx; font-weight: 700; }
.option-label {
  flex: 1;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.5;
}
.submit-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border: none;
  border-radius: 100rpx;
  margin-top: 40rpx;
  background: #3D5A4E;
  color: #fff;
  font-size: 32rpx;
  font-weight: 800;
}
.submit-btn::after { border: none; }
</style>
