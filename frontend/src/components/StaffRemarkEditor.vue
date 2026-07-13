<template>
  <view class="staff-remark" :class="{ compact }">
    <view v-if="compact" class="staff-remark-row">
      <textarea
        class="staff-remark-input"
        v-model="draft"
        :maxlength="maxLength"
        placeholder="内部备注，仅咨询助理/主任/管理员可见"
        placeholder-class="staff-remark-ph"
        :auto-height="false"
      />
      <view
        class="staff-remark-save"
        :class="{ disabled: !dirty || saving, loading: saving }"
        @tap="save"
      >保存</view>
    </view>
    <template v-else>
      <text class="staff-remark-label block">备注</text>
      <text class="staff-remark-hint">仅咨询助理/主任/管理员可见</text>
      <textarea
        class="staff-remark-input block"
        v-model="draft"
        :maxlength="maxLength"
        placeholder="填写内部备注，点击保存后生效"
        auto-height
      />
      <button
        class="staff-remark-save block"
        :loading="saving"
        :disabled="!dirty || saving"
        @tap="save"
      >保存备注</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const props = withDefaults(
  defineProps<{
    accountId: number
    modelValue?: string
    maxLength?: number
    compact?: boolean
  }>(),
  {
    modelValue: '',
    maxLength: 2000,
    compact: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  saved: [value: string]
}>()

const draft = ref(props.modelValue || '')
const saving = ref(false)

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value || ''
  },
)

const dirty = computed(() => (draft.value || '').trim() !== (props.modelValue || '').trim())

const save = async () => {
  if (!props.accountId || saving.value || !dirty.value) return
  saving.value = true
  try {
    const res = await httpV2.put<{ staffRemark: string }>(
      API_ENDPOINTS.admin.staffRemark(props.accountId),
      { remark: draft.value },
    )
    if (res.code === 0) {
      const saved = res.data?.staffRemark ?? draft.value.trim()
      draft.value = saved
      emit('update:modelValue', saved)
      emit('saved', saved)
      uni.showToast({ title: '备注已保存', icon: 'success' })
    } else {
      uni.showToast({ title: res.message || '保存失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.staff-remark.compact {
  width: 100%;
  margin-top: 12rpx;
  box-sizing: border-box;
}

.staff-remark-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  width: 100%;
}

.staff-remark-label {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 500;
  color: #9CA3AF;
}

.staff-remark-label.block {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
}

.staff-remark-hint {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #9CA3AF;
}

.staff-remark-input {
  flex: 1;
  width: 0;
  min-width: 0;
  height: 60rpx;
  min-height: 60rpx;
  max-height: 60rpx;
  padding: 10rpx 16rpx;
  box-sizing: border-box;
  background: #F7F5F2;
  border-radius: 10rpx;
  font-size: 24rpx;
  color: #2C2C2C;
  line-height: 1.3;
}

.staff-remark-input.block {
  width: 100%;
  min-height: 120rpx;
  max-height: none;
  height: auto;
  margin-top: 12rpx;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  font-size: 26rpx;
}

.staff-remark-save {
  flex-shrink: 0;
  min-width: 88rpx;
  padding: 0 12rpx;
  height: 56rpx;
  line-height: 56rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 100rpx;
  font-size: 22rpx;
  text-align: center;
}

.staff-remark-save.disabled {
  opacity: 0.4;
}

.staff-remark-save.loading {
  opacity: 0.7;
}

.staff-remark-save.block {
  width: 100%;
  height: 68rpx;
  line-height: 68rpx;
  margin-top: 16rpx;
  font-size: 26rpx;
}

.staff-remark-save.block[disabled] {
  opacity: 0.45;
}

.staff-remark:not(.compact) {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #F0EDE8;
}
</style>

<style>
.staff-remark-ph {
  font-size: 22rpx;
  color: #9CA3AF;
}
</style>
