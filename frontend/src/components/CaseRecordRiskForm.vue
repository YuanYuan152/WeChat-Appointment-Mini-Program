<template>
  <view class="risk-form">
    <text v-if="title" class="risk-title">{{ title }}</text>
    <text v-if="hint" class="risk-hint">{{ hint }}</text>

    <view v-for="item in RISK_ASSESSMENT_ITEMS" :key="item.id" class="risk-row">
      <view class="risk-head">
        <text class="risk-index">{{ item.index }}</text>
        <view class="risk-head-text">
          <text class="risk-label">
            {{ item.label }}<text v-if="required" class="required">*</text>
          </text>
          <text v-if="item.description" class="risk-desc">{{ item.description }}</text>
        </view>
      </view>

      <view class="option-list">
        <view
          v-for="opt in displayOptions(item)"
          :key="opt.choice"
          class="option-item"
          :class="{
            active: getChoice(item.id) === opt.choice,
            readonly: readonly,
          }"
          @tap="selectChoice(item.id, opt.choice)"
        >
          <text class="option-mark">{{ getChoice(item.id) === opt.choice ? '✓' : '' }}</text>
          <text class="option-text">{{ opt.label }}</text>
        </view>
      </view>

      <view v-if="needsNote(item, getChoice(item.id))" class="note-box">
        <textarea
          v-if="!readonly"
          class="note-input"
          :value="getNote(item.id)"
          :placeholder="notePlaceholder(item, getChoice(item.id))"
          :auto-height="true"
          :maxlength="500"
          @input="onNoteInput(item.id, $event)"
        />
        <text v-else class="note-readonly">{{ getNote(item.id) || '—' }}</text>
      </view>
    </view>

    <view class="guide-box">
      <text class="guide-title">风险等级说明</text>
      <text class="guide-text">{{ RISK_LEVEL_GUIDE }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import {
  RISK_ASSESSMENT_ITEMS,
  RISK_LEVEL_GUIDE,
  normalizeRiskChoice,
  type RiskAssessmentData,
  type RiskAssessmentItemConfig,
  type RiskChoice,
} from '@/constants/caseRecordRiskAssessment'

const props = withDefaults(
  defineProps<{
    modelValue: RiskAssessmentData
    readonly?: boolean
    required?: boolean
    title?: string
    hint?: string
  }>(),
  {
    readonly: false,
    required: true,
    title: '个案风险评估表',
    hint: '请逐项选择对应选项；选「其他」项时请填写文字说明',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: RiskAssessmentData]
}>()

interface DisplayOption {
  choice: RiskChoice
  label: string
}

const getChoice = (itemId: string): RiskChoice =>
  normalizeRiskChoice(props.modelValue.items[itemId]?.choice ?? '', itemId)

const optionContent = (item: RiskAssessmentItemConfig, choice: RiskChoice): string =>
  item.options[choice as 'A' | 'B' | 'C' | 'D' | 'E'] ?? choice

const displayOptions = (item: RiskAssessmentItemConfig): DisplayOption[] => {
  const all = item.choices.map(choice => ({
    choice,
    label: `${choice}. ${optionContent(item, choice)}`,
  }))
  if (!props.readonly) return all
  const selected = getChoice(item.id)
  if (!selected) return all
  return all.filter(o => o.choice === selected)
}

const getNote = (itemId: string) => props.modelValue.items[itemId]?.note ?? ''

const needsNote = (item: RiskAssessmentItemConfig, choice: RiskChoice) => {
  if (!choice) return false
  return item.noteChoices.includes(choice)
}

const notePlaceholder = (item: RiskAssessmentItemConfig, choice: RiskChoice) => {
  if (item.otherChoice === 'C' && choice === 'C') return '请填写其他说明'
  if (item.otherChoice === 'E' && choice === 'E') return '请填写其他说明'
  return '请填写具体说明'
}

const patchItem = (itemId: string, patch: Partial<{ choice: RiskChoice; note: string }>) => {
  const next: RiskAssessmentData = {
    items: {
      ...props.modelValue.items,
      [itemId]: {
        choice: patch.choice ?? props.modelValue.items[itemId]?.choice ?? '',
        note: patch.note ?? props.modelValue.items[itemId]?.note ?? '',
      },
    },
  }
  emit('update:modelValue', next)
}

const selectChoice = (itemId: string, choice: RiskChoice) => {
  if (props.readonly) return
  const prev = props.modelValue.items[itemId]
  patchItem(itemId, {
    choice,
    note: prev?.choice === choice ? (prev.note ?? '') : '',
  })
}

const onNoteInput = (itemId: string, e: { detail?: { value?: string } }) => {
  patchItem(itemId, { note: e.detail?.value ?? '' })
}
</script>

<style scoped>
.risk-form {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.risk-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 4rpx;
}

.risk-hint {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  line-height: 1.5;
  margin-bottom: 8rpx;
}

.risk-row {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F0EDE8;
}

.risk-row:last-of-type {
  border-bottom: none;
}

.risk-head {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.risk-index {
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  border-radius: 50%;
  background: #3D5A4E;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.risk-head-text {
  flex: 1;
}

.risk-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
  line-height: 1.5;
}

.risk-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #6B7280;
  line-height: 1.5;
}

.required {
  color: #DC2626;
  margin-left: 4rpx;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid #E5E7EB;
  background: #fff;
}

.option-item.active {
  border-color: #3D5A4E;
  background: #F0F5F3;
}

.option-item.readonly {
  pointer-events: none;
}

.option-mark {
  width: 32rpx;
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  color: #3D5A4E;
  line-height: 1.5;
}

.option-text {
  flex: 1;
  font-size: 24rpx;
  color: #374151;
  line-height: 1.6;
}

.option-item.active .option-text {
  color: #1F2937;
  font-weight: 600;
}

.note-box {
  margin-top: 12rpx;
}

.note-input {
  width: 100%;
  min-height: 88rpx;
  padding: 16rpx;
  border-radius: 12rpx;
  background: #FFFBEB;
  border: 1rpx solid #FDE68A;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.5;
}

.note-readonly {
  display: block;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.6;
  white-space: pre-wrap;
}

.guide-box {
  margin-top: 16rpx;
  padding: 20rpx;
  background: #F7F5F2;
  border-radius: 12rpx;
}

.guide-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #3D5A4E;
  margin-bottom: 8rpx;
}

.guide-text {
  display: block;
  font-size: 22rpx;
  color: #6B7280;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
