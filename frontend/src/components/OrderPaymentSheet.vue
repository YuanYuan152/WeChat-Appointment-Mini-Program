<template>
  <view v-if="visible" class="sheet-overlay" @touchmove.stop.prevent @tap="onClose">
    <view class="sheet-card" @tap.stop>
      <view class="sheet-header">
        <text class="sheet-title">{{ sheetTitle }}</text>
        <text class="sheet-close" @tap="onClose">×</text>
      </view>

      <view v-if="loading" class="sheet-loading">加载订单详情...</view>

      <!-- 协议签署步骤 -->
      <template v-else-if="showAgreementStep">
        <view class="agreement-tip">
          <text class="agreement-tip-title">签署心理咨询协议</text>
          <text class="agreement-tip-desc">
            {{ presetAgreementTip }}
          </text>
        </view>

        <view v-if="showAgeConfirm" class="age-card">
          <text class="age-title">选择签署协议</text>
          <text class="age-desc">请选择需要签署的心理咨询协议</text>
          <view class="age-btns">
            <button class="age-btn fill" @tap="confirmAge(true)">{{ tongxinAgreementTitle }}</button>
            <button class="age-btn outline" @tap="confirmAge(false)">{{ yangfanAgreementTitle }}</button>
          </view>
        </view>

        <template v-else>
          <scroll-view
            class="agreement-body-scroll"
            scroll-y
            :show-scrollbar="false"
            :scroll-into-view="signatureScrollIntoView"
            scroll-with-animation
          >
            <view class="agreement-scroll">
              <text class="agreement-text">{{ agreementText }}</text>
            </view>

            <view class="emergency-box">
              <text class="emergency-title">紧急联系人信息 <text class="sig-required">*</text></text>
              <text class="emergency-hint">签署协议前请完整填写以下三项</text>
              <view class="emergency-field">
                <text class="emergency-label">紧急联系人姓名</text>
                <input
                  class="emergency-input"
                  type="text"
                  maxlength="50"
                  placeholder="请输入姓名"
                  :value="emergencyName"
                  @input="onEmergencyNameInput"
                />
              </view>
              <view class="emergency-field">
                <text class="emergency-label">与您的关系</text>
                <input
                  class="emergency-input"
                  type="text"
                  maxlength="30"
                  placeholder="如：父亲 / 配偶 / 朋友"
                  :value="emergencyRelation"
                  @input="onEmergencyRelationInput"
                />
              </view>
              <view class="emergency-field">
                <text class="emergency-label">联系电话</text>
                <input
                  class="emergency-input"
                  type="text"
                  maxlength="20"
                  placeholder="请输入手机号"
                  :value="emergencyPhone"
                  @input="onEmergencyPhoneInput"
                />
              </view>
            </view>

            <view id="signature-anchor" class="signature-box">
              <view class="sig-header">
                <text class="sig-title">来访者签字 <text class="sig-required">*</text></text>
                <text class="sig-date">{{ agreementDate }}</text>
              </view>

              <view v-if="!hasSignature && !showSignatureCanvas" class="sig-placeholder" @tap="startSignature">
                <text class="sig-placeholder-text">点击此处手写签名</text>
              </view>

              <view v-if="showSignatureCanvas" class="sig-canvas-wrap">
                <text class="sig-tip">请在下方框内绘制您的签名</text>
                <view class="sig-canvas-inner" :style="{ height: sigCanvasHeightPx + 'px' }">
                  <l-signature
                    ref="signatureRef"
                    penColor="#000000"
                    :penSize="3"
                    backgroundColor="#F9FAFB"
                    :disableScroll="true"
                    :beforeDelay="280"
                    :maxHistoryLength="20"
                    :openSmooth="false"
                    type="2d"
                  />
                </view>
                <view class="sig-actions">
                  <button class="sig-btn outline" @tap="clearSignature">重写</button>
                  <button class="sig-btn fill" @tap="confirmSignature">确认签名</button>
                </view>
              </view>

              <view v-if="hasSignature && !showSignatureCanvas" class="sig-result">
                <image :src="signatureData" class="sig-img" mode="aspectFit" />
                <view class="sig-re-sign" @tap="startSignature">重新签名</view>
              </view>
            </view>
          </scroll-view>

          <view class="sheet-footer">
            <text v-if="agreementSubmitHint" class="submit-hint">{{ agreementSubmitHint }}</text>
            <button
              class="confirm-btn"
              :class="{ disabled: !canSubmitAgreement || submittingAgreement }"
              @tap="submitAgreement"
            >{{ submittingAgreement ? '提交中...' : '同意协议并继续支付' }}</button>
          </view>
        </template>
      </template>

      <!-- 支付确认步骤 -->
      <template v-else-if="order">
        <scroll-view class="pay-body-scroll" scroll-y :show-scrollbar="false">
          <view class="amount-box">
            <text class="amount-currency">¥</text>
            <text class="amount-value">{{ (order.TotalFee / 100).toFixed(2) }}</text>
          </view>

          <view class="detail-block">
            <text class="block-title">预约信息</text>
            <view class="detail-row">
              <text class="label">咨询师</text>
              <text class="value">{{ order.counselorName || '—' }}</text>
            </view>
            <view class="detail-row">
              <text class="label">预约时间</text>
              <text class="value highlight">{{ formatOrderTime(order.startTime, order.endTime) }}</text>
            </view>
            <view v-if="order.centerName" class="detail-row">
              <text class="label">预约中心</text>
              <text class="value">{{ order.centerName }}</text>
            </view>
          </view>

          <view class="detail-block">
            <text class="block-title">订单信息</text>
            <view class="detail-row">
              <text class="label">订单号</text>
              <text class="value mono">{{ order.OutTradeNo }}</text>
            </view>
            <view class="detail-row">
              <text class="label">订单状态</text>
              <text class="value pending">待支付</text>
            </view>
            <view v-if="expireText" class="expire-tip">{{ expireText }}</view>
          </view>

          <view class="tips-block">
            <text class="tips-title">温馨提示</text>
            <text class="tips-line">· 支付成功后预约立即生效；</text>
            <text class="tips-line">· 距咨询开始超过 24 小时可免费取消；</text>
            <text class="tips-line">· 24 小时内取消或爽约，按规定不予退款。</text>
          </view>

          <view class="agree-row" @tap="agreed = !agreed">
            <view class="checkbox" :class="{ checked: agreed }">
              <text v-if="agreed" class="check-icon">✓</text>
            </view>
            <text class="agree-text">我已阅读并同意上述预约与退款规则</text>
          </view>
        </scroll-view>

        <view class="sheet-footer pay-footer">
          <button
            class="confirm-btn"
            :class="{ disabled: !agreed || paying }"
            :disabled="!agreed || paying"
            @tap="onConfirm"
          >{{ paying ? '支付中...' : '确认支付' }}</button>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import {
  TONGXIN_AGREEMENT_TITLE,
  YANGFAN_AGREEMENT_TITLE,
  buildTongxinConsultationAgreement,
  buildYangfanConsultationAgreement,
  currentAgreementDate,
  normalizeAgreementPhone,
  validateAgreementEmergencyContact,
} from '@/utils/consultationAgreement'
import {
  type PatientOrder,
  executeOrderPayment,
  expireHintText,
  formatOrderTime,
} from '@/utils/orderPayment'

