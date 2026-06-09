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
            <text class="hero-name">{{ doctor.name }}</text>
            <view class="hero-tags">
              <text class="hero-tag primary">{{ doctor.mode || '地面/视频' }}</text>
              <text class="hero-tag secondary">从业{{ doctor.workYears }}年</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 悬浮数据卡片 -->
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
          <text class="stat-value price">￥{{ doctor.price }}</text>
          <text class="stat-label">每次/50分钟</text>
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
        >咨询过程</view>
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 2 }"
          @click="scrollToSection(2)"
        >预约</view>
      </view>

      <!-- 个人介绍区域（id 须为 scroll-view 直接子节点，滚动定位才生效） -->
      <view class="content-section main-content-padding" id="section0">
          <view class="info-block">
            <text class="block-title">简介</text>
            <text class="block-text quote-text">"{{ doctor.profile }}"</text>
          </view>
          
          <view class="info-block">
            <text class="block-title">个人介绍</text>
            <text class="block-text">{{ doctor.description }}</text>
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

      <!-- 咨询过程区域 -->
      <view class="content-section main-content-padding" id="section1">
          <view class="info-block">
            <text class="block-title">咨询过程</text>
            <view class="process-card">
              <text class="block-text">
                咨询是以精神分析取向的心理咨询，这意味着当前状况的缓解可能不是一个很快的过程，但是你会通过这样一个逐步展开的咨询得到一个更深入的转变，无论是自我认识，还是自我的接纳和自尊的改善，以及生活的关系中的动力和快乐。
                


                但是可能也会在咨询的过程中体验到许多未曾感受的情感，这些也许会让你感觉到有一些难以耐受，但是所有这些我们可以去讨论，我也会和你在一起来经历这些。每次50分钟。前面的3-4次为初始访谈，每周的频率在1-2次，有些可以是3-4次。一个个短程的咨询在15-30次，中长程持续50-100次，长程在100次以上。如果你不喜欢精神分析，也可以采用人本主义聚焦疗法的方式，是从身体的感受入手来工作。所以需要通过一点点地增加对自己的身体的理解，来帮助自己解决困扰，增强自己对于自己的情绪及反应的领悟。会有一个更加自主性的过程。每次也是50分钟，频率一周1-2次。每次会包括聚焦和讨论。
              </text>
            </view>
          </view>
      </view>

      <!-- 预约区域：预约中心 + 可约时间 -->
      <view class="content-section main-content-padding" id="section2">
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
                :class="{ selected: selectedSlotId === slot.ID }"
                @click="selectTimeSlot(slot)"
              >
                <view class="time-card-top">
                  <text class="tc-date">{{ slot.startDate }}</text>
                  <text class="tc-week">{{ slot.week }}</text>
                </view>
                <view class="time-card-mid">
                  <text class="tc-time">{{ slot.startHH }}-{{ slot.endHH }}</text>
                </view>
                <view class="time-card-bot">
                  <text class="tc-price">￥{{ slot.Price }}</text>
                  <view class="tc-radio">
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
    <view class="bottom-action-bar" :class="{ 'show': canProceedBooking }">
      <view class="action-info">
        <text class="action-label">合计</text>
        <text class="action-price">￥{{ selectedSlot?.Price || doctor.price }}</text>
      </view>
      <button class="action-btn" @click="makeAppointment">立即预约</button>
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
            <text class="pay-currency">￥</text>
            <text class="pay-amount">{{ selectedSlot?.Price || 0 }}</text>
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
              <text class="pay-value">{{ doctor.mode || '地面/视频' }}</text>
            </view>
          </view>
          
          <view class="pay-tip">
            <text class="pay-tip-icon">!</text>
            <text>预约成功后请在15分钟内完成付款</text>
          </view>
        </view>
        <view class="modal-footer-modern">
          <button class="btn-fill full-width" @click="confirmPayment">确认支付</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { API_V2_CONFIG } from '@/config/api'
