<template>
  <view class="page-consultant-detail">
    <!-- 自定义导航栏 (透明/毛玻璃) -->
    <view class="custom-navbar" :class="{ 'navbar-solid': pageScrollTop > 50 }">
      <view class="navbar-content">
        <view class="nav-btn-wrap" @click="goBack">
          <text class="nav-icon">‹</text>
        </view>
        <view class="nav-title" :style="{ opacity: pageScrollTop > 50 ? 1 : 0 }">{{ doctor.name || '咨询师' }}</view>
        <view class="nav-btn-wrap" @click="goHome">
          <text class="nav-icon-home">⌂</text>
        </view>
      </view>
    </view>
    
    <scroll-view 
      class="content-area" 
      scroll-y 
      :scroll-top="scrollTopBinding"
      scroll-with-animation
      @scroll="onScroll"
      :style="{ height: '100vh' }"
    >
      <!-- 顶部 Hero 区域 -->
      <view class="hero-section">
        <!-- 模糊背景 -->
        <view class="hero-bg">
          <image :src="getAvatarUrl(doctor.avatar)" mode="aspectFill" class="hero-bg-img" />
          <view class="hero-bg-overlay"></view>
        </view>
        
        <view class="hero-content">
          <image 
            :src="getAvatarUrl(doctor.avatar)" 
            class="hero-avatar" 
            mode="aspectFill" 
            @error="handleImageError"
          />
          <view class="hero-info">
            <view class="hero-name-row">
              <text class="hero-name">{{ doctor.name }}</text>
              <text class="hero-price">
                <template v-if="doctor.priceNegotiation">议价<text class="hero-price-unit">/次</text></template>
                <template v-else>￥{{ doctor.price }}<text class="hero-price-unit">/次</text></template>
              </text>
            </view>
            <view class="hero-tags">
              <text class="hero-tag secondary">从业{{ doctor.workYears }}年</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 悬浮数据卡片：从业年限 | 咨询时数 | 培训经历（4段） -->
      <view class="stats-card">
        <view class="stat-item">
          <text class="stat-value">{{ doctor.workYears }}<text class="stat-unit">年</text></text>
          <text class="stat-label">从业年限</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ doctor.consultHours }}<text class="stat-unit">h+</text></text>
          <text class="stat-label">咨询时数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ trainingCount }}<text class="stat-unit">段</text></text>
          <text class="stat-label">培训经历</text>
        </view>
      </view>

      <!-- Tab 导航 (吸顶) -->
      <view class="tab-nav-modern" :class="{ 'tab-sticky': pageScrollTop > 280 }">
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 0 }"
          @click="scrollToSection(0)"
        >介绍</view>
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 1 }"
          @click="scrollToSection(1)"
        >预约</view>
      </view>

      <!-- 个人介绍区域（id 须为 scroll-view 直接子节点，滚动定位才生效） -->
      <view class="content-section main-content-padding" id="section0">
          <view class="info-block">
            <text class="block-title">简介</text>
            <text class="block-text quote-text">"{{ doctor.profile }}"</text>
          </view>
          
          <view class="info-block">
            <text class="block-title">资质</text>
            <text class="block-text">{{ doctor.qualification }}</text>
          </view>
          
          <view class="info-block">
            <text class="block-title">专业领域</text>
            <view class="tag-cloud">
              <text v-for="field in doctorFields" :key="field" class="cloud-tag">{{ field }}</text>
            </view>
          </view>
          
          <view class="info-block">
            <text class="block-title">服务人群</text>
            <view class="tag-cloud">
              <text v-for="group in doctorTargetGroups" :key="group" class="cloud-tag alt">{{ group }}</text>
            </view>
          </view>
      </view>

      <!-- 预约区域：预约中心 + 可约时间 -->
      <view class="content-section main-content-padding" id="section1">
        <view class="booking-section">
          <text class="block-title block-title--green">预约</text>
          <text class="booking-hint">请选择您合适的预约中心和时间段</text>

          <!-- 预约中心 -->
          <view class="booking-module-box">
            <text class="block-title block-title--orange block-title--sm">预约中心</text>
            <view class="center-grid">
              <view
                v-for="center in appointmentCenters"
                :key="center.id"
                class="center-card"
                :class="{
                  selected: selectedCenterId === center.id,
                  unavailable: !counselorWorksAtCenter(center.id)
                }"
                @click="selectCenter(center.id)"
              >
                <text class="center-name">{{ center.name }}</text>
                <text v-if="!counselorWorksAtCenter(center.id)" class="center-tip">暂无可约</text>
              </view>
            </view>
          </view>

          <!-- 可约时间 -->
          <view class="booking-module-box" :class="{ 'is-disabled': isTimeModuleDisabled }">
            <text class="block-title block-title--orange block-title--sm">可约时间</text>

            <view v-if="!selectedCenterId" class="module-placeholder">
              <text class="module-placeholder-text">请先选择预约中心</text>
            </view>
            <view v-else-if="!counselorWorksAtCenter(selectedCenterId)" class="module-placeholder">
              <text class="module-placeholder-text">该咨询师不在此预约中心，暂不可预约</text>
            </view>
            <view v-else-if="filteredTimeSlots.length > 0" class="time-grid">
              <view
                v-for="slot in filteredTimeSlots"
                :key="slot.ID"
                class="time-card"
                :class="{
                  selected: selectedSlotId === slot.ID && isSlotBookable(slot),
                  'time-card--booked': !isSlotBookable(slot)
                }"
                @click="selectTimeSlot(slot)"
              >
                <view class="time-card-top">
                  <text class="tc-date">{{ slot.startDate }}</text>
                  <text class="tc-week">{{ slot.week }}</text>
                  <text v-if="!isSlotBookable(slot)" class="tc-booked-tag">{{ slotUnavailableLabel(slot) }}</text>
                </view>
                <view class="time-card-mid">
                  <text class="tc-time">{{ slot.startHH }}-{{ slot.endHH }}</text>
                </view>
                <view class="time-card-bot">
                  <text class="tc-price">{{ slotPriceLabel(slot) }}</text>
                  <view v-if="isSlotBookable(slot)" class="tc-radio">
                    <view class="tc-radio-inner" v-if="selectedSlotId === slot.ID"></view>
                  </view>
                </view>
              </view>
            </view>
            <view v-else class="module-placeholder">
              <text class="module-placeholder-text">该预约中心暂无可约时间段</text>
            </view>
          </view>
        </view>
      </view>
      
      <!-- 底部留白 -->
      <view style="height: 120px;"></view>
    </scroll-view>

    <!-- 底部悬浮预约栏 (Glassmorphism) -->
    <view class="bottom-action-bar show">
      <button
        class="favorite-btn"
        :class="{ active: isFavorited }"
        @click="toggleFavorite"
      >
        <text class="favorite-icon">{{ isFavorited ? '♥' : '♡' }}</text>
        <text>{{ isFavorited ? '已收藏' : '收藏' }}</text>
      </button>
      <view class="action-btns">
        <button class="action-btn outline" @click="openAssistantContact">联系助理</button>
        <button
          class="action-btn"
          :class="{ disabled: !canProceedBooking }"
          :disabled="!canProceedBooking"
          @click="makeAppointment"
        >{{ bookingButtonLabel }}</button>
      </view>
    </view>

    <!-- 联系助理 -->
    <view v-if="showAssistantContact" class="modal-overlay modern-modal modal-overlay--bottom" @tap="closeAssistantContact">
      <view class="modal-content bottom-sheet assistant-sheet" @tap.stop>
        <view class="modal-header-modern">
          <text class="modal-title">联系助理</text>
          <view class="modal-close-btn" @click="closeAssistantContact">×</view>
        </view>
        <view class="modal-body assistant-body">
          <ContactUsContent :show-centers="false" compact />
        </view>
      </view>
    </view>

    <!-- 年龄确认弹框（居中） -->
    <view v-if="showAgeConfirm" class="modal-overlay modern-modal modal-overlay--center">
      <view class="modal-content">
        <view class="modal-body text-center">
          <view class="modal-icon-wrap">
            <text class="modal-icon">!</text>
          </view>
          <text class="modal-title-large">年龄确认</text>
          <text class="modal-desc">为了提供更合适的咨询服务，请确认您是否已满18周岁？</text>
          <view class="modal-btn-group">
            <button class="btn-outline" @click="confirmAge(false)">未成年</button>
            <button class="btn-fill" @click="confirmAge(true)">已成年</button>
          </view>
          <text class="modal-close-text" @click="closeAgeConfirm">取消</text>
        </view>
      </view>
    </view>

    <!-- 协议弹框（底部上推） -->
    <view v-if="showAgreement" class="modal-overlay modern-modal modal-overlay--bottom">
      <view class="modal-content full-height">
        <view class="modal-header-modern">
          <text class="modal-title">心理咨询协议</text>
          <view class="modal-close-btn" @click="closeAgreement">×</view>
        </view>
        <view class="modal-body no-padding">
          <view class="agreement-block">
            <scroll-view class="agreement-scroll" scroll-y :show-scrollbar="false">
              <view class="agreement-text-wrap">
                <text class="agreement-text">{{ currentAgreement }}</text>
              </view>
            </scroll-view>
          </view>
          
          <!-- 签名区域 -->
          <view class="signature-box">
            <view class="sig-header">
              <text class="sig-title">来访者签字 <text class="text-red">*</text></text>
              <text class="sig-date">{{ currentDate }}</text>
            </view>
            
            <view v-if="!hasSignature && !showSignatureCanvas" class="sig-placeholder" @click="startSignature">
              <text class="sig-placeholder-text">点击此处手写签名</text>
            </view>
            
            <view v-if="showSignatureCanvas" class="sig-canvas-wrap">
              <text class="sig-tip">请在下方区域内绘制您的签名</text>
              <view class="sig-canvas-inner">
                <l-signature 
                  ref="signatureRef"
                  :penColor="'#000000'"
                  :penSize="3"
                  :backgroundColor="'#F9FAFB'"
                  :disableScroll="true"
                  :beforeDelay="100"
                  :maxHistoryLength="20"
                  :openSmooth="false"
                  :type="'2d'"
                  style="width: 100%; height: 200px;"
                ></l-signature>
              </view>
              <view class="sig-actions">
                <button class="sig-btn outline" @click="clearSignature">重写</button>
                <button class="sig-btn outline" @click="goBackFromSignature">取消</button>
                <button class="sig-btn fill" @click="confirmSignature">确认签名</button>
              </view>
            </view>
            
            <view v-if="hasSignature && !showSignatureCanvas" class="sig-result">
              <image :src="signatureData" class="sig-img" mode="aspectFit" @error="onSignatureImageError" />
              <view class="sig-re-sign" @click="startSignature">重新签名</view>
            </view>
          </view>
        </view>
        
        <view class="modal-footer-modern">
          <button class="btn-fill full-width" :class="{ 'disabled': !hasSignature }" @click="confirmAgreement">同意协议并继续</button>
        </view>
      </view>
    </view>

    <!-- 支付弹框（底部上推） -->
    <view v-if="showPayment" class="modal-overlay modern-modal modal-overlay--bottom">
      <view class="modal-content bottom-sheet">
        <view class="modal-header-modern">
          <text class="modal-title">确认订单</text>
          <view class="modal-close-btn" @click="closePayment">×</view>
        </view>
        <view class="modal-body">
          <view class="pay-amount-box">
            <template v-if="doctor.priceNegotiation">
              <text class="pay-amount">议价</text>
            </template>
            <template v-else>
              <text class="pay-currency">￥</text>
              <text class="pay-amount">{{ selectedSlot?.Price || 0 }}</text>
            </template>
          </view>
          
          <view class="pay-details">
            <view class="pay-row">
              <text class="pay-label">咨询师</text>
              <text class="pay-value">{{ doctor.name }}</text>
            </view>
            <view class="pay-row">
              <text class="pay-label">预约时间</text>
              <text class="pay-value highlight">{{ selectedSlot?.startDate }} {{ selectedSlot?.startHH }}-{{ selectedSlot?.endHH }}</text>
            </view>
            <view class="pay-row">
              <text class="pay-label">咨询方式</text>
              <text class="pay-value">线上/线下</text>
            </view>
          </view>
          
          <view class="pay-warm-tips">
            <view class="pay-tip-title">
              <text class="pay-tip-icon">!</text>
              <text class="pay-tip-title-text">温馨提示</text>
            </view>
            <view class="pay-rules-list">
              <text class="pay-rule-item">· 距咨询开始超过24小时可免费取消；</text>
              <text class="pay-rule-item">· 距咨询开始24小时内取消或爽约，不予退款；</text>
              <text class="pay-rule-item">· 特殊情况可致电咨询，申请人工豁免；</text>
              <text class="pay-rule-item">· 迟到15分钟以上视为爽约。</text>
            </view>
          </view>

          <view class="pay-agree-row" @tap="togglePayRulesAgreed">
            <view class="pay-checkbox" :class="{ checked: payRulesAgreed }">
              <text v-if="payRulesAgreed" class="pay-check-icon">✓</text>
            </view>
            <text class="pay-agree-text">
              我已同意上述规则及
              <text class="pay-agree-link" @tap.stop="openPrivacyPolicy">《隐私协议》</text>
            </text>
          </view>
        </view>
        <view class="modal-footer-modern">
          <button
            class="btn-fill full-width"
            :class="{ disabled: !payRulesAgreed }"
            @click="confirmPayment"
          >确认支付</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { API_V2_CONFIG, API_ENDPOINTS } from '@/config/api'
