<template>
  <view class="page-patient-pricing">
    <view class="counselor-banner">
      <text class="counselor-name">{{ counselorName }}</text>
      <text class="counselor-meta">
        统一基础价 ¥{{ counselor?.basePriceYuan ?? '—' }} · {{ counselor?.counselorTypeLabel }}
        <text v-if="counselor?.usingDefaultBase">（默认）</text>
      </text>
      <text class="banner-tip">共 {{ total }} 位来访 · 以下管理各来访对本咨询师的调价与分成</text>
    </view>

    <view class="toolbar">
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="搜索来访姓名/手机号/ID"
        confirm-type="search"
        @confirm="reload(true)"
      />
      <view class="tool-btn" @tap="reload(true)">搜索</view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="items.length === 0" class="empty">
      {{ keyword.trim() ? '未找到匹配来访' : '暂无来访数据' }}
    </view>
    <view v-else class="list">
      <view v-for="row in items" :key="row.patientId" class="card">
        <view class="card-head">
          <view>
            <text class="patient-name">{{ row.patientName }}</text>
            <text class="patient-meta">ID {{ row.patientId }}{{ row.patientMobile ? ' · ' + row.patientMobile : '' }}</text>
            <text class="stats-line">
              累计完成 {{ row.totalCompletedConsultations }} 次咨询 · 与本咨询师 {{ row.counselorCompletedConsultations }} 次
            </text>
            <text v-if="row.autoAdjustmentYuan" class="auto-hint">
              系统调价 +¥{{ row.autoAdjustmentYuan }}（已完成 {{ row.lowPriceOrderCount }} 次 ¥100 订单）
            </text>
          </view>
          <view class="edit-btn" @tap="openEdit(row)">编辑</view>
        </view>

        <view class="price-grid">
          <view class="price-cell muted">
            <text class="cell-label">基础价格</text>
            <text class="cell-value">¥{{ row.basePriceYuan }}</text>
          </view>
          <view class="price-cell">
            <text class="cell-label">手动调价</text>
            <text class="cell-value" :class="adjustClass(row.manualAdjustmentYuan)">
              {{ formatAdjustment(row.manualAdjustmentYuan) }}
            </text>
          </view>
          <view class="price-cell highlight">
            <text class="cell-label">显示价格</text>
            <text class="cell-value strong">¥{{ row.displayPriceYuan }}</text>
          </view>
          <view class="price-cell">
            <text class="cell-label">分成收入</text>
            <text class="cell-value">¥{{ row.revenueShareYuan }}</text>
            <text v-if="row.shareMode === 'PERCENT'" class="cell-sub">{{ row.revenueSharePercent }}%</text>
            <text v-else-if="row.shareMode === 'AMOUNT'" class="cell-sub">固定金额</text>
            <text v-else class="cell-sub">默认全额</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showEdit && editing" class="overlay" @touchmove.stop.prevent>
      <view class="modal-card edit-modal" @tap.stop>
        <text class="modal-title">编辑来访定价</text>
        <text class="modal-sub">{{ editing.patientName }}</text>

        <view class="preview-row">
          <text class="preview-label">基础价格（统一）</text>
          <text class="preview-value">¥{{ editing.basePriceYuan }}</text>
        </view>
        <view v-if="editing.autoAdjustmentYuan" class="preview-row">
          <text class="preview-label">系统调价</text>
          <text class="preview-value">+¥{{ editing.autoAdjustmentYuan }}</text>
        </view>

        <view class="form-group">
          <text class="form-label">手动调价（元，可正可负）</text>
          <input v-model="form.adjustmentYuan" class="form-input" type="number" placeholder="如 -50 或 100" />
        </view>

        <view class="preview-row">
          <text class="preview-label">显示价格（预览）</text>
          <text class="preview-value accent">¥{{ previewDisplayYuan }}</text>
        </view>

        <view class="form-group">
          <text class="form-label">分成方式</text>
          <view class="share-tabs">
            <view class="share-tab" :class="{ active: form.shareMode === '' }" @tap="form.shareMode = ''">默认全额</view>
            <view class="share-tab" :class="{ active: form.shareMode === 'AMOUNT' }" @tap="form.shareMode = 'AMOUNT'">固定金额</view>
            <view class="share-tab" :class="{ active: form.shareMode === 'PERCENT' }" @tap="form.shareMode = 'PERCENT'">占比</view>
          </view>
        </view>

        <view v-if="form.shareMode === 'AMOUNT'" class="form-group">
          <text class="form-label">分成金额（元）</text>
          <input v-model="form.revenueShareYuan" class="form-input" type="number" />
        </view>

        <view v-if="form.shareMode === 'PERCENT'" class="form-group">
          <text class="form-label">分成占比（0–100%）</text>
          <input v-model="form.revenueSharePercent" class="form-input" type="number" />
          <text class="form-hint">预览分成：¥{{ previewShareYuan }}</text>
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap="closeEdit">取消</button>
          <button class="modal-btn confirm" :loading="saving" @tap="saveEdit">保存</button>
        </view>
      </view>
    </view>

    <view v-if="!loading && hasMore" class="load-more" @tap="loadMore">加载更多</view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface CounselorInfo {
  counselorId: number
  counselorName: string
  counselorTypeLabel: string
  basePriceYuan: number
  usingDefaultBase?: boolean
}

