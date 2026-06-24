<template>
  <view class="page-case-record">
    <view class="tip-banner">
      <text>{{ isAmendment ? '修改内容需管理员审核通过后才会生效' : '请一次性完整填写并提交，提交后不可修改' }}</text>
    </view>

    <view class="form-section">
      <text class="form-section-title">患者情况记录（主观陈述）<text class="required">*</text></text>
      <textarea
        class="form-textarea"
        v-model="form.subjective"
        placeholder="记录来访者本次陈述的主要内容、主诉与情绪状态..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">客观观察<text class="required">*</text></text>
      <textarea
        class="form-textarea"
        v-model="form.objective"
        placeholder="记录行为观察、情绪状态、量表得分等..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">评估分析<text class="required">*</text></text>
      <textarea
        class="form-textarea"
        v-model="form.assessment"
        placeholder="对本次咨询的综合判断、议题分析..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">计划方向<text class="required">*</text></text>
      <textarea
        class="form-textarea"
        v-model="form.plan"
        placeholder="下次咨询的方向、布置的作业或建议..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">相关照片</text>
      <text class="form-hint">选填，可上传咨询相关照片，最多 9 张</text>
      <view class="photo-grid">
        <view v-for="(url, idx) in photoUrls" :key="url" class="photo-item">
          <image class="photo-img" :src="fixImageUrl(url)" mode="aspectFill" @tap="previewPhoto(idx)" />
          <view class="photo-remove" @tap.stop="removePhoto(idx)">×</view>
        </view>
        <view v-if="photoUrls.length < 9" class="photo-add" @tap="pickPhotos">
          <text class="photo-add-text">{{ uploading ? '上传中' : '+' }}</text>
        </view>
      </view>
    </view>

    <view v-if="isAmendment" class="form-section">
      <text class="form-section-title">修改说明</text>
      <text class="form-hint">选填，可向管理员说明修改原因</text>
      <textarea
        class="form-textarea"
        v-model="amendReason"
        placeholder="例如：补充遗漏的观察内容..."
        :auto-height="true"
        :maxlength="500"
      />
    </view>

    <button class="save-btn" :loading="saving" @tap="save">{{ isAmendment ? '提交修改申请' : '提交咨询记录' }}</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { fixImageUrl } from '@/utils/image'
import { API_ENDPOINTS } from '@/config/api'
import { caseRecordHasContent } from '@/utils/case-record'

type FormKey = 'subjective' | 'objective' | 'assessment' | 'plan'

const REQUIRED_FIELDS: { key: FormKey; label: string }[] = [
  { key: 'subjective', label: '患者情况记录（主观陈述）' },
  { key: 'objective', label: '客观观察' },
  { key: 'assessment', label: '评估分析' },
  { key: 'plan', label: '计划方向' },
]

const form = ref({ subjective: '', objective: '', assessment: '', plan: '' })
const photoUrls = ref<string[]>([])
const saving = ref(false)
const uploading = ref(false)
const consultationId = ref(0)
const recordId = ref(0)
const isAmendment = ref(false)
const amendReason = ref('')

const loadExistingDraft = async (rid: number) => {
  const res = await httpV2.get(`${API_ENDPOINTS.counselor.caseRecords}/${rid}`, undefined, {
    showLoading: false,
  })
  if (res.code !== 0 || !res.data) return
  if (caseRecordHasContent(res.data) && !isAmendment.value) {
    uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${rid}` })
    return
  }
  if (isAmendment.value && res.data.AmendmentStatus === 'PENDING') {
    uni.showToast({ title: '已有待审核的修改申请', icon: 'none' })
    setTimeout(() => uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${rid}` }), 1200)
    return
  }
  form.value = {
    subjective: res.data.Subjective ?? '',
    objective: res.data.Objective ?? '',
    assessment: res.data.Assessment ?? '',
    plan: res.data.Plan ?? '',
  }
  photoUrls.value = Array.isArray(res.data.PhotoUrls) ? [...res.data.PhotoUrls] : []
  if (res.data.ConsultationId) consultationId.value = res.data.ConsultationId
}