import { doctorApi } from '@/apis'
import { httpV2 } from '@/utils/http'
import { isBookingDemoMock, getMockDoctorDetailJson, getMockAppointmentSubmitResponse } from '@/mocks/bookingDemo'
import { APPOINTMENT_CENTERS } from '@/constants/appointmentCenters'
import {
  normalizeBookingTimeSlots,
  filterSlotsByCenter,
  counselorWorksAtCenter as slotWorksAtCenter,
  getCounselorAvailableCenterIds,
  isSlotBookable,
  slotUnavailableLabel,
  hasBookableSlotsInCenter,
  type BookingTimeSlot,
} from '@/utils/bookingSlots'
import ContactUsContent from '@/components/ContactUsContent.vue'
import { isLoggedIn, handleRequireLogin } from '@/utils/auth'

interface Doctor {
  id: number
  name: string
  specialty: string
  experience: number
  price: number
  priceNegotiation?: boolean
  charityBookingBlocked?: boolean
  avatar: string
  description: string
  profile: string
  career: string
  joiner: string
  trainingCount: number
  qualification: string
  field: string
  targetGroup: string
  consultHours: number
  workYears: number
  mode: string
}

const activeTab = ref(0)
/** 页面实际滚动位置（用于导航栏/吸顶 Tab 样式） */
const pageScrollTop = ref(0)
/** 仅用于编程式滚动，不与 @scroll 双向绑定 */
const scrollTopBinding = ref(0)
const sectionOffsets = ref<number[]>([0, 0])
const isClickScrolling = ref(false)
/** 吸顶 Tab 高度补偿（px） */
const STICKY_TAB_OFFSET = 48
const contentHeight = ref(0)
const doctor = ref<Doctor>({
  id: 0,
  name: '',
  specialty: '',
  experience: 0,
  price: 0,
  avatar: '',
  description: '',
  profile: '',
  career: '',
  joiner: '',
  trainingCount: 0,
  qualification: '',
  field: '',
  targetGroup: '',
  consultHours: 0,
  workYears: 0,
  mode: ''
})
const appointmentCenters = APPOINTMENT_CENTERS
const timeSlots = ref<BookingTimeSlot[]>([])
const selectedCenterId = ref<string | null>(null)
const selectedSlotId = ref<number>(-1)
const hasAvailableTime = ref(false)
/** 咨询师实际可约中心（API 注入；无则根据 timeSlots 推导） */
const counselorCenterIds = ref<string[]>([])
const isFavorited = ref(false)
const favoriteLoading = ref(false)
const routeDoctorId = ref<string | number>('')

