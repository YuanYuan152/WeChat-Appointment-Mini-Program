<template>
  <view class="page-appointment-stub">
    <view class="card">
      <text class="title">请前往咨询师详情页完成预约</text>
      <text class="desc">
        新版本统一以「咨询师详情 → 选择时段 → 协议签署 → 微信原生支付」为预约链路，
        本页面已不再承载预约逻辑。
      </text>

      <view class="actions">
        <button class="btn primary" @click="goToConsultantList">浏览咨询师</button>
        <button class="btn ghost" @click="goBack">返回上一页</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const goToConsultantList = () => {
  uni.navigateTo({ url: '/pages/consultant/list' })
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style scoped>
.page-appointment-stub {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F4F6F8;
  padding: 48rpx;
}

.card {
  width: 100%;
  background: #fff;
  border-radius: 32rpx;
  padding: 64rpx 48rpx;
  text-align: center;
  box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.06);
}

.title { display: block; font-size: 36rpx; font-weight: 800; color: #1F2937; margin-bottom: 24rpx; }
.desc { display: block; font-size: 28rpx; color: #6B7280; line-height: 1.7; margin-bottom: 56rpx; }
.actions { display: flex; flex-direction: column; gap: 24rpx; }
.btn { height: 88rpx; line-height: 88rpx; border-radius: 100rpx; font-size: 30rpx; font-weight: 600; border: none; }
.btn.primary { background: #0D9488; color: #fff; }
.btn.ghost { background: #F3F4F6; color: #374151; }
</style>
