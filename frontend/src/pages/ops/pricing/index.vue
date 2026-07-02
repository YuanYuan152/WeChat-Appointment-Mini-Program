<template>
  <view class="page-pricing">
    <view class="hero-card">
      <text class="hero-title">定价管理</text>
      <text class="hero-subtitle">
        第一级设置咨询师统一基础价（对所有来访生效）；点击进入咨询师后再管理各来访的调价与分成。
      </text>
    </view>

    <view class="rule-card">
      <text class="rule-title">默认基础价</text>
      <text class="rule-line">· 公益咨询师：¥100（基础价仍为 ¥100 时，来访完成 2 次 ¥100 订单后系统自动 +¥400 调价）</text>
      <text class="rule-line">· 专业咨询师：¥600</text>
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
        <view class="card-main" @tap="goPatients(row)">
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
          <text class="enter-hint">点击进入 · 管理各来访调价与分成 ›</text>
        </view>
        <view class="card-actions">
          <view class="action-btn" @tap.stop="openEditBase(row)">改基础价</view>
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
          <text class="form-hint">类型默认：¥{{ editing.defaultBasePriceYuan }}</text>
        </view>
        <view class="modal-btns">
          <button class="modal-btn cancel" @tap="closeEdit">取消</button>
          <button class="modal-btn confirm" :loading="saving" @tap="saveBase">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

interface CounselorPricingRow {
  counselorId: number
  counselorName: string
  counselorType: string
  counselorTypeLabel: string
  basePriceYuan: number
  defaultBasePriceYuan: number
  usingDefaultBase?: boolean
  patientCount: number
}

const items = ref<CounselorPricingRow[]>([])
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')

const showEdit = ref(false)
const editing = ref<CounselorPricingRow | null>(null)
const basePriceInput = ref('')

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

const closeEdit = () => {
  showEdit.value = false
  editing.value = null
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
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
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

.card-main:active { opacity: 0.92; }

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

.enter-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #6B9080;
}

.card-actions {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #F0EDE8;
}

.action-btn {
  display: inline-block;
  font-size: 26rpx;
  color: #3D5A4E;
  font-weight: 600;
  padding: 8rpx 0;
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