const tongxinAgreementTitle = TONGXIN_AGREEMENT_TITLE
const yangfanAgreementTitle = YANGFAN_AGREEMENT_TITLE

const props = defineProps<{
  visible: boolean
  orderId?: number | null
  initialOrder?: PatientOrder | null
}>()

const emit = defineEmits<{
  close: []
  paid: []
}>()

const order = ref<PatientOrder | null>(null)
const loading = ref(false)
const paying = ref(false)
const agreed = ref(false)
const submittingAgreement = ref(false)

const showAgeConfirm = ref(true)
const intakeIsAdult = ref<boolean | null>(null)
const agreementText = ref('')
const agreementDate = ref('')
const hasSignature = ref(false)
const showSignatureCanvas = ref(false)
const signatureData = ref('')
const signatureRef = ref<any>(null)
/** 签字区高度（px），按屏宽自适应，确保父容器有明确尺寸供 lime-signature 测量 */
const sigCanvasHeightPx = ref(180)
const signatureScrollIntoView = ref('')
const emergencyName = ref('')
const emergencyRelation = ref('')
const emergencyPhone = ref('')

const resolveSigCanvasHeight = () => {
  try {
    const { windowWidth = 375, windowHeight = 667 } = uni.getSystemInfoSync()
    // 宽度约一半作签名高度，并夹在合理范围内，避免过扁或占满屏
    const byWidth = Math.round(windowWidth * 0.52)
    const byHeight = Math.round(windowHeight * 0.28)
    sigCanvasHeightPx.value = Math.max(160, Math.min(byWidth, byHeight, 260))
  } catch {
    sigCanvasHeightPx.value = 180
  }
}

