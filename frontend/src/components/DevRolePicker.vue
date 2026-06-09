<template>
  <view v-if="isDev" class="dev-role-picker">
    <text class="dev-role-label">开发联调角色</text>
    <view class="dev-role-list">
      <view
        v-for="item in DEV_LOGIN_ROLES"
        :key="item.role"
        class="dev-role-chip"
        :class="{ active: currentRole === item.role }"
        @click="selectRole(item.role)"
      >
        <text class="dev-role-chip-text">{{ item.label }}</text>
      </view>
    </view>
    <text class="dev-role-hint">{{ hintText }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import {
  DEV_LOGIN_ROLES,
  clearToken,
  getDevLoginRole,
  setDevLoginRole,
  type DevLoginRole,
} from '@/utils/auth'

const isDev = import.meta.env.DEV
const currentRole = ref<DevLoginRole>('patient')

const hintText = computed(() => {
  const item = DEV_LOGIN_ROLES.find(r => r.role === currentRole.value)
  return item ? `对应 seed：${item.seedHint} · 切换后请重新登录` : ''
})

const selectRole = (role: DevLoginRole) => {
  if (currentRole.value === role) return
  currentRole.value = role
  setDevLoginRole(role)
  clearToken()
  uni.showToast({ title: `已切换为${DEV_LOGIN_ROLES.find(r => r.role === role)?.label}`, icon: 'none' })
}

onMounted(() => {
  currentRole.value = getDevLoginRole()
})
</script>

<style scoped>
.dev-role-picker {
  margin-bottom: 32rpx;
  padding: 24rpx;
  background: #F9FAFB;
  border-radius: 20rpx;
  border: 2rpx dashed #D1D5DB;
}
.dev-role-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #6B7280;
  margin-bottom: 16rpx;
}
.dev-role-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.dev-role-chip {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: #ffffff;
  border: 2rpx solid #E5E7EB;
}
.dev-role-chip.active {
  background: #ECFDF5;
  border-color: #0D9488;
}
.dev-role-chip-text {
  font-size: 24rpx;
  color: #374151;
}
.dev-role-chip.active .dev-role-chip-text {
  color: #0D9488;
  font-weight: 600;
}
.dev-role-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 20rpx;
  color: #9CA3AF;
  line-height: 1.5;
}
</style>