interface PatientPricingRow {
  patientId: number
  patientName: string
  patientMobile?: string
  basePriceYuan: number
  manualAdjustmentYuan: number
  autoAdjustmentYuan: number
  adjustmentYuan: number
  displayPriceYuan: number
  revenueShareYuan: number
  lowPriceOrderCount: number
  totalCompletedConsultations: number
  counselorCompletedConsultations: number
  shareMode?: string | null
  revenueSharePercent?: number | null
}

const counselorId = ref(0)
const counselorName = ref('')
const counselor = ref<CounselorInfo | null>(null)
const items = ref<PatientPricingRow[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const saving = ref(false)
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const pageSize = 50

const hasMore = computed(() => items.value.length < total.value)

const showEdit = ref(false)
const editing = ref<PatientPricingRow | null>(null)
const form = reactive({
  adjustmentYuan: '0',
  shareMode: '' as '' | 'AMOUNT' | 'PERCENT',
  revenueShareYuan: '',
  revenueSharePercent: '',
})

const previewDisplayYuan = computed(() => {
  if (!editing.value) return 0
  const manual = Number(form.adjustmentYuan) || 0
  return Math.max(editing.value.basePriceYuan + manual + (editing.value.autoAdjustmentYuan || 0), 0)
})

const previewShareYuan = computed(() => {
  const display = previewDisplayYuan.value
  if (form.shareMode === 'AMOUNT') {
    return Math.max(0, Math.min(Number(form.revenueShareYuan) || 0, display))
  }
  if (form.shareMode === 'PERCENT') {
    const pct = Math.max(0, Math.min(Number(form.revenueSharePercent) || 0, 100))
    return Math.floor(display * pct / 100)
  }
  return display
})

const formatAdjustment = (v: number) => (v > 0 ? `+¥${v}` : v < 0 ? `-¥${Math.abs(v)}` : '¥0')
const adjustClass = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : '')

const reload = async (reset = true) => {
  if (!counselorId.value) return
  if (reset) {
    page.value = 1
    loading.value = true
  } else {
    loadingMore.value = true
  }
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      page_size: pageSize,
    }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await httpV2.get<{ counselor: CounselorInfo; items: PatientPricingRow[]; total: number }>(
      API_ENDPOINTS.admin.pricingCounselorPatients(counselorId.value),
      params,
      { showLoading: false },
    )
    if (res.code === 0 && res.data) {
      counselor.value = res.data.counselor
      total.value = res.data.total || 0
      const next = res.data.items || []
      items.value = reset ? next : [...items.value, ...next]
    } else if (reset) {
      items.value = []
      total.value = 0
    }
  } catch {
    if (reset) {
      items.value = []
      total.value = 0
    }
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loadingMore.value) return
  page.value += 1
  await reload(false)
}

const openEdit = (row: PatientPricingRow) => {
  editing.value = row
  form.adjustmentYuan = String(row.manualAdjustmentYuan)
  form.shareMode = (row.shareMode as typeof form.shareMode) || ''
  form.revenueShareYuan = row.shareMode === 'AMOUNT' ? String(row.revenueShareYuan) : ''
  form.revenueSharePercent =
    row.shareMode === 'PERCENT' && row.revenueSharePercent != null ? String(row.revenueSharePercent) : ''
  showEdit.value = true
}

