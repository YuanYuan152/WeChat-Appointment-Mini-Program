<template>
  <view class="page-consultant-list">
    <!-- 顶部固定区域 (包含导航栏和搜索栏) -->
    <view class="header-fixed-area">
      <!-- 自定义导航栏 -->
      <view class="custom-navbar" :style="{ paddingTop: statusBarPx + 'px' }">
        <view class="navbar-content">
          <view class="nav-title">预约咨询师</view>
        </view>
      </view>

      <!-- 搜索栏 -->
      <view class="search-section">
        <view class="search-bar-modern">
          <image src="/static/images/seI.png" class="search-icon" mode="aspectFit" />
          <input 
            class="search-input" 
            placeholder="搜索咨询师姓名、地区、专业" 
            placeholder-class="search-placeholder"
            v-model="searchKeyword"
            @confirm="handleSearch"
          />
          <view v-if="searchKeyword" class="clear-icon" @click="clearSearch">×</view>
        </view>
      </view>

      <!-- 筛选栏 -->
      <view class="filter-section">
        <view class="filter-bar">
          <view 
            class="filter-item" 
            :class="{ active: activeFilter === 'sort' }"
            @click="toggleFilter('sort')"
          >
            <text class="filter-text">{{ currentSortLabel }}</text>
            <view class="filter-chevron" :class="{ up: activeFilter === 'sort' }" />
          </view>
          <view 
            class="filter-item" 
            :class="{ active: activeFilter === 'city' }"
            @click="toggleFilter('city')"
          >
            <text class="filter-text">{{ currentCityLabel }}</text>
            <view class="filter-chevron" :class="{ up: activeFilter === 'city' }" />
          </view>
          <view 
            class="filter-item" 
            :class="{ active: activeFilter === 'price' }"
            @click="toggleFilter('price')"
          >
            <text class="filter-text">{{ currentPriceLabel }}</text>
            <view class="filter-chevron" :class="{ up: activeFilter === 'price' }" />
          </view>
          <view 
            class="filter-item" 
            :class="{ active: activeFilter === 'more' }"
            @click="toggleFilter('more')"
          >
            <text class="filter-text">筛选</text>
            <view class="filter-chevron" :class="{ up: activeFilter === 'more' }" />
          </view>
        </view>

        <!-- 筛选下拉面板 -->
        <view class="filter-dropdown" :class="{ show: activeFilter }">
          <!-- 综合排序 -->
          <view v-if="activeFilter === 'sort'" class="dropdown-list">
            <view 
              class="dropdown-item" 
              v-for="(item, index) in sortOptions" 
              :key="index"
              :class="{ selected: currentSort === item.value }"
              @click="selectSort(item)"
            >
              <text>{{ item.label }}</text>
              <text v-if="currentSort === item.value" class="check-icon">✓</text>
            </view>
          </view>

          <!-- 城市选择 -->
          <view v-if="activeFilter === 'city'" class="dropdown-list">
            <view 
              class="dropdown-item" 
              v-for="(item, index) in cityOptions" 
              :key="index"
              :class="{ selected: currentCity === item.value }"
              @click="selectCity(item)"
            >
              <text>{{ item.label }}</text>
              <text v-if="currentCity === item.value" class="check-icon">✓</text>
            </view>
          </view>

          <!-- 价格区间 -->
          <view v-if="activeFilter === 'price'" class="dropdown-list">
            <view 
              class="dropdown-item" 
              v-for="(item, index) in priceOptions" 
              :key="index"
              :class="{ selected: currentPrice === item.value }"
              @click="selectPrice(item)"
            >
              <text>{{ item.label }}</text>
              <text v-if="currentPrice === item.value" class="check-icon">✓</text>
            </view>
          </view>

          <!-- 更多筛选 -->
          <view v-if="activeFilter === 'more'" class="dropdown-panel">
            <view class="panel-group">
              <text class="panel-title">咨询方式</text>
              <view class="panel-tags">
                <view 
                  class="panel-tag" 
                  v-for="(item, index) in methodOptions" 
                  :key="index"
                  :class="{ active: currentMethod === item.value }"
                  @click="currentMethod = item.value"
                >
                  {{ item.label }}
                </view>
              </view>
            </view>
            <view class="panel-group">
              <text class="panel-title">咨询师性别</text>
              <view class="panel-tags">
                <view 
                  class="panel-tag" 
                  v-for="(item, index) in genderOptions" 
                  :key="index"
                  :class="{ active: currentGender === item.value }"
                  @click="currentGender = item.value"
                >
                  {{ item.label }}
                </view>
              </view>
            </view>
            <view class="panel-actions">
              <button class="btn-reset" @click="resetMoreFilter">重置</button>
              <button class="btn-confirm" @click="confirmMoreFilter">确定</button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 遮罩仅覆盖头部以下区域，避免压在筛选栏文字上 -->
    <view
      v-if="activeFilter"
      class="filter-dropdown-mask"
      :style="{ top: headerPlaceholderPx + 'px' }"
      @tap="closeFilter"
    />

    <!-- 占位符，防止内容被固定头部遮挡 -->
    <view class="header-placeholder" :style="{ height: headerPlaceholderPx + 'px' }"></view>

    <!-- 咨询师列表（页面级滚动，避免 scroll-view 高度问题） -->
    <view class="list-scroll">
      <view class="doctor-list-modern">
        <view 
          class="doc-card" 
          v-for="doctor in doctors" 
          :key="doctor.id"
          @click="goToDetail(doctor.id)"
        >
          <view class="doc-card-top">
            <view class="doc-avatar-wrap">
              <image 
                :src="doctor.avatar || '/static/images/tc59.png'" 
                class="doc-avatar" 
                mode="aspectFill" 
                @error="handleImageError"
              />
              <view class="doc-status" :class="doctor.status === '可预约' ? 'online' : 'busy'"></view>
            </view>
            
            <view class="doc-info">
              <view class="doc-name-row">
                <text class="doc-name">{{ doctor.name }}</text>
                <text class="doc-title">{{ doctor.title || '心理咨询师' }}</text>
              </view>
              
              <view class="doc-stats">
                <text class="stat-text">从业{{ doctor.workYears || 0 }}年</text>
                <text class="stat-dot">·</text>
                <text class="stat-text">{{ doctor.consultHours || 1000 }}小时+</text>
                <text class="stat-dot">·</text>
                <text class="stat-text">{{ doctor.province || '上海' }}</text>
              </view>
              
              <view class="doc-tags">
                <text class="doc-tag" v-for="(tag, idx) in getSpecialties(doctor.specialty)" :key="idx">
                  {{ tag }}
                </text>
              </view>
            </view>
          </view>
          
          <view class="doc-card-bottom">
            <view class="doc-price-box">
              <template v-if="doctor.priceNegotiation">
                <text class="price-num">议价</text>
                <text class="price-unit">/50分钟</text>
              </template>
              <template v-else>
                <text class="price-symbol">￥</text>
                <text class="price-num">{{ doctor.price || 500 }}</text>
                <text class="price-unit">/50分钟</text>
              </template>
            </view>
            <view class="doc-card-actions">
              <button class="assistant-btn" @click.stop="openAssistantContact">联系助理</button>
              <button class="book-btn" @click.stop="goToDetail(doctor.id)">立即预约</button>
            </view>
          </view>
        </view>

        <!-- 加载状态 -->
        <view class="loading-state">
          <text v-if="loading">加载中...</text>
          <text v-else-if="!hasMore && doctors.length > 0">没有更多了</text>
          <view v-else-if="doctors.length === 0 && !loading" class="empty-box">
            <image src="/static/images/place12.png" class="empty-img" mode="aspectFit" />
            <text class="empty-text">暂无符合条件的咨询师</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 联系助理 -->
    <view v-if="showAssistantContact" class="modal-overlay" @tap="closeAssistantContact">
      <view class="modal-content bottom-sheet" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">联系助理</text>
          <view class="modal-close" @click="closeAssistantContact">×</view>
        </view>
        <view class="modal-body">
          <ContactUsContent :show-centers="false" compact />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { doctorApi } from '@/apis/index'