onLoad(async (opts) => {
  consultationId.value = Number(opts?.consultationId || 0)
  recordId.value = Number(opts?.recordId || 0)
  isAmendment.value = opts?.mode === 'amendment'
  if (recordId.value) await loadExistingDraft(recordId.value)
})

const validateForm = () => {
  const missing = REQUIRED_FIELDS.filter(({ key }) => !form.value[key].trim()).map(({ label }) => label)
  if (missing.length) {
    uni.showToast({ title: `请填写：${missing[0]}`, icon: 'none' })
    return false
  }
  return true
}

const pickPhotos = () => {
  if (uploading.value) return
  const remain = 9 - photoUrls.value.length
  uni.chooseImage({
    count: remain,
    success: async (res) => {
      uploading.value = true
      try {
        for (const path of res.tempFilePaths) {
          const uploadRes = await httpV2.upload(API_ENDPOINTS.upload.file, path, 'file')
          if (uploadRes.code === 0 && uploadRes.data?.url) {
            photoUrls.value.push(uploadRes.data.url)
          } else {
            uni.showToast({ title: uploadRes.msg || '上传失败', icon: 'none' })
          }
        }
      } finally {
        uploading.value = false
      }
    },
  })
}

const removePhoto = (idx: number) => {
  photoUrls.value.splice(idx, 1)
}

const previewPhoto = (idx: number) => {
  uni.previewImage({
    current: fixImageUrl(photoUrls.value[idx]),
    urls: photoUrls.value.map((u) => fixImageUrl(u)),
  })
}

const save = async () => {
  if (!validateForm()) return
  if (isAmendment.value) {
    if (!recordId.value) {
      uni.showToast({ title: '缺少记录编号', icon: 'none' })
      return
    }
    saving.value = true
    try {
      const res = await httpV2.post(
        API_ENDPOINTS.counselor.caseRecordAmendmentRequest(recordId.value),
        {
          ...form.value,
          photo_urls: photoUrls.value,
          reason: amendReason.value.trim() || undefined,
        },
      )
      if (res.code === 0) {
        uni.showToast({ title: '修改申请已提交', icon: 'success' })
        setTimeout(() => {
          uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${recordId.value}` })
        }, 1200)
      } else {
        uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
      }
    } finally {
      saving.value = false
    }
    return
  }
  if (!consultationId.value) {
    uni.showToast({ title: '缺少咨询参数，请返回重试', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.counselor.caseRecords, {
      consultation_id: consultationId.value,
      ...form.value,
      photo_urls: photoUrls.value,
    })
    if (res.code === 0) {
      uni.showToast({ title: '提交成功', icon: 'success' })
      const newId = res.data?.Id
      setTimeout(() => {
        if (newId) {
          uni.redirectTo({ url: `/pages/counselor/case-record/view?recordId=${newId}` })
        } else {
          uni.navigateBack()
        }
      }, 1200)
    } else {
      uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page-case-record { padding: 32rpx; background: #F4F6F8; min-height: 100vh; padding-bottom: 48rpx; }

.tip-banner {
  background: #EFF6FF;
  border: 1rpx solid #BFDBFE;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 24rpx;
  font-size: 24rpx;
  color: #1D4ED8;
  text-align: center;
}

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
  color: #1F2937;
  margin-bottom: 16rpx;
}

.required {
  color: #DC2626;
  margin-left: 4rpx;
}

.form-hint {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-bottom: 16rpx;
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.6;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.photo-item {
  position: relative;
  width: 200rpx;
  height: 200rpx;
}

.photo-img {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
  background: #F3F4F6;
}

.photo-remove {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 28rpx;
  line-height: 40rpx;
  text-align: center;
}

.photo-add {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed #D1D5DB;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F9FAFB;
}

.photo-add-text {
  font-size: 48rpx;
  color: #9CA3AF;
}

.save-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  margin-top: 8rpx;
}
</style>
