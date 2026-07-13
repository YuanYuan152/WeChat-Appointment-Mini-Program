<template>
  <view v-if="tag" class="patient-contract-badge">{{ tag }}</view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { patientContractTag, type PatientContractFields } from '@/utils/patientContract'

const props = defineProps<{
  item?: PatientContractFields | null
  contractTag?: string | null
}>()

const tag = computed(() => props.contractTag || patientContractTag(props.item))
</script>

<style scoped>
.patient-contract-badge {
  display: inline-block;
  margin-left: 8rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #92400e;
  background: #fef3c7;
  border: 1rpx solid #fcd34d;
  vertical-align: middle;
}
</style>