// 弹框状态
const showAgeConfirm = ref(false)
const showAgreement = ref(false)
const showPayment = ref(false)
const showAssistantContact = ref(false)
const showSignatureCanvas = ref(false)
/** 是否仍需首次协议签署（年龄确认 + 签字） */
const needsIntakeAgreement = ref(true)
/** 首次来访年龄确认结果：true=已成年，false=未成年 */
const intakeIsAdult = ref<boolean | null>(null)
/** 确认订单页：是否已勾选同意温馨提示与隐私协议 */
const payRulesAgreed = ref(false)

// 协议内容
const currentAgreement = ref('')
const currentDate = ref('')
const hasSignature = ref(false)

// 选中的时间段
const selectedSlot = computed(() => {
  return timeSlots.value.find(slot => slot.ID === selectedSlotId.value)
})

const filteredTimeSlots = computed(() =>
  filterSlotsByCenter(timeSlots.value, selectedCenterId.value)
)

const counselorWorksAtCenter = (centerId: string) =>
  counselorCenterIds.value.includes(centerId) ||
  slotWorksAtCenter(timeSlots.value, centerId)

/** 已选中心但咨询师不在该中心或无可约时段时，可约时间模块灰化且不可点 */
const isTimeModuleDisabled = computed(() => {
  if (!selectedCenterId.value) return false
  if (!counselorWorksAtCenter(selectedCenterId.value)) return true
  return !hasBookableSlotsInCenter(timeSlots.value, selectedCenterId.value)
})

const canProceedBooking = computed(() =>
  Boolean(
    !doctor.value.charityBookingBlocked &&
    !doctor.value.priceNegotiation &&
    selectedCenterId.value &&
    selectedSlotId.value !== -1 &&
    selectedSlot.value &&
    isSlotBookable(selectedSlot.value) &&
    selectedSlot.value.centerId === selectedCenterId.value
  )
)

const slotPriceLabel = (slot: BookingTimeSlot) => {
  if (slot.priceNegotiation || slot.priceLabel === '议价') return '议价'
  return `￥${slot.Price ?? 0}`
}

const bookingButtonLabel = computed(() => {
  if (doctor.value.charityBookingBlocked || doctor.value.priceNegotiation) {
    return '议价后方可预约'
  }
  if (canProceedBooking.value) {
    const price = selectedSlot.value?.Price ?? doctor.value.price
    return `立即预约 ￥${price}`
  }
  return '立即预约'
})

const applyBookingData = (data: {
  timeSlots?: any[]
  availableCenterIds?: string[]
  hasAvailableTime?: boolean
  charityBookingBlocked?: boolean
  priceNegotiation?: boolean
}) => {
  timeSlots.value = normalizeBookingTimeSlots(data.timeSlots || [])
  if (data.priceNegotiation != null) {
    doctor.value.priceNegotiation = !!data.priceNegotiation
  }
  if (data.charityBookingBlocked != null) {
    doctor.value.charityBookingBlocked = !!data.charityBookingBlocked
  }
  counselorCenterIds.value =
    data.availableCenterIds?.length
      ? data.availableCenterIds
      : getCounselorAvailableCenterIds(timeSlots.value)
  hasAvailableTime.value = Boolean(data.hasAvailableTime ?? timeSlots.value.length)
  selectedCenterId.value = null
  selectedSlotId.value = -1
}

const selectCenter = (centerId: string) => {
  selectedCenterId.value = centerId
  selectedSlotId.value = -1
}

// 计算属性
const doctorFields = computed(() => {
  return doctor.value.field ? doctor.value.field.split(',').map(f => f.trim()) : []
})

const doctorTargetGroups = computed(() => {
  return doctor.value.targetGroup ? doctor.value.targetGroup.split(',').map(g => g.trim()) : []
})

const parseTrainingSegments = (raw?: string): string[] => {
  const text = raw?.trim()
  if (!text) return []

  let parts = text.split(/\n+/).map(p => p.trim()).filter(Boolean)
  if (parts.length <= 1) {
    parts = text.split(/[;；|｜]/).map(p => p.trim()).filter(Boolean)
  }
  if (parts.length <= 1) {
    parts = text.split(/[。！？.!?]+/).map(p => p.trim()).filter(p => p.length > 1)
  }
  if (parts.length <= 1) {
    parts = [text]
  }
  return parts
}

const trainingCount = computed(() => {
  if (doctor.value.trainingCount != null && doctor.value.trainingCount > 0) {
    return doctor.value.trainingCount
  }
  const merged = [doctor.value.career, doctor.value.joiner].filter(Boolean).join('\n').trim()
  if (!merged) return 0
  if (/^\d+$/.test(merged)) return Number(merged)
  const match = merged.match(/(\d+)\s*段/)
  if (match) return Number(match[1])
  return parseTrainingSegments(merged).length
})

// 获取路由参数
const getRouteParams = () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return (currentPage as any).options || {}
}

const mapDoctorDetail = (item: any): Doctor => ({
  id: Number(item.id || 0),
  name: item.name || '咨询师',
  specialty: item.specialty || item.field || '心理咨询',
  experience: Number(item.workYears || 0),
  price: Math.round(Number(item.billing || 0) / 100) || item.price || 500,
  priceNegotiation: !!(item.priceNegotiation),
  charityBookingBlocked: !!(item.charityBookingBlocked),
  avatar: item.avatarUrl || item.avatar || '',
  description: item.introduce || item.description || '暂无介绍',
  profile: item.profile || item.introduce || '暂无简介',
  career: item.career || '',
  joiner: item.joiner || '',
  trainingCount: Number(item.trainingCount ?? item.trainingSegments ?? 0) || 0,
  qualification: item.qualification || '暂无资质信息',
  field: item.field || item.specialty || '',
  targetGroup: item.targetGroup || '成人,青少年,亲子家庭',
  consultHours: Number(item.consultHours || 0),
  workYears: Number(item.workYears || 0),
  mode: item.mode || '线上/线下'
})

const loadFavoriteStatus = async () => {
  if (!doctor.value.id || !isLoggedIn()) {
    isFavorited.value = false
    return
  }
  try {
    const res = await httpV2.get<{ favorited: boolean }>(
      API_ENDPOINTS.patient.favoriteCheck(doctor.value.id),
      undefined,
      { showLoading: false, showError: false },
    )
    if (res.code === 0 && res.data) {
      isFavorited.value = !!res.data.favorited
    }
  } catch {
    // ignore
  }
}

const toggleFavorite = () => {
  if (!doctor.value.id) return
  handleRequireLogin(async () => {
    if (favoriteLoading.value) return
    favoriteLoading.value = true
    try {
      if (isFavorited.value) {
        const res = await httpV2.delete(API_ENDPOINTS.patient.favoriteItem(doctor.value.id))
        if (res.code === 0) {
          isFavorited.value = false
          uni.showToast({ title: '已取消收藏', icon: 'none' })
        } else {
          uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
        }
      } else {
        const res = await httpV2.post(API_ENDPOINTS.patient.favoriteItem(doctor.value.id))
        if (res.code === 0) {
          isFavorited.value = true
          uni.showToast({ title: '收藏成功', icon: 'success' })
        } else {
          uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
        }
      }
    } catch {
      uni.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      favoriteLoading.value = false
    }
  })
}

// 获取医生详情
const loadBookingSlots = async (doctorId: string | number) => {
  try {
    const res = await doctorApi.getTimeSlots(doctorId)
    if (res.code === 0 && res.data) {
      const prevCenter = selectedCenterId.value
      const prevSlot = selectedSlotId.value
      applyBookingData(res.data)
      if (prevCenter && counselorWorksAtCenter(prevCenter)) {
        selectedCenterId.value = prevCenter
        if (prevSlot !== -1) {
          const still = timeSlots.value.find(s => s.ID === prevSlot && isSlotBookable(s))
          selectedSlotId.value = still ? prevSlot : -1
        }
      }
    }
  } catch (error) {
    console.error('刷新可约时段失败:', error)
  }
}

