<template>
  <view class="scale-questionnaire">
    <text v-if="meta.desc" class="desc">{{ meta.desc }}</text>
    <view v-for="(q, idx) in meta.questions" :key="idx" class="question-block">
      <text class="q-label">{{ idx + 1 }}. {{ q }}</text>
      <view class="options">
        <view
          v-for="opt in SCORE_OPTIONS"
          :key="opt.value"
          class="option"
          :class="{ active: answers[idx] === opt.value }"
          @tap="setAnswer(idx, opt.value)"
        >
          <text class="opt-num">{{ opt.value }}</text>
          <text class="opt-text">{{ opt.label.replace(/^\d\s/, '') }}</text>
        </view>
      </view>
    </view>
    <view class="total-row">
      <text class="total-label">当前总分</text>
      <text class="total-num">{{ total }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SCORE_OPTIONS, type ScaleMeta } from '@/constants/psychScales'

const props = defineProps<{
  meta: ScaleMeta
  answers: number[]
}>()

const emit = defineEmits<{
  'update:answers': [value: number[]]
}>()

const total = computed(() =>
  props.answers.reduce((sum, n) => sum + (Number(n) || 0), 0),
)

const setAnswer = (idx: number, value: number) => {
  const next = [...props.answers]
  next[idx] = value
  emit('update:answers', next)
}
</script>

<style scoped>
.desc {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  line-height: 1.6;
  margin-bottom: 24rpx;
}
.question-block {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}
.question-block:last-of-type { border-bottom: none; }
.q-label {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2937;
  line-height: 1.6;
  margin-bottom: 16rpx;
}
.options { display: flex; flex-direction: column; gap: 12rpx; }
.option {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: #FAFAF8;
  border: 2rpx solid transparent;
}
.option.active {
  background: #F0FDFA;
  border-color: #A7F3D0;
}
.opt-num {
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  border-radius: 50%;
  background: #E5E7EB;
  font-size: 24rpx;
  font-weight: 700;
  color: #374151;
  flex-shrink: 0;
}
.option.active .opt-num {
  background: #3D5A4E;
  color: #fff;
}
.opt-text { font-size: 26rpx; color: #4B5563; }
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28rpx;
  padding: 24rpx;
  background: #F0FDFA;
  border-radius: 16rpx;
}
.total-label { font-size: 28rpx; color: #047857; font-weight: 600; }
.total-num { font-size: 40rpx; font-weight: 800; color: #3D5A4E; }
</style>
