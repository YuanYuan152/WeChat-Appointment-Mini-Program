<template>
  <view class="feedback-display">
    <view v-if="goalScore && goalScore > 0" class="row stars-row">
      <text class="row-label">目标达成</text>
      <FeedbackStarRating :model-value="goalScore" readonly />
      <text v-if="goalScoreHint(goalScore)" class="hint">{{ goalScoreHint(goalScore) }}</text>
    </view>
    <view v-if="rhythmScore && rhythmScore > 0" class="row stars-row">
      <text class="row-label">议题节奏</text>
      <FeedbackStarRating :model-value="rhythmScore" readonly />
      <text v-if="rhythmScoreHint(rhythmScore)" class="hint">{{ rhythmScoreHint(rhythmScore) }}</text>
    </view>
    <text v-if="improvements?.length" class="row text-row">改进方面：{{ improvements.join('、') }}</text>
    <text v-else-if="summary && !goalScore && !rhythmScore" class="row text-row">{{ summary }}</text>
    <text v-if="!hasStructured && !summary" class="row text-row muted">已提交反馈</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FeedbackStarRating from '@/components/FeedbackStarRating.vue'
import { goalScoreHint, rhythmScoreHint } from '@/constants/consultationFeedback'

const props = defineProps<{
  goalScore?: number | null
  rhythmScore?: number | null
  improvements?: string[]
  summary?: string
}>()

const hasStructured = computed(
  () =>
    (props.goalScore && props.goalScore > 0)
    || (props.rhythmScore && props.rhythmScore > 0)
    || (props.improvements && props.improvements.length > 0),
)
</script>

<style scoped>
.feedback-display { display: flex; flex-direction: column; gap: 12rpx; }
.row { font-size: 26rpx; color: #374151; line-height: 1.6; }
.stars-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx 16rpx; }
.row-label { font-size: 26rpx; color: #6B7280; flex-shrink: 0; }
.hint { font-size: 24rpx; color: #9CA3AF; }
.text-row.muted { color: #9CA3AF; }
</style>