const getDoctorDetail = async () => {
  try {
    const params = getRouteParams()
    const doctorId = routeDoctorId.value || params.id || params.doctorId
    const source = params.source
    
    console.log('获取医生详情，参数:', params)
    console.log('医生ID:', doctorId)
    
    if (!doctorId) {
      uni.showToast({
        title: '医生ID不存在',
        icon: 'none'
      })
      return
    }

    if (isBookingDemoMock()) {
      const payload = getMockDoctorDetailJson(doctorId) as any
      const data = payload.data
      doctor.value = data.doctor
      applyBookingData(data)
      await loadFavoriteStatus()
      setTimeout(() => updateSectionOffsets(), 300)
      return
    }

    const response = await doctorApi.getDetail(doctorId, source ? { source } : undefined)
    if (response.code === 0 && response.data) {
      doctor.value = mapDoctorDetail(response.data)
      applyBookingData(response.data)
      await loadFavoriteStatus()
      setTimeout(() => updateSectionOffsets(), 300)
    } else {
      uni.showToast({
        title: response.msg || '获取医生信息失败',
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('获取医生详情失败:', error)
    uni.showToast({
      title: '网络错误',
      icon: 'none'
    })
  }
}

/** 测量各区块在 scroll-view 内的滚动偏移 */
const updateSectionOffsets = () => {
  return new Promise<void>((resolve) => {
    nextTick(() => {
      const query = uni.createSelectorQuery()
      query.select('#section0').boundingClientRect()
      query.select('#section1').boundingClientRect()
      query.select('.content-area').boundingClientRect()
      query.select('.content-area').scrollOffset()
      query.exec((res) => {
        if (!res || res.length < 4 || !res[0] || !res[2] || !res[3]) {
          resolve()
          return
        }
        const scrollViewTop = res[2].top
        const currentScroll = res[3].scrollTop || 0
        sectionOffsets.value = [0, 1].map((i) => {
          const rect = res[i]
          if (!rect) return 0
          const offset = currentScroll + rect.top - scrollViewTop
          return Math.max(0, Math.round(offset - (i === 0 ? 0 : STICKY_TAB_OFFSET)))
        })
        resolve()
      })
    })
  })
}

// 点击 Tab：切换绿色下划线并滚动到对应内容区
const scrollToSection = async (index: number) => {
  activeTab.value = index
  isClickScrolling.value = true
  await updateSectionOffsets()
  const target = sectionOffsets.value[index] ?? 0
  scrollTopBinding.value = target === scrollTopBinding.value ? target + 0.01 : target
  nextTick(() => {
    scrollTopBinding.value = target
    setTimeout(() => {
      isClickScrolling.value = false
    }, 450)
  })
}

// 滚动时联动 Tab 下划线（按各区块实际位置判断）
const onScroll = (e: any) => {
  const scrollTopValue = e.detail.scrollTop
  pageScrollTop.value = scrollTopValue

  if (isClickScrolling.value) return

  const offsets = sectionOffsets.value
  if (offsets.length < 2) return

  const threshold = scrollTopValue + STICKY_TAB_OFFSET + 10
  const currentIndex = threshold >= offsets[1] ? 1 : 0

  if (currentIndex !== activeTab.value) {
    activeTab.value = currentIndex
  }
}

// 选择时间段（需已选预约中心且时段属于该中心）
const selectTimeSlot = (slot: BookingTimeSlot) => {
  if (isTimeModuleDisabled.value) return
  if (!isSlotBookable(slot)) {
    uni.showToast({ title: '该时段已被预约', icon: 'none' })
    return
  }
  if (!selectedCenterId.value || slot.centerId !== selectedCenterId.value) {
    uni.showToast({ title: '请选择当前预约中心下的时段', icon: 'none' })
    return
  }
  if (slot.ID === undefined || slot.ID === null) {
    uni.showToast({ title: '时间段数据错误', icon: 'none' })
    return
  }
  selectedSlotId.value = selectedSlotId.value === slot.ID ? -1 : slot.ID
}

/** 每次发起新的预约流程前清空签名（不沿用上次本地缓存） */
const resetSignatureForNewBooking = () => {
  hasSignature.value = false
  signatureData.value = ''
  intakeIsAdult.value = null
  showSignatureCanvas.value = false
  try {
    uni.removeStorageSync('signatureImage')
  } catch {
    /* ignore */
  }
  nextTick(() => {
    try {
      signatureRef.value?.clear?.()
    } catch {
      /* ignore */
    }
  })
}

const loadIntakeStatus = async () => {
  try {
    const res = await httpV2.get<{ needsIntakeAgreement?: boolean }>(API_ENDPOINTS.patient.me)
    if (res.code === 0 && res.data) {
      needsIntakeAgreement.value = res.data.needsIntakeAgreement !== false
    }
  } catch {
    /* 默认仍走首次流程，由后端支付时校验 */
  }
}

const proceedToPayment = () => {
  payRulesAgreed.value = false
  showPayment.value = true
}

const openAssistantContact = () => {
  showAssistantContact.value = true
}

const closeAssistantContact = () => {
  showAssistantContact.value = false
}

// 预约：须先选预约中心 → 可约时间 →（首次）协议 → 支付成功
const makeAppointment = async () => {
  if (doctor.value.charityBookingBlocked || doctor.value.priceNegotiation) {
    uni.showToast({ title: '请与咨询师议价后再预约', icon: 'none' })
    return
  }
  if (!selectedCenterId.value) {
    uni.showToast({ title: '请选择预约中心', icon: 'none' })
    return
  }
  if (!counselorWorksAtCenter(selectedCenterId.value)) {
    uni.showToast({ title: '该咨询师不在所选预约中心', icon: 'none' })
    return
  }
  if (selectedSlotId.value === -1) {
    uni.showToast({ title: '请选择可约时间', icon: 'none' })
    return
  }

  resetSignatureForNewBooking()

  // 演示模式：跳过登录，并打印与 expertsController.appointment 成功时一致的返回体（真实 POST 仍应在协议后提交）
  if (isBookingDemoMock()) {
    const mockReq = {
      doctorScheduleID: selectedSlotId.value,
      centerId: selectedCenterId.value,
      xyID: '(演示)协议签署后传入的 xy/gId'
    }
    const mockRes = getMockAppointmentSubmitResponse()
    console.log('[BookingMock] 模拟 POST /we/appointment 请求体:', mockReq)
    console.log('[BookingMock] 模拟接口成功返回(与 expertsController 一致):', mockRes)
    uni.showToast({
      title: '演示：已模拟预约成功，请继续确认协议',
      icon: 'none',
      duration: 2200
    })
    if (needsIntakeAgreement.value) {
      showAgeConfirmDialog()
    } else {
      proceedToPayment()
    }
    return
  }

  const token = uni.getStorageSync('token')
  if (!token) {
    uni.setStorageSync('redirectAfterLogin', `/pages/consultant/detail?id=${doctor.value.id}`)
    uni.navigateTo({
      url: '/pages/auth/login'
    })
    return
  }

  await loadIntakeStatus()
  if (!needsIntakeAgreement.value) {
    proceedToPayment()
    return
  }

  showAgeConfirmDialog()
}

// 返回
const goBack = () => {
  uni.navigateBack()
}

// 主页
const goHome = () => {
  uni.switchTab({
    url: '/pages/index/index'
  })
}

// 获取头像URL
const getAvatarUrl = (avatar: string) => {
  if (!avatar) {
    return getDefaultAvatar()
  }
  
  if (avatar.startsWith('/static/')) {
    return avatar
  }
  if (avatar.startsWith('/')) {
    return `${API_V2_CONFIG.baseURL}${avatar}`
  }
  
  // 如果是完整URL，直接返回
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar
  }
  
  // 默认返回默认头像
  return getDefaultAvatar()
}

// 获取默认头像
const getDefaultAvatar = () => {
  return '/static/images/default-doctor.png'
}

// 处理图片加载错误
const handleImageError = () => {
  console.log('头像加载失败，使用默认头像')
  // 图片加载失败时，可以在这里添加错误处理逻辑
}

// 获取当前日期
const getCurrentDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
}

// 年龄确认相关方法
const showAgeConfirmDialog = () => {
  showAgeConfirm.value = true
}

const closeAgeConfirm = () => {
  showAgeConfirm.value = false
}

const confirmAge = (isAdult: boolean) => {
  intakeIsAdult.value = isAdult
  closeAgeConfirm()
  showAgreement.value = true
  
  // 根据年龄显示不同协议
  if (isAdult) {
    currentAgreement.value = getAdultAgreement()
  } else {
    currentAgreement.value = getMinorAgreement()
  }
  
  currentDate.value = getCurrentDate()
}

// 仅关闭协议弹层（去支付时调用，不清空已签内容）
const hideAgreementModal = () => {
  showAgreement.value = false
  showSignatureCanvas.value = false
}

// 用户取消协议：关闭并重置签名，便于下次重新签
const closeAgreement = () => {
  hideAgreementModal()
  resetSignatureForNewBooking()
}

const getAdultAgreement = () => {
  return `重要提示：
本协议是您与上海连心心理咨询有限公司（以下简称"连心"或"公司"）之间具有法律约束力的协议。请您仔细阅读并理解本协议的所有条款，特别是那些限制责任的条款（将以粗体显示）。通过阅读和签署本协议，您表示接受本协议的所有条款。如果您不同意本协议的任何条款，请停止使用我们的服务。

第一条 协议适用
本协议适用于具有完全民事行为能力的个人，不包括限制民事行为能力人或无民事行为能力人（如未成年人）。如果发现来访者不符合上述资格，来访者及其监护人将承担所有后果，连心保留终止服务的权利。

第二条 服务目的
来访者寻求专业的心理咨询和治疗服务，连心使用专业的技术和方法提供这些服务。

第三条 服务内容
连心指定咨询师${doctor.value.name}，费用为每次50分钟咨询${selectedSlot.value?.Price || 0}元。双方同意遵守合同约定。

第四条 服务预约
每次咨询通常持续50分钟，具体时间由来访者和咨询师确认。

第五条 服务流程
咨询是以精神分析取向的心理咨询，这意味着当前状况的缓解可能不是一个很快的过程，但是你会通过这样一个逐步展开的咨询得到一个更深入的转变，无论是自我认识，还是自我的接纳和自尊的改善，以及生活的关系中的动力和快乐。

第六条 咨询频率
前面的3-4次为初始访谈，每周的频率在1-2次，有些可以是3-4次。短程咨询在15-30次，中长程持续50-100次，长程在100次以上。

第七条 替代疗法
如果你不喜欢精神分析，也可以采用人本主义聚焦疗法的方式，是从身体的感受入手来工作。所以需要通过一点点地增加对自己的身体的理解，来帮助自己解决困扰，增强自己对于自己的情绪及反应的领悟。会有一个更加自主性的过程。每次也是50分钟，频率一周1-2次。每次会包括聚焦和讨论。

第八条 服务方式
目前面询与视频都可以工作。

第九条 保密原则
咨询师将严格保护来访者的隐私，除非法律要求或来访者同意，否则不会向第三方透露咨询内容。

第十条 服务终止
来访者与连心之间的咨询关系是自愿建立的，任何一方都可以单方面终止服务，此时协议终止。任何未解决的事项需要补充协议。

第十一条 法律适用及争议解决
1. 本协议的订立、效力、解释、履行及争议的解决均适用中华人民共和国法律。
2. 因履行本协议发生的争议，双方可以协商解决；协商不成的，提交连心所在地人民法院解决。
3. 争议期间，非争议条款仍然有效。

第十二条 合同的效力
1. 本合同自双方签字盖章之日起生效。
2. 任何一方不得在未经所有方一致同意的情况下单方面变更或终止协议。
3. 部分条款的无效不影响其他条款的效力和履行。

（以下无正文）`
}

const getMinorAgreement = () => {
  return `重要提示：
本协议是您与上海连心心理咨询有限公司（以下简称"连心"或"公司"）之间具有法律约束力的协议。由于您是未成年人，本协议需要您的监护人共同签署。请您和监护人仔细阅读并理解本协议的所有条款，特别是那些限制责任的条款（将以粗体显示）。通过阅读和签署本协议，您和监护人表示接受本协议的所有条款。如果您或监护人不同意本协议的任何条款，请停止使用我们的服务。

第一条 协议适用
本协议适用于未成年人及其监护人。未成年人必须在监护人的陪同下进行咨询，监护人必须全程参与咨询过程并承担相应责任。

第二条 服务目的
未成年人寻求专业的心理咨询和治疗服务，连心使用专业的技术和方法提供这些服务。监护人将全程参与并协助咨询过程。

第三条 服务内容
连心指定咨询师${doctor.value.name}，费用为每次50分钟咨询${selectedSlot.value?.Price || 0}元。双方同意遵守合同约定。

第四条 监护人责任
1. 监护人必须全程陪同未成年人进行咨询
2. 监护人需要签署知情同意书
3. 监护人承担咨询费用和法律责任
4. 监护人有权了解咨询进展和内容

第五条 服务流程
咨询是以精神分析取向的心理咨询，这意味着当前状况的缓解可能不是一个很快的过程，但是你会通过这样一个逐步展开的咨询得到一个更深入的转变，无论是自我认识，还是自我的接纳和自尊的改善，以及生活的关系中的动力和快乐。

第六条 咨询频率
前面的3-4次为初始访谈，每周的频率在1-2次，有些可以是3-4次。短程咨询在15-30次，中长程持续50-100次，长程在100次以上。

第七条 替代疗法
如果你不喜欢精神分析，也可以采用人本主义聚焦疗法的方式，是从身体的感受入手来工作。所以需要通过一点点地增加对自己的身体的理解，来帮助自己解决困扰，增强自己对于自己的情绪及反应的领悟。会有一个更加自主性的过程。每次也是50分钟，频率一周1-2次。每次会包括聚焦和讨论。

第八条 服务方式
目前面询与视频都可以工作。

第九条 保密原则
咨询师将严格保护未成年人的隐私，除非法律要求或监护人同意，否则不会向第三方透露咨询内容。

第十条 服务终止
未成年人、监护人与连心之间的咨询关系是自愿建立的，任何一方都可以单方面终止服务，此时协议终止。任何未解决的事项需要补充协议。

第十一条 法律适用及争议解决
1. 本协议的订立、效力、解释、履行及争议的解决均适用中华人民共和国法律。
2. 因履行本协议发生的争议，双方可以协商解决；协商不成的，提交连心所在地人民法院解决。
3. 争议期间，非争议条款仍然有效。

第十二条 合同的效力
1. 本合同自双方签字盖章之日起生效。
2. 任何一方不得在未经所有方一致同意的情况下单方面变更或终止协议。
3. 部分条款的无效不影响其他条款的效力和履行。

（以下无正文）`
}

// 签名相关方法
const startSignature = () => {
  showSignatureCanvas.value = true
  hasSignature.value = false
  // 延迟初始化，确保DOM已渲染
  nextTick(() => {
    console.log('lime-signature组件已初始化')
  })
}

const confirmSignature = () => {
  // 使用lime-signature组件的canvasToTempFilePath方法
  if (signatureRef.value) {
    signatureRef.value.canvasToTempFilePath({
      success: (res: any) => {
        console.log('签名保存成功:', res)
        if (!res.isEmpty) {
          hasSignature.value = true
          showSignatureCanvas.value = false
          // 仅本次预约流程使用，不写本地存储，避免下次预约仍显示旧签名
          signatureData.value = res.tempFilePath
          uni.showToast({
            title: '签名完成',
            icon: 'success'
          })
        } else {
          uni.showToast({
            title: '请先完成签名',
            icon: 'none'
          })
        }
      },
      fail: (err: any) => {
        console.error('签名保存失败:', err)
        uni.showToast({
          title: '签名保存失败',
          icon: 'none'
        })
      }
    })
  } else {
    uni.showToast({
      title: '签名组件未初始化',
      icon: 'none'
    })
  }
}

// 添加signatureRef引用和签名数据状态
const signatureRef = ref<any>(null)
const signatureData = ref<string>('')

// 清空签名时也要清空签名数据
const clearSignature = () => {
  hasSignature.value = false
  signatureData.value = ''
  // 使用lime-signature组件的clear方法
  if (signatureRef.value) {
    signatureRef.value.clear()
  }
}

// 签名图片加载错误处理
const onSignatureImageError = () => {
  console.error('签名图片加载失败')
  hasSignature.value = false
  signatureData.value = ''
}

// 确认协议
const confirmAgreement = () => {
  if (!hasSignature.value) {
    uni.showToast({
      title: '请先完成签名',
      icon: 'none'
    })
    return
  }
  
  hideAgreementModal()
  payRulesAgreed.value = false
  showPayment.value = true
}

// 支付相关方法
const closePayment = () => {
  showPayment.value = false
  payRulesAgreed.value = false
}

const togglePayRulesAgreed = () => {
  payRulesAgreed.value = !payRulesAgreed.value
}

const openPrivacyPolicy = () => {
  uni.navigateTo({ url: '/pages/legal/privacy' })
}

/** 是否走真实微信支付（上线后在 .env 设置 VITE_ENABLE_REAL_PAY=true） */
const useRealWechatPay = () => import.meta.env.VITE_ENABLE_REAL_PAY === 'true'

const confirmPayment = async () => {
  if (!payRulesAgreed.value) {
    uni.showToast({
      title: '请先阅读温馨提示和《隐私协议》并勾选同意',
      icon: 'none',
      duration: 2500,
    })
    return
  }

  const finishOk = async (orderId?: string) => {
    needsIntakeAgreement.value = false
    closePayment()
    await getDoctorDetail()
    uni.showToast({ title: '预约成功！', icon: 'success', duration: 2000 })
    if (orderId) {
      setTimeout(() => {
        uni.navigateTo({ url: `/pages/consultation/payment-result?order_id=${orderId}` })
      }, 600)
    }
  }

  if (selectedSlotId.value <= 0) {
    uni.showToast({ title: '请先选择可约时间', icon: 'none' })
    return
  }

  let signatureUrl: string | undefined
  if (needsIntakeAgreement.value) {
    if (intakeIsAdult.value === null) {
      uni.showToast({ title: '请先确认是否成年', icon: 'none' })
      return
    }
    if (!hasSignature.value || !signatureData.value) {
      uni.showToast({ title: '请先完成协议签字', icon: 'none' })
      return
    }
    uni.showLoading({ title: '正在上传签名...' })
    try {
      const uploadRes = await httpV2.upload(API_ENDPOINTS.upload.file, signatureData.value, 'file')
      uni.hideLoading()
      if (uploadRes.code !== 0 || !uploadRes.data?.url) {
        uni.showToast({ title: uploadRes.msg || '签名上传失败', icon: 'none' })
        return
      }
      signatureUrl = uploadRes.data.url
    } catch (e: any) {
      uni.hideLoading()
      uni.showToast({ title: e?.message || '签名上传失败', icon: 'none' })
      return
    }
  }

  const payBody: Record<string, unknown> = {
    slot_id: selectedSlotId.value,
    center_id: selectedCenterId.value,
    total_fee: Math.round((selectedSlot.value?.Price ?? doctor.value.price ?? 0) * 100),
    description: `心理咨询预约 - ${doctor.value.name}`,
  }
  if (needsIntakeAgreement.value) {
    payBody.is_adult = intakeIsAdult.value
    payBody.signature_url = signatureUrl
  }

  // 默认：一键模拟支付（点击确认即预约成功）
  if (!useRealWechatPay()) {
    uni.showLoading({ title: '正在预约...' })
    try {
      const res = await httpV2.post<{ order_id: number; out_trade_no: string }>(
        API_ENDPOINTS.payment.simulatePay,
        payBody,
      )
      uni.hideLoading()
      if (res.code !== 0) {
        uni.showToast({ title: res.msg || '预约失败', icon: 'none', duration: 2500 })
        return
      }
      const orderId = String((res.data as any)?.order_id || (res.data as any)?.orderId || '')
      await finishOk(orderId || undefined)
    } catch (e: any) {
      uni.hideLoading()
      uni.showToast({ title: e?.message || '预约失败', icon: 'none' })
    }
    return
  }

  // 上线真实支付：create → wx.requestPayment → 微信回调到账
  uni.showLoading({ title: '正在下单...' })
  try {
    const orderRes = await httpV2.post(API_ENDPOINTS.payment.createOrder, payBody)
    uni.hideLoading()
    if (orderRes.code !== 0 || !orderRes.data) {
      uni.showToast({ title: orderRes.msg || '下单失败', icon: 'none' })
      return
    }
    const payload = orderRes.data as any
    const payParams = payload?.pay_params || payload?.payParams
    const orderId = String(payload?.order_id || payParams?.order_id || '')
    if (!payParams?.appId) {
      uni.showToast({ title: '未获取到支付参数', icon: 'none' })
      return
    }
    uni.requestPayment({
      provider: 'wxpay',
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign,
      success: () => { finishOk(orderId) },
      fail: () => uni.showToast({ title: '支付取消或失败', icon: 'none' }),
    } as any)
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: e?.message || '支付异常', icon: 'none' })
  }
}

