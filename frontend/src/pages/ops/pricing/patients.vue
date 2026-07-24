<template>
  <view class="page-patient-pricing">
    <view class="counselor-banner">
      <view class="banner-top">
        <text class="counselor-name">{{ counselorName }}</text>
        <text v-if="counselor?.counselorTypeLabel" class="counselor-type">{{ counselor.counselorTypeLabel }}</text>
      </view>

      <view class="base-price-hero">
        <text class="base-price-label">统一基础价</text>
        <view class="base-price-row">
          <text class="base-price-value">¥{{ counselor?.basePriceYuan ?? '—' }}</text>
          <text v-if="counselor?.usingDefaultBase" class="base-price-tag">系统默认</text>
        </view>
        <text class="base-price-hint">对该咨询师全部来访生效；未单独设置分成的来访沿用此默认分成</text>
      </view>

      <text class="banner-tip">共 {{ total }} 位来访 · 以下为个性化价格调整</text>
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
            <text v-else class="cell-sub">{{ counselorDefaultShareLabel }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showEdit && editing" class="overlay" @touchmove.stop.prevent>
      <view class="modal-card edit-modal" @tap.stop>
        <text class="modal-title">编辑来访定价</text>
        <text class="modal-sub">{{ editing.patientName }}</text>

        <view class="preview-row">
          <text class="preview-label">基础价格（所有来访生效）</text>
          <text class="preview-value">¥{{ editing.basePriceYuan }}</text>
        </view>
        <view v-if="editing.autoAdjustmentYuan" class="preview-row">
          <text class="preview-label">系统调价</text>
          <text class="preview-value">+¥{{ editing.autoAdjustmentYuan }}</text>
        </view>

        <view class="preview-row">
          <text class="preview-label">调整金额（对当前来访生效）</text>
          <view class="plain-amount">
            <text>¥</text>
            <input
              v-model="form.adjustmentYuan"
              class="plain-amount-input"
              type="number"
              placeholder="0"
            />
          </view>
        </view>

        <view class="preview-row">
          <text class="preview-label">显示价格（预览）</text>
          <text class="preview-value accent">¥{{ previewDisplayYuan }}</text>
        </view>

        <view class="share-target-section">
          <view class="share-header-row">
            <text class="share-target-label">分成</text>
            <view class="share-target-fields">
              <text class="share-col-label">分成比例</text>
              <text class="share-col-label">分成金额</text>
            </view>
          </view>
          <view class="share-target-row">
            <text class="share-target-label">平台</text>
            <view class="share-target-fields">
              <view class="target-field">
                <input
                  v-model="form.platformPercent"
                  class="plain-inline-input"
                  type="digit"
                  @input="onPlatformPercentInput"
                />
                <text class="share-inline-unit">%</text>
              </view>
              <view class="target-field amount-field">
                <view class="plain-amount compact">
                  <text>¥</text>
                  <input
                    v-model="form.platformYuan"
                    class="plain-amount-input"
                    type="digit"
                    @input="onPlatformYuanInput"
                  />
                </view>
              </view>
            </view>
          </view>
          <view class="share-target-row">
            <text class="share-target-label">咨询师</text>
            <view class="share-target-fields">
              <view class="target-field">
                <input
                  v-model="form.revenueSharePercent"
                  class="plain-inline-input"
                  type="digit"
                  @input="onCounselorPercentInput"
                />
                <text class="share-inline-unit">%</text>
              </view>
              <view class="target-field amount-field">
                <view class="plain-amount compact">
                  <text>¥</text>
                  <input
                    v-model="form.revenueShareYuan"
                    class="plain-amount-input"
                    type="digit"
                    @input="onCounselorYuanInput"
                  />
                </view>
              </view>
            </view>
          </view>
          <view class="share-target-row">
            <text class="share-target-label">医生</text>
            <view class="share-target-fields">
              <view class="target-field">
                <input
                  v-model="form.doctorPercent"
                  class="plain-inline-input"
                  type="digit"
                  @input="onDoctorPercentInput"
                />
                <text class="share-inline-unit">%</text>
              </view>
              <view class="target-field amount-field">
                <view class="plain-amount compact">
                  <text>¥</text>
                  <input
                    v-model="form.doctorYuan"
                    class="plain-amount-input"
                    type="digit"
                    @input="onDoctorYuanInput"
                  />
                </view>
              </view>
            </view>
          </view>
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
import { computed, reactive, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { maybePromptRoleSubscribe } from '@/utils/subscribePrompt'

interface CounselorInfo {
  counselorId: number
  counselorName: string
  counselorTypeLabel: string
  basePriceYuan: number
  usingDefaultBase?: boolean
  defaultShareMode?: string | null
  defaultRevenueShareYuan?: number | null
  defaultRevenueSharePercent?: number | null
  defaultShareYuan?: number
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

const DEFAULT_SHARE_PERCENT = 50

const showEdit = ref(false)
const editing = ref<PatientPricingRow | null>(null)
const form = reactive({
  adjustmentYuan: '0',
  revenueShareYuan: '0',
  revenueSharePercent: '0',
  platformPercent: '0',
  platformYuan: '0',
  doctorPercent: '0',
  doctorYuan: '0',
})

const shareSyncLock = ref(false)

const clampSharePercent = (value: number) => Math.max(0, Math.min(Math.round(value), 100))

const clampShareYuan = (value: number, display: number) => Math.max(0, Math.min(Math.floor(value), display))

const calcShareYuanFromPercent = (percent: number, display = previewDisplayYuan.value) =>
  clampShareYuan(Math.floor(display * percent / 100), display)

const calcSharePercentFromYuan = (amount: number, display = previewDisplayYuan.value) => {
  if (display <= 0) return 0
  return clampSharePercent(Math.round(amount / display * 100))
}

const applyCounselorShare = (percent: number, yuan: number) => {
  if (shareSyncLock.value) return
  shareSyncLock.value = true
  const display = previewDisplayYuan.value
  const counselorYuan = clampShareYuan(yuan, display)
  const counselorPercent = calcSharePercentFromYuan(counselorYuan, display)
  const doctorYuan = clampShareYuan(Number(form.doctorYuan) || 0, display)
  const platformYuan = Math.max(0, display - counselorYuan - doctorYuan)
  form.revenueSharePercent = String(counselorPercent)
  form.revenueShareYuan = String(counselorYuan)
  form.platformYuan = String(platformYuan)
  form.platformPercent = String(calcSharePercentFromYuan(platformYuan, display))
  shareSyncLock.value = false
}

const onCounselorPercentInput = () => {
  const percent = clampSharePercent(Number(form.revenueSharePercent) || 0)
  applyCounselorShare(percent, calcShareYuanFromPercent(percent))
}

const onCounselorYuanInput = () => {
  const display = previewDisplayYuan.value
  const yuan = clampShareYuan(Number(form.revenueShareYuan) || 0, display)
  applyCounselorShare(calcSharePercentFromYuan(yuan, display), yuan)
}

const applyPlatformShare = (percent: number, yuan: number) => {
  if (shareSyncLock.value) return
  shareSyncLock.value = true
  const display = previewDisplayYuan.value
  const platformYuan = clampShareYuan(yuan, display)
  const platformPercent = calcSharePercentFromYuan(platformYuan, display)
  const doctorYuan = clampShareYuan(Number(form.doctorYuan) || 0, display)
  const counselorYuan = Math.max(0, display - platformYuan - doctorYuan)
  form.platformPercent = String(platformPercent)
  form.platformYuan = String(platformYuan)
  form.revenueShareYuan = String(counselorYuan)
  form.revenueSharePercent = String(calcSharePercentFromYuan(counselorYuan, display))
  shareSyncLock.value = false
}

const onPlatformPercentInput = () => {
  const percent = clampSharePercent(Number(form.platformPercent) || 0)
  applyPlatformShare(percent, calcShareYuanFromPercent(percent))
}

const onPlatformYuanInput = () => {
  const display = previewDisplayYuan.value
  const yuan = clampShareYuan(Number(form.platformYuan) || 0, display)
  applyPlatformShare(calcSharePercentFromYuan(yuan, display), yuan)
}

const applyDoctorShare = (percent: number, yuan: number) => {
  if (shareSyncLock.value) return
  shareSyncLock.value = true
  const display = previewDisplayYuan.value
  const doctorYuan = clampShareYuan(yuan, display)
  const doctorPercent = calcSharePercentFromYuan(doctorYuan, display)
  const counselorYuan = clampShareYuan(Number(form.revenueShareYuan) || 0, display)
  const platformYuan = Math.max(0, display - counselorYuan - doctorYuan)
  form.doctorPercent = String(doctorPercent)
  form.doctorYuan = String(doctorYuan)
  form.platformYuan = String(platformYuan)
  form.platformPercent = String(calcSharePercentFromYuan(platformYuan, display))
  shareSyncLock.value = false
}

const onDoctorPercentInput = () => {
  const percent = clampSharePercent(Number(form.doctorPercent) || 0)
  applyDoctorShare(percent, calcShareYuanFromPercent(percent))
}

const onDoctorYuanInput = () => {
  const display = previewDisplayYuan.value
  const yuan = clampShareYuan(Number(form.doctorYuan) || 0, display)
  applyDoctorShare(calcSharePercentFromYuan(yuan, display), yuan)
}

watch(
  () => form.adjustmentYuan,
  () => {
    if (shareSyncLock.value) return
    shareSyncLock.value = true
    const display = previewDisplayYuan.value
    const percent = clampSharePercent(Number(form.revenueSharePercent) || 0)
    const counselorYuan = calcShareYuanFromPercent(percent, display)
    const doctorYuan = clampShareYuan(Number(form.doctorYuan) || 0, display)
    const platformYuan = Math.max(0, display - counselorYuan - doctorYuan)
    form.revenueShareYuan = String(counselorYuan)
    form.platformYuan = String(platformYuan)
    form.platformPercent = String(calcSharePercentFromYuan(platformYuan, display))
    shareSyncLock.value = false
  },
)

const counselorDefaultShareYuan = computed(() => {
  if (!counselor.value) return 0
  if (counselor.value.defaultShareMode === 'AMOUNT' && counselor.value.defaultRevenueShareYuan != null) {
    return counselor.value.defaultRevenueShareYuan
  }
  if (counselor.value.defaultShareMode === 'PERCENT' && counselor.value.defaultRevenueSharePercent != null) {
    return Math.floor(counselor.value.basePriceYuan * counselor.value.defaultRevenueSharePercent / 100)
  }
  if (counselor.value.defaultShareYuan != null) return counselor.value.defaultShareYuan
  return Math.floor((counselor.value.basePriceYuan || 0) * DEFAULT_SHARE_PERCENT / 100)
})

const counselorDefaultShareLabel = computed(() => {
  if (!counselor.value) return '50%'
  if (counselor.value.defaultShareMode === 'AMOUNT' && counselor.value.defaultRevenueShareYuan != null) {
    return `固定 ¥${counselor.value.defaultRevenueShareYuan}`
  }
  if (counselor.value.defaultShareMode === 'PERCENT' && counselor.value.defaultRevenueSharePercent != null) {
    return `${counselor.value.defaultRevenueSharePercent}%`
  }
  return '50%'
})

const previewDisplayYuan = computed(() => {
  if (!editing.value) return 0
  const manual = Number(form.adjustmentYuan) || 0
  return Math.max(editing.value.basePriceYuan + manual + (editing.value.autoAdjustmentYuan || 0), 0)
})

const counselorShareYuan = computed(() => Number(form.revenueShareYuan) || 0)

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

const resolveInitialShare = (row: PatientPricingRow) => {
  const display = Math.max(
    row.basePriceYuan + row.manualAdjustmentYuan + (row.autoAdjustmentYuan || 0),
    0,
  )
  let percent = DEFAULT_SHARE_PERCENT
  let amount = 0

  if (row.shareMode === 'PERCENT' && row.revenueSharePercent != null) {
    percent = clampSharePercent(row.revenueSharePercent)
    amount = calcShareYuanFromPercent(percent, display)
  } else if (row.shareMode === 'AMOUNT') {
    amount = clampShareYuan(row.revenueShareYuan, display)
    percent = calcSharePercentFromYuan(amount, display)
  } else if (counselor.value?.defaultShareMode === 'PERCENT' && counselor.value.defaultRevenueSharePercent != null) {
    percent = clampSharePercent(counselor.value.defaultRevenueSharePercent)
    amount = calcShareYuanFromPercent(percent, display)
  } else if (counselor.value?.defaultShareMode === 'AMOUNT' && counselor.value.defaultRevenueShareYuan != null) {
    amount = clampShareYuan(counselor.value.defaultRevenueShareYuan, display)
    percent = calcSharePercentFromYuan(amount, display)
  } else {
    amount = calcShareYuanFromPercent(percent, display)
  }

  return { percent, amount }
}

const openEdit = (row: PatientPricingRow) => {
  editing.value = row
  form.adjustmentYuan = String(row.manualAdjustmentYuan)
  const display = Math.max(
    row.basePriceYuan + row.manualAdjustmentYuan + (row.autoAdjustmentYuan || 0),
    0,
  )
  const { percent, amount } = resolveInitialShare(row)
  const platformYuan = Math.max(0, display - amount)
  shareSyncLock.value = true
  form.revenueSharePercent = String(percent)
  form.revenueShareYuan = String(amount)
  form.platformYuan = String(platformYuan)
  form.platformPercent = String(calcSharePercentFromYuan(platformYuan, display))
  form.doctorYuan = '0'
  form.doctorPercent = '0'
  shareSyncLock.value = false
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
      shareMode: 'AMOUNT',
      revenueShareYuan: counselorShareYuan.value,
    }
    const res = await httpV2.put(
      API_ENDPOINTS.admin.pricingCounselorPatientUpdate(counselorId.value, editing.value.patientId),
      payload,
    )
    if (res.code === 0) {
      uni.showToast({ title: '已保存', icon: 'success' })
      closeEdit()
      await reload(true)
      setTimeout(() => { void maybePromptRoleSubscribe('workbench') }, 500)
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

.banner-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.counselor-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
  flex: 1;
}

.counselor-type {
  flex-shrink: 0;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.15);
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.base-price-hero {
  background: rgba(255, 255, 255, 0.12);
  border: 2rpx solid rgba(255, 255, 255, 0.25);
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
}

.base-price-label {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 2rpx;
  margin-bottom: 8rpx;
}

.base-price-row {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.base-price-value {
  font-size: 56rpx;
  font-weight: 800;
  color: #fff;
  line-height: 1.1;
}

.base-price-tag {
  font-size: 22rpx;
  color: #FEF3C7;
  background: rgba(245, 158, 11, 0.35);
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}

.base-price-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.banner-tip {
  display: block;
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
  display: flex;
  gap: 12rpx;
}

.price-cell {
  flex: 1;
  min-width: 0;
  background: #F7F5F2;
  border-radius: 16rpx;
  padding: 20rpx 16rpx;
  border: 1rpx solid #E8E4DE;
  text-align: center;
}

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
  font-size: 28rpx;
  font-weight: 600;
  color: #2C2C2C;
  word-break: break-all;
}

.cell-value.strong { color: #3D5A4E; font-size: 30rpx; }
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

.plain-amount {
  display: inline-flex;
  align-items: baseline;
  font-size: 30rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.plain-amount-input {
  min-width: 48rpx;
  max-width: 140rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #2C2C2C;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  text-align: left;
}

.share-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 12rpx;
  border-bottom: 1rpx solid #E8E4DE;
  margin-bottom: 4rpx;
}

.share-col-label {
  font-size: 24rpx;
  color: #9CA3AF;
  min-width: 96rpx;
  text-align: right;
}

.share-col-label:last-child {
  min-width: 120rpx;
}

.share-inline-unit {
  font-size: 26rpx;
  color: #6B7280;
}

.plain-inline-input {
  width: 72rpx;
  text-align: right;
  font-size: 28rpx;
  font-weight: 600;
  color: #2C2C2C;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
}

.plain-inline-input.wide { width: 96rpx; }

.share-target-section {
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin: 8rpx 0 24rpx;
}

.share-target-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #E8E4DE;
}

.share-target-row:last-child { border-bottom: none; }

.share-target-label {
  font-size: 28rpx;
  color: #374151;
  font-weight: 600;
}

.plain-amount.compact {
  font-size: 28rpx;
}

.plain-amount.compact .plain-amount-input {
  font-size: 28rpx;
  max-width: 88rpx;
}

.share-target-fields {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.target-field {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4rpx;
  min-width: 96rpx;
}

.target-field.amount-field {
  min-width: 120rpx;
}

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
