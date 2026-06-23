<template>
  <view class="page-view">
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="errorMsg" class="empty">{{ errorMsg }}</view>
    <view v-else-if="!record" class="empty">咨询记录不存在或未填写</view>
    <view v-else class="content">
      <view class="meta-card">
        <view class="meta-row">
          <text class="label">咨询师</text>
          <text class="value">{{ record.CounselorName }}</text>
        </view>
        <view class="meta-row">
          <text class="label">来访者</text>
          <text class="value">{{ record.PatientName }}</text>
        </view>
        <view class="meta-row">
          <text class="label">咨询时间</text>
          <text class="value">{{ formatDT(record.StartTime) }}</text>
          <text v-if="record.EndTime" class="value-end"> - {{ formatEnd(record.EndTime) }}</text>
        </view>
        <view v-if="record.UpdatedAt" class="meta-row">
          <text class="label">最近更新</text>
          <text class="value">{{ formatDT(record.UpdatedAt) }}</text>
        </view>
      </view>

      <view class="readonly-banner">
        <text>管理员只读查看，不可修改</text>
      </view>

      <view class="form-section">
        <text class="form-section-title">患者情况记录（主观陈述）</text>
        <text class="form-text readonly">{{ record.Subjective || '—' }}</text>
      </view>

      <view class="form-section">
        <text class="form-section-title">客观观察</text>
        <text class="form-text readonly">{{ record.Objective || '—' }}</text>
      </view>

      <view class="form-section">
        <text class="form-section-title">评估分析</text>
        <text class="form-text readonly">{{ record.Assessment || '—' }}</text>
      </view>

      <view class="form-section">
        <text class="form-section-title">计划方向</text>
        <text class="form-text readonly">{{ record.Plan || '—' }}</text>
      </view>

      <view v-if="photoUrls.length" class="form-section">
        <text class="form-section-title">相关照片</text>
        <view class="photo-grid">
          <image
            v-for="(url, idx) in photoUrls"
            :key="url"
            class="photo-img"
            :src="fixImageUrl(url)"
            mode="aspectFill"
            @tap="previewPhoto(idx)"
          />
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
          <view v-if="rev.PhotoUrls && rev.PhotoUrls.length" class="revision-photos">
            <image
              v-for="(url, i) in rev.PhotoUrls"
              :key="url"
              class="revision-thumb"
              :src="fixImageUrl(url)"
              mode="aspectFill"
              @tap="previewRevisionPhotos(rev.PhotoUrls!, i)"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { fixImageUrl } from '@/utils/image'
import { API_ENDPOINTS } from '@/config/api'

interface CaseRecordView {
  Id: number
  ConsultationId: number
  CounselorId: number
  CounselorName: string
  PatientName: string
  StartTime?: string
  EndTime?: string
  Subjective?: string
  Objective?: string
  Assessment?: string
  Plan?: string
  PhotoUrls?: string[]
  CreatedAt?: string
  UpdatedAt?: string
}

interface Revision {
  Id: number
  RevisedAt: string
  Subjective?: string
  Objective?: string
  Assessment?: string
  Plan?: string
  PhotoUrls?: string[]
}

const loading = ref(true)
const errorMsg = ref('')
const record = ref<CaseRecordView | null>(null)
const revisions = ref<Revision[]>([])

const photoUrls = computed(() => record.value?.PhotoUrls || [])

const toText = (dt: unknown) => {
  if (dt == null || dt === '') return ''
  if (typeof dt === 'string') return dt
  if (typeof dt === 'number') return String(dt)
  return String(dt)
}

const formatDT = (dt?: unknown) => {
  const text = toText(dt)
  return text ? text.slice(0, 16).replace('T', ' ') : '—'
}

const formatEnd = (dt?: unknown) => {
  const text = toText(dt).replace('T', ' ')
  if (!text) return ''
  return text.length > 11 ? text.slice(11, 16) : text.slice(0, 16)
}

