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
.page-dashboard {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  box-sizing: border-box;
}

.header {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);
}

.title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
}

.subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.5;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.num {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: #3D5A4E;
  line-height: 1.2;
}

.label {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #6B6560;
}
</style>