const expireText = computed(() => expireHintText(order.value?.ExpiresAt))
const emergencyPayload = computed(() => ({
  name: emergencyName.value.trim(),
  relation: emergencyRelation.value.trim(),
  phone: normalizeAgreementPhone(emergencyPhone.value),
}))
const emergencyError = computed(() => validateAgreementEmergencyContact(emergencyPayload.value))
const canSubmitAgreement = computed(() =>
  hasSignature.value
  && effectiveIsAdult.value !== null
  && !emergencyError.value,
)
const agreementSubmitHint = computed(() => {
  if (submittingAgreement.value) return ''
  if (effectiveIsAdult.value === null) {
    return hasPresetAgreement.value ? '请先完成签名' : '请先选择协议并完成签名'
  }
  if (emergencyError.value) return emergencyError.value
  if (!hasSignature.value) return '请先完成来访者签字'
  return ''
})

const showAgreementStep = computed(() =>
  Boolean(
    order.value?.needsContractAgreement && !order.value?.contractAgreementSigned,
  ),
)

const hasPresetAgreement = computed(() => {
  const preset = order.value?.proxyAgreementIsAdult
  return preset === true || preset === false
})

const presetAgreementTip = computed(() => {
  if (hasPresetAgreement.value && order.value?.proxyAgreementLabel) {
    return `助理已为您选定《${order.value.proxyAgreementLabel}》，请阅读协议并完成电子签名后再支付。`
  }
  return '您与该咨询师尚未签约，支付前请先选择协议并完成电子签名。'
})

const effectiveIsAdult = computed(() => {
  if (intakeIsAdult.value !== null) return intakeIsAdult.value
  const preset = order.value?.proxyAgreementIsAdult
  return preset === true || preset === false ? preset : null
})

const sheetTitle = computed(() =>
  showAgreementStep.value ? '签署协议' : '确认预约与支付',
)

const resetAgreementState = () => {
  showAgeConfirm.value = true
  intakeIsAdult.value = null
  agreementText.value = ''
  agreementDate.value = ''
  hasSignature.value = false
  showSignatureCanvas.value = false
  signatureData.value = ''
  signatureScrollIntoView.value = ''
  emergencyName.value = ''
  emergencyRelation.value = ''
  emergencyPhone.value = ''
  nextTick(() => {
    try { signatureRef.value?.clear?.() } catch { /* ignore */ }
  })
}

const rebuildAgreementText = () => {
  if (!order.value || effectiveIsAdult.value === null) return
  const counselorName = order.value.counselorName || '咨询师'
  const priceYuan = Math.round((order.value.TotalFee || 0) / 100)
  agreementText.value = effectiveIsAdult.value
    ? buildTongxinConsultationAgreement(counselorName, priceYuan, emergencyPayload.value)
    : buildYangfanConsultationAgreement(counselorName, priceYuan, emergencyPayload.value)
  agreementDate.value = currentAgreementDate()
}

