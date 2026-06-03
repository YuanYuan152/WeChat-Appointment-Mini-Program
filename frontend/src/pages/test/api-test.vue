<template>
  <view class="api-test-page">
    <view class="header">
      <text class="title">API接口测试</text>
      <text class="subtitle">测试后端接口连接状态</text>
    </view>

    <view class="test-section">
      <view class="section-title">接口测试</view>
      
      <!-- 首页数据测试 -->
      <view class="test-item">
        <view class="test-header">
          <text class="test-name">首页数据接口</text>
          <text :class="['test-status', homeTestStatus]">{{ homeTestStatusText }}</text>
        </view>
        <button class="test-btn" @click="testHomeApi" :disabled="homeTestLoading">
          {{ homeTestLoading ? '测试中...' : '测试接口' }}
        </button>
        <view v-if="homeTestResult" class="test-result">
          <text class="result-label">响应结果:</text>
          <text class="result-content">{{ homeTestResult }}</text>
        </view>
      </view>

      <!-- 搜索接口测试 -->
      <view class="test-item">
        <view class="test-header">
          <text class="test-name">搜索接口</text>
          <text :class="['test-status', searchTestStatus]">{{ searchTestStatusText }}</text>
        </view>
        <view class="test-input-group">
          <input 
            class="test-input" 
            v-model="searchKeyword" 
            placeholder="输入搜索关键词"
          />
          <button class="test-btn" @click="testSearchApi" :disabled="searchTestLoading">
            {{ searchTestLoading ? '搜索中...' : '测试搜索' }}
          </button>
        </view>
        <view v-if="searchTestResult" class="test-result">
          <text class="result-label">搜索结果:</text>
          <text class="result-content">{{ searchTestResult }}</text>
        </view>
      </view>

      <!-- 连接状态测试 -->
      <view class="test-item">
        <view class="test-header">
          <text class="test-name">连接状态</text>
          <text :class="['test-status', connectionStatus]">{{ connectionStatusText }}</text>
        </view>
        <button class="test-btn" @click="testConnection">
          测试连接
        </button>
        <view v-if="connectionResult" class="test-result">
          <text class="result-label">连接信息:</text>
          <text class="result-content">{{ connectionResult }}</text>
        </view>
      </view>

      <!-- API Test接口测试 -->
      <view class="test-item">
        <view class="test-header">
          <text class="test-name">API Test接口</text>
          <text :class="['test-status', apiTestStatus]">{{ apiTestStatusText }}</text>
        </view>
        <button class="test-btn" @click="testApiTest" :disabled="apiTestLoading">
          {{ apiTestLoading ? '测试中...' : '测试接口' }}
        </button>
        <view v-if="apiTestResult" class="test-result">
          <text class="result-label">响应结果:</text>
          <text class="result-content">{{ apiTestResult }}</text>
        </view>
      </view>

      <!-- 医生详情接口测试 -->
      <view class="test-item">
        <view class="test-header">
          <text class="test-name">医生详情接口</text>
          <text :class="['test-status', doctorDetailTestStatus]">{{ doctorDetailTestStatusText }}</text>
        </view>
        <view class="test-input-group">
          <input 
            class="test-input" 
            v-model="doctorId" 
            placeholder="输入医生ID (如: 1)"
            type="number"
          />
          <button class="test-btn" @click="testDoctorDetailApi" :disabled="doctorDetailTestLoading">
            {{ doctorDetailTestLoading ? '测试中...' : '测试接口' }}
          </button>
        </view>
        <view v-if="doctorDetailTestResult" class="test-result">
          <text class="result-label">响应结果:</text>
          <text class="result-content">{{ doctorDetailTestResult }}</text>
        </view>
        <view class="test-actions">
          <button class="test-btn test-btn-secondary" @click="goToDoctorDetail">
            跳转到医生详情页
          </button>
        </view>
      </view>
    </view>

    <view class="config-section">
      <view class="section-title">配置信息</view>
      <view class="config-item">
        <text class="config-label">后端地址:</text>
        <text class="config-value">{{ apiBaseUrl }}</text>
      </view>
      <view class="config-item">
        <text class="config-label">超时时间:</text>
        <text class="config-value">{{ timeout }}ms</text>
      </view>
      <view class="config-item">
        <text class="config-label">环境:</text>
        <text class="config-value">{{ environment }}</text>
      </view>
    </view>

    <view class="log-section">
      <view class="section-title">测试日志</view>
      <scroll-view class="log-content" scroll-y="true">
        <view v-for="(log, index) in testLogs" :key="index" class="log-item">
          <text class="log-time">{{ log.time }}</text>
          <text :class="['log-level', log.level]">{{ log.level }}</text>
          <text class="log-message">{{ log.message }}</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { homeApi, searchApi } from '@/apis'

