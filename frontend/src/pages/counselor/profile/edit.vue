<template>
  <view class="page-counselor-profile">
    <!-- 承诺书门禁 -->
    <view v-if="!profileLoaded" class="loading-box">
      <text>加载中...</text>
    </view>

    <view v-else-if="!form.infoAuthenticityCommitted" class="commitment-card">
      <text class="commitment-title">信息真实可信承诺书</text>
      <scroll-view class="commitment-scroll" scroll-y>
        <text class="commitment-text">
          本人作为本平台入驻咨询师，郑重承诺：
          1. 在本页面填写及对外展示的全部个人信息（包括但不限于姓名、职称、从业年限、咨询时数、培训经历、资质证书、专业领域、服务人群、简介等）均真实、准确、完整；
          2. 不存在伪造、夸大或误导性陈述；
          3. 如信息发生变更，将及时更新并保证持续真实有效；
          4. 如有违反，愿承担由此产生的相应责任，并接受平台处理。
        </text>
      </scroll-view>
      <view class="commitment-field">
        <text class="label">签署姓名</text>
        <input
          class="input"
          v-model="commitmentSigner"
          placeholder="请输入您的真实姓名"
        />
      </view>
      <view class="agree-row" @tap="commitmentAgreed = !commitmentAgreed">
        <view class="checkbox" :class="{ checked: commitmentAgreed }">
          <text v-if="commitmentAgreed" class="check-icon">✓</text>
        </view>
        <text class="agree-text">我已阅读并同意上述承诺书</text>
      </view>
      <button class="save-btn" :loading="committing" @click="submitCommitment">签署并继续填写</button>
    </view>

    <template v-else>
      <view class="tip-bar">
        <text class="tip-text">您已签署信息真实可信承诺书，请如实填写以下资料</text>
      </view>

      <view class="form-card">
        <view class="form-item">
          <text class="label">姓名</text>
          <input class="input" v-model="form.name" placeholder="请输入姓名" />
        </view>
        <view class="form-item">
          <text class="label">头像 URL</text>
          <input class="input" v-model="form.avatarUrl" placeholder="请输入头像图片地址" />
        </view>
        <view class="form-item">
          <text class="label">职称/头衔</text>
          <input class="input" v-model="form.title" placeholder="如：国家二级心理咨询师" />
        </view>
        <view class="form-item readonly">
          <text class="label">咨询费用</text>
          <text class="readonly-value">￥{{ displayPrice }} / 次（由平台设定，不可修改）</text>
        </view>
        <view class="form-item">
          <text class="label">从业年限</text>
          <input class="input" type="number" v-model.number="form.workYears" placeholder="年" />
        </view>
        <view class="form-item">
          <text class="label">咨询时数</text>
          <input class="input" type="number" v-model.number="form.consultHours" placeholder="累计咨询小时数" />
        </view>
        <view class="form-item">
          <text class="label">培训经历（段数）</text>
          <input class="input" v-model="form.career" placeholder="填写数字，如 4 表示 4 段培训经历" />
        </view>
        <view class="form-item">
          <text class="label">咨询方式</text>
          <picker :range="modeOptions" :value="modeIndex" @change="onModeChange">
            <view class="picker">{{ form.mode || '请选择咨询方式' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="label">专业领域</text>
          <input class="input" v-model="form.field" placeholder="多个用逗号分隔，如：情绪压力,亲子关系" />
        </view>
        <view class="form-item">
          <text class="label">服务人群</text>
          <input class="input" v-model="form.targetGroup" placeholder="多个用逗号分隔，如：成人,青少年" />
        </view>
        <view class="form-item">
          <text class="label">擅长方向</text>
          <textarea class="textarea" v-model="form.specialty" placeholder="请输入擅长方向" />
        </view>
        <view class="form-item">
          <text class="label">简介</text>
          <textarea class="textarea" v-model="form.introduce" placeholder="将在来访者端展示为咨询师简介" />
        </view>
        <view class="form-item">
          <text class="label">资质证书</text>
          <textarea class="textarea" v-model="form.qualification" placeholder="请输入资质与证书信息" />
        </view>
      </view>

      <button class="save-btn" :loading="saving" @click="save">保存资料</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const modeOptions = ['线上', '线下', '线上/线下']

const form = ref({
  name: '',
  avatarUrl: '',
  title: '',
  field: '',
  specialty: '',
  introduce: '',
  career: '',
  qualification: '',
  targetGroup: '',
  mode: '',
  billing: 0,
  consultHours: 0,
  workYears: 0,
  infoAuthenticityCommitted: false,
})

const profileLoaded = ref(false)
const saving = ref(false)
const committing = ref(false)
const commitmentSigner = ref('')
const commitmentAgreed = ref(false)

const displayPrice = computed(() => Math.round(Number(form.value.billing || 0) / 100) || 0)

const modeIndex = computed(() => {
  const idx = modeOptions.indexOf(form.value.mode)
  return idx >= 0 ? idx : 0
})

const onModeChange = (e: any) => {
  form.value.mode = modeOptions[Number(e.detail.value)] || modeOptions[0]
}

const applyProfile = (data: Record<string, any>) => {
  form.value = {
    ...form.value,
    name: data.name || '',
    avatarUrl: data.avatarUrl || '',
    title: data.title || '',
    field: data.field || '',
    specialty: data.specialty || '',
    introduce: data.introduce || '',
    career: data.career || '',
    qualification: data.qualification || '',
    targetGroup: data.targetGroup || '',
    mode: data.mode || '线上/线下',
    billing: Number(data.billing || 0),
    consultHours: Number(data.consultHours || 0),
    workYears: Number(data.workYears || 0),
    infoAuthenticityCommitted: !!data.infoAuthenticityCommitted,
  }
  if (!commitmentSigner.value) {
    commitmentSigner.value = data.infoAuthenticitySignerName || data.name || ''
  }
}

const load = async () => {
  try {
    const res = await httpV2.get<Record<string, any>>(API_ENDPOINTS.counselor.profile)
    if (res.code === 0 && res.data) {
      applyProfile(res.data)
    }
  } finally {
    profileLoaded.value = true
  }
}

const submitCommitment = async () => {
  if (!commitmentAgreed.value) {
    uni.showToast({ title: '请先勾选同意承诺书', icon: 'none' })
    return
  }
  const signer = commitmentSigner.value.trim()
  if (!signer) {
    uni.showToast({ title: '请填写签署姓名', icon: 'none' })
    return
  }
  committing.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.counselor.profileAuthenticityCommitment, {
      signerName: signer,
      agreed: true,
    })
    if (res.code === 0 && res.data) {
      applyProfile(res.data)
      uni.showToast({ title: '签署成功', icon: 'success' })
    } else {
      uni.showToast({ title: res.msg || '签署失败', icon: 'none' })
    }
  } finally {
    committing.value = false
  }
}

