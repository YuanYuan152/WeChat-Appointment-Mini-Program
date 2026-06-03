<template>
  <view class="page-xy1">
    <view class="header">
      <text class="title">咨询协议</text>
      <text class="subtitle">请仔细阅读以下协议内容</text>
    </view>

    <view class="content">
      <view class="section">
        <text class="section-title">一、服务内容</text>
        <text class="section-content">
          本平台提供专业的心理咨询服务，包括但不限于：
          • 个人心理咨询
          • 情感问题咨询
          • 职场压力咨询
          • 家庭关系咨询
        </text>
      </view>

      <view class="section">
        <text class="section-title">二、服务流程</text>
        <text class="section-content">
          1. 选择咨询师
          2. 预约咨询时间
          3. 确认咨询协议
          4. 进行咨询服务
          5. 完成咨询评价
        </text>
      </view>

      <view class="section">
        <text class="section-title">三、注意事项</text>
        <text class="section-content">
          • 请如实填写个人信息
          • 保持咨询环境的私密性
          • 按时参加预约的咨询
          • 尊重咨询师的专业建议
        </text>
      </view>
    </view>

    <view class="footer">
      <button class="btn btn-primary" @click="agreeProtocol">同意协议</button>
      <button class="btn btn-secondary" @click="goBack">返回</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isAgreed = ref(false)

const agreeProtocol = () => {
  isAgreed.value = true
  uni.showToast({ title: '协议已确认', icon: 'success' })
  setTimeout(() => {
    uni.navigateTo({ url: '/pages/consultation/agreement/xy2' })
  }, 1500)
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style>
.page-xy1 { min-height: 100vh; background-color: #f8f8f8; padding: 20px; }
.header { text-align: center; margin-bottom: 30px; }
.title { display: block; font-size: 24px; font-weight: bold; color: #1F2937; margin-bottom: 10px; }
.subtitle { display: block; font-size: 16px; color: #6B7280; }
.content { background: white; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
.section { margin-bottom: 20px; }
.section:last-child { margin-bottom: 0; }
.section-title { display: block; font-size: 18px; font-weight: 600; color: #1F2937; margin-bottom: 10px; }
.section-content { display: block; font-size: 14px; color: #6B7280; line-height: 1.6; }
.footer { display: flex; gap: 15px; }
.btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; }
.btn-primary { background-color: #0D9488; color: white; }
.btn-secondary { background-color: #6B7280; color: white; }
</style>