const prefillEmergencyContact = async () => {
  try {
    const res = await httpV2.get<{
      emergencyContact?: string
      emergencyRelation?: string
      emergencyPhone?: string
    }>(API_ENDPOINTS.patient.me, undefined, { showLoading: false, showError: false })
    if (res.code === 0 && res.data) {
      emergencyName.value = res.data.emergencyContact || ''
      emergencyRelation.value = res.data.emergencyRelation || ''
      emergencyPhone.value = res.data.emergencyPhone || ''
      rebuildAgreementText()
    }
  } catch {
    /* ignore */
  }
}

const applyPresetAgreementIfNeeded = () => {
  const preset = order.value?.proxyAgreementIsAdult
  if (preset !== true && preset !== false) return false
  intakeIsAdult.value = preset
  showAgeConfirm.value = false
  rebuildAgreementText()
  prefillEmergencyContact()
  return true
}

const loadOrder = async () => {
  const id = props.orderId ?? props.initialOrder?.Id
  if (!id) {
    order.value = null
    return
  }
  loading.value = true
  try {
    const res = await httpV2.get<PatientOrder>(API_ENDPOINTS.patient.orderDetail(id))
    if (res.code === 0 && res.data) {
      order.value = res.data
      if (showAgreementStep.value) {
        applyPresetAgreementIfNeeded()
      }
    } else {
      uni.showToast({ title: res.msg || '加载订单失败', icon: 'none' })
      emit('close')
    }
  } catch {
    uni.showToast({ title: '加载订单失败', icon: 'none' })
    emit('close')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.visible, props.orderId, props.initialOrder] as const,
  ([vis]) => {
    if (vis) {
      agreed.value = false
      resetAgreementState()
      loadOrder()
    }
  },
)

const confirmAge = (isAdult: boolean) => {
  if (!order.value) return
  intakeIsAdult.value = isAdult
  showAgeConfirm.value = false
  rebuildAgreementText()
  prefillEmergencyContact()
}

const onEmergencyNameInput = (e: { detail: { value: string } }) => {
  emergencyName.value = e.detail.value
  rebuildAgreementText()
}
const onEmergencyRelationInput = (e: { detail: { value: string } }) => {
  emergencyRelation.value = e.detail.value
  rebuildAgreementText()
}
const onEmergencyPhoneInput = (e: { detail: { value: string } }) => {
  emergencyPhone.value = e.detail.value
  rebuildAgreementText()
}

const startSignature = () => {
  resolveSigCanvasHeight()
  showSignatureCanvas.value = true
  hasSignature.value = false
  signatureData.value = ''
  // 展开后滚到签字区，避免画布在可视区域外导致测量不全
  signatureScrollIntoView.value = ''
  setTimeout(() => {
    signatureScrollIntoView.value = 'signature-anchor'
  }, 50)
}

const clearSignature = () => {
  hasSignature.value = false
  signatureData.value = ''
  signatureRef.value?.clear?.()
}

const confirmSignature = () => {
  if (!signatureRef.value) {
    uni.showToast({ title: '签名组件未初始化', icon: 'none' })
    return
  }
  signatureRef.value.canvasToTempFilePath({
    success: (res: { isEmpty?: boolean; tempFilePath?: string }) => {
      if (!res.isEmpty && res.tempFilePath) {
        hasSignature.value = true
        showSignatureCanvas.value = false
        signatureData.value = res.tempFilePath
        uni.showToast({ title: '签名完成', icon: 'success' })
      } else {
        uni.showToast({ title: '请先完成签名', icon: 'none' })
      }
    },
    fail: () => uni.showToast({ title: '签名保存失败', icon: 'none' }),
  })
}

