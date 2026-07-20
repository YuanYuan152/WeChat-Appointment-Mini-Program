<template>
  <view class="page-dashboard">
    <view class="header">
      <text class="title">运营数据看板</text>
      <text class="subtitle">用户、订单、内容概览</text>
    </view>
    <view class="grid">
      <view v-for="item in cards" :key="item.label" class="card">
        <text class="num">{{ item.value }}</text>
        <text class="label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { useUserStore } from '@/store/user'
import { resolveAccountRole } from '@/constants/roles'
import { readStoredRole } from '@/utils/tabBar'

const userStore = useUserStore()

const data = ref({
  userCount: 0,
  orderCount: 0,
  paidOrderCount: 0,
  paidAmount: 0,
  articleCount: 0,
  activityCount: 0,
})

const cards = computed(() => [
  { label: '用户数', value: data.value.userCount },
  { label: '订单数', value: data.value.orderCount },
  { label: '已支付订单', value: data.value.paidOrderCount },
  { label: '支付金额', value: `¥${(data.value.paidAmount / 100).toFixed(0)}` },
  { label: '文章数', value: data.value.articleCount },
  { label: '活动数', value: data.value.activityCount },
])

const canViewDashboard = () => {
  const role =
    userStore.activeRole ||
    resolveAccountRole(userStore.roles) ||
    readStoredRole()
  return role === 'Ops' || role === 'Admin'
}

const load = async () => {
  if (!canViewDashboard()) {
    uni.showToast({ title: '咨询助理无权查看运营看板', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack({
        fail: () => uni.redirectTo({ url: '/pages/ops/index/index' }),
      })
    }, 400)
    return
  }
  const res = await httpV2.get<typeof data.value>(API_ENDPOINTS.ops.dashboard)
  if (res.code === 0 && res.data) data.value = res.data
}

onShow(() => {
  void load()
})
</script>

<style scoped>
.page-dashboard { min-height: 100vh; background: #F4F6F8; padding: 32rpx; }
.header {
  background: linear-gradient(135deg, #7C3AED, #4F46E5);
  border-radius: 32rpx;
  padding: 44rpx 36rpx;
  margin-bottom: 28rpx;
}
.title { display: block; color: #fff; font-size: 38rpx; font-weight: 900; }
.subtitle { display: block; margin-top: 10rpx; color: rgba(255,255,255,.86); font-size: 26rpx; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; }
.card {
  background: #fff;
  border-radius: 28rpx;
  padding: 36rpx 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.num { display: block; color: #7C3AED; font-size: 44rpx; font-weight: 900; }
.label { display: block; margin-top: 10rpx; color: #6B7280; font-size: 26rpx; }
</style>