import type { Doctor } from '@/types'
import { fixImageUrl } from '@/utils/image'
import { getMockConsultantFilterMetaResponse } from '@/mocks/bookingDemo'
import ContactUsContent from '@/components/ContactUsContent.vue'

// 咨询师数据接口扩展
interface Consultant extends Omit<Doctor, 'province'> {
  title?: string
  workYears?: number
  consultHours?: number
  consultationType?: string
  province?: string
  description?: string
  price?: number
  priceNegotiation?: boolean
  billingLabel?: string
  _source?: string
}

// 响应式数据
const _sys = uni.getSystemInfoSync()
const consultants = ref<Consultant[]>([])
const loading = ref(false)
const hasMore = ref(true)
const searchKeyword = ref('')
const showAssistantContact = ref(false)
const statusBarPx = ref(_sys.statusBarHeight || 0)
const headerPlaceholderPx = ref((_sys.statusBarHeight || 0) + uni.upx2px(88 + 124 + 88))

// 筛选栏（选项在 mock 时来自 getMockConsultantFilterMetaResponse；非 mock 用同结构默认项）
const activeFilter = ref<'sort' | 'city' | 'price' | 'more' | ''>('')
const sortOptions = ref<{ label: string; value: string }[]>([])
const cityOptions = ref<{ label: string; value: string }[]>([])
const priceOptions = ref<{ label: string; value: string }[]>([])
const methodOptions = ref<{ label: string; value: string }[]>([])
const genderOptions = ref<{ label: string; value: string }[]>([])

