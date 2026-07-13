<template>
  <view class="page-users">
    <view class="header">
      <text class="title">用户管理</text>
      <text class="subtitle">管理来访者与咨询师信息</text>
    </view>

    <scroll-view scroll-x class="tab-scroll" :show-scrollbar="false">
      <view class="tab-bar">
        <view
          class="tab-item"
          :class="{ active: activeTab === 'patients' }"
          @tap="activeTab = 'patients'"
        >来访管理</view>
        <view
          class="tab-item"
          :class="{ active: activeTab === 'counselors' }"
          @tap="activeTab = 'counselors'"
        >咨询师管理</view>
      </view>
    </scroll-view>

    <!-- 来访管理 -->
    <view v-show="activeTab === 'patients'" class="panel">
      <view class="search-bar">
        <input
          class="search-input"
          v-model="patientKeyword"
          placeholder="搜索姓名或手机号"
          confirm-type="search"
          @confirm="loadPatients"
        />
        <view class="search-btn" @tap="loadPatients">搜索</view>
      </view>

      <view v-if="patientLoading" class="empty">加载中...</view>
      <view v-else-if="patients.length === 0" class="empty">暂无来访者数据</view>
      <view v-else class="list">
        <view
          v-for="item in patients"
          :key="item.patientId"
          class="card"
          @tap="openPatientDetail(item.patientId)"
        >
          <view class="card-head">
            <view class="name-row">
              <text class="name">{{ item.name }}</text>
              <PatientContractBadge :item="item" />
              <text v-if="item.typeLabel" class="type-badge">{{ item.typeLabel }}</text>
              <text v-if="item.staffRemark" class="remark-badge">{{ item.staffRemark }}</text>
            </view>
            <text class="arrow">›</text>
          </view>
          <text class="mobile">{{ item.mobile || '未填写手机号' }}</text>
        </view>
      </view>
    </view>

    <!-- 咨询师管理 -->
    <view v-show="activeTab === 'counselors'" class="panel">
      <view class="search-bar">
        <input
          class="search-input"
          v-model="counselorKeyword"
          placeholder="搜索咨询师姓名"
          confirm-type="search"
          @confirm="loadCounselors"
        />
        <view class="search-btn" @tap="loadCounselors">搜索</view>
      </view>

      <view v-if="counselorLoading" class="empty">加载中...</view>
      <view v-else-if="counselors.length === 0" class="empty">暂无咨询师数据</view>
      <view v-else class="list">
        <view
          v-for="item in counselors"
          :key="item.counselorId"
          class="card"
          @tap="openCounselorDetail(item.counselorId)"
        >
          <view class="card-head">
            <view class="head-left">
              <image
                v-if="item.avatarUrl"
                :src="item.avatarUrl"
                class="avatar"
                mode="aspectFill"
              />
              <view v-else class="avatar placeholder">{{ item.name.slice(0, 1) }}</view>
              <view class="name-block">
                <view class="name-row">
                  <text class="name">{{ item.name }}</text>
                  <text v-if="item.typeLabel" class="type-badge">{{ item.typeLabel }}</text>
                  <text v-if="item.staffRemark" class="remark-badge">{{ item.staffRemark }}</text>
                </view>
                <text v-if="item.title" class="sub">{{ item.title }}</text>
              </view>
            </view>
            <text class="arrow">›</text>
          </view>
          <text v-if="item.missingRecordCount > 0" class="warn-tag solo">未填记录 {{ item.missingRecordCount }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import PatientContractBadge from '@/components/PatientContractBadge.vue'

interface PatientSummary {
  patientId: number
  name: string
  mobile?: string
  roleLabel?: string
  typeLabel?: string
  contractTag?: string | null
  isContractSigned?: boolean
  boundCounselorId?: number | null
  boundCounselorName?: string | null
  totalConsultations: number
  upcomingCount: number
  completedCount: number
  cancelledCount: number
  staffRemark?: string
}

interface CounselorSummary {
  counselorId: number
  name: string
  title?: string
  avatarUrl?: string
  roleLabel?: string
  typeLabel?: string
  activeBookingCount: number
  cancelledCount: number
  scheduleCount: number
  recordedCount: number
  missingRecordCount: number
  visitorCount: number
  billingYuan: number
  faceBillingYuan: number
  staffRemark?: string
}

const activeTab = ref<'patients' | 'counselors'>('patients')
const patientKeyword = ref('')
const counselorKeyword = ref('')
const patientLoading = ref(false)
const counselorLoading = ref(false)
const patients = ref<PatientSummary[]>([])
const counselors = ref<CounselorSummary[]>([])

const loadPatients = async () => {
  patientLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (patientKeyword.value.trim()) params.keyword = patientKeyword.value.trim()
    const res = await httpV2.get<PatientSummary[]>(API_ENDPOINTS.admin.patients, params)
    if (res.code === 0 && Array.isArray(res.data)) patients.value = res.data
  } finally {
    patientLoading.value = false
  }
}