// 返回按钮点击事件
const goBackFromSignature = () => {
  showSignatureCanvas.value = false
  // 只关闭绘制区域，保持其他状态不变
}

onLoad((opts) => {
  routeDoctorId.value = opts?.id || opts?.doctorId || ''
  getDoctorDetail()
  if (uni.getStorageSync('token')) {
    loadIntakeStatus()
  }
})

onShow(() => {
  if (doctor.value.id) {
    loadFavoriteStatus()
  }
  const params = getRouteParams()
  const doctorId = routeDoctorId.value || params.id || params.doctorId
  if (doctorId && doctor.value.id) {
    loadBookingSlots(doctorId)
  } else if (doctorId && !doctor.value.id) {
    getDoctorDetail()
  }
})

onMounted(() => {
  resetSignatureForNewBooking()
  setTimeout(() => updateSectionOffsets(), 500)

  const systemInfo = uni.getSystemInfoSync()
  const navbarHeight = 88
  const tabHeight = 44
  const statusBarHeight = systemInfo.statusBarHeight || 0
  contentHeight.value = systemInfo.windowHeight - navbarHeight - tabHeight - statusBarHeight
})
</script>

<style>
/* 顶级设计系统变量与重置 */
.page-consultant-detail {
  background-color: #F7F5F2;
  position: relative;
  width: 100%;
  overflow-x: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.content-area {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

/* 自定义导航栏 */
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  transition: all 0.3s ease;
  background: transparent;
}

.custom-navbar.navbar-solid {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  height: 88rpx;
  margin-top: var(--status-bar-height, 0px);
}

.nav-btn-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.navbar-solid .nav-btn-wrap {
  background: #F3F4F6;
}

.nav-icon {
  color: white;
  font-size: 48rpx;
  line-height: 1;
  margin-top: -4rpx;
  margin-left: -4rpx;
}

.nav-icon-home {
  color: white;
  font-size: 36rpx;
  line-height: 1;
}

.navbar-solid .nav-icon,
.navbar-solid .nav-icon-home {
  color: #1F2937;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1F2937;
  transition: opacity 0.3s;
}

/* Hero 区域 */
.hero-section {
  position: relative;
  height: 560rpx;
  width: 100%;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.hero-bg-img {
  width: 100%;
  height: 100%;
  filter: blur(40px) brightness(0.8);
  transform: scale(1.2);
}

.hero-bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, #F7F5F2 100%);
}

.hero-content {
  position: absolute;
  bottom: 60rpx;
  left: 0;
  right: 0;
  padding: 0 40rpx;
  display: flex;
  align-items: flex-end;
  gap: 32rpx;
}

.hero-avatar {
  width: 200rpx;
  height: 200rpx;
  border-radius: 40rpx;
  border: 6rpx solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.15);
  background: #E5E7EB;
}

