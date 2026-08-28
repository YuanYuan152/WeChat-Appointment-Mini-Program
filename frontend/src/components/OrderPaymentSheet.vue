<template>
  <view v-if="visible" class="sheet-root">
    <view class="sheet-mask" @touchmove.stop.prevent @tap="onClose" />
    <view
      class="sheet-card"
      :class="showAgreementStep ? 'sheet-agreement' : 'sheet-pay'"
      :style="sheetCardStyle"
      @tap.stop
    >
      <view class="sheet-header">
        <text class="sheet-title">{{ sheetTitle }}</text>
        <text class="sheet-close" @tap="onClose">×</text>
      </view>

      <view v-if="loading && !order" class="sheet-loading">加载订单详情...</view>

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
            <button class="age-btn fill" @tap="confirmAgreementType('TONGXIN')">{{ tongxinAgreementTitle }}</button>
            <button class="age-btn outline" @tap="confirmAgreementType('YANGFAN')">{{ yangfanAgreementTitle }}</button>
            <button class="age-btn outline" @tap="confirmAgreementType('QIHANG')">{{ qihangAgreementTitle }}</button>
          </view>
        </view>

        <template v-else>
          <scroll-view
            class="agreement-body-scroll"
            scroll-y
            :show-scrollbar="false"
            :style="scrollAreaStyle"
          >
            <view class="agreement-scroll">
              <text class="agreement-text">{{ agreementText }}</text>
            </view>

            <view v-if="!hasStoredRealName" class="emergency-box">
              <text class="emergency-title">来访者真实姓名 <text class="sig-required">*</text></text>
              <text class="emergency-hint">首次签约需填写，保存后后续签约无需重复填写</text>
              <view class="emergency-field">
                <input
                  class="emergency-input"
                  type="text"
                  :maxlength="50"
                  placeholder="请输入真实姓名"
                  :value="realName"
                  @input="onRealNameInput"
                />
              </view>
            </view>

            <view class="emergency-box">
              <text class="emergency-title">紧急联系人信息 <text class="sig-required">*</text></text>
              <text class="emergency-hint">签署协议前请完整填写以下三项</text>
              <view class="emergency-field">
                <text class="emergency-label">紧急联系人姓名</text>
                <input
                  class="emergency-input"
                  type="text"
                  :maxlength="50"
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
                  :maxlength="30"
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
                  :maxlength="20"
                  placeholder="请输入手机号"
                  :value="emergencyPhone"
                  @input="onEmergencyPhoneInput"
                />
              </view>
            </view>

            <view class="signature-box">
              <view class="sig-header">
                <text class="sig-title">来访者签字 <text class="sig-required">*</text></text>
                <text class="sig-date">{{ agreementDate }}</text>
              </view>

              <view v-if="!hasSignature" class="sig-placeholder" @tap="startSignature">
                <text class="sig-placeholder-text">点击此处手写签名</text>
              </view>

              <view v-if="hasSignature" class="sig-result">
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
            >{{ submittingAgreement ? '提交中...' : (isFreeOrder ? '同意协议并继续确认' : '同意协议并继续支付') }}</button>
          </view>
        </template>
      </template>

      <!-- 支付确认步骤 -->
      <template v-else-if="order">
        <scroll-view
          class="pay-body-scroll"
          scroll-y
          :show-scrollbar="false"
          :style="scrollAreaStyle"
        >
          <view class="amount-box">
            <template v-if="isFreeOrder">
              <text class="amount-value">免费</text>
            </template>
            <template v-else>
              <text class="amount-currency">¥</text>
              <text class="amount-value">{{ (order.TotalFee / 100).toFixed(2) }}</text>
            </template>
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
              <text class="value pending">{{ isFreeOrder ? '待确认' : '待支付' }}</text>
            </view>
            <view v-if="expireText" class="expire-tip">{{ expireText }}</view>
          </view>

          <view class="tips-block">
            <text class="tips-title">温馨提示</text>
            <text class="tips-line">· {{ isFreeOrder ? '确认后预约立即生效；' : '支付成功后预约立即生效；' }}</text>
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
          >{{ paying ? (isFreeOrder ? '确认中...' : '支付中...') : (isFreeOrder ? '确认预约' : '确认支付') }}</button>
        </view>
      </template>
    </view>

    <!-- 签名浮层：不能挂在 catchtouchmove 祖先下，否则触点事件收不到、无笔画 -->
    <view v-if="showSignatureCanvas" class="sig-pad-overlay">
      <view class="sig-pad-mask" @tap="cancelSignaturePad" @touchmove.stop.prevent></view>
      <view class="sig-pad-card" @tap.stop>
        <view class="sig-pad-header">
          <text class="sig-pad-title">来访者签字</text>
          <text class="sig-pad-close" @tap="cancelSignaturePad">×</text>
        </view>
        <text class="sig-pad-tip">请在下方区域内书写签名</text>
        <view
          class="sig-pad-canvas"
          :style="{ width: sigCanvasWidthPx + 'px', height: sigCanvasHeightPx + 'px' }"
        >
          <l-signature
            v-if="signaturePadReady"
            ref="signatureRef"
            penColor="#111111"
            :penSize="4"
            backgroundColor="#FFFFFF"
            :disableScroll="true"
            :beforeDelay="400"
            :maxHistoryLength="20"
            :openSmooth="false"
            type="2d"
          />
        </view>
        <view class="sig-pad-actions">
          <button class="sig-btn outline" @tap="clearSignature">重写</button>
          <button class="sig-btn fill" @tap="confirmSignature">确认签名</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import {
  type ConsultationAgreementType,
  TONGXIN_AGREEMENT_TITLE,
  YANGFAN_AGREEMENT_TITLE,
  QIHANG_AGREEMENT_TITLE,
  buildAgreementByType,
  currentAgreementDate,
  normalizeAgreementPhone,
  resolveProxyAgreementType,
  validateAgreementEmergencyContact,
} from '@/utils/consultationAgreement'
import {
  type PatientOrder,
  executeOrderPayment,
  expireHintText,
  formatOrderTime,
  isFreeOrderFee,
} from '@/utils/orderPayment'
import {
  DEFAULT_ONBOARDING_EVENT_KEYS,
  requestOfficialSubscribeInGesture,
} from '@/utils/subscribeMessage'

