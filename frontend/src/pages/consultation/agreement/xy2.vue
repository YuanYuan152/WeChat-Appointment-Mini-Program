<template>
  <view class="page-xy2">
    <view class="card">
      <text class="title">个人信息确认</text>
      <text class="desc">请确认你的预约信息无误。提交后将进入支付流程。</text>
      <view class="actions">
        <button class="btn primary" @click="confirm">确认无误</button>
        <button class="btn ghost" @click="back">返回</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const confirm = () => {
  uni.showToast({ title: '已确认', icon: 'success' })
  setTimeout(() => uni.navigateBack({ delta: 2 } as any), 800)
}
const back = () => uni.navigateBack()
</script>

<style scoped>
.page-xy2 { min-height: 100vh; background: #F4F6F8; padding: 32rpx; }
.card { background: #fff; border-radius: 32rpx; padding: 56rpx 40rpx; box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.06); margin-top: 80rpx; }
.title { display: block; font-size: 36rpx; font-weight: 800; color: #1F2937; text-align: center; }
.desc { display: block; font-size: 26rpx; color: #6B7280; text-align: center; line-height: 1.7; margin: 24rpx 0 32rpx; }
.actions { display: flex; flex-direction: column; gap: 16rpx; }
.btn { height: 88rpx; line-height: 88rpx; border: none; border-radius: 100rpx; font-size: 30rpx; font-weight: 700; }
.btn.primary { background: #0D9488; color: #fff; }
.btn.ghost { background: #F3F4F6; color: #374151; }
</style>
