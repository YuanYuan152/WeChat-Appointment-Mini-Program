<template>
  <view class="scale-report">
    <view class="report-card">
      <text class="report-label">测评得分</text>
      <text class="report-score">{{ result.total }}</text>
      <view class="level-badge">
        <text class="level-text">{{ result.levelLabel }}</text>
      </view>
    </view>

    <view v-if="result.description" class="section-card">
      <text class="section-title">结果解读</text>
      <text class="section-body">{{ result.description }}</text>
    </view>

    <view v-if="result.suggestions?.length" class="section-card">
      <text class="section-title">建议</text>
      <view v-for="(s, i) in result.suggestions" :key="i" class="suggestion-row">
        <text class="bullet">•</text>
        <text class="suggestion-text">{{ s }}</text>
      </view>
    </view>

    <view v-if="showAnswers && result.answers?.length" class="section-card">
      <text class="section-title">答题明细</text>
      <view v-for="(q, idx) in questions" :key="idx" class="answer-row">
        <text class="answer-q">{{ idx + 1 }}. {{ q }}</text>
        <text class="answer-v">{{ scoreOptionLabel(result.answers[idx] ?? -1) }}</text>
      </view>
    </view>

    <view class="disclaimer-box">
      <text class="disclaimer-icon">!</text>
      <text class="disclaimer-text">{{ disclaimer }}</text>
    </view>

    <view v-if="showActions" class="actions">
      <button v-if="showRetest" class="action-btn outline" @click="emit('retest')">重新测试</button>
      <button v-if="showReports" class="action-btn outline" @click="emit('reports')">我的报告</button>
      <button v-if="showBack" class="action-btn primary" @click="emit('back')">返回列表</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  getScaleMeta,
  scoreOptionLabel,
  SCALE_DISCLAIMER,
  type ScaleResult,
} from '@/constants/psychScales'

const props = withDefaults(
  defineProps<{
    result: ScaleResult
    showAnswers?: boolean
    showActions?: boolean
    showRetest?: boolean
    showReports?: boolean
    showBack?: boolean
  }>(),
  {
    showAnswers: true,
    showActions: false,
    showRetest: true,
    showReports: true,
    showBack: true,
  },
)

const emit = defineEmits<{
  retest: []
  reports: []
  back: []
}>()

const meta = computed(() => getScaleMeta(props.result.scaleType))
const questions = computed(() => meta.value?.questions || [])
const disclaimer = computed(() => meta.value?.disclaimer || SCALE_DISCLAIMER)
</script>

<style scoped>
.scale-report {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.report-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 48rpx 32rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.report-label {
  display: block;
  font-size: 24rpx;
  color: #9CA3AF;
}

.report-score {
  display: block;
  margin: 16rpx 0 20rpx;
  font-size: 96rpx;
  font-weight: 800;
  color: #3D5A4E;
  line-height: 1;
}

.level-badge {
  display: inline-flex;
  padding: 8rpx 28rpx;
  border-radius: 999rpx;
  background: rgba(61, 90, 78, 0.1);
}

.level-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #3D5A4E;
}

.section-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 16rpx;
}

.section-body {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  line-height: 1.75;
}

.suggestion-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.bullet {
  color: #C9A96E;
  font-size: 28rpx;
  line-height: 1.6;
}

.suggestion-text {
  flex: 1;
  font-size: 26rpx;
  color: #6B7280;
  line-height: 1.65;
}

.answer-row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}

.answer-q {
  display: block;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.6;
}

.answer-v {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #6B7280;
}

.disclaimer-box {
  display: flex;
  gap: 12rpx;
  padding: 20rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
}

.disclaimer-icon {
  width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 50%;
  background: #E5E7EB;
  color: #6B7280;
  font-size: 22rpx;
  flex-shrink: 0;
}

.disclaimer-text {
  flex: 1;
  font-size: 22rpx;
  color: #9CA3AF;
  line-height: 1.65;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 8rpx;
}

.action-btn {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.action-btn::after { border: none; }

.action-btn.primary {
  background: #3D5A4E;
  color: #fff;
}

.action-btn.outline {
  background: #fff;
  color: #3D5A4E;
  border: 2rpx solid #3D5A4E;
}
</style>