const normalizeRecord = (raw: any): CaseRecordView | null => {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.Id ?? raw.id
  if (!id) return null
  return {
    Id: id,
    ConsultationId: raw.ConsultationId ?? raw.consultationId ?? 0,
    CounselorId: raw.CounselorId ?? raw.counselorId ?? 0,
    CounselorName: raw.CounselorName ?? raw.counselorName ?? '—',
    PatientName: raw.PatientName ?? raw.patientName ?? '—',
    StartTime: toText(raw.StartTime ?? raw.startTime) || undefined,
    EndTime: toText(raw.EndTime ?? raw.endTime) || undefined,
    Subjective: raw.Subjective ?? raw.subjective,
    Objective: raw.Objective ?? raw.objective,
    Assessment: raw.Assessment ?? raw.assessment,
    Plan: raw.Plan ?? raw.plan,
    PhotoUrls: raw.PhotoUrls ?? raw.photoUrls ?? [],
    CreatedAt: toText(raw.CreatedAt ?? raw.createdAt) || undefined,
    UpdatedAt: toText(raw.UpdatedAt ?? raw.updatedAt) || undefined,
  }
}

const normalizeRevision = (raw: any): Revision => ({
  Id: raw.Id ?? raw.id,
  RevisedAt: toText(raw.RevisedAt ?? raw.revisedAt),
  Subjective: raw.Subjective ?? raw.subjective,
  Objective: raw.Objective ?? raw.objective,
  Assessment: raw.Assessment ?? raw.assessment,
  Plan: raw.Plan ?? raw.plan,
  PhotoUrls: raw.PhotoUrls ?? raw.photoUrls ?? [],
})

const previewPhoto = (idx: number) => {
  uni.previewImage({
    current: fixImageUrl(photoUrls.value[idx]),
    urls: photoUrls.value.map(u => fixImageUrl(u)),
  })
}

const previewRevisionPhotos = (urls: string[], idx: number) => {
  uni.previewImage({
    current: fixImageUrl(urls[idx]),
    urls: urls.map(u => fixImageUrl(u)),
  })
}

const loadRecord = async (recordId: number) => {
  if (!recordId) {
    errorMsg.value = '缺少记录编号，请返回重试'
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await httpV2.get<any>(
      API_ENDPOINTS.admin.consultationRecordView(recordId),
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code !== 0) {
      errorMsg.value = res.msg || '加载咨询记录失败'
      return
    }
    const normalized = normalizeRecord(res.data)
    if (!normalized) {
      errorMsg.value = '咨询记录数据异常'
      return
    }
    record.value = normalized

    const revRes = await httpV2.get<any[]>(
      API_ENDPOINTS.admin.consultationRecordRevisions(recordId),
      undefined,
      { showLoading: false, showError: false },
    )
    if (revRes.code === 0 && Array.isArray(revRes.data)) {
      revisions.value = revRes.data.map(normalizeRevision)
    }
  } catch {
    errorMsg.value = '网络异常，请稍后重试'
  } finally {
    loading.value = false
  }
}

onLoad((opts) => {
  const recordId = Number(opts?.recordId || 0)
  loadRecord(recordId)
})
</script>

<style scoped>
.page-view { min-height: 100vh; background: #F7F5F2; padding: 32rpx; padding-bottom: 48rpx; }
.empty { text-align: center; padding: 120rpx 32rpx; color: #9CA3AF; font-size: 28rpx; line-height: 1.6; }
.meta-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.meta-row { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8rpx; padding: 10rpx 0; align-items: center; }
.label { font-size: 26rpx; color: #8A8A8A; flex: 1; }
.value { font-size: 26rpx; color: #2C2C2C; text-align: right; }
.value-end { font-size: 26rpx; color: #2C2C2C; }
.readonly-banner {
  background: #FFFBEB;
  border: 1rpx solid #FDE68A;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  font-size: 24rpx;
  color: #92400E;
  text-align: center;
}
.form-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.form-section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #3D5A4E;
  margin-bottom: 16rpx;
}
.form-text.readonly {
  display: block;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.photo-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.photo-img { width: 200rpx; height: 200rpx; border-radius: 12rpx; }
.revision-card {
  background: #FAF7F3;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-top: 16rpx;
}
.revision-time { display: block; font-size: 22rpx; color: #9CA3AF; margin-bottom: 8rpx; }
.revision-line { display: block; font-size: 24rpx; color: #4B5563; line-height: 1.6; margin-top: 6rpx; }
.revision-photos { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 12rpx; }
.revision-thumb { width: 120rpx; height: 120rpx; border-radius: 8rpx; }
</style>