// 响应式数据
const searchKeyword = ref('')
const doctorId = ref('')
const homeTestStatus = ref<'pending' | 'success' | 'error'>('pending')
const searchTestStatus = ref<'pending' | 'success' | 'error'>('pending')
const connectionStatus = ref<'pending' | 'success' | 'error'>('pending')
const apiTestStatus = ref<'pending' | 'success' | 'error'>('pending')
const doctorDetailTestStatus = ref<'pending' | 'success' | 'error'>('pending')
const homeTestLoading = ref(false)
const searchTestLoading = ref(false)
const apiTestLoading = ref(false)
const doctorDetailTestLoading = ref(false)
const homeTestResult = ref('')
const searchTestResult = ref('')
const connectionResult = ref('')
const apiTestResult = ref('')
const doctorDetailTestResult = ref('')
const testLogs = ref<Array<{ time: string; level: string; message: string }>>([])

// 配置信息
import { CURRENT_CONFIG } from '@/config/config'
const apiBaseUrl = CURRENT_CONFIG.API_BASE_URL
const timeout = CURRENT_CONFIG.API_TIMEOUT
const environment = import.meta.env.DEV ? 'development' : 'production'

// 状态文本
const homeTestStatusText = computed(() => {
  switch (homeTestStatus.value) {
    case 'success': return '成功'
    case 'error': return '失败'
    default: return '待测试'
  }
})

const searchTestStatusText = computed(() => {
  switch (searchTestStatus.value) {
    case 'success': return '成功'
    case 'error': return '失败'
    default: return '待测试'
  }
})

const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case 'success': return '已连接'
    case 'error': return '连接失败'
    default: return '未测试'
  }
})

const apiTestStatusText = computed(() => {
  switch (apiTestStatus.value) {
    case 'success': return '成功'
    case 'error': return '失败'
    default: return '待测试'
  }
})

const doctorDetailTestStatusText = computed(() => {
  switch (doctorDetailTestStatus.value) {
    case 'success': return '成功'
    case 'error': return '失败'
    default: return '待测试'
  }
})

// 添加日志
const addLog = (level: string, message: string) => {
  const time = new Date().toLocaleTimeString()
  testLogs.value.unshift({ time, level, message })
  
  // 限制日志数量
  if (testLogs.value.length > 50) {
    testLogs.value = testLogs.value.slice(0, 50)
  }
}

// 测试首页API
const testHomeApi = async () => {
  homeTestLoading.value = true
  homeTestStatus.value = 'pending'
  homeTestResult.value = ''
  
  addLog('INFO', '开始测试首页数据接口...')
  
  try {
    const result = await homeApi.getIndexData()
    homeTestStatus.value = 'success'
    homeTestResult.value = JSON.stringify(result, null, 2)
    addLog('SUCCESS', '首页数据接口测试成功')
  } catch (error: any) {
    homeTestStatus.value = 'error'
    homeTestResult.value = error.message || '请求失败'
    addLog('ERROR', `首页数据接口测试失败: ${error.message}`)
  } finally {
    homeTestLoading.value = false
  }
}

// 测试搜索API
const testSearchApi = async () => {
  if (!searchKeyword.value.trim()) {
    uni.showToast({
      title: '请输入搜索关键词',
      icon: 'none'
    })
    return
  }
  
  searchTestLoading.value = true
  searchTestStatus.value = 'pending'
  searchTestResult.value = ''
  
  addLog('INFO', `开始测试搜索接口，关键词: ${searchKeyword.value}`)
  
  try {
    const result = await searchApi.globalSearch(searchKeyword.value)
    searchTestStatus.value = 'success'
    searchTestResult.value = JSON.stringify(result, null, 2)
    addLog('SUCCESS', '搜索接口测试成功')
  } catch (error: any) {
    searchTestStatus.value = 'error'
    searchTestResult.value = error.message || '搜索失败'
    addLog('ERROR', `搜索接口测试失败: ${error.message}`)
  } finally {
    searchTestLoading.value = false
  }
}