.hero-info {
  flex: 1;
  padding-bottom: 10rpx;
}

.hero-name-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-bottom: 16rpx;
}

.hero-name {
  font-size: 48rpx;
  font-weight: 800;
  color: #1F2937;
  flex: 1;
  text-shadow: 0 2rpx 4rpx rgba(255,255,255,0.5);
}

.hero-price {
  font-size: 36rpx;
  font-weight: 800;
  color: #F59E0B;
  flex-shrink: 0;
}

.hero-price-unit {
  font-size: 22rpx;
  font-weight: 600;
  color: #9CA3AF;
}

.hero-tags {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.hero-tag {
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
  backdrop-filter: blur(8px);
}

.hero-tag.primary {
  background: rgba(61, 90, 78, 0.15);
  color: #3D5A4E;
  border: 1px solid rgba(61, 90, 78, 0.3);
}

.hero-tag.secondary {
  background: rgba(255, 255, 255, 0.6);
  color: #4B5563;
  border: 1px solid rgba(255, 255, 255, 0.8);
}

/* 悬浮数据卡片 */
.stats-card {
  margin: -30rpx 32rpx 32rpx;
  background: #ffffff;
  border-radius: 32rpx;
  padding: 32rpx 0;
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.04);
  position: relative;
  z-index: 10;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  flex: 1;
}