import { doctorApi } from '@/apis'
import { isBookingDemoMock, getMockDoctorDetailJson, getMockAppointmentSubmitResponse } from '@/mocks/bookingDemo'
import { APPOINTMENT_CENTERS } from '@/constants/appointmentCenters'
import {
  normalizeBookingTimeSlots,
  filterSlotsByCenter,
  counselorWorksAtCenter as slotWorksAtCenter,
  getCounselorAvailableCenterIds,
  type BookingTimeSlot,
} from '@/utils/bookingSlots'

interface Doctor {
  id: number
  name: string
  specialty: string
  experience: number
  price: number
  avatar: string
  description: string
  profile: string
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
const sectionOffsets = ref<number[]>([0, 0, 0])
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

// 弹框状态
const showAgeConfirm = ref(false)
const showAgreement = ref(false)
const showPayment = ref(false)
const showSignatureCanvas = ref(false)

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

/** 已选中心但咨询师不在该中心或无可约时段时，可约时间模块灰化且不可点 */
const isTimeModuleDisabled = computed(() => {
  if (!selectedCenterId.value) return false
  if (!counselorWorksAtCenter(selectedCenterId.value)) return true
  return filteredTimeSlots.value.length === 0
})

const canProceedBooking = computed(() =>
  Boolean(
    selectedCenterId.value &&
    selectedSlotId.value !== -1 &&
    selectedSlot.value?.centerId === selectedCenterId.value
  )
)

const counselorWorksAtCenter = (centerId: string) =>
  counselorCenterIds.value.includes(centerId) ||
  slotWorksAtCenter(timeSlots.value, centerId)

const applyBookingData = (data: {
  timeSlots?: any[]
  availableCenterIds?: string[]
  hasAvailableTime?: boolean
}) => {
  timeSlots.value = normalizeBookingTimeSlots(data.timeSlots || [])
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
  avatar: item.avatarUrl || item.avatar || '',
  description: item.introduce || item.description || '暂无介绍',
  profile: item.career || item.introduce || item.description || '暂无简介',
  qualification: item.qualification || '暂无资质信息',
  field: item.field || item.specialty || '',
  targetGroup: item.targetGroup || '成人,青少年,亲子家庭',
  consultHours: Number(item.consultHours || 0),
  workYears: Number(item.workYears || 0),
  mode: item.mode || '地面/视频'
})