const tongxinAgreementTitle = TONGXIN_AGREEMENT_TITLE
const yangfanAgreementTitle = YANGFAN_AGREEMENT_TITLE
const qihangAgreementTitle = QIHANG_AGREEMENT_TITLE

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
const intakeAgreementType = ref<ConsultationAgreementType | null>(null)
const agreementText = ref('')
const agreementDate = ref('')
const hasSignature = ref(false)
const showSignatureCanvas = ref(false)
const signatureData = ref('')
const signatureRef = ref<any>(null)
/** 签字区画布显式宽高（px），保证 lime-signature 能正确测量 */
const sigCanvasWidthPx = ref(320)
const sigCanvasHeightPx = ref(220)
const signaturePadReady = ref(false)
const emergencyName = ref('')
const emergencyRelation = ref('')
const emergencyPhone = ref('')
const realName = ref('')
const hasStoredRealName = ref(false)

const resolveSigCanvasHeight = () => {
  try {
    const { windowWidth = 375, windowHeight = 667 } = uni.getSystemInfoSync()
    // 左右各留 32px 边距
    sigCanvasWidthPx.value = Math.max(260, Math.round(windowWidth - 64))
    const byWidth = Math.round(sigCanvasWidthPx.value * 0.55)
    const byHeight = Math.round(windowHeight * 0.34)
    sigCanvasHeightPx.value = Math.max(200, Math.min(byWidth, byHeight, 320))
  } catch {
    sigCanvasWidthPx.value = 320
    sigCanvasHeightPx.value = 220
  }
}

const expireText = computed(() => expireHintText(order.value?.ExpiresAt))
const isFreeOrder = computed(() => isFreeOrderFee(order.value?.TotalFee))
const emergencyPayload = computed(() => ({
  name: emergencyName.value.trim(),
  relation: emergencyRelation.value.trim(),
  phone: normalizeAgreementPhone(emergencyPhone.value),
}))
const emergencyError = computed(() => validateAgreementEmergencyContact(emergencyPayload.value))
const realNameError = computed(() =>
  hasStoredRealName.value || realName.value.trim() ? '' : '请填写真实姓名',
)
const canSubmitAgreement = computed(() =>
  hasSignature.value
  && effectiveAgreementType.value !== null
  && !realNameError.value
  && !emergencyError.value,
)
const agreementSubmitHint = computed(() => {
  if (submittingAgreement.value) return ''
  if (effectiveAgreementType.value === null) {
    return hasPresetAgreement.value ? '请先完成签名' : '请先选择协议并完成签名'
  }
  if (realNameError.value) return realNameError.value
  if (emergencyError.value) return emergencyError.value
  if (!hasSignature.value) return '请先完成来访者签字'
  return ''
})

const showAgreementStep = computed(() =>
  Boolean(
    order.value?.needsContractAgreement && !order.value?.contractAgreementSigned,
  ),
)