.stat-value {
  font-size: 40rpx;
  font-weight: 800;
  color: #1F2937;
}

.stat-value.price {
  color: #F59E0B;
}

.stat-unit {
  font-size: 24rpx;
  font-weight: 600;
  color: #6B7280;
  margin-left: 4rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #9CA3AF;
  font-weight: 500;
}

.stat-divider {
  width: 2rpx;
  height: 60rpx;
  background: #F3F4F6;
}

/* Tab 导航 */
.tab-nav-modern {
  display: flex;
  padding: 0 32rpx;
  position: relative;
  margin-bottom: 24rpx;
  z-index: 90;
  transition: all 0.3s;
}

.tab-nav-modern.tab-sticky {
  position: fixed;
  top: calc(88rpx + var(--status-bar-height, 0px));
  left: 0;
  right: 0;
  background: rgba(247, 245, 242, 0.95);
  backdrop-filter: blur(20px);
  padding-top: 20rpx;
  padding-bottom: 20rpx;
  margin-bottom: 0;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.02);
}

.tab-item {
  flex: 1;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #9CA3AF;
  padding: 20rpx 0;
  position: relative;
  transition: color 0.3s;
}

.tab-item.active {
  color: #1F2937;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 48rpx;
  height: 6rpx;
  background: #3D5A4E;
  border-radius: 6rpx 6rpx 0 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 内容区域 */
.main-content-padding {
  padding: 0 32rpx;
}

.content-section {
  margin-bottom: 48rpx;
}

.info-block {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 40rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
}

.block-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 24rpx;
  position: relative;
  padding-left: 24rpx;
}

.block-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8rpx;
  height: 32rpx;
  background: #3D5A4E;
  border-radius: 8rpx;
}

.block-subtitle {
  display: block;
  font-size: 26rpx;
  color: #9CA3AF;
  margin-top: -16rpx;
  margin-bottom: 32rpx;
  padding-left: 24rpx;
}

/* 预约区域 */
.booking-section {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 40rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
}

.booking-hint {
  display: block;
  font-size: 28rpx;
  color: #4B5563;
  margin-bottom: 32rpx;
  padding-left: 24rpx;
  line-height: 1.5;
}

.block-title--green::before {
  background: #3D5A4E;
}

.block-title--orange::before {
  background: #4A6B5D;
}

.block-title--sm {
  font-size: 30rpx;
  margin-bottom: 20rpx;
}

.booking-module-box {
  background: #F3F4F6;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
}

.booking-module-box.is-disabled {
  opacity: 0.55;
  pointer-events: none;
}

.booking-module-box.is-disabled .module-placeholder {
  pointer-events: auto;
}

.center-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.center-card {
  background: #FFFFFF;
  border: 2px solid transparent;
  border-radius: 24rpx;
  padding: 28rpx 20rpx;
  text-align: center;
  transition: all 0.2s;
}

.center-card.selected {
  background: #F0EDE8;
  border-color: #3D5A4E;
  box-shadow: 0 8rpx 24rpx rgba(61, 90, 78, 0.12);
}

.center-card.unavailable {
  opacity: 0.65;
}

.center-name {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
}

.center-tip {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-top: 8rpx;
}

.module-placeholder {
  padding: 48rpx 24rpx;
  text-align: center;
}

.module-placeholder-text {
  font-size: 26rpx;
  color: #6B7280;
}

.block-text {
  font-size: 30rpx;
  color: #4B5563;
  line-height: 1.8;
}

.quote-text {
  font-style: italic;
  color: #3D5A4E;
  background: #F0EDE8;
  padding: 24rpx;
  border-radius: 16rpx;
  display: block;
}

.process-card {
  background: #F9FAFB;
  padding: 32rpx;
  border-radius: 24rpx;
  border: 1px solid #F3F4F6;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.cloud-tag {
  background: #F0EDE8;
  color: #3D5A4E;
  padding: 12rpx 32rpx;
  border-radius: 100rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.cloud-tag.alt {
  background: #F0EDE8;
  color: #3D5A4E;
}

/* 可约时间 Grid */
.time-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.time-card {
  background: #F9FAFB;
  border: 2px solid transparent;
  border-radius: 24rpx;
  padding: 24rpx;
  transition: all 0.2s;
}

.time-card.selected {
  background: #F0EDE8;
  border-color: #3D5A4E;
  box-shadow: 0 8rpx 24rpx rgba(61, 90, 78, 0.1);
}

.time-card--booked {
  opacity: 0.48;
  background: #E5E7EB;
  filter: grayscale(0.35);
}

.time-card--booked .tc-time,
.time-card--booked .tc-price {
  color: #9CA3AF;
}

.tc-booked-tag {
  font-size: 20rpx;
  color: #9CA3AF;
  background: #F3F4F6;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.time-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.tc-date {
  font-size: 26rpx;
  font-weight: 700;
  color: #1F2937;
}

.tc-week {
  font-size: 22rpx;
  color: #9CA3AF;
}

.time-card-mid {
  margin-bottom: 16rpx;
}

.tc-time {
  font-size: 32rpx;
  font-weight: 800;
  color: #3D5A4E;
}

.time-card-bot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed #E5E7EB;
  padding-top: 16rpx;
}

.tc-price {
  font-size: 28rpx;
  font-weight: 700;
  color: #F59E0B;
}

.tc-radio {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2px solid #D1D5DB;
  display: flex;
  align-items: center;
  justify-content: center;
}

.time-card.selected .tc-radio {
  border-color: #3D5A4E;
}

.tc-radio-inner {
  width: 20rpx;
  height: 20rpx;
  background: #3D5A4E;
  border-radius: 50%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}

.empty-img {
  width: 240rpx;
  height: 240rpx;
  margin-bottom: 24rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
  color: #9CA3AF;
}

/* 底部悬浮预约栏 */
.bottom-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 -10rpx 40rpx rgba(0, 0, 0, 0.08);
  border-top: 1px solid rgba(255,255,255,0.5);
  border-radius: 40rpx 40rpx 0 0;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 900;
}

.bottom-action-bar.show {
  transform: translateY(0);
}

.action-info {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.action-label {
  font-size: 26rpx;
  color: #6B7280;
}

.action-price {
  font-size: 36rpx;
  font-weight: 800;
  color: #F59E0B;
}

.action-btns {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
  justify-content: flex-end;
}

.favorite-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  background: transparent;
  border: none;
  padding: 0 16rpx;
  margin: 0;
  flex-shrink: 0;
  min-width: 88rpx;
  color: #6B7280;
  font-size: 22rpx;
  line-height: 1.2;
}

.favorite-btn::after {
  border: none;
}