// 测试连接
const testConnection = async () => {
  connectionStatus.value = 'pending'
  connectionResult.value = ''
  
  addLog('INFO', '开始测试后端连接...')
  
  try {
    const startTime = Date.now()
    const response = await fetch(`${apiBaseUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    if (response.ok) {
      connectionStatus.value = 'success'
      connectionResult.value = `连接成功，响应时间: ${responseTime}ms`
      addLog('SUCCESS', `后端连接测试成功，响应时间: ${responseTime}ms`)
    } else {
      connectionStatus.value = 'error'
      connectionResult.value = `连接失败，状态码: ${response.status}`
      addLog('ERROR', `后端连接测试失败，状态码: ${response.status}`)
    }
  } catch (error: any) {
    connectionStatus.value = 'error'
    connectionResult.value = `连接异常: ${error.message}`
    addLog('ERROR', `后端连接测试异常: ${error.message}`)
  }
}

// 测试API Test接口
const testApiTest = async () => {
  apiTestLoading.value = true
  apiTestStatus.value = 'pending'
  apiTestResult.value = ''
  
  addLog('INFO', '开始测试API Test接口...')
  
  try {
    const startTime = Date.now()
    const response = await fetch(`${apiBaseUrl}/api/test`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    if (response.ok) {
      const result = await response.json()
      apiTestStatus.value = 'success'
      apiTestResult.value = JSON.stringify(result, null, 2)
      addLog('SUCCESS', `API Test接口测试成功，响应时间: ${responseTime}ms`)
    } else {
      apiTestStatus.value = 'error'
      apiTestResult.value = `接口调用失败，状态码: ${response.status}`
      addLog('ERROR', `API Test接口测试失败，状态码: ${response.status}`)
    }
  } catch (error: any) {
    apiTestStatus.value = 'error'
    apiTestResult.value = `接口调用异常: ${error.message}`
    addLog('ERROR', `API Test接口测试异常: ${error.message}`)
  } finally {
    apiTestLoading.value = false
  }
}

// 测试医生详情接口
const testDoctorDetailApi = async () => {
  if (!doctorId.value) {
    uni.showToast({
      title: '请输入医生ID',
      icon: 'none'
    })
    return
  }

  doctorDetailTestLoading.value = true
  doctorDetailTestStatus.value = 'pending'
  doctorDetailTestResult.value = ''

  addLog('INFO', `开始测试医生详情接口，医生ID: ${doctorId.value}`)

  try {
    const response = await uni.request({
      url: `${apiBaseUrl}/api/frontend/GetDoctorDetail/${doctorId.value}`,
      method: 'GET'
    })

    if (response.statusCode === 200) {
      doctorDetailTestStatus.value = 'success'
      doctorDetailTestResult.value = JSON.stringify(response.data, null, 2)
      addLog('SUCCESS', '医生详情接口测试成功')
    } else {
      doctorDetailTestStatus.value = 'error'
      doctorDetailTestResult.value = `请求失败，状态码: ${response.statusCode}`
      addLog('ERROR', `医生详情接口测试失败，状态码: ${response.statusCode}`)
    }
  } catch (error: any) {
    doctorDetailTestStatus.value = 'error'
    doctorDetailTestResult.value = error.message || '请求失败'
    addLog('ERROR', `医生详情接口测试失败: ${error.message}`)
  } finally {
    doctorDetailTestLoading.value = false
  }
}

// 跳转到医生详情页
const goToDoctorDetail = () => {
  if (doctorId.value) {
    uni.navigateTo({
      url: `/pages/consultant/detail?id=${doctorId.value}`
    })
  } else {
    uni.showToast({
      title: '请先输入医生ID',
      icon: 'none'
    })
  }
}

// 生命周期
onMounted(() => {
  addLog('INFO', 'API测试页面已加载')
  addLog('INFO', `后端地址: ${apiBaseUrl}`)
})
</script>

<style scoped>
.api-test-page {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #666;
}

.test-section,
.config-section,
.log-section {
  background-color: #fff;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.test-item {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.test-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.test-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.test-status.pending {
  background-color: #f0f0f0;
  color: #666;
}

.test-status.success {
  background-color: #e8f5e8;
  color: #52c41a;
}

.test-status.error {
  background-color: #fff2f0;
  color: #ff4d4f;
}

.test-btn {
  background-color: #1890ff;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.test-btn:disabled {
  background-color: #d9d9d9;
  cursor: not-allowed;
}

.test-input-group {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.test-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
}

.test-result {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.result-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 8px;
}

.result-content {
  font-size: 12px;
  color: #666;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.test-actions {
  margin-top: 15px;
  display: flex;
  justify-content: flex-start;
  gap: 10px;
}

.test-btn-secondary {
  background-color: #6c757d;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.test-btn-secondary:disabled {
  background-color: #d9d9d9;
  cursor: not-allowed;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.config-item:last-child {
  border-bottom: none;
}

.config-label {
  font-size: 14px;
  color: #666;
}

.config-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.log-content {
  max-height: 300px;
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: #999;
  min-width: 80px;
}

.log-level {
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

.log-level.INFO {
  background-color: #e6f7ff;
  color: #1890ff;
}

.log-level.SUCCESS {
  background-color: #f6ffed;
  color: #52c41a;
}

.log-level.ERROR {
  background-color: #fff2f0;
  color: #ff4d4f;
}

.log-message {
  color: #333;
  flex: 1;
}
</style> 