const currentSort = ref('default')
const currentCity = ref('')
const currentPrice = ref('')
const currentMethod = ref('')
const currentGender = ref('')

const currentSortLabel = computed(() => {
  const hit = sortOptions.value.find((o) => o.value === currentSort.value)
  return hit?.label || '综合排序'
})
const currentCityLabel = computed(() => {
  const hit = cityOptions.value.find((o) => o.value === currentCity.value)
  return hit?.label || '城市'
})
const currentPriceLabel = computed(() => {
  const hit = priceOptions.value.find((o) => o.value === currentPrice.value)
  return hit?.label || '价格'
})

function initFilterOptionsFromMeta() {
  const meta = getMockConsultantFilterMetaResponse().data!
  sortOptions.value = meta.sortOptions
  cityOptions.value = meta.provinces
  priceOptions.value = meta.priceRanges
  methodOptions.value = meta.consultationMethods
  genderOptions.value = meta.genders
}

const toggleFilter = (key: 'sort' | 'city' | 'price' | 'more') => {
  activeFilter.value = activeFilter.value === key ? '' : key
}
const closeFilter = () => {
  activeFilter.value = ''
}
const selectSort = (item: { label: string; value: string }) => {
  currentSort.value = item.value
  closeFilter()
  fetchConsultants()
}
const selectCity = (item: { label: string; value: string }) => {
  currentCity.value = item.value
  closeFilter()
  fetchConsultants()
}
const selectPrice = (item: { label: string; value: string }) => {
  currentPrice.value = item.value
  closeFilter()
  fetchConsultants()
}
const resetMoreFilter = () => {
  currentMethod.value = ''
  currentGender.value = ''
}
const confirmMoreFilter = () => {
  closeFilter()
  fetchConsultants()
}

const handleSearch = () => {
  fetchConsultants()
}
const clearSearch = () => {
  searchKeyword.value = ''
  fetchConsultants()
}

function getSpecialties(specialty: string | undefined) {
  if (!specialty) return []
  return specialty.split(/[|｜,，]/).map((s) => s.trim()).filter(Boolean)
}

// 计算属性：过滤后的咨询师列表
const filteredConsultants = computed(() => {
  if (!searchKeyword.value.trim()) {
    return consultants.value
  }
  
  const keyword = searchKeyword.value.toLowerCase()
  return consultants.value.filter(consultant => 
    consultant.name.toLowerCase().includes(keyword) ||
    (consultant.specialty || '').toLowerCase().includes(keyword) ||
    consultant.description?.toLowerCase().includes(keyword) ||
    consultant.province?.toLowerCase().includes(keyword)
  )
})

// 与模板中 v-for="doctor in doctors" 对齐
const doctors = computed(() => filteredConsultants.value)

function parseWorkYears(item: { workYears?: number; experience?: string }) {
  if (item.workYears != null) return item.workYears
  const m = String(item.experience || '').match(/\d+/)
  return m ? Number(m[0]) : 0
}

function normalizeConsultant(item: Consultant): Consultant {
  return {
    ...item,
    avatar: fixImageUrl(item.avatar || '/static/images/tc59.png'),
    title: item.title || '心理咨询师',
    workYears: parseWorkYears(item),
    consultHours: item.consultHours ?? 0,
    province: item.province || '线下/线上',
    description: item.description || '暂无介绍',
    price: item.price || 500,
  }
}

