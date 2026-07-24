<template>
  <view class="page-pricing">
    <view class="hero-card">
      <text class="hero-title">定价管理</text>
      <text class="hero-subtitle">
        第一级设置咨询师统一基础价（对所有来访生效）；点击进入咨询师后再进行个性化价格调整。
      </text>
    </view>

    <view class="rule-card">
      <text class="rule-title">默认基础价</text>
      <text class="rule-line">· 公益咨询师：¥100（基础价仍为 ¥100 时，来访完成 2 次 ¥100 订单后系统自动 +¥400 调价）</text>
      <text class="rule-line">· 专业咨询师：¥600</text>
      <text class="rule-line">· 默认抽成：基础价格的 50%；可点击「默认抽成」按固定金额或比例调整，保存后对该咨询师全部来访生效</text>
      <text class="rule-line">· 可在下方直接修改各咨询师基础价，修改后对该咨询师全部来访生效</text>
    </view>

    <view class="toolbar">
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="搜索咨询师姓名或 ID"
        confirm-type="search"
        @confirm="reload"
      />
      <view class="tool-btn primary" @tap="reload">搜索</view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="items.length === 0" class="empty">暂无咨询师</view>
    <view v-else class="list">
      <view v-for="row in items" :key="row.counselorId" class="card">
        <view class="card-main">
          <view class="head-row">
            <text class="name">{{ row.counselorName }}</text>
            <text class="type-tag">{{ row.counselorTypeLabel }}</text>
          </view>
          <text class="meta">ID {{ row.counselorId }} · 已咨询来访 {{ row.patientCount }} 人</text>
          <view class="base-row">
            <text class="base-label">统一基础价</text>
            <text class="base-value">¥{{ row.basePriceYuan }}</text>
            <text v-if="row.usingDefaultBase" class="default-hint">类型默认</text>
          </view>
          <view class="share-row">
            <text class="share-label">默认分成</text>
            <text class="share-value">{{ formatDefaultShare(row) }}</text>
          </view>
        </view>
        <view class="card-actions">
          <view class="action-btn" @tap="openEditBase(row)">基础价</view>
          <view class="action-btn" @tap="openEditShare(row)">默认抽成</view>
          <view class="action-btn primary" @tap="goPatients(row)">个性化调价</view>
        </view>
      </view>
    </view>

    <view v-if="showEdit && editing" class="overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop>
        <text class="modal-title">修改基础价格</text>
        <text class="modal-sub">{{ editing.counselorName }} · 对所有来访生效</text>
        <view class="form-group">
          <text class="form-label">基础价格（元）</text>
          <input
            v-model="basePriceInput"
            class="form-input"
            type="number"
            placeholder="请输入基础价格"
          />
          <text class="form-hint">修改前：¥{{ editing.basePriceYuan }}</text>
          <text class="form-hint">类型默认：¥{{ editing.defaultBasePriceYuan }}</text>
        </view>
        <view class="modal-btns">
          <button class="modal-btn cancel" @tap="closeEdit">取消</button>
          <button class="modal-btn confirm" :loading="saving" @tap="saveBase">保存</button>
        </view>
      </view>
    </view>

    <view v-if="showShareEdit && shareEditing" class="overlay" @touchmove.stop.prevent>
      <view class="modal-card edit-modal" @tap.stop>
        <text class="modal-title">修改默认抽成</text>
        <text class="modal-sub">{{ shareEditing.counselorName }} · 保存后对该咨询师全部来访生效</text>
        <text class="modal-warn">将覆盖已有个性化分成设置，仅保留各来访的手动调价</text>

        <view class="preview-row">
          <text class="preview-label">当前基础价</text>
          <text class="preview-value">¥{{ shareEditing.basePriceYuan }}</text>
        </view>

        <view class="form-group">
          <text class="form-label">默认咨询师分成</text>
          <view v-if="!shareForm.shareMode" class="form-hint share-default-hint">
            当前使用系统默认：基础价格的 50%（¥{{ systemDefaultShareYuan }}）
          </view>
          <view class="share-tabs">
            <view class="share-tab" :class="{ active: shareForm.shareMode === 'AMOUNT' }" @tap="shareForm.shareMode = 'AMOUNT'">按固定金额</view>
            <view class="share-tab" :class="{ active: shareForm.shareMode === 'PERCENT' }" @tap="shareForm.shareMode = 'PERCENT'">按比例</view>
            <view class="share-tab" :class="{ active: !shareForm.shareMode }" @tap="shareForm.shareMode = ''">系统默认</view>
          </view>
        </view>

        <view v-if="shareForm.shareMode === 'AMOUNT'" class="form-group">
          <text class="form-label">分成金额（元）</text>
          <input v-model="shareForm.revenueShareYuan" class="form-input" type="number" />
          <text class="form-hint">预览分成：¥{{ previewShareYuan }} · 占基础价 {{ previewSharePercent }}%</text>
        </view>

        <view v-if="shareForm.shareMode === 'PERCENT'" class="form-group">
          <text class="form-label">分成占比（0–100%）</text>
          <view class="input-with-suffix">
            <input v-model="shareForm.revenueSharePercent" class="form-input suffix-input" type="number" />
            <text class="input-suffix">%</text>
          </view>
          <text class="form-hint">预览分成：¥{{ previewShareYuan }}（按各来访实际显示价计算）</text>
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap="closeShareEdit">取消</button>
          <button class="modal-btn confirm" :loading="shareSaving" @tap="saveShare">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { maybePromptRoleSubscribe } from '@/utils/subscribePrompt'

