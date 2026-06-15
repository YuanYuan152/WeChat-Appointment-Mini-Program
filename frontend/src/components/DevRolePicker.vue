<template>
  <view v-if="showPicker" class="dev-role-picker">
    <view class="dev-role-header">
      <text class="dev-role-label">测试版 · 选择登录角色</text>
      <text class="dev-role-current">当前：{{ currentLabel }}</text>
    </view>
    <view v-for="group in roleGroups" :key="group.title" class="dev-role-group">
      <text class="dev-role-group-title">{{ group.title }}</text>
      <view class="dev-role-list">
        <view
          v-for="item in group.items"
          :key="item.role"
          class="dev-role-chip"
          :class="{ active: currentRole === item.role }"
          @click="selectRole(item.role)"
        >
          <text class="dev-role-chip-text">{{ item.label }}</text>
        </view>
      </view>
    </view>
    <text class="dev-role-hint">{{ hintText }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import {
  DEV_LOGIN_ROLE_GROUPS,
  DEV_LOGIN_ROLES,
  clearToken,
  getDevLoginRole,
  isMockLoginEnabled,
  setDevLoginRole,
  type DevLoginRole,
} from '@/utils/auth'

const emit = defineEmits<{
  change: [role: DevLoginRole]
}>()

const showPicker = isMockLoginEnabled()
const currentRole = ref<DevLoginRole>('patient')
const currentLabel = computed(() => {
  const item = DEV_LOGIN_ROLES.find(r => r.role === currentRole.value)
  return item?.label || '来访·小美'
})

const roleGroups = computed(() =>
  DEV_LOGIN_ROLE_GROUPS.map(group => ({
    title: group.title,
    items: group.roles
      .map(role => DEV_LOGIN_ROLES.find(r => r.role === role))
      .filter((item): item is (typeof DEV_LOGIN_ROLES)[number] => !!item),
  })),
)

const hintText = computed(() => {
  const item = DEV_LOGIN_ROLES.find(r => r.role === currentRole.value)
  return item
    ? `将以此身份微信一键登录 · ${item.seedHint} · 切换后需重新登录`
    : '请先选择角色，再点击微信一键登录'
})

const selectRole = (role: DevLoginRole) => {
  if (currentRole.value === role) return
  currentRole.value = role
  setDevLoginRole(role)
  clearToken()
  uni.removeStorageSync('user_roles')
  emit('change', role)
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
.dev-role-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  gap: 16rpx;
}
.dev-role-label {
  font-size: 26rpx;
  font-weight: 700;
  color: #374151;
}
.dev-role-current {
  font-size: 22rpx;
  color: #0D9488;
  font-weight: 600;
  flex-shrink: 0;
}
.dev-role-group {
  margin-bottom: 16rpx;
}
.dev-role-group-title {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-bottom: 10rpx;
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
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #9CA3AF;
  line-height: 1.5;
}
</style>