.favorite-btn.active {
  color: #EF4444;
}

.favorite-icon {
  font-size: 44rpx;
  line-height: 1;
}

.favorite-btn.active .favorite-icon {
  color: #EF4444;
}

.action-btn {
  flex: 0 0 auto;
  min-width: 140rpx;
  max-width: 168rpx;
  background: linear-gradient(135deg, #3D5A4E 0%, #4A6B5D 100%);
  color: white;
  font-size: 24rpx;
  font-weight: 600;
  padding: 0 20rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 100rpx;
  margin: 0;
  box-shadow: 0 6rpx 16rpx rgba(61, 90, 78, 0.25);
}

.action-btn::after {
  border: none;
}

.action-btn.outline {
  background: #fff;
  color: #3D5A4E;
  border: 2rpx solid #3D5A4E;
  box-shadow: none;
}

.action-btn.disabled {
  opacity: 0.45;
  box-shadow: none;
}

.action-btn:active {
  transform: scale(0.96);
}

.assistant-sheet {
  max-height: 85vh;
}

.assistant-body {
  padding: 0 32rpx 32rpx;
  max-height: 70vh;
  overflow-y: auto;
}

/* 遮罩层：必须 fixed，否则会排在页面文档流最底部，无法盖住全屏 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.modal-overlay--center {
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx;
  padding-top: calc(48rpx + env(safe-area-inset-top, 0px));
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom, 0px));
}

.modal-overlay--bottom {
  align-items: stretch;
  justify-content: flex-end;
  padding: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* 现代化弹窗通用样式 */
.modern-modal {
  background: rgba(17, 24, 39, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.modal-content {
  background: #ffffff;
  border-radius: 40rpx;
  width: 85%;
  max-width: 640rpx;
  overflow: hidden;
  box-shadow: 0 24rpx 64rpx rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
}

.modal-content.bottom-sheet {
  width: 100%;
  max-width: 100%;
  border-radius: 40rpx 40rpx 0 0;
  margin-top: auto;
}

.modal-content.full-height {
  width: 100%;
  max-width: 100%;
  height: 92vh;
  border-radius: 40rpx 40rpx 0 0;
  margin-top: auto;
  overflow: hidden;
  box-sizing: border-box;
}

.modal-header-modern {
  padding: 40rpx 40rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 800;
  color: #1F2937;
}

.modal-close-btn {
  width: 64rpx;
  height: 64rpx;
  background: #F3F4F6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: #6B7280;
  line-height: 1;
}

.modal-body {
  padding: 0 40rpx 40rpx;
  flex: 1;
  overflow-y: auto;
}

.modal-body.no-padding {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  min-width: 0;
  flex: 1;
  min-height: 0;
}

.modal-footer-modern {
  padding: 24rpx 40rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1px solid #F3F4F6;
}

.btn-fill {
  background: #3D5A4E;
  color: white;
  font-size: 32rpx;
  font-weight: 600;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 100rpx;
  border: none;
}

.btn-fill.disabled {
  background: #D1D5DB;
  color: #9CA3AF;
}

.btn-outline {
  background: #ffffff;
  color: #4B5563;
  font-size: 32rpx;
  font-weight: 600;
  height: 96rpx;
  line-height: 92rpx;
  border-radius: 100rpx;
  border: 2rpx solid #E5E7EB;
}

.full-width {
  width: 100%;
}

.text-center { text-align: center; }
.text-red { color: #EF4444; }

/* 年龄确认弹窗特有 */
.modal-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  background: #FEF3C7;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 40rpx auto 32rpx;
}

.modal-icon {
  font-size: 64rpx;
  font-weight: 800;
  color: #F59E0B;
}

.modal-title-large {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 16rpx;
}

.modal-desc {
  display: block;
  font-size: 28rpx;
  color: #6B7280;
  line-height: 1.6;
  margin-bottom: 48rpx;
}

.modal-btn-group {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.modal-btn-group button {
  flex: 1;
}

.modal-close-text {
  font-size: 28rpx;
  color: #9CA3AF;
  padding: 20rpx;
}

/* 协议区：外层用 padding 做左右留白；flex 子项须可收缩，否则固定 52vh 的 scroll 会在签名展开时溢出并与签名区叠层 */
.agreement-block {
  flex: 1;
  min-height: 0;
  min-width: 0;
  padding: 0 40rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 协议滚动区：占满协议块剩余高度，随签名区展开自动变矮，避免与「来访者签字」等重叠 */
.agreement-scroll {
  flex: 1 1 0%;
  min-height: 280rpx;
  width: 100%;
  max-width: 100%;
  max-height: 820rpx;
  box-sizing: border-box;
  background: #f9fafb;
  border-radius: 24rpx;
  padding: 32rpx;
  overflow: hidden;
}

.agreement-text-wrap {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.agreement-text {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  font-size: 28rpx;
  color: #4b5563;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.signature-box {
  flex-shrink: 0;
  padding: 0 40rpx 24rpx;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.sig-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.sig-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1F2937;
}

.sig-date {
  font-size: 26rpx;
  color: #9CA3AF;
}

.sig-placeholder {
  height: 200rpx;
  background: #F9FAFB;
  border: 2px dashed #D1D5DB;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sig-placeholder-text {
  font-size: 30rpx;
  color: #9CA3AF;
  font-weight: 500;
}

.sig-canvas-wrap {
  background: #ffffff;
  border: 1px solid #E5E7EB;
  border-radius: 24rpx;
  overflow: hidden;
}

.sig-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #9CA3AF;
  padding: 16rpx 0;
  background: #F9FAFB;
}

.sig-canvas-inner {
  border-top: 1px solid #E5E7EB;
  border-bottom: 1px solid #E5E7EB;
}

.sig-actions {
  display: flex;
  padding: 16rpx;
  gap: 16rpx;
  background: #F9FAFB;
}

.sig-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 26rpx;
  border-radius: 100rpx;
  margin: 0;
}

.sig-btn.outline {
  background: white;
  border: 1px solid #D1D5DB;
  color: #4B5563;
}

.sig-btn.fill {
  background: #3D5A4E;
  color: white;
}

.sig-result {
  position: relative;
  height: 200rpx;
  background: #F9FAFB;
  border-radius: 24rpx;
  border: 1px solid #E5E7EB;
  overflow: hidden;
}

.sig-img {
  width: 100%;
  height: 100%;
}

.sig-re-sign {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  background: rgba(0,0,0,0.5);
  color: white;
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 100rpx;
  backdrop-filter: blur(4px);
}

/* 支付弹窗特有 */
.pay-amount-box {
  text-align: center;
  margin-bottom: 48rpx;
}

.pay-currency {
  font-size: 40rpx;
  font-weight: 800;
  color: #1F2937;
}

.pay-amount {
  font-size: 72rpx;
  font-weight: 800;
  color: #1F2937;
}

.pay-details {
  background: #F9FAFB;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
}

.pay-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.pay-row:last-child {
  margin-bottom: 0;
}

.pay-label {
  font-size: 28rpx;
  color: #6B7280;
}

.pay-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2937;
}

.pay-value.highlight {
  color: #3D5A4E;
}

.pay-warm-tips {
  background: #FFFBEB;
  border: 1rpx solid #FDE68A;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 28rpx;
}

.pay-tip-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.pay-tip-title-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #B45309;
}

.pay-tip-icon {
  width: 32rpx;
  height: 32rpx;
  background: #F59E0B;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 20rpx;
  flex-shrink: 0;
}

.pay-rules-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.pay-rule-item {
  font-size: 24rpx;
  color: #92400E;
  line-height: 1.6;
}

.pay-agree-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 8rpx 0 4rpx;
}

.pay-checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #D1D5DB;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
  background: #fff;
}

.pay-checkbox.checked {
  background: #3D5A4E;
  border-color: #3D5A4E;
}

.pay-check-icon {
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}

.pay-agree-text {
  flex: 1;
  font-size: 26rpx;
  color: #4B5563;
  line-height: 1.6;
}

.pay-agree-link {
  color: #3D5A4E;
  font-weight: 600;
}
</style>