const DEFAULT_SHARE_PERCENT = 50

interface CounselorPricingRow {
  counselorId: number
  counselorName: string
  counselorType: string
  counselorTypeLabel: string
  basePriceYuan: number
  defaultBasePriceYuan: number
  usingDefaultBase?: boolean
  defaultShareMode?: string | null
  defaultRevenueShareYuan?: number | null
  defaultRevenueSharePercent?: number | null
  defaultShareYuan?: number
  patientCount: number
}

const items = ref<CounselorPricingRow[]>([])
const loading = ref(false)
const saving = ref(false)
const shareSaving = ref(false)
const keyword = ref('')

const showEdit = ref(false)
const showShareEdit = ref(false)
const editing = ref<CounselorPricingRow | null>(null)
const shareEditing = ref<CounselorPricingRow | null>(null)
const basePriceInput = ref('')
const shareForm = reactive({
  shareMode: '' as '' | 'AMOUNT' | 'PERCENT',
  revenueShareYuan: '',
  revenueSharePercent: '',
})

const previewBaseYuan = computed(() => {
  const row = shareEditing.value || editing.value
  if (shareEditing.value) return shareEditing.value.basePriceYuan
  const yuan = Number(basePriceInput.value)
  return Number.isNaN(yuan) || yuan < 0 ? (row?.basePriceYuan || 0) : yuan
})

const systemDefaultShareYuan = computed(() =>
  Math.floor(previewBaseYuan.value * DEFAULT_SHARE_PERCENT / 100),
)

const previewShareYuan = computed(() => {
  const base = previewBaseYuan.value
  if (shareForm.shareMode === 'AMOUNT') {
    return Math.max(0, Math.min(Number(shareForm.revenueShareYuan) || 0, base))
  }
  if (shareForm.shareMode === 'PERCENT') {
    const pct = Math.max(0, Math.min(Number(shareForm.revenueSharePercent) || 0, 100))
    return Math.floor(base * pct / 100)
  }
  return systemDefaultShareYuan.value
})

