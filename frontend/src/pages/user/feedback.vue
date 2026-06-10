<template>
  <view class="page-feedback">
    <view class="form-card">
      <view class="form-item">
        <text class="label">反馈类型</text>
        <picker :range="categoryOptions" :value="categoryIndex" @change="onCategoryChange">
          <view class="picker">{{ form.category || '请选择反馈类型' }}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">反馈内容</text>
        <textarea
          class="textarea"
          v-model="form.content"
          placeholder="请描述您遇到的问题或建议，我们会尽快处理"
          maxlength="2000"
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

const onCategoryChange = (e: any) => {
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
  background: #F4F6F8;
  padding: 32rpx;
}

.form-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 8rpx 32rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.form-item {
  padding: 28rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}

.form-item:last-child {
  border-bottom: none;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  margin-bottom: 14rpx;
}

.input,
.picker {
  font-size: 30rpx;
  color: #1F2937;
  min-height: 44rpx;
}

.textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 240rpx;
  font-size: 30rpx;
  color: #1F2937;
  line-height: 1.7;
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
  height: 92rpx;
  line-height: 92rpx;
  border: none;
  border-radius: 100rpx;
  margin-top: 40rpx;
  background: #8B5CF6;
  color: #fff;
  font-size: 32rpx;
  font-weight: 800;
}
</style>
