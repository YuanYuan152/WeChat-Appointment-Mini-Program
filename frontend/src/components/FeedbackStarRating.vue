<template>
  <view class="star-row" :class="{ readonly }">
    <view
      v-for="n in STAR_COUNT"
      :key="n"
      class="star-wrap"
      @tap="onTap(n)"
    >
      <text class="star-icon" :class="{ active: n <= (modelValue || 0) }">★</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { STAR_COUNT } from '@/constants/consultationFeedback'

const props = withDefaults(
  defineProps<{
    modelValue?: number | null
    readonly?: boolean
  }>(),
  {
    modelValue: null,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const onTap = (n: number) => {
  if (props.readonly) return
  emit('update:modelValue', n)
}
</script>

<style scoped>
.star-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.star-wrap {
  padding: 4rpx;
}
.star-icon {
  font-size: 52rpx;
  line-height: 1;
  color: #E5E7EB;
}
.star-icon.active {
  color: #FBBF24;
}
.star-row.readonly .star-wrap {
  padding: 0;
}
.star-row.readonly .star-icon {
  font-size: 36rpx;
}
</style>