const hasPresetAgreement = computed(() =>
  Boolean(order.value && resolveProxyAgreementType(order.value)),
)

const presetAgreementTip = computed(() => {
  if (hasPresetAgreement.value && order.value?.proxyAgreementLabel) {
    return `助理已为您选定《${order.value.proxyAgreementLabel}》，请阅读协议并完成电子签名后再${isFreeOrderFee(order.value.TotalFee) ? '确认' : '支付'}。`
  }
  return '您与该咨询师尚未签约，确认前请先选择协议并完成电子签名。'
})

const effectiveAgreementType = computed((): ConsultationAgreementType | null => {
  if (intakeAgreementType.value) return intakeAgreementType.value
  if (order.value) return resolveProxyAgreementType(order.value)
  return null
})

const sheetTitle = computed(() =>
  showAgreementStep.value ? '签署协议' : (isFreeOrder.value ? '确认免费预约' : '确认预约与支付'),
)

/** 真机：底部绝对定位 + 像素高度字符串（协议约 4/5，支付约 3/4） */
const windowHeightPx = ref(667)
const sheetHeightPx = ref(534)
const refreshWindowHeight = () => {
  try {
    const info = uni.getSystemInfoSync()
    windowHeightPx.value = Number(info.windowHeight) || Number(info.screenHeight) || 667
  } catch {
    windowHeightPx.value = 667
  }
  const ratio = showAgreementStep.value ? 0.8 : 0.75
  sheetHeightPx.value = Math.max(420, Math.round(windowHeightPx.value * ratio))
}
const sheetCardStyle = computed(() => {
  const h = sheetHeightPx.value
  return `position:absolute;left:0;right:0;bottom:0;width:100%;height:${h}px;max-height:${h}px;min-height:${h}px;box-sizing:border-box;`
})
/** scroll-view 在微信里需明确高度才能占满剩余区域 */
const scrollAreaStyle = computed(() => {
  const reserved = showAgreementStep.value ? 280 : 200
  const h = Math.max(240, sheetHeightPx.value - reserved)
  return `height:${h}px;`
})

const resetAgreementState = () => {
  showAgeConfirm.value = true
  intakeAgreementType.value = null
  agreementText.value = ''
  agreementDate.value = ''
  hasSignature.value = false
  showSignatureCanvas.value = false
  signaturePadReady.value = false
  signatureData.value = ''
  emergencyName.value = ''
  emergencyRelation.value = ''
  emergencyPhone.value = ''
  realName.value = ''
  hasStoredRealName.value = false
  nextTick(() => {
    try { signatureRef.value?.clear?.() } catch { /* ignore */ }
  })
}

const rebuildAgreementText = () => {
  if (!order.value || !effectiveAgreementType.value) return
  const counselorName = order.value.counselorName || '咨询师'
  const priceYuan = Math.round((order.value.TotalFee || 0) / 100)
  agreementText.value = buildAgreementByType(
    effectiveAgreementType.value,
    counselorName,
    priceYuan,
    emergencyPayload.value,
    realName.value,
  )
  agreementDate.value = currentAgreementDate()
}

