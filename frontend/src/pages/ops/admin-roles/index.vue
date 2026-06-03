<template>
  <view class="page-admin-roles">
    <view v-for="u in users" :key="u.id" class="user-card">
      <view class="head">
        <text class="name">#{{ u.id }} {{ u.nickname || u.mobile || '未命名用户' }}</text>
        <text class="active">{{ u.activeRole || '-' }}</text>
      </view>
      <view class="roles">
        <text v-for="r in u.roles" :key="r" class="role" @click="removeRole(u.id, r)">{{ r }} ×</text>
      </view>
      <view class="add-row">
        <picker :range="roles" @change="e => selectRole(u.id, e.detail.value)">
          <view class="picker">选择角色</view>
        </picker>
        <button class="bind-btn" @click="bindRole(u.id)">绑定</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const roles = ['Patient', 'Counselor', 'Assistant', 'Ops', 'Admin']
const users = ref<any[]>([])
const selected = reactive<Record<number, string>>({})

const load = async () => {
  const res = await httpV2.get<any[]>(API_ENDPOINTS.admin.users)
  if (res.code === 0 && res.data) users.value = res.data
}

const selectRole = (uid: number, idx: number) => {
  selected[uid] = roles[Number(idx)]
}

const bindRole = async (uid: number) => {
  const role = selected[uid]
  if (!role) {
    uni.showToast({ title: '请选择角色', icon: 'none' })
    return
  }
  const res = await httpV2.post(API_ENDPOINTS.admin.bindRole(uid), { role })
  if (res.code === 0) {
    await load()
    uni.showToast({ title: '已绑定', icon: 'success' })
  }
}

const removeRole = (uid: number, role: string) => {
  uni.showModal({
    title: '确认解绑',
    content: `是否解绑 ${role}？`,
    success: async (res) => {
      if (!res.confirm) return
      await httpV2.delete(`${API_ENDPOINTS.admin.bindRole(uid)}/${role}`)
      await load()
    }
  })
}

onMounted(load)
</script>

<style scoped>
.page-admin-roles { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.user-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.head { display: flex; justify-content: space-between; gap: 20rpx; }
.name { font-size: 30rpx; font-weight: 800; color: #1F2937; }
.active { font-size: 24rpx; color: #7C3AED; }
.roles { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 20rpx; }
.role {
  padding: 8rpx 18rpx; border-radius: 100rpx; background: #EEF2FF;
  color: #4F46E5; font-size: 24rpx;
}
.add-row { display: flex; gap: 16rpx; margin-top: 22rpx; }
.picker {
  flex: 1; background: #F9FAFB; border-radius: 16rpx; padding: 18rpx 24rpx;
  font-size: 27rpx; color: #4B5563;
}
.bind-btn {
  width: 140rpx; height: 68rpx; line-height: 68rpx; margin: 0; border: none;
  border-radius: 100rpx; background: #7C3AED; color: #fff; font-size: 26rpx;
}
</style>