const save = async () => {
  if (!form.value.name?.trim()) {
    uni.showToast({ title: '请填写姓名', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      avatarUrl: form.value.avatarUrl,
      title: form.value.title,
      field: form.value.field,
      specialty: form.value.specialty,
      introduce: form.value.introduce,
      career: form.value.career,
      qualification: form.value.qualification,
      targetGroup: form.value.targetGroup,
      mode: form.value.mode,
      consultHours: form.value.consultHours,
      workYears: form.value.workYears,
    }
    const res = await httpV2.put(API_ENDPOINTS.counselor.profile, payload)
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
.page-counselor-profile {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 28rpx;
  box-sizing: border-box;
}

.loading-box {
  padding: 120rpx 0;
  text-align: center;
  color: #9CA3AF;
  font-size: 28rpx;
}

.commitment-card,
.form-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.commitment-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 24rpx;
  text-align: center;
}

.commitment-scroll {
  max-height: 420rpx;
  margin-bottom: 24rpx;
}

.commitment-text {
  font-size: 28rpx;
  color: #4B5563;
  line-height: 1.8;
  white-space: pre-wrap;
}

.commitment-field {
  margin-bottom: 24rpx;
}

.tip-bar {
  background: #ECFDF5;
  border: 1rpx solid #A7F3D0;
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}

.tip-text {
  font-size: 24rpx;
  color: #047857;
  line-height: 1.6;
}

.form-item {
  padding: 26rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}

.form-item:last-child {
  border-bottom: none;
}

.form-item.readonly .readonly-value {
  font-size: 30rpx;
  color: #6B7280;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  margin-bottom: 12rpx;
}

.input,
.textarea,
.picker {
  width: 100%;
  box-sizing: border-box;
  font-size: 29rpx;
  color: #1F2937;
}

.textarea {
  min-height: 150rpx;
  line-height: 1.7;
}

.picker {
  min-height: 44rpx;
  line-height: 44rpx;
}

.agree-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #D1D5DB;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.checkbox.checked {
  background: #0D9488;
  border-color: #0D9488;
}

.check-icon {
  color: #fff;
  font-size: 24rpx;
}

.agree-text {
  font-size: 26rpx;
  color: #374151;
  line-height: 1.6;
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

.save-btn::after {
  border: none;
}
</style>