// 获取医生详情
const getDoctorDetail = async () => {
  try {
    const params = getRouteParams()
    const doctorId = params.id || params.doctorId
    
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
      setTimeout(() => updateSectionOffsets(), 300)
      return
    }

    const response = await doctorApi.getDetail(doctorId)
    if (response.code === 0 && response.data) {
      doctor.value = mapDoctorDetail(response.data)
      applyBookingData(response.data)
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
      query.select('#section2').boundingClientRect()
      query.select('.content-area').boundingClientRect()
      query.select('.content-area').scrollOffset()
      query.exec((res) => {
        if (!res || res.length < 5 || !res[0] || !res[3] || !res[4]) {
          resolve()
          return
        }
        const scrollViewTop = res[3].top
        const currentScroll = res[4].scrollTop || 0
        sectionOffsets.value = [0, 1, 2].map((i) => {
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
  if (offsets.length < 3) return

  const threshold = scrollTopValue + STICKY_TAB_OFFSET + 10
  let currentIndex = 0
  if (threshold >= offsets[2]) {
    currentIndex = 2
  } else if (threshold >= offsets[1]) {
    currentIndex = 1
  }

  if (currentIndex !== activeTab.value) {
    activeTab.value = currentIndex
  }
}

// 选择时间段（需已选预约中心且时段属于该中心）
const selectTimeSlot = (slot: BookingTimeSlot) => {
  if (isTimeModuleDisabled.value) return
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

// 预约：须先选预约中心 → 可约时间 → 协议 → 支付成功
const makeAppointment = () => {
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
    showAgeConfirmDialog()
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
  showPayment.value = true
}

// 支付相关方法
const closePayment = () => {
  showPayment.value = false
}

const confirmPayment = async () => {
  const finishOk = (orderId?: string) => {
    closePayment()
    if (orderId) {
      uni.redirectTo({ url: `/pages/consultation/payment-result?order_id=${orderId}` })
    } else {
      uni.showToast({ title: '预约成功！', icon: 'success' })
      setTimeout(() => { uni.navigateBack() }, 1500)
    }
  }

  if (isBookingDemoMock()) {
    uni.showToast({ title: '正在提交预约(演示)...', icon: 'loading' })
    const mockRes = getMockAppointmentSubmitResponse()
    console.log('[BookingMock] 模拟 POST /we/appointment 返回:', mockRes)
    setTimeout(() => { uni.hideToast(); finishOk() }, 600)
    return
  }

  // 真实支付：调用 Python 后端下单，再唤起微信支付
  uni.showLoading({ title: '正在下单...' })
  try {
    const { httpV2 } = await import('@/utils/http')
    const { API_ENDPOINTS } = await import('@/config/api')
    const orderRes = await httpV2.post('/api/payment/wechat/create', {
      slot_id: selectedSlotId.value,
      center_id: selectedCenterId.value,
      total_fee: Math.round((selectedSlot.value?.Price ?? doctor.value.price ?? 0) * 100),
      description: `心理咨询预约 - ${doctor.value.name}`
    })

    uni.hideLoading()

    if (orderRes.code !== 0 || !orderRes.data) {
      uni.showToast({ title: orderRes.msg || '下单失败', icon: 'none' })
      return
    }

    // 下单成功后，先请求"预约成功 / 提醒"订阅授权（升级方案 §7.6）。
    // 失败/拒绝都不阻断支付流程。
    try {
      const tplEvents = ['APPOINTMENT_OK', 'APPOINTMENT_REMIND']
      const tplRes = await httpV2.get<{ tmplIds: string[] }>(
        API_ENDPOINTS.message.templates,
        { event_keys: tplEvents.join(',') }
      )
      const tmplIds = (tplRes.code === 0 && tplRes.data?.tmplIds) || []
      if (tmplIds.length && (uni as any).requestSubscribeMessage) {
        await new Promise<void>((resolve) => {
          ;(uni as any).requestSubscribeMessage({
            tmplIds,
            success: (subRes: any) => {
              const accepted = Object.keys(subRes || {}).filter(k => subRes[k] === 'accept')
              accepted.forEach(tplId => {
                const evt = tplEvents.find(e =>
                  (tplRes.data?.tmplIds || []).includes(tplId)
                ) || 'APPOINTMENT_OK'
                httpV2.post(API_ENDPOINTS.message.subscribe, {
                  event_key: evt,
                  template_id: tplId,
                  payload: { slotId: selectedSlotId.value, doctorId: doctor.value.id }
                }).catch(() => {})
              })
              resolve()
            },
            fail: () => resolve(),
          })
        })
      }
    } catch (subErr) {
      console.warn('订阅消息授权阶段异常', subErr)
    }

    const payParams = orderRes.data.pay_params
    const orderId = orderRes.data.order_id || orderRes.data.id || ''
    if ((payParams.appId as string).startsWith('wx_mock')) {
      finishOk(orderId)
      return
    }

    uni.requestPayment({
      provider: 'wxpay',
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign,
      success: () => finishOk(orderId),
      fail: (err: any) => {
        console.error('支付失败', err)
        uni.showToast({ title: '支付取消或失败', icon: 'none' })
      }
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

onMounted(() => {
  resetSignatureForNewBooking()
  getDoctorDetail()

  // 添加测试数据，确保页面能正常显示
  setTimeout(() => {
    if (!doctor.value.name) {
      console.log('使用测试数据')
      doctor.value = {
        id: 1,
        name: '赵晶',
        specialty: '心理咨询师',
        experience: 8,
        price: 600,
        avatar: getDefaultAvatar(),
        description: '专注于情感关系、婚姻家庭、亲子教育等领域的心理咨询。拥有丰富的临床经验，擅长运用认知行为疗法、家庭系统疗法等多种治疗方法。',
        profile: '生活坏到一定程度就会好起来,因为它无法更坏,因为你本自具足,因为生命本身就是黑暗中闪烁的光。',
        qualification: '国家二级心理咨询师 上海某三甲医院心理咨询师',
        field: '心理健康,人际关系,家庭养育,学业发展,亲密关系,个人成长',
        targetGroup: '幼儿&儿童,青少年,伴侣,家庭,成年人',
        consultHours: 1800,
        workYears: 9,
        mode: '地面/视频'
      }
      
      applyBookingData({
        availableCenterIds: ['yangpu', 'pudong'],
        hasAvailableTime: true,
        timeSlots: [
          {
            ID: 1,
            centerId: 'yangpu',
            startDate: '2025-01-20',
            startHH: '09:00',
            endHH: '10:00',
            week: '星期一',
            Price: 600,
            maxSign: 1,
            numSign: 0
          },
          {
            ID: 2,
            centerId: 'pudong',
            startDate: '2025-01-20',
            startHH: '14:00',
            endHH: '15:00',
            week: '星期一',
            Price: 600,
            maxSign: 1,
            numSign: 0
          }
        ]
      })
      setTimeout(() => updateSectionOffsets(), 100)
    }
  }, 2000)
  
  setTimeout(() => updateSectionOffsets(), 500)
  
  // 计算内容区域高度
  const systemInfo = uni.getSystemInfoSync()
  const navbarHeight = 88 // 导航栏高度
  const tabHeight = 44 // tab高度
  const statusBarHeight = systemInfo.statusBarHeight || 0
  contentHeight.value = systemInfo.windowHeight - navbarHeight - tabHeight - statusBarHeight
})
</script>

<style>
/* 顶级设计系统变量与重置 */
.page-consultant-detail {
  background-color: #F4F6F8;
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
  background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, #F4F6F8 100%);
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

.hero-name {
  font-size: 48rpx;
  font-weight: 800;
  color: #1F2937;
  display: block;
  margin-bottom: 16rpx;
  text-shadow: 0 2rpx 4rpx rgba(255,255,255,0.5);
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
  background: rgba(13, 148, 136, 0.15);
  color: #0D9488;
  border: 1px solid rgba(13, 148, 136, 0.3);
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
  background: rgba(244, 246, 248, 0.95);
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
  background: #0D9488;
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
  background: #0D9488;
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
  background: #0D9488;
}

.block-title--orange::before {
  background: #F59E0B;
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
  background: #FFFBEB;
  border-color: #F59E0B;
  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.12);
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
  color: #0D9488;
  background: #F0FDFA;
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
  background: #F3F4F6;
  color: #4B5563;
  padding: 12rpx 32rpx;
  border-radius: 100rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.cloud-tag.alt {
  background: #EFF6FF;
  color: #3B82F6;
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
  background: #F0FDFA;
  border-color: #0D9488;
  box-shadow: 0 8rpx 24rpx rgba(13, 148, 136, 0.1);
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
  color: #0D9488;
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
  border-color: #0D9488;
}

.tc-radio-inner {
  width: 20rpx;
  height: 20rpx;
  background: #0D9488;
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
  padding: 24rpx 40rpx calc(24rpx + env(safe-area-inset-bottom));
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
}

.action-label {
  font-size: 26rpx;
  color: #6B7280;
}

.action-price {
  font-size: 48rpx;
  font-weight: 800;
  color: #F59E0B;
}

.action-btn {
  background: linear-gradient(135deg, #0F766E 0%, #0D9488 100%);
  color: white;
  font-size: 32rpx;
  font-weight: 700;
  padding: 0 60rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  margin: 0;
  box-shadow: 0 8rpx 24rpx rgba(13, 148, 136, 0.3);
}

.action-btn:active {
  transform: scale(0.96);
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
  background: #0D9488;
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
  background: #0D9488;
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
  color: #0D9488;
}

.pay-tip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #FEF3C7;
  color: #D97706;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
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
}
</style>