<template>
  <view class="page-contact">
    <view class="add-card">
      <input class="input" type="number" v-model.number="form.patient_id" placeholder="患者账号 ID" />
      <picker :range="methods" :value="methodIndex" @change="onMethodChange">
        <view class="picker">{{ form.contact_method }}</view>
      </picker>
      <textarea class="textarea" v-model="form.content" placeholder="记录本次联系情况、风险点、后续跟进事项" />
      <button class="add-btn" :loading="saving" @click="save">新增联系记录</button>
    </view>

    <view v-if="records.length === 0" class="empty">暂无联系记录</view>
    <view v-for="item in records" :key="item.Id" class="record-card">
      <view class="record-head">
        <text class="patient">患者 #{{ item.PatientId }}</text>
        <text class="method">{{ methodLabel(item.ContactMethod) }}</text>
      </view>
      <text class="content">{{ item.Content || '无记录内容' }}</text>
      <text class="time">{{ formatTime(item.CreatedAt) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface ContactRecord {
  Id: number
  PatientId: number
  ContactMethod: string
  Content?: string
  CreatedAt: string
}

const methods = ['PHONE', 'WECHAT', 'OFFLINE', 'OTHER']
const records = ref<ContactRecord[]>([])
const saving = ref(false)
const form = ref({
  patient_id: undefined as number | undefined,
  contact_method: 'PHONE',
  content: '',
})

const methodIndex = computed(() => Math.max(0, methods.indexOf(form.value.contact_method)))
const methodLabel = (m: string) => ({ PHONE: '电话', WECHAT: '微信', OFFLINE: '线下', OTHER: '其他' }[m] || m)
const formatTime = (dt: string) => dt ? dt.slice(0, 16).replace('T', ' ') : ''

const onMethodChange = (e: any) => {
  form.value.contact_method = methods[Number(e.detail.value)]
}

const load = async () => {
  const res = await httpV2.get<ContactRecord[]>(API_ENDPOINTS.assistant.contactRecords)
  if (res.code === 0 && res.data) records.value = res.data
}

const save = async () => {
  if (!form.value.patient_id) {
    uni.showToast({ title: '请输入患者账号 ID', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.assistant.contactRecords, form.value)
    if (res.code === 0) {
      form.value = { patient_id: undefined, contact_method: 'PHONE', content: '' }
      await load()
      uni.showToast({ title: '已保存', icon: 'success' })
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
.page-contact {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 28rpx;
}

.add-card,
.record-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.input,
.picker,
.textarea {
  width: 100%;
  box-sizing: border-box;
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1F2937;
  margin-bottom: 18rpx;
}

.textarea {
  min-height: 150rpx;
  line-height: 1.6;
}

.add-btn {
  height: 82rpx;
  line-height: 82rpx;
  border: none;
  border-radius: 100rpx;
  background: #7C3AED;
  color: #fff;
  font-size: 30rpx;
  font-weight: 800;
}

.empty {
  text-align: center;
  color: #9CA3AF;
  font-size: 28rpx;
  padding: 80rpx 0;
}

.record-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.patient {
  font-size: 30rpx;
  font-weight: 800;
  color: #1F2937;
}

.method {
  font-size: 24rpx;
  color: #7C3AED;
}

.content {
  display: block;
  font-size: 27rpx;
  line-height: 1.7;
  color: #4B5563;
}

.time {
  display: block;
  margin-top: 18rpx;
  font-size: 23rpx;
  color: #9CA3AF;
}
</style>
