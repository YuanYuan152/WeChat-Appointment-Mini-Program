<template>
  <view class="page-feedback">
    <view class="notice-bar">
      <text class="notice-text">欢迎留下使用建议或问题。我们会认真阅读每一条反馈，并尽快跟进处理。</text>
    </view>

    <view class="form-card">
      <view class="form-item">
        <text class="label">反馈类型</text>
        <picker :range="categoryOptions" :value="categoryIndex" @change="onCategoryChange">
          <view class="picker-row">
            <text class="picker">{{ form.category || '请选择反馈类型' }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">反馈内容</text>
        <textarea
          class="textarea"
          v-model="form.content"
          placeholder="请描述您遇到的问题或建议，我们会尽快处理"
          maxlength="2000"
          :show-confirm-bar="false"
        />
        <text class="counter">{{ form.content.length }}/2000</text>
      </view>
      <view class="form-item">
        <text class="label">联系方式（选填）</text>
        <input class="input" v-model="form.contact" placeholder="手机号或微信号，便于我们回复您" />
      </view>
    </view>

    <button class="submit-btn" :loading="submitting" @click="submit">提交反馈</button>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const categoryOptions = ['功能建议', '问题反馈', '体验优化', '其他']
const form = ref({
  category: '功能建议',
  content: '',
  contact: '',
})
const submitting = ref(false)

const categoryIndex = computed(() => {
  const idx = categoryOptions.indexOf(form.value.category)
  return idx >= 0 ? idx : 0
})

const onCategoryChange = (e: { detail: { value: string } }) => {
  form.value.category = categoryOptions[Number(e.detail.value)]
}

const submit = async () => {
  const content = form.value.content.trim()
  if (!content) {
    uni.showToast({ title: '请填写反馈内容', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.feedback.submit, {
      category: form.value.category,
      content,
      contact: form.value.contact.trim() || undefined,
    })
    if (res.code === 0) {
      uni.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 900)
    } else {
      uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page-feedback {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  box-sizing: border-box;
}

.notice-bar {
  background: #F0EDE8;
  border: 1rpx solid #E8E4DE;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}

.notice-text {
  font-size: 24rpx;
  color: #3D5A4E;
  line-height: 1.6;
}

.form-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 8rpx 32rpx 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.form-item {
  padding: 28rpx 0;
  border-bottom: 1rpx solid #F0EDE8;
}

.form-item:last-child {
  border-bottom: none;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #6B6560;
  margin-bottom: 14rpx;
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.input,
.picker {
  font-size: 30rpx;
  color: #2C2C2C;
  min-height: 44rpx;
}

.picker-arrow {
  font-size: 36rpx;
  color: #C4BEB6;
  font-weight: 300;
  line-height: 1;
}

.textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 240rpx;
  font-size: 30rpx;
  color: #2C2C2C;
  line-height: 1.7;
  background: #FAF8F4;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.counter {
  display: block;
  margin-top: 12rpx;
  text-align: right;
  font-size: 24rpx;
  color: #9CA3AF;
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  border: none;
  border-radius: 100rpx;
  margin-top: 40rpx;
  background: #3D5A4E;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  box-shadow: 0 8rpx 24rpx rgba(61, 90, 78, 0.2);
}

.submit-btn:active {
  background: #2F4A40;
}

.submit-btn::after {
  border: none;
}
</style>