const loadCounselors = async () => {
  counselorLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (counselorKeyword.value.trim()) params.keyword = counselorKeyword.value.trim()
    const res = await httpV2.get<CounselorSummary[]>(API_ENDPOINTS.admin.counselors, params)
    if (res.code === 0 && Array.isArray(res.data)) counselors.value = res.data
  } finally {
    counselorLoading.value = false
  }
}

const openPatientDetail = (patientId: number) => {
  uni.navigateTo({ url: `/pages/ops/patients/detail?patientId=${patientId}` })
}

const openCounselorDetail = (counselorId: number) => {
  uni.navigateTo({ url: `/pages/ops/counselors/detail?counselorId=${counselorId}` })
}

const refresh = () => {
  if (activeTab.value === 'patients') loadPatients()
  else loadCounselors()
}

onLoad((options) => {
  if (options?.tab === 'counselors') activeTab.value = 'counselors'
})

watch(activeTab, () => refresh())

onMounted(refresh)
onShow(refresh)
</script>

<style scoped>
.page-users { min-height: 100vh; background: #F7F5F2; padding: 32rpx; box-sizing: border-box; }
.header {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 24rpx;
}
.title { display: block; font-size: 36rpx; font-weight: 600; color: #fff; }
.subtitle { display: block; margin-top: 10rpx; font-size: 24rpx; color: rgba(255,255,255,0.82); }
.tab-scroll { width: 100%; margin-bottom: 24rpx; white-space: nowrap; }
.tab-bar { display: inline-flex; gap: 16rpx; padding: 4rpx; background: #fff; border-radius: 100rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); }
.tab-item {
  padding: 18rpx 40rpx;
  border-radius: 100rpx;
  font-size: 28rpx;
  color: #6B6560;
  flex-shrink: 0;
}
.tab-item.active { background: #3D5A4E; color: #fff; font-weight: 600; }
.search-bar { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.search-input {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
}
.search-btn {
  flex-shrink: 0;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  padding: 0 28rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
.empty { text-align: center; padding: 80rpx 0; color: #9CA3AF; font-size: 28rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}
.card:active { opacity: 0.92; }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  flex: 1;
  min-width: 0;
}
.name-block { flex: 1; min-width: 0; }
.type-badge {
  font-size: 22rpx;
  color: #6B6560;
  background: #F0EDE8;
  padding: 4rpx 14rpx;
  border-radius: 100rpx;
  white-space: nowrap;
  flex-shrink: 0;
}
.remark-badge {
  font-size: 22rpx;
  color: #3D5A4E;
  background: #E8F0EC;
  padding: 4rpx 14rpx;
  border-radius: 100rpx;
  max-width: 280rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}
.head-left { display: flex; align-items: center; gap: 16rpx; flex: 1; min-width: 0; }
.avatar { width: 72rpx; height: 72rpx; border-radius: 16rpx; flex-shrink: 0; }
.avatar.placeholder {
  background: #E8F0EC;
  color: #3D5A4E;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 700;
}
.name { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.sub { display: block; margin-top: 4rpx; font-size: 22rpx; color: #9CA3AF; }
.mobile { display: block; margin-top: 8rpx; font-size: 26rpx; color: #6B6560; }
.arrow { font-size: 36rpx; color: #C9A96E; flex-shrink: 0; }
.warn-tag.solo { display: inline-block; margin-top: 12rpx; font-size: 22rpx; color: #DC2626; background: #FEF2F2; padding: 6rpx 14rpx; border-radius: 8rpx; }
</style>
