<template>
  <view class="page-user-info">
    <view class="form-card">
      <view class="form-item">
        <text class="label">昵称</text>
        <input class="input" v-model="form.nickname" placeholder="请输入昵称" />
      </view>
      <view class="form-item">
        <text class="label">头像 URL</text>
        <input class="input" v-model="form.avatarUrl" placeholder="请输入头像链接" />
      </view>
      <view class="form-item">
        <text class="label">真实姓名</text>
        <input class="input" v-model="form.realName" placeholder="请输入真实姓名" />
      </view>
      <view class="form-item">
        <text class="label">性别</text>
        <picker :range="genderOptions" :value="genderIndex" @change="onGenderChange">
          <view class="picker">{{ form.gender || '请选择性别' }}</view>
        </picker>
      </view>
      <view class="form-item readonly">
        <text class="label">手机号</text>
        <text class="value">{{ form.mobile || '未绑定' }}</text>
      </view>
    </view>

    <button class="save-btn" :loading="saving" @click="save">保存资料</button>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const genderOptions = ['男', '女', '其他']
const form = ref({
  nickname: '',
  avatarUrl: '',
  realName: '',
  gender: '',
  mobile: '',
})
const saving = ref(false)

const genderIndex = computed(() => {
  const idx = genderOptions.indexOf(form.value.gender)
  return idx >= 0 ? idx : 0
})

const onGenderChange = (e: any) => {
  form.value.gender = genderOptions[Number(e.detail.value)]
}

const load = async () => {
  const res = await httpV2.get<any>(API_ENDPOINTS.auth.me)
  if (res.code === 0 && res.data) {
    form.value = {
      nickname: res.data.nickname || '',
      avatarUrl: res.data.avatarUrl || '',
      realName: res.data.realName || '',
      gender: res.data.gender || '',
      mobile: res.data.mobile || '',
    }
  }
}

const save = async () => {
  saving.value = true
  try {
    const payload = {
      nickname: form.value.nickname,
      avatarUrl: form.value.avatarUrl,
      realName: form.value.realName,
      gender: form.value.gender,
    }
    const res = await httpV2.put(API_ENDPOINTS.auth.updateMe, payload)
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 900)
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-user-info {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 32rpx;
}

.form-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 8rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.form-item {
  padding: 28rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}

.form-item:last-child {
  border-bottom: none;
}

.form-item.readonly .value {
  font-size: 30rpx;
  color: #6B7280;
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

.save-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border: none;
  border-radius: 100rpx;
  margin-top: 40rpx;
  background: #0D9488;
  color: #fff;
  font-size: 32rpx;
  font-weight: 800;
}
</style>
