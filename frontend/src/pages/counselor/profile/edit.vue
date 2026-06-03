<template>
  <view class="page-counselor-profile">
    <view class="form-card">
      <FormInput label="姓名" v-model="form.name" />
      <FormInput label="头像 URL" v-model="form.avatarUrl" />
      <FormInput label="职称/头衔" v-model="form.title" />
      <FormInput label="领域" v-model="form.field" />
      <FormInput label="咨询时数" type="number" v-model.number="form.consultHours" />
      <FormInput label="从业年限" type="number" v-model.number="form.workYears" />
      <FormInput label="咨询费用（分）" type="number" v-model.number="form.billing" />
      <FormTextarea label="擅长方向" v-model="form.specialty" />
      <FormTextarea label="个人介绍" v-model="form.introduce" />
      <FormTextarea label="职业经历" v-model="form.career" />
      <FormTextarea label="资质证书" v-model="form.qualification" />
    </view>
    <button class="save-btn" :loading="saving" @click="save">保存资料</button>
  </view>
</template>

<script setup lang="ts">
import { defineComponent, h, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const form = ref<Record<string, any>>({
  name: '',
  avatarUrl: '',
  title: '',
  field: '',
  specialty: '',
  introduce: '',
  career: '',
  qualification: '',
  billing: 0,
  consultHours: 0,
  workYears: 0,
})
const saving = ref(false)

const FormInput = defineComponent({
  props: { label: String, modelValue: [String, Number], type: { type: String, default: 'text' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('view', { class: 'field' }, [
      h('text', { class: 'label' }, props.label),
      h('input', {
        class: 'input',
        type: props.type,
        value: props.modelValue,
        placeholder: `请输入${props.label || ''}`,
        onInput: (e: any) => emit('update:modelValue', props.type === 'number' ? Number(e.detail.value || 0) : e.detail.value),
      })
    ])
  }
})

const FormTextarea = defineComponent({
  props: { label: String, modelValue: String },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('view', { class: 'field' }, [
      h('text', { class: 'label' }, props.label),
      h('textarea', {
        class: 'textarea',
        value: props.modelValue,
        placeholder: `请输入${props.label || ''}`,
        onInput: (e: any) => emit('update:modelValue', e.detail.value),
      })
    ])
  }
})

const load = async () => {
  const res = await httpV2.get<Record<string, any>>(API_ENDPOINTS.counselor.profile)
  if (res.code === 0 && res.data) form.value = { ...form.value, ...res.data }
}

const save = async () => {
  saving.value = true
  try {
    const res = await httpV2.put(API_ENDPOINTS.counselor.profile, form.value)
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
}

.form-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 8rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.field {
  padding: 26rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}

.field:last-child {
  border-bottom: none;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  margin-bottom: 12rpx;
}

.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  font-size: 29rpx;
  color: #1F2937;
}

.textarea {
  min-height: 150rpx;
  line-height: 1.7;
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