const closeEdit = () => {
  showEdit.value = false
  editing.value = null
}

const saveEdit = async () => {
  if (!editing.value || !counselorId.value) return
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      adjustmentYuan: Number(form.adjustmentYuan) || 0,
      shareMode: form.shareMode || null,
    }
    if (form.shareMode === 'AMOUNT') {
      payload.revenueShareYuan = Number(form.revenueShareYuan)
    } else if (form.shareMode === 'PERCENT') {
      payload.revenueSharePercent = Number(form.revenueSharePercent)
    }
    const res = await httpV2.put(
      API_ENDPOINTS.admin.pricingCounselorPatientUpdate(counselorId.value, editing.value.patientId),
      payload,
    )
    if (res.code === 0) {
      uni.showToast({ title: '已保存', icon: 'success' })
      closeEdit()
      await reload(true)
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onLoad((options) => {
  counselorId.value = Number(options?.counselorId || 0)
  counselorName.value = decodeURIComponent(String(options?.counselorName || '咨询师'))
})

onShow(() => reload(true))
</script>

<style scoped>
.page-patient-pricing {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}

.counselor-banner {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.counselor-name {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
}

.counselor-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

.banner-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5;
}

.toolbar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.search-input {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.tool-btn {
  flex-shrink: 0;
  padding: 0 32rpx;
  line-height: 88rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.empty {
  text-align: center;
  padding: 80rpx 0;
  color: #9CA3AF;
  font-size: 28rpx;
}

.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
}

.patient-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.patient-meta, .stats-line, .auto-hint {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}

.stats-line { color: #6B7280; }

.auto-hint { color: #6B9080; font-size: 22rpx; }

.load-more {
  text-align: center;
  padding: 28rpx;
  font-size: 28rpx;
  color: #3D5A4E;
  font-weight: 600;
}

.edit-btn {
  font-size: 24rpx;
  color: #3D5A4E;
  background: #E8E4DE;
  padding: 12rpx 24rpx;
  border-radius: 100rpx;
  font-weight: 600;
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.price-cell {
  background: #F7F5F2;
  border-radius: 16rpx;
  padding: 20rpx;
  border: 1rpx solid #E8E4DE;
}

.price-cell.muted { opacity: 0.85; }

.price-cell.highlight {
  background: #E8E4DE;
  border-color: #D4CFC6;
}

.cell-label {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-bottom: 8rpx;
}

.cell-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.cell-value.strong { color: #3D5A4E; font-size: 34rpx; }
.cell-value.up { color: #B45309; }
.cell-value.down { color: #047857; }

.cell-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #9CA3AF;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}

.modal-card {
  width: 100%;
  max-width: 640rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  box-sizing: border-box;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #2C2C2C;
}

.modal-sub {
  display: block;
  margin: 8rpx 0 24rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}

.preview-label { font-size: 26rpx; color: #6B7280; }
.preview-value { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.preview-value.accent { color: #3D5A4E; font-size: 34rpx; }

.form-group { margin-bottom: 24rpx; }

.form-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #6B7280;
  font-weight: 600;
}

.form-input {
  width: 100%;
  box-sizing: border-box;
  height: 88rpx;
  line-height: 88rpx;
  background: #F7F5F2;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  border: 1rpx solid #E8E4DE;
}

.form-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6B9080;
}

.share-tabs {
  display: flex;
  gap: 12rpx;
}

.share-tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 8rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #6B7280;
  background: #F7F5F2;
  border: 1rpx solid #E8E4DE;
}

.share-tab.active {
  background: #E8E4DE;
  color: #3D5A4E;
  font-weight: 600;
  border-color: #3D5A4E;
}

.modal-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.modal-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  font-size: 28rpx;
  font-weight: 600;
  margin: 0;
}

.modal-btn::after { border: none; }
.modal-btn.cancel { background: #F3F4F6; color: #6B7280; }
.modal-btn.confirm { background: #3D5A4E; color: #fff; }
</style>