const prefillEmergencyContact = async () => {
  try {
    const res = await httpV2.get<{
      realName?: string
      emergencyContact?: string
      emergencyRelation?: string
      emergencyPhone?: string
    }>(API_ENDPOINTS.patient.me, undefined, { showLoading: false, showError: false })
    if (res.code === 0 && res.data) {
      realName.value = (res.data.realName || '').trim()
      hasStoredRealName.value = Boolean(realName.value)
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
  if (!order.value) return false
  const preset = resolveProxyAgreementType(order.value)
  if (!preset) return false
  intakeAgreementType.value = preset
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
  const hadData = !!order.value
  if (!hadData) loading.value = true
  try {
    const res = await httpV2.get<PatientOrder>(
      API_ENDPOINTS.patient.orderDetail(id),
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      order.value = res.data
      refreshWindowHeight()
      if (showAgreementStep.value) {
        applyPresetAgreementIfNeeded()
      }
    } else if (!hadData) {
      uni.showToast({ title: res.msg || '加载订单失败', icon: 'none' })
      emit('close')
    }
  } catch {
    if (!hadData) {
      uni.showToast({ title: '加载订单失败', icon: 'none' })
      emit('close')
    }
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
      // 先用列表传入的订单渲染，避免空白/矮弹层闪屏
      if (props.initialOrder) {
        order.value = { ...props.initialOrder }
        if (
          order.value.proxyAgreementLabel
          && order.value.needsContractAgreement == null
        ) {
          order.value.needsContractAgreement = true
        }
        refreshWindowHeight()
        if (showAgreementStep.value) {
          applyPresetAgreementIfNeeded()
        }
      } else {
        order.value = null
        refreshWindowHeight()
      }
      loadOrder()
    } else {
      order.value = null
      loading.value = false
    }
  },
)

watch(showAgreementStep, () => {
  if (props.visible) refreshWindowHeight()
})

const confirmAgreementType = (type: ConsultationAgreementType) => {
  if (!order.value) return
  intakeAgreementType.value = type
  showAgeConfirm.value = false
  rebuildAgreementText()
  prefillEmergencyContact()
}

const onEmergencyNameInput = (e: { detail: { value: string } }) => {
  emergencyName.value = e.detail.value
  rebuildAgreementText()
}
const onRealNameInput = (e: { detail: { value: string } }) => {
  realName.value = e.detail.value
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
  hasSignature.value = false
  signatureData.value = ''
  signaturePadReady.value = false
  showSignatureCanvas.value = true
  // 浮层渲染完成后再挂载画布；配合组件 beforeDelay，避免宽高为 0
  nextTick(() => {
    setTimeout(() => {
      signaturePadReady.value = true
    }, 50)
  })
}

const cancelSignaturePad = () => {
  showSignatureCanvas.value = false
  signaturePadReady.value = false
}

const clearSignature = () => {
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
        signaturePadReady.value = false
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
  if (!order.value || !hasSignature.value || !effectiveAgreementType.value) {
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
  if (realNameError.value) {
    uni.showToast({ title: realNameError.value, icon: 'none' })
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
      agreement_type: effectiveAgreementType.value,
      signature_url: uploadRes.data.url,
      real_name: hasStoredRealName.value ? undefined : realName.value.trim(),
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

/**
 * 确认支付：在同一点击手势内先弹微信官方订阅授权（图一，一次性模板续订），
 * 用户允许/拒绝后再发起支付。支付成功后后端即可下发「预约成功」到服务通知。
 * 不使用自定义「接收提醒」按钮。
 */
const onConfirm = () => {
  if (!agreed.value || !order.value || paying.value) return
  paying.value = true
  const orderId = order.value.Id

  // 同步发起官方授权（不可先 await）
  const subscribePromise = requestOfficialSubscribeInGesture(DEFAULT_ONBOARDING_EVENT_KEYS)

  const runPay = async () => {
    try {
      await subscribePromise
      const result = await executeOrderPayment(orderId, {
        totalFeeCents: order.value?.TotalFee,
      })
      if (result.ok) {
        uni.showToast({
          title: isFreeOrderFee(order.value?.TotalFee) ? '预约成功' : '支付成功',
          icon: 'success',
        })
        emit('paid')
        emit('close')
      } else {
        uni.showToast({
          title: result.msg || (isFreeOrderFee(order.value?.TotalFee) ? '确认失败' : '支付失败'),
          icon: 'none',
        })
      }
    } catch {
      uni.showToast({
        title: isFreeOrderFee(order.value?.TotalFee) ? '确认失败' : '支付失败',
        icon: 'none',
      })
    } finally {
      paying.value = false
    }
  }

  runPay()
}
</script>

<style scoped>
.sheet-root {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 200;
}
.sheet-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
}
.sheet-card {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  z-index: 1;
}
.agreement-body-scroll,
.pay-body-scroll {
  width: 100%;
  margin-bottom: 16rpx;
  box-sizing: border-box;
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
  flex-wrap: wrap;
  gap: 20rpx;
}
.age-btn {
  flex: 1 1 calc(50% - 10rpx);
  min-width: 240rpx;
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
.sig-result {
  position: relative;
  height: 200rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
  border: 1rpx solid #E5E7EB;
  overflow: hidden;
}
.sig-pad-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sig-pad-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}
.sig-pad-card {
  position: relative;
  z-index: 1;
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.sig-pad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.sig-pad-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1F2937;
}
.sig-pad-close {
  font-size: 48rpx;
  color: #9CA3AF;
  line-height: 1;
  padding: 0 8rpx;
}
.sig-pad-tip {
  display: block;
  font-size: 24rpx;
  color: #6B7280;
  margin-bottom: 16rpx;
}
.sig-pad-canvas {
  /* width/height 由 inline 明确指定，供 canvas 2d 正确采样 */
  box-sizing: border-box;
  border: 2rpx solid #D1D5DB;
  border-radius: 16rpx;
  overflow: hidden;
  background: #FFFFFF;
  position: relative;
  margin: 0 auto;
}
.sig-pad-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
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
