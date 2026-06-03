<template>
  <view class="page-registration">
    <view class="section">
      <text class="section-title">基础信息</text>
      <FormInput label="姓名" v-model="form.realName" />
      <FormInput label="职业" v-model="form.occupation" />
      <FormInput label="学历" v-model="form.education" />
      <FormInput label="婚姻状态" v-model="form.maritalStatus" />
      <FormInput label="手机号" v-model="form.phone" />
      <FormInput label="紧急联系人" v-model="form.emergencyContact" />
      <FormInput label="紧急联系人电话" v-model="form.emergencyPhone" />
      <view class="field">
        <text class="label">主诉</text>
        <textarea class="textarea" v-model="form.chiefComplaint" placeholder="请简要描述当前困扰" />
      </view>
    </view>

    <view class="section">
      <text class="section-title">PHQ-9 抑郁量表</text>
      <text class="section-desc">过去两周内，以下问题困扰您的频率？0=完全没有，3=几乎每天</text>
      <ScaleItem v-for="(q, idx) in phqQuestions" :key="q" :label="q" v-model="form[`phq${idx + 1}`]" />
      <text class="score">PHQ-9 总分：{{ phqTotal }}</text>
    </view>

    <view class="section">
      <text class="section-title">GAD-7 焦虑量表</text>
      <text class="section-desc">过去两周内，以下问题困扰您的频率？0=完全没有，3=几乎每天</text>
      <ScaleItem v-for="(q, idx) in gadQuestions" :key="q" :label="q" v-model="form[`gad${idx + 1}`]" />
      <text class="score">GAD-7 总分：{{ gadTotal }}</text>
    </view>

    <view class="section">
      <text class="section-title">补充资料</text>
      <FormTextarea label="既往诊断" v-model="form.pastDiagnosis" />
      <FormTextarea label="既往咨询/治疗经历" v-model="form.treatmentHistory" />
      <FormTextarea label="用药史" v-model="form.medicationHistory" />
      <FormTextarea label="家族精神心理史" v-model="form.familyMentalHistory" />
      <FormTextarea label="家庭关系" v-model="form.familyRelationship" />
      <FormInput label="睡眠情况" v-model="form.sleepStatus" />
      <FormInput label="食欲情况" v-model="form.appetiteStatus" />
      <FormTextarea label="物质使用情况" v-model="form.substanceUse" />
      <FormTextarea label="自伤/自杀风险" v-model="form.selfHarmRisk" />
      <FormTextarea label="咨询目标" v-model="form.consultationGoal" />
    </view>

    <button class="save-btn" :loading="saving" @click="save">保存登记表</button>
  </view>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const phqQuestions = [
  '做事时提不起劲或没有兴趣',
  '感到心情低落、沮丧或绝望',
  '入睡困难、睡不安或睡眠过多',
  '感觉疲倦或没有活力',
  '食欲不振或吃太多',
  '觉得自己很糟，或觉得自己很失败',
  '难以集中注意力',
  '行动或说话缓慢，或坐立不安',
  '有不如死掉或伤害自己的念头',
]

const gadQuestions = [
  '感到紧张、焦虑或急切',
  '不能停止或控制担忧',
  '对各种事情担忧过多',
  '很难放松下来',
  '由于不安而无法静坐',
  '变得容易烦恼或急躁',
  '感到好像有什么可怕的事会发生',
]

const createForm = () => ({
  realName: '',
  occupation: '',
  education: '',
  maritalStatus: '',
  phone: '',
  emergencyContact: '',
  emergencyPhone: '',
  chiefComplaint: '',
  phq1: 0, phq2: 0, phq3: 0, phq4: 0, phq5: 0, phq6: 0, phq7: 0, phq8: 0, phq9: 0,
  gad1: 0, gad2: 0, gad3: 0, gad4: 0, gad5: 0, gad6: 0, gad7: 0,
  pastDiagnosis: '',
  treatmentHistory: '',
  medicationHistory: '',
  familyMentalHistory: '',
  familyRelationship: '',
  sleepStatus: '',
  appetiteStatus: '',
  substanceUse: '',
  selfHarmRisk: '',
  consultationGoal: '',
})

const form = ref<Record<string, any>>(createForm())
const saving = ref(false)

const phqTotal = computed(() => Array.from({ length: 9 }, (_, i) => Number(form.value[`phq${i + 1}`] || 0)).reduce((a, b) => a + b, 0))
const gadTotal = computed(() => Array.from({ length: 7 }, (_, i) => Number(form.value[`gad${i + 1}`] || 0)).reduce((a, b) => a + b, 0))

const FormInput = defineComponent({
  props: { label: String, modelValue: String },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('view', { class: 'field' }, [
      h('text', { class: 'label' }, props.label),
      h('input', {
        class: 'input',
        value: props.modelValue,
        placeholder: `请输入${props.label || ''}`,
        onInput: (e: any) => emit('update:modelValue', e.detail.value)
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
        onInput: (e: any) => emit('update:modelValue', e.detail.value)
      })
    ])
  }
})

const ScaleItem = defineComponent({
  props: { label: String, modelValue: Number },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const options = [0, 1, 2, 3]
    return () => h('view', { class: 'scale-item' }, [
      h('text', { class: 'scale-label' }, props.label),
      h('view', { class: 'scale-options' }, options.map(opt =>
        h('view', {
          class: ['scale-option', props.modelValue === opt ? 'active' : ''],
          onClick: () => emit('update:modelValue', opt)
        }, String(opt))
      ))
    ])
  }
})

const load = async () => {
  const res = await httpV2.get<Record<string, any>>(API_ENDPOINTS.patient.registration)
  if (res.code === 0 && res.data && Object.keys(res.data).length) {
    form.value = { ...createForm(), ...res.data }
  }
}

const save = async () => {
  saving.value = true
  try {
    const res = await httpV2.put(API_ENDPOINTS.patient.registration, form.value)
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
.page-registration {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 28rpx;
  padding-bottom: 64rpx;
}

.section {
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.section-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 10rpx;
}

.section-desc {
  display: block;
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.6;
  margin-bottom: 22rpx;
}

.field {
  margin-top: 24rpx;
}

.label,
.scale-label {
  display: block;
  font-size: 26rpx;
  color: #4B5563;
  margin-bottom: 12rpx;
  line-height: 1.5;
}

.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1F2937;
}

.textarea {
  min-height: 150rpx;
  line-height: 1.6;
}

.scale-item {
  padding: 22rpx 0;
  border-bottom: 1rpx solid #F3F4F6;
}

.scale-options {
  display: flex;
  gap: 16rpx;
}

.scale-option {
  width: 68rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  border-radius: 16rpx;
  background: #F3F4F6;
  color: #6B7280;
  font-size: 28rpx;
  font-weight: 700;
}

.scale-option.active {
  background: #0D9488;
  color: #fff;
}

.score {
  display: block;
  margin-top: 24rpx;
  font-size: 30rpx;
  font-weight: 800;
  color: #0D9488;
}

.save-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border: none;
  border-radius: 100rpx;
  background: #0D9488;
  color: #fff;
  font-size: 32rpx;
  font-weight: 800;
}
</style>