const previewSharePercent = computed(() => {
  const base = previewBaseYuan.value
  if (base <= 0) return 0
  if (shareForm.shareMode === 'AMOUNT') {
    const amount = Number(shareForm.revenueShareYuan) || 0
    return Math.round(Math.max(0, Math.min(amount, base)) / base * 100)
  }
  if (shareForm.shareMode === 'PERCENT') {
    return Math.max(0, Math.min(Number(shareForm.revenueSharePercent) || 0, 100))
  }
  return DEFAULT_SHARE_PERCENT
})

const formatDefaultShare = (row: CounselorPricingRow) => {
  if (row.defaultShareMode === 'AMOUNT' && row.defaultRevenueShareYuan != null) {
    return `¥${row.defaultRevenueShareYuan}（固定金额）`
  }
  if (row.defaultShareMode === 'PERCENT' && row.defaultRevenueSharePercent != null) {
    return `${row.defaultRevenueSharePercent}%（约 ¥${row.defaultShareYuan ?? 0}）`
  }
  return `50%（约 ¥${row.defaultShareYuan ?? Math.floor(row.basePriceYuan * DEFAULT_SHARE_PERCENT / 100)}）`
}

const reload = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await httpV2.get<{ items: CounselorPricingRow[] }>(
      API_ENDPOINTS.admin.pricingCounselors,
      params,
      { showLoading: false },
    )
    items.value = res.code === 0 && res.data?.items ? res.data.items : []
  } catch {
    items.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const goPatients = (row: CounselorPricingRow) => {
  uni.navigateTo({
    url: `/pages/ops/pricing/patients?counselorId=${row.counselorId}&counselorName=${encodeURIComponent(row.counselorName)}`,
  })
}

const openEditBase = (row: CounselorPricingRow) => {
  editing.value = row
  basePriceInput.value = String(row.basePriceYuan)
  showEdit.value = true
}

const fillShareForm = (row: CounselorPricingRow) => {
  shareForm.shareMode = (row.defaultShareMode as typeof shareForm.shareMode) || ''
  shareForm.revenueShareYuan =
    row.defaultShareMode === 'AMOUNT' && row.defaultRevenueShareYuan != null
      ? String(row.defaultRevenueShareYuan)
      : ''
  shareForm.revenueSharePercent =
    row.defaultShareMode === 'PERCENT' && row.defaultRevenueSharePercent != null
      ? String(row.defaultRevenueSharePercent)
      : ''
}

const openEditShare = (row: CounselorPricingRow) => {
  shareEditing.value = row
  fillShareForm(row)
  showShareEdit.value = true
}

const closeEdit = () => {
  showEdit.value = false
  editing.value = null
}

const closeShareEdit = () => {
  showShareEdit.value = false
  shareEditing.value = null
}

const saveBase = async () => {
  if (!editing.value) return
  const yuan = Number(basePriceInput.value)
  if (Number.isNaN(yuan) || yuan < 0) {
    uni.showToast({ title: '请输入有效价格', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const res = await httpV2.put(
      API_ENDPOINTS.admin.pricingCounselorBase(editing.value.counselorId),
      { basePriceYuan: yuan },
    )
    if (res.code === 0) {
      uni.showToast({ title: '已保存', icon: 'success' })
      closeEdit()
      await reload()
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

const saveShare = async () => {
  if (!shareEditing.value) return
  const baseYuan = shareEditing.value.basePriceYuan
  if (shareForm.shareMode === 'AMOUNT') {
    const shareYuan = Number(shareForm.revenueShareYuan)
    if (Number.isNaN(shareYuan) || shareYuan < 0) {
      uni.showToast({ title: '请输入有效分成金额', icon: 'none' })
      return
    }
    if (shareYuan > baseYuan) {
      uni.showToast({ title: '分成金额不能超过基础价格', icon: 'none' })
      return
    }
  }
  if (shareForm.shareMode === 'PERCENT') {
    const pct = Number(shareForm.revenueSharePercent)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      uni.showToast({ title: '分成比例须在 0–100 之间', icon: 'none' })
      return
    }
  }
  shareSaving.value = true
  try {
    const payload: Record<string, unknown> = {
      shareMode: shareForm.shareMode || null,
    }
    if (shareForm.shareMode === 'AMOUNT') {
      payload.revenueShareYuan = Number(shareForm.revenueShareYuan)
    } else if (shareForm.shareMode === 'PERCENT') {
      payload.revenueSharePercent = Number(shareForm.revenueSharePercent)
    }
    const res = await httpV2.put(
      API_ENDPOINTS.admin.pricingCounselorDefaultShare(shareEditing.value.counselorId),
      payload,
    )
    if (res.code === 0) {
      uni.showToast({ title: '默认抽成已更新', icon: 'success' })
      closeShareEdit()
      await reload()
      setTimeout(() => { void maybePromptRoleSubscribe('workbench') }, 500)
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    shareSaving.value = false
  }
}

onShow(reload)
</script>

<style scoped>
.page-pricing {
  min-height: 100vh;
  background: #F7F5F2;
  padding: 32rpx;
  padding-bottom: 48rpx;
  box-sizing: border-box;
}

.hero-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 20rpx;
}

.hero-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
}

.hero-subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.6;
}

.rule-card {
  background: #E8E4DE;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.rule-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #3D5A4E;
  margin-bottom: 10rpx;
}

.rule-line {
  display: block;
  font-size: 22rpx;
  color: #6B9080;
  line-height: 1.6;
}

.toolbar { margin-bottom: 24rpx; }

.search-input {
  width: 100%;
  box-sizing: border-box;
  height: 88rpx;
  line-height: 88rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}

.tool-btn {
  text-align: center;
  padding: 20rpx 0;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  background: #3D5A4E;
  color: #fff;
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

.card-main:active { opacity: 1; }

.head-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.name {
  font-size: 32rpx;
  font-weight: 600;
  color: #2C2C2C;
}

.type-tag {
  font-size: 22rpx;
  color: #3D5A4E;
  background: #E8E4DE;
  padding: 6rpx 16rpx;
  border-radius: 100rpx;
}

.meta {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}

.base-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 20rpx;
  background: #F7F5F2;
  border-radius: 16rpx;
}

.base-label { font-size: 24rpx; color: #6B7280; }

.base-value {
  font-size: 40rpx;
  font-weight: 700;
  color: #3D5A4E;
}

.default-hint {
  font-size: 22rpx;
  color: #9CA3AF;
}

.share-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 12rpx;
  padding: 16rpx 20rpx;
  background: #fff;
  border-radius: 12rpx;
  border: 1rpx solid #E8E4DE;
}

.share-label { font-size: 24rpx; color: #6B7280; }

.share-value {
  font-size: 26rpx;
  font-weight: 600;
  color: #3D5A4E;
}

.card-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #F0EDE8;
}

.action-btn {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #3D5A4E;
  font-weight: 600;
  padding: 20rpx 0;
  border-radius: 16rpx;
  background: #F7F5F2;
  border: 1rpx solid #E8E4DE;
}

.action-btn.primary {
  background: #3D5A4E;
  color: #fff;
  border-color: #3D5A4E;
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

.modal-warn {
  display: block;
  margin: -12rpx 0 20rpx;
  padding: 16rpx 20rpx;
  background: #FFFBEB;
  border-radius: 12rpx;
  font-size: 22rpx;
  color: #B45309;
  line-height: 1.5;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0 20rpx;
}

.preview-label { font-size: 26rpx; color: #6B7280; }
.preview-value { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }

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
  color: #9CA3AF;
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

.share-default-hint {
  margin-bottom: 12rpx;
  color: #6B9080;
}

.input-with-suffix {
  display: flex;
  align-items: center;
  background: #F7F5F2;
  border-radius: 16rpx;
  border: 1rpx solid #E8E4DE;
  overflow: hidden;
}

.suffix-input {
  flex: 1;
  border: none !important;
  background: transparent !important;
}

.input-suffix {
  flex-shrink: 0;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #6B7280;
  font-weight: 600;
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
