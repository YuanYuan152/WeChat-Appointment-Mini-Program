<template>
  <view class="page-case-record">
    <view class="form-section">
      <text class="form-section-title">患者情况记录（主观陈述）</text>
      <textarea
        class="form-textarea"
        v-model="form.subjective"
        placeholder="记录来访者本次陈述的主要内容、主诉与情绪状态..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">客观观察</text>
      <textarea
        class="form-textarea"
        v-model="form.objective"
        placeholder="记录行为观察、情绪状态、量表得分等..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">评估分析</text>
      <textarea
        class="form-textarea"
        v-model="form.assessment"
        placeholder="对本次咨询的综合判断、议题分析..."
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-section">
      <text class="form-section-title">计划方向</text>
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
      <text class="form-hint">可上传咨询相关照片，最多 9 张</text>
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

    <view v-if="revisions.length > 0" class="form-section">
      <text class="form-section-title">修改历史</text>
      <view v-for="rev in revisions" :key="rev.Id" class="revision-card">
        <text class="revision-time">{{ formatDT(rev.RevisedAt) }}</text>
        <text v-if="rev.Subjective" class="revision-line">患者情况：{{ rev.Subjective }}</text>
        <text v-if="rev.Objective" class="revision-line">客观观察：{{ rev.Objective }}</text>
        <text v-if="rev.Assessment" class="revision-line">评估分析：{{ rev.Assessment }}</text>
        <text v-if="rev.Plan" class="revision-line">计划方向：{{ rev.Plan }}</text>
        <view v-if="rev.PhotoUrls?.length" class="revision-photos">
          <image
            v-for="(url, i) in rev.PhotoUrls"
            :key="url"
            class="revision-thumb"
            :src="fixImageUrl(url)"
            mode="aspectFill"
            @tap="previewRevisionPhotos(rev.PhotoUrls, i)"
          />
        </view>
      </view>
    </view>

    <button class="save-btn" :loading="saving" @click="save">保存咨询记录</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'
import { fixImageUrl } from '@/utils/image'
import { API_ENDPOINTS } from '@/config/api'

interface Revision {
  Id: number
  RevisedAt: string
  Subjective?: string
  Objective?: string
  Assessment?: string
  Plan?: string
  PhotoUrls?: string[]
}

const form = ref({ subjective: '', objective: '', assessment: '', plan: '' })
const photoUrls = ref<string[]>([])
const revisions = ref<Revision[]>([])
const saving = ref(false)
const uploading = ref(false)
const consultationId = ref(0)
const recordId = ref<number | null>(null)

const formatDT = (dt: string) => dt?.slice(0, 16).replace('T', ' ') ?? ''

const loadRecord = async (rid: number) => {
  const res = await httpV2.get(`${API_ENDPOINTS.counselor.caseRecords}/${rid}`)
  if (res.code === 0 && res.data) {
    const found = res.data
    form.value = {
      subjective: found.Subjective ?? '',
      objective: found.Objective ?? '',
      assessment: found.Assessment ?? '',
      plan: found.Plan ?? '',
    }
    photoUrls.value = Array.isArray(found.PhotoUrls) ? [...found.PhotoUrls] : []
  }
  const revRes = await httpV2.get(`${API_ENDPOINTS.counselor.caseRecords}/${rid}/revisions`)
  if (revRes.code === 0 && Array.isArray(revRes.data)) {
    revisions.value = revRes.data
  }
}

onMounted(async () => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  consultationId.value = Number(current?.options?.consultationId || 0)
  const rid = Number(current?.options?.recordId || 0)

  if (rid) {
    recordId.value = rid
    await loadRecord(rid)
  }
})

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

const previewRevisionPhotos = (urls: string[], idx: number) => {
  uni.previewImage({
    current: fixImageUrl(urls[idx]),
    urls: urls.map((u) => fixImageUrl(u)),
  })
}

const save = async () => {
  if (!consultationId.value && !recordId.value) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      photo_urls: photoUrls.value,
    }
    let res
    if (recordId.value) {
      res = await httpV2.put(`${API_ENDPOINTS.counselor.caseRecords}/${recordId.value}`, payload)
    } else {
      res = await httpV2.post(API_ENDPOINTS.counselor.caseRecords, {
        consultation_id: consultationId.value,
        ...payload,
      })
      if (res.code === 0 && res.data?.Id) recordId.value = res.data.Id
    }
    if (res.code === 0) {
      if (recordId.value) await loadRecord(recordId.value)
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
.page-case-record { padding: 32rpx; background: #F4F6F8; min-height: 100vh; padding-bottom: 48rpx; }

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

.revision-card {
  border-top: 1rpx solid #F3F4F6;
  padding-top: 20rpx;
  margin-top: 20rpx;
}

.revision-card:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.revision-time {
  display: block;
  font-size: 24rpx;
  color: #6B7280;
  margin-bottom: 12rpx;
}

.revision-line {
  display: block;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.6;
  margin-bottom: 8rpx;
}

.revision-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.revision-thumb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 8rpx;
  background: #F3F4F6;
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
