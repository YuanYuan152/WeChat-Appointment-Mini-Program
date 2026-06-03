<template>
  <view class="page-profile-edit">
    <view class="form-card">
      <view class="form-item">
        <text class="label">昵称</text>
        <input class="input" v-model="form.nickname" placeholder="请输入昵称" />
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
      <view class="form-item">
        <text class="label">生日</text>
        <picker mode="date" :value="form.birthday" @change="e => form.birthday = e.detail.value">
          <view class="picker">{{ form.birthday || '请选择生日' }}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">紧急联系人</text>
        <input class="input" v-model="form.emergencyContact" placeholder="请输入紧急联系人" />
      </view>
      <view class="form-item">
        <text class="label">紧急联系人电话</text>
        <input class="input" v-model="form.emergencyPhone" placeholder="请输入联系电话" />
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
  realName: '',
  gender: '',
  birthday: '',
  emergencyContact: '',
  emergencyPhone: '',
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
  const res = await httpV2.get<any>(API_ENDPOINTS.patient.me)
  if (res.code === 0 && res.data) {
    form.value = {
      nickname: res.data.nickname || '',
      realName: res.data.realName || '',
      gender: res.data.gender || '',
      birthday: res.data.birthday ? String(res.data.birthday).slice(0, 10) : '',
      emergencyContact: res.data.emergencyContact || '',
      emergencyPhone: res.data.emergencyPhone || '',
    }
  }
}

const save = async () => {
  saving.value = true
  try {
    const payload = {
      ...form.value,
      birthday: form.value.birthday ? `${form.value.birthday}T00:00:00` : null,
    }
    const res = await httpV2.put(API_ENDPOINTS.patient.me, payload)
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
.page-profile-edit {
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
