<template>
  <view class="page-case-record">
    <view class="form-section">
      <text class="form-section-title">S — 主观陈述（来访者描述）</text>
      <textarea
        class="form-textarea"
        v-model="form.subjective"
        placeholder="记录来访者本次陈述的主要内容..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">O — 客观观察（咨询师观察/评估工具结果）</text>
      <textarea
        class="form-textarea"
        v-model="form.objective"
        placeholder="记录行为观察、情绪状态、量表得分等..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">A — 评估分析（诊断印象与动力理解）</text>
      <textarea
        class="form-textarea"
        v-model="form.assessment"
        placeholder="对本次咨询的综合判断、议题分析..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">P — 计划方向（下次咨询目标与安排）</text>
      <textarea
        class="form-textarea"
        v-model="form.plan"
        placeholder="下次咨询的方向、布置的作业或建议..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <button class="save-btn" :loading="saving" @click="save">保存个案记录</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'

const form = ref({ subjective: '', objective: '', assessment: '', plan: '' })
const saving = ref(false)
const consultationId = ref(0)
const recordId = ref<number | null>(null)  // 已有记录时用于 PUT

onMounted(async () => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  consultationId.value = Number(current?.options?.consultationId || 0)
  const rid = Number(current?.options?.recordId || 0)

  if (rid) {
    // 编辑模式：加载已有内容
    recordId.value = rid
    const res = await httpV2.get('/api/mini/counselor/case-records')
    if (res.code === 0 && Array.isArray(res.data)) {
      const found = res.data.find((r: any) => r.Id === rid)
      if (found) {
        form.value = {
          subjective: found.Subjective ?? '',
          objective: found.Objective ?? '',
          assessment: found.Assessment ?? '',
          plan: found.Plan ?? '',
        }
      }
    }
  }
})

const save = async () => {
  if (!consultationId.value && !recordId.value) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    return
  }
  saving.value = true
  try {
    let res
    if (recordId.value) {
      res = await httpV2.put(`/api/mini/counselor/case-records/${recordId.value}`, form.value)
    } else {
      res = await httpV2.post('/api/mini/counselor/case-records', {
        consultation_id: consultationId.value,
        ...form.value,
      })
    }
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 1200)
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page-case-record { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }

.form-section {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.form-section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #0D9488;
  margin-bottom: 20rpx;
  line-height: 1.4;
}
.form-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.8;
  box-sizing: border-box;
}

.save-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #0D9488;
  color: #fff;
  border: none;
  border-radius: 100rpx;
  font-size: 32rpx;
  font-weight: 700;
  margin-top: 16rpx;
  box-shadow: 0 8rpx 24rpx rgba(13,148,136,0.3);
}
</style>
