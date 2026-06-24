<template>
  <view class="page-view">
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="errorMsg" class="empty">{{ errorMsg }}</view>
    <view v-else-if="!record" class="empty">咨询记录不存在</view>
    <view v-else class="content">
      <view v-if="record.UpdatedAt" class="meta-card">
        <view class="meta-row">
          <text class="label">提交时间</text>
          <text class="value">{{ formatDT(record.UpdatedAt || record.CreatedAt) }}</text>
        </view>
      </view>

      <view v-if="record.AmendmentStatus === 'PENDING'" class="pending-banner">
        <text>修改申请审核中，请等待管理员处理</text>
      </view>
      <view v-else-if="record.AmendmentStatus === 'REJECTED'" class="rejected-banner">
        <text>上次修改申请已驳回{{ record.AmendmentRejectReason ? `：${record.AmendmentRejectReason}` : '' }}</text>
      </view>
      <view v-else class="readonly-banner">
        <text>咨询记录已提交，仅可查看不可修改</text>
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
    </view>

    <view v-if="record && canApplyAmendment" class="footer-bar">
      <button class="apply-btn" @tap="goApplyAmendment">申请修改</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { fixImageUrl } from '@/utils/image'
import { API_ENDPOINTS } from '@/config/api'
import { caseRecordHasContent } from '@/utils/case-record'

interface CaseRecordView {
  Id: number
  ConsultationId: number
  Subjective?: string
  Objective?: string
  Assessment?: string
  Plan?: string
  PhotoUrls?: string[]
  CreatedAt?: string
  UpdatedAt?: string
  AmendmentStatus?: string
  AmendmentRejectReason?: string
}

const loading = ref(true)
const errorMsg = ref('')
const record = ref<CaseRecordView | null>(null)
const recordId = ref(0)

const photoUrls = computed(() => record.value?.PhotoUrls || [])
const canApplyAmendment = computed(() => {
  const status = record.value?.AmendmentStatus
  return !status || status === 'REJECTED' || status === 'APPROVED'
})

const formatDT = (dt?: string) => (dt ? dt.slice(0, 16).replace('T', ' ') : '—')

const previewPhoto = (idx: number) => {
  uni.previewImage({
    current: fixImageUrl(photoUrls.value[idx]),
    urls: photoUrls.value.map(u => fixImageUrl(u)),
  })
}

const goApplyAmendment = () => {
  if (!recordId.value) return
  uni.navigateTo({
    url: `/pages/counselor/case-record/edit?mode=amendment&recordId=${recordId.value}`,
  })
}

const loadRecord = async (rid: number) => {
  if (!rid) {
    errorMsg.value = '缺少记录编号'
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await httpV2.get<CaseRecordView>(
      `${API_ENDPOINTS.counselor.caseRecords}/${rid}`,
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code !== 0 || !res.data) {
      errorMsg.value = res.msg || '加载失败'
      return
    }
    if (!caseRecordHasContent(res.data)) {
      uni.redirectTo({ url: `/pages/counselor/case-record/edit?recordId=${rid}&consultationId=${res.data.ConsultationId}` })
      return
    }
    record.value = res.data
  } catch {
    errorMsg.value = '网络异常，请稍后重试'
  } finally {
    loading.value = false
  }
}

onLoad((opts) => {
  recordId.value = Number(opts?.recordId || 0)
  loadRecord(recordId.value)
})
</script>

<style scoped>
.page-view { min-height: 100vh; background: #F4F6F8; padding: 32rpx; padding-bottom: 160rpx; }
.empty { text-align: center; padding: 120rpx 32rpx; color: #9CA3AF; font-size: 28rpx; }
.meta-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.meta-row { display: flex; justify-content: space-between; gap: 24rpx; }
.label { font-size: 26rpx; color: #8A8A8A; }
.value { font-size: 26rpx; color: #2C2C2C; }
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
.pending-banner {
  background: #EFF6FF;
  border: 1rpx solid #BFDBFE;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  font-size: 24rpx;
  color: #1D4ED8;
  text-align: center;
}
.rejected-banner {
  background: #FEF2F2;
  border: 1rpx solid #FECACA;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  font-size: 24rpx;
  color: #B91C1C;
  text-align: center;
}
.footer-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.06);
}
.apply-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
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
.form-text.readonly {
  display: block;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.photo-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.photo-img { width: 200rpx; height: 200rpx; border-radius: 12rpx; background: #F3F4F6; }
</style>
