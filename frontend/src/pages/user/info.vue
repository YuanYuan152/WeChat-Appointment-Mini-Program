<template>
  <view class="page-user-info">
    <view v-if="isCounselor" class="notice-bar">
      <text class="notice-text">此处仅可修改账号昵称等个人信息；咨询师对外展示资料由平台统一维护</text>
    </view>

    <view class="form-card">
      <view class="form-item avatar-item">
        <text class="label">头像</text>
        <view class="avatar-row" @tap="pickAvatar">
          <image class="avatar-preview" :src="avatarDisplay" mode="aspectFill" />
          <view class="avatar-meta">
            <text class="avatar-action">从相册选择</text>
            <text class="avatar-tip">可在圆形框中拖动预览后再保存</text>
          </view>
        </view>
      </view>
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
      <view class="form-item readonly">
        <text class="label">手机号</text>
        <text class="value">{{ form.mobile || '未绑定' }}</text>
      </view>
    </view>

    <button class="save-btn" :loading="saving" @click="save">保存资料</button>

    <AvatarCropper
      :visible="cropVisible"
      :src="cropSrc"
      @cancel="cropVisible = false"
      @confirm="onCropConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AvatarCropper from '@/components/AvatarCropper.vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { fixImageUrl, toStoredUploadPath } from '@/utils/image'

const defaultAvatar = '/static/images-opt/default-avatar.jpg'
const genderOptions = ['男', '女', '其他']
const isCounselor = ref(false)
const form = ref({
  nickname: '',
  avatarUrl: '',
  realName: '',
  gender: '',
  mobile: '',
})
const localPreview = ref('')
const cropVisible = ref(false)
const cropSrc = ref('')
const saving = ref(false)

const avatarDisplay = computed(() => {
  if (localPreview.value) return localPreview.value
  return form.value.avatarUrl ? fixImageUrl(form.value.avatarUrl) : defaultAvatar
})

const genderIndex = computed(() => {
  const idx = genderOptions.indexOf(form.value.gender)
  return idx >= 0 ? idx : 0
})

const onGenderChange = (e: any) => {
  form.value.gender = genderOptions[Number(e.detail.value)]
}

const pickAvatar = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: (res) => {
      const path = res.tempFilePaths?.[0]
      if (!path) return
      cropSrc.value = path
      cropVisible.value = true
    },
  })
}

const onCropConfirm = async (filePath: string) => {
  cropVisible.value = false
  localPreview.value = filePath
  uni.showLoading({ title: '上传中...', mask: true })
  try {
    const uploadRes = await httpV2.upload<{ url?: string; filename?: string }>(
      API_ENDPOINTS.upload.file,
      filePath,
      'file',
    )
    if (uploadRes.code !== 0 || !(uploadRes.data?.url || uploadRes.data?.filename)) {
      throw new Error(uploadRes.msg || '头像上传失败')
    }
    form.value.avatarUrl = toStoredUploadPath(uploadRes.data?.url, uploadRes.data?.filename)
    uni.showToast({ title: '头像已更新，请保存资料', icon: 'none' })
  } catch (err: any) {
    uni.showToast({ title: err?.message || '头像上传失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

const load = async () => {
  const res = await httpV2.get<any>(API_ENDPOINTS.auth.me)
  if (res.code === 0 && res.data) {
    isCounselor.value = (res.data.roles || []).includes('Counselor')
    form.value = {
      nickname: res.data.nickname || '',
      avatarUrl: res.data.avatarUrl || '',
      realName: res.data.realName || '',
      gender: res.data.gender || '',
      mobile: res.data.mobile || '',
    }
    localPreview.value = ''
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
  background: #F7F5F2;
  padding: 32rpx;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
  border-radius: 32rpx;
  padding: 8rpx 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
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

.avatar-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.avatar-preview {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: #EDEAE6;
  flex-shrink: 0;
}

.avatar-meta {
  flex: 1;
}

.avatar-action {
  display: block;
  font-size: 30rpx;
  color: #3D5A4E;
  font-weight: 600;
}

.avatar-tip {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9CA3AF;
}

.input,
.picker {
  font-size: 30rpx;
  color: #1F2937;
  min-height: 44rpx;
}

.save-btn {
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

.save-btn:active {
  background: #2F4A40;
}
</style>