// 获取咨询师列表
const fetchConsultants = async () => {
  loading.value = true
  try {
    const response = await doctorApi.getList(
      {
        keyword: searchKeyword.value.trim() || undefined,
        province: currentCity.value || undefined,
        page: 1,
        pageSize: 50,
        priceRange: currentPrice.value || undefined,
        sort: currentSort.value || undefined,
        gender: currentGender.value || undefined,
        consultMethod: currentMethod.value || undefined,
      },
      { showLoading: false, showError: false, timeout: 20000 },
    )

    if (response.code !== 0) {
      throw new Error(response.msg || '加载失败')
    }

    const doctorsList = response.data?.list || []
    consultants.value = doctorsList.map((item) => normalizeConsultant(item))
    hasMore.value = doctorsList.length >= 50
  } catch (error) {
    console.error('获取咨询师列表失败:', error)
    consultants.value = []
    uni.showToast({ title: '加载失败，请确认后端已启动', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function initPageLayout() {
  const systemInfo = uni.getSystemInfoSync()
  const sb = systemInfo.statusBarHeight || 0
  statusBarPx.value = sb
  headerPlaceholderPx.value = sb + uni.upx2px(88 + 124 + 88)
}



// 搜索输入处理
const onSearchInput = () => {
  // 实时搜索，这里可以根据需要添加防抖
}

// 加载更多
const loadMore = () => {
  if (loading.value || !hasMore.value) return
  // 这里可以实现分页加载更多
  hasMore.value = false
}

// 跳转到详情页（模板传入 doctor.id）
const goToDetail = (id: number | string) => {
  const doctor = consultants.value.find((d) => d.id === id)
  const source = doctor?._source ? `&source=${encodeURIComponent(doctor._source)}` : ''
  uni.navigateTo({
    url: `/pages/consultant/detail?id=${id}${source}`
  })
}

const openAssistantContact = () => {
  showAssistantContact.value = true
}

const closeAssistantContact = () => {
  showAssistantContact.value = false
}

// 图片加载错误处理
const handleImageError = (e: any) => {
  console.error('图片加载失败:', e)
  console.log('图片路径:', e.target?.src)
  console.log('图片元素:', e.target)
  
  // 可以在这里设置默认头像
  if (e.target) {
    e.target.src = '/static/images/default-doctor.png'
  }
}

// 图片加载成功处理
const handleImageLoad = (e: any) => {
  console.log('图片加载成功:', e.target?.src)
}



// 生命周期
onMounted(() => {
  initPageLayout()
  initFilterOptionsFromMeta()
})

onShow(() => {
  initPageLayout()
  fetchConsultants()
})

onReachBottom(loadMore)

onPullDownRefresh(async () => {
  await fetchConsultants()
  uni.stopPullDownRefresh()
})
</script>

<style>
/* 顶级设计系统变量与重置 */
.page-consultant-list {
  min-height: 100vh;
  background-color: #F7F5F2;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 顶部固定区域 */
.header-fixed-area {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #F7F5F2;
}

/* 自定义导航栏 */
.custom-navbar {
  background: linear-gradient(135deg, #3D5A4E 0%, #4A6B5D 100%);
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  padding: 0 32rpx;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}

/* 搜索栏 */
.search-section {
  background: linear-gradient(135deg, #3D5A4E 0%, #4A6B5D 100%);
  padding: 16rpx 32rpx 32rpx;
  border-radius: 0 0 48rpx 48rpx;
}

.search-bar-modern {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  height: 76rpx;
  border-radius: 100rpx;
  padding: 0 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.search-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 16rpx;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 28rpx;
  color: #1F2937;
}

.search-placeholder {
  color: #9CA3AF;
}

.clear-icon {
  width: 40rpx;
  height: 40rpx;
  background: #E5E7EB;
  color: #6B7280;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  line-height: 1;
  margin-left: 16rpx;
}

/* 筛选栏 */
.filter-section {
  position: relative;
  background: #ffffff;
  z-index: 1;
  margin: 0 32rpx;
  border-radius: 32rpx 32rpx 0 0;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.02);
}

.filter-bar {
  display: flex;
  height: 88rpx;
  border-bottom: 1px solid #F3F4F6;
  position: relative;
  z-index: 2;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
}

.filter-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.filter-text {
  font-size: 28rpx;
  color: #4B5563;
  font-weight: 500;
  transition: color 0.2s;
}

.filter-chevron {
  width: 0;
  height: 0;
  border-left: 7rpx solid transparent;
  border-right: 7rpx solid transparent;
  border-top: 8rpx solid #9CA3AF;
  flex-shrink: 0;
  transition: transform 0.25s ease, border-top-color 0.2s;
}

.filter-chevron.up {
  transform: rotate(180deg);
}

.filter-item.active .filter-text {
  color: #3D5A4E;
}

.filter-item.active .filter-chevron {
  border-top-color: #3D5A4E;
}

/* 筛选下拉面板 */
.filter-dropdown-mask {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 98;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.filter-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #ffffff;
  z-index: 3;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 0 0 24rpx 24rpx;
}

.filter-dropdown.show {
  max-height: 800rpx;
  box-shadow: 0 12rpx 24rpx rgba(0, 0, 0, 0.06);
  border-top: 1px solid #F3F4F6;
}

.dropdown-list {
  padding: 16rpx 0;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 40rpx;
  font-size: 28rpx;
  color: #4B5563;
  border-bottom: 1px solid #F9FAFB;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item.selected {
  color: #3D5A4E;
  font-weight: 600;
  background: #F0EDE8;
}

.check-icon {
  color: #3D5A4E;
  font-size: 32rpx;
  font-weight: bold;
}

.dropdown-panel {
  padding: 32rpx 40rpx;
}

.panel-group {
  margin-bottom: 40rpx;
}

.panel-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 24rpx;
}

.panel-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.panel-tag {
  padding: 12rpx 32rpx;
  background: #F3F4F6;
  color: #4B5563;
  border-radius: 100rpx;
  font-size: 26rpx;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.panel-tag.active {
  background: #F0EDE8;
  color: #3D5A4E;
  border-color: #3D5A4E;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 16rpx;
}

.btn-reset {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #F3F4F6;
  color: #4B5563;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 100rpx;
  border: none;
}

.btn-confirm {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #3D5A4E;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 100rpx;
  border: none;
}

/* 占位符高度由 headerPlaceholderPx 动态设置 */
.header-placeholder {
  width: 100%;
}

/* 列表区域 */
.list-scroll {
  width: 100%;
}

.doctor-list-modern {
  padding: 24rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.doc-card {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.03);
  transition: transform 0.2s;
}

.doc-card:active {
  transform: scale(0.98);
}

.doc-card-top {
  display: flex;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.doc-avatar-wrap {
  position: relative;
  width: 140rpx;
  height: 140rpx;
  flex-shrink: 0;
}

.doc-avatar {
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
  background: #F3F4F6;
  object-fit: cover;
}

.doc-status {
  position: absolute;
  right: -6rpx;
  bottom: -6rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  border: 4rpx solid #ffffff;
}

.doc-status.online { background: #10B981; }
.doc-status.busy { background: #F59E0B; }

.doc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.doc-name-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.doc-name {
  font-size: 34rpx;
  font-weight: 800;
  color: #1F2937;
}

.doc-title {
  font-size: 24rpx;
  color: #6B7280;
  background: #F3F4F6;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.doc-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16rpx;
}

.stat-text {
  font-size: 24rpx;
  color: #6B7280;
}

.stat-dot {
  font-size: 24rpx;
  color: #D1D5DB;
  margin: 0 8rpx;
}

.doc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.doc-tag {
  font-size: 22rpx;
  color: #3D5A4E;
  background: #F0EDE8;
  padding: 6rpx 16rpx;
  border-radius: 100rpx;
}

.doc-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24rpx;
  border-top: 1px dashed #E5E7EB;
}

.doc-card-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.doc-price-box {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 24rpx;
  color: #F59E0B;
  font-weight: 700;
}

.price-num {
  font-size: 40rpx;
  color: #F59E0B;
  font-weight: 800;
}

.price-unit {
  font-size: 22rpx;
  color: #9CA3AF;
  margin-left: 4rpx;
}

.assistant-btn {
  background: #fff;
  color: #3D5A4E;
  font-size: 22rpx;
  font-weight: 600;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  border-radius: 100rpx;
  margin: 0;
  border: 2rpx solid #3D5A4E;
}

.assistant-btn::after {
  border: none;
}

.book-btn {
  background: #3D5A4E;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 600;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 28rpx;
  border-radius: 100rpx;
  margin: 0;
  box-shadow: 0 4rpx 12rpx rgba(61, 90, 78, 0.25);
}

.book-btn::after {
  border: none;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10050;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.modal-content.bottom-sheet {
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  max-height: 85vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1F2937;
}

.modal-close {
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  font-size: 40rpx;
  color: #9CA3AF;
}

.modal-body {
  padding: 0 32rpx calc(32rpx + env(safe-area-inset-bottom));
  max-height: 70vh;
  overflow-y: auto;
}

/* 加载状态 */
.loading-state {
  padding: 40rpx 0;
  text-align: center;
}

.loading-state text {
  font-size: 26rpx;
  color: #9CA3AF;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-img {
  width: 240rpx;
  height: 240rpx;
  margin-bottom: 24rpx;
  opacity: 0.6;
}

.empty-text {
  font-size: 28rpx;
  color: #6B7280;
}
</style>