const submitAgreement = async () => {
  if (submittingAgreement.value) return
  if (!order.value || !hasSignature.value || effectiveIsAdult.value === null) {
    uni.showToast({
      title: agreementSubmitHint.value || (hasPresetAgreement.value ? '请先完成签名' : '请先选择协议并完成签名'),
      icon: 'none',
    })
    return
  }
  if (emergencyError.value) {
    uni.showToast({ title: emergencyError.value, icon: 'none' })
    return
  }
  submittingAgreement.value = true
  try {
    uni.showLoading({ title: '正在上传签名...' })
    const uploadRes = await httpV2.upload(API_ENDPOINTS.upload.file, signatureData.value, 'file')
    uni.hideLoading()
    if (uploadRes.code !== 0 || !uploadRes.data?.url) {
      uni.showToast({ title: uploadRes.msg || '签名上传失败', icon: 'none' })
      return
    }
    const res = await httpV2.post<PatientOrder>(API_ENDPOINTS.payment.attachOrderAgreement, {
      order_id: order.value.Id,
      is_adult: effectiveIsAdult.value,
      signature_url: uploadRes.data.url,
      emergency_contact: emergencyPayload.value.name,
      emergency_relation: emergencyPayload.value.relation,
      emergency_phone: emergencyPayload.value.phone,
    })
    if (res.code === 0 && res.data) {
      order.value = res.data
      uni.showToast({ title: '协议已签署', icon: 'success' })
    } else {
      uni.showToast({ title: res.msg || '协议提交失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: e?.message || '协议提交失败', icon: 'none' })
  } finally {
    submittingAgreement.value = false
  }
}

const onClose = () => emit('close')

const onConfirm = async () => {
  if (!agreed.value || !order.value || paying.value) return
  paying.value = true
  try {
    const result = await executeOrderPayment(order.value.Id)
    if (result.ok) {
      uni.showToast({ title: '支付成功', icon: 'success' })
      emit('paid')
      emit('close')
    } else {
      uni.showToast({ title: result.msg || '支付失败', icon: 'none' })
    }
  } finally {
    paying.value = false
  }
}
</script>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.sheet-card {
  width: 100%;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.agreement-body-scroll {
  flex: 1;
  height: 0;
  min-height: 320rpx;
  margin-bottom: 16rpx;
}
.pay-body-scroll {
  flex: 1;
  height: 0;
  min-height: 240rpx;
  margin-bottom: 8rpx;
}
.sheet-footer {
  flex-shrink: 0;
  padding-top: 8rpx;
}
.pay-footer {
  padding-top: 16rpx;
  padding-bottom: 8rpx;
}
.submit-hint {
  display: block;
  font-size: 22rpx;
  color: #DC2626;
  margin-bottom: 12rpx;
  line-height: 1.4;
}
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1F2937;
}
.sheet-close {
  font-size: 48rpx;
  color: #9CA3AF;
  line-height: 1;
  padding: 0 8rpx;
}
.sheet-loading {
  text-align: center;
  padding: 80rpx 0;
  color: #9CA3AF;
  font-size: 28rpx;
}
.agreement-tip {
  background: #FFFBEB;
  border: 1rpx solid #FDE68A;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
}
.agreement-tip-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #92400E;
  margin-bottom: 8rpx;
}
.agreement-tip-desc {
  display: block;
  font-size: 24rpx;
  color: #B45309;
  line-height: 1.6;
}
.emergency-box {
  margin: 20rpx 0;
  padding: 24rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
}
.emergency-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 8rpx;
}
.emergency-hint {
  display: block;
  font-size: 22rpx;
  color: #6B7280;
  margin-bottom: 16rpx;
}
.emergency-field {
  margin-bottom: 14rpx;
}
.emergency-label {
  display: block;
  font-size: 24rpx;
  color: #4B5563;
  margin-bottom: 8rpx;
}
.emergency-input {
  width: 100%;
  box-sizing: border-box;
  height: 72rpx;
  padding: 0 20rpx;
  background: #fff;
  border: 1rpx solid #E5E7EB;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #1F2937;
}
.age-card {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 32rpx 24rpx;
  text-align: center;
}
.age-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 12rpx;
}
.age-desc {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  margin-bottom: 24rpx;
}
.age-btns {
  display: flex;
  gap: 20rpx;
}
.age-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 100rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.age-btn.outline {
  background: #fff;
  color: #4B5563;
  border: 2rpx solid #E5E7EB;
}
.age-btn.fill {
  background: #3D5A4E;
  color: #fff;
}
.age-btn::after { border: none; }
.agreement-scroll {
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
}
.agreement-text {
  font-size: 24rpx;
  color: #4B5563;
  line-height: 1.7;
  white-space: pre-wrap;
}
.signature-box {
  margin-bottom: 24rpx;
  width: 100%;
  box-sizing: border-box;
}
.sig-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.sig-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
}
.sig-required { color: #EF4444; }
.sig-date {
  font-size: 24rpx;
  color: #9CA3AF;
}
.sig-placeholder {
  height: 200rpx;
  background: #F9FAFB;
  border: 2rpx dashed #D1D5DB;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.sig-placeholder-text {
  font-size: 28rpx;
  color: #9CA3AF;
}
.sig-canvas-wrap {
  width: 100%;
  box-sizing: border-box;
  border: 2rpx solid #D1D5DB;
  border-radius: 16rpx;
  overflow: hidden;
  background: #fff;
}
.sig-tip {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: #9CA3AF;
  padding: 12rpx 0;
  background: #F9FAFB;
  border-bottom: 1rpx solid #E5E7EB;
}
.sig-canvas-inner {
  width: 100%;
  /* height 由 inline style 按屏宽动态设置，保证 canvas 有完整可绘区域 */
  background: #F9FAFB;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}
.sig-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
  background: #F9FAFB;
  border-top: 1rpx solid #E5E7EB;
}
.sig-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 26rpx;
  border-radius: 100rpx;
}
.sig-btn.outline {
  background: #fff;
  border: 1rpx solid #D1D5DB;
  color: #4B5563;
}
.sig-btn.fill {
  background: #3D5A4E;
  color: #fff;
}
.sig-btn::after { border: none; }
.sig-result {
  position: relative;
  height: 200rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
  border: 1rpx solid #E5E7EB;
  overflow: hidden;
}
.sig-img {
  width: 100%;
  height: 100%;
}
.sig-re-sign {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 100rpx;
}
.amount-box {
  text-align: center;
  margin-bottom: 32rpx;
}
.amount-currency {
  font-size: 36rpx;
  font-weight: 700;
  color: #0D9488;
}
.amount-value {
  font-size: 72rpx;
  font-weight: 800;
  color: #0D9488;
}
.detail-block {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.block-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16rpx;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 12rpx 0;
}
.label {
  font-size: 26rpx;
  color: #6B7280;
  flex-shrink: 0;
}
.value {
  font-size: 26rpx;
  color: #1F2937;
  font-weight: 500;
  text-align: right;
  flex: 1;
}
.value.highlight {
  color: #3D5A4E;
  font-weight: 600;
}
.value.pending {
  color: #F59E0B;
}
.value.mono {
  font-size: 22rpx;
  word-break: break-all;
}
.expire-tip {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #F59E0B;
}
.tips-block {
  background: #FFFBEB;
  border: 1rpx solid #FDE68A;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}
.tips-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #B45309;
  margin-bottom: 12rpx;
}
.tips-line {
  display: block;
  font-size: 24rpx;
  color: #92400E;
  line-height: 1.6;
}
.agree-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #D1D5DB;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
}
.checkbox.checked {
  background: #3D5A4E;
  border-color: #3D5A4E;
}
.check-icon {
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}
.agree-text {
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.5;
}
.confirm-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #0D9488;
  color: #fff;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 600;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-btn.disabled {
  opacity: 0.5;
}
.confirm-btn::after {
  border: none;
}
</style>
