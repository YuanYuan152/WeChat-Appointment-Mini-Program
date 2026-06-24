<template>
  <view class="header-form">
    <text v-if="showTitle" class="form-title">{{ CASE_RECORD_FORM_TITLE }}</text>

    <view class="header-grid">
      <view class="header-field">
        <text class="field-label">代码<text v-if="required" class="required">*</text></text>
        <input
          v-if="!readonly"
          class="field-input"
          :value="modelValue.code"
          placeholder="请填写"
          @input="onInput('code', $event)"
        />
        <text v-else class="field-readonly">{{ modelValue.code || '—' }}</text>
      </view>

      <view class="header-field">
        <text class="field-label">性别<text v-if="required" class="required">*</text></text>
        <input
          v-if="!readonly"
          class="field-input"
          :value="modelValue.gender"
          placeholder="请填写"
          @input="onInput('gender', $event)"
        />
        <text v-else class="field-readonly">{{ modelValue.gender || '—' }}</text>
      </view>

      <view class="header-field">
        <text class="field-label">咨询方式<text v-if="required" class="required">*</text></text>
        <input
          v-if="!readonly"
          class="field-input"
          :value="modelValue.consult_method"
          placeholder="如：视频咨询、杨浦预约中心"
          @input="onInput('consult_method', $event)"
        />
        <text v-else class="field-readonly">{{ modelValue.consult_method || '—' }}</text>
      </view>

      <view class="header-field">
        <text class="field-label">咨询次数<text v-if="required" class="required">*</text></text>
        <view v-if="!readonly" class="session-row">
          <text class="session-prefix">第</text>
          <input
            class="field-input session-input"
            :value="modelValue.session_number"
            type="number"
            placeholder=""
            @input="onInput('session_number', $event)"
          />
          <text class="session-prefix">次</text>
        </view>
        <text v-else class="field-readonly">第{{ modelValue.session_number || '—' }}次</text>
      </view>
    </view>

    <view class="time-row">
      <text class="field-label">咨询时间<text v-if="required" class="required">*</text></text>
      <view v-if="!readonly" class="time-inputs">
        <input class="time-input" :value="modelValue.start_year" type="number" placeholder="年" @input="onInput('start_year', $event)" />
        <text class="time-unit">年</text>
        <input class="time-input" :value="modelValue.start_month" type="number" placeholder="月" @input="onInput('start_month', $event)" />
        <text class="time-unit">月</text>
        <input class="time-input" :value="modelValue.start_day" type="number" placeholder="日" @input="onInput('start_day', $event)" />
        <text class="time-unit">日</text>
        <input class="time-input" :value="modelValue.start_hour" type="number" placeholder="时" @input="onInput('start_hour', $event)" />
        <text class="time-unit">时</text>
        <input class="time-input" :value="modelValue.start_minute" type="number" placeholder="分" @input="onInput('start_minute', $event)" />
        <text class="time-unit">分</text>
        <text class="time-sep">——</text>
        <input class="time-input" :value="modelValue.end_hour" type="number" placeholder="时" @input="onInput('end_hour', $event)" />
        <text class="time-unit">时</text>
        <input class="time-input" :value="modelValue.end_minute" type="number" placeholder="分" @input="onInput('end_minute', $event)" />
        <text class="time-unit">分</text>
      </view>
      <text v-else class="field-readonly time-readonly">
        {{ modelValue.start_year || '—' }}年{{ modelValue.start_month || '—' }}月{{ modelValue.start_day || '—' }}日
        {{ modelValue.start_hour || '—' }}时{{ modelValue.start_minute || '—' }}分
        ——
        {{ modelValue.end_hour || '—' }}时{{ modelValue.end_minute || '—' }}分
      </text>
    </view>

    <view class="signature-row">
      <text class="field-label">咨询师签名<text v-if="required" class="required">*</text></text>
      <input
        v-if="!readonly"
        class="field-input"
        :value="modelValue.counselor_signature"
        placeholder="请填写咨询师签名"
        @input="onInput('counselor_signature', $event)"
      />
      <text v-else class="field-readonly">{{ modelValue.counselor_signature || '—' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import {
  CASE_RECORD_FORM_TITLE,
  type CaseRecordHeaderInfo,
} from '@/constants/caseRecordHeader'

const props = withDefaults(
  defineProps<{
    modelValue: CaseRecordHeaderInfo
    readonly?: boolean
    required?: boolean
    showTitle?: boolean
  }>(),
  {
    readonly: false,
    required: true,
    showTitle: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: CaseRecordHeaderInfo]
}>()

const onInput = (key: keyof CaseRecordHeaderInfo, e: { detail?: { value?: string } }) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: e.detail?.value ?? '',
  })
}
</script>

<style scoped>
.header-form {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.form-title {
  display: block;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 8rpx;
}

.header-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.header-field,
.time-row,
.signature-row {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.field-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
  line-height: 1.4;
}

.required {
  color: #DC2626;
  margin-left: 4rpx;
}

.field-input {
  width: 100%;
  height: 56rpx;
  min-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 8rpx;
  background: #F9FAFB;
  border: 1rpx solid #E5E7EB;
  font-size: 26rpx;
  color: #374151;
  line-height: 56rpx;
  box-sizing: border-box;
}

.field-readonly {
  font-size: 26rpx;
  color: #374151;
  line-height: 1.5;
  padding: 4rpx 0;
}

.session-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.session-prefix {
  font-size: 26rpx;
  color: #374151;
}

.session-input {
  width: 100rpx;
  max-width: 100rpx;
  flex: none;
}

.time-inputs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6rpx;
}

.time-input {
  width: 72rpx;
  height: 48rpx;
  min-height: 48rpx;
  padding: 0 6rpx;
  border-radius: 8rpx;
  background: #F9FAFB;
  border: 1rpx solid #E5E7EB;
  font-size: 24rpx;
  text-align: center;
  line-height: 48rpx;
  box-sizing: border-box;
}

.time-unit {
  font-size: 22rpx;
  color: #6B7280;
  margin-right: 2rpx;
}

.time-sep {
  font-size: 22rpx;
  color: #6B7280;
  margin: 0 4rpx;
}

.time-readonly {
  line-height: 1.7;
}
</style>
