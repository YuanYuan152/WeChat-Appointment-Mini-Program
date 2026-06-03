<template>
  <view class="modal-overlay" v-if="visible" @click="handleOverlayClick">
    <view class="modal-content" @click.stop>
      <!-- 关闭按钮 -->
      <view class="close-btn-wrapper">
        <text class="close-btn" @click="handleClose">×</text>
      </view>
      
      <!-- 标题区域 -->
      <view class="header-section">
        <text class="welcome-text">{{ isLoginMode ? '欢迎回来' : '创建账号' }}</text>
        <text class="subtitle">{{ isLoginMode ? '登录您的账号继续使用' : '填写信息完成注册' }}</text>
      </view>
      
      <!-- 表单区域 -->
      <view class="form-section">
        <!-- 手机号输入 -->
        <view class="input-group">
          <view class="input-label">
            <text class="label-icon">📱</text>
            <text class="label-text">手机号</text>
          </view>
          <input 
            class="input-field" 
            v-model="form.phone" 
            placeholder="请输入手机号" 
            type="number"
            maxlength="11"
          />
        </view>
        
        <!-- 验证码输入 -->
        <view class="input-group">
          <view class="input-label">
            <text class="label-icon">🔐</text>
            <text class="label-text">验证码</text>
          </view>
          <view class="verification-row">
            <input 
              class="input-field verification-input" 
              v-model="form.code" 
              placeholder="请输入6位验证码" 
              type="number"
              maxlength="6"
            />
            <button 
              class="get-code-btn" 
              :disabled="countdown > 0"
              @click="getVerificationCode"
            >
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </button>
          </view>
        </view>
        
        <!-- 密码输入（仅注册模式） -->
        <view class="input-group" v-if="!isLoginMode">
          <view class="input-label">
            <text class="label-icon">🔒</text>
            <text class="label-text">密码</text>
          </view>
          <view class="password-row">
            <input 
              class="input-field password-input" 
              v-model="form.password" 
              placeholder="请输入6-12位密码" 
              :type="passwordVisible ? 'text' : 'password'"
              maxlength="12"
            />
            <text 
              class="eye-icon" 
              @click="togglePasswordVisible"
            >
              {{ passwordVisible ? '👁️' : '🙈' }}
            </text>
          </view>
        </view>
        
        <!-- 确认密码（仅注册模式） -->
        <view class="input-group" v-if="!isLoginMode">
          <view class="input-label">
            <text class="label-icon">🔒</text>
            <text class="label-text">确认密码</text>
          </view>
          <input 
            class="input-field" 
            v-model="form.confirmPassword" 
            placeholder="请再次输入密码" 
            type="password"
            maxlength="12"
          />
        </view>
        
        <!-- 提交按钮 -->
        <button 
          class="submit-btn" 
          :disabled="!isFormValid"
          @click="handleSubmit"
        >
          <text class="btn-text">{{ isLoginMode ? '登录' : '注册' }}</text>
        </button>
        
        <!-- 切换模式 -->
        <view class="mode-switch">
          <text class="switch-text">
            {{ isLoginMode ? '还没有账号？' : '已有账号？' }}
          </text>
          <text 
            class="switch-link" 
            @click="switchMode"
          >
            {{ isLoginMode ? '立即注册' : '立即登录' }}
          </text>
        </view>
      </view>
      
      <!-- 底部装饰 -->
      <view class="footer-decoration">
        <view class="decoration-circle"></view>
        <view class="decoration-circle"></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { AuthApi } from '@/apis/auth'

interface Props {
  visible: boolean
  mode?: 'login' | 'register'
}

interface Emits {
  (e: 'close'): void
  (e: 'success', data: any): void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'login'
})

const emit = defineEmits<Emits>()

const isLoginMode = ref(props.mode === 'login')
const passwordVisible = ref(false)
const countdown = ref(0)

const form = ref({
  phone: '',
  code: '',
  password: '',
  confirmPassword: ''
})

// 表单验证
const isFormValid = computed(() => {
  if (isLoginMode.value) {
    return form.value.phone && form.value.code
  } else {
    return form.value.phone && 
           form.value.code && 
           form.value.password && 
           form.value.confirmPassword &&
           form.value.password === form.value.confirmPassword
  }
})

// 监听模式变化
watch(() => props.mode, (newMode) => {
  isLoginMode.value = newMode === 'register'
  resetForm()
})

// 重置表单
const resetForm = () => {
  form.value = {
    phone: '',
    code: '',
    password: '',
    confirmPassword: ''
  }
  passwordVisible.value = false
}

// 处理遮罩层点击
const handleOverlayClick = () => {
  handleClose()
}

// 关闭模态框
const handleClose = () => {
  resetForm()
  emit('close')
}

// 切换密码可见性
const togglePasswordVisible = () => {
  passwordVisible.value = !passwordVisible.value
}

// 切换登录/注册模式
const switchMode = () => {
  isLoginMode.value = !isLoginMode.value
  resetForm()
}

// 获取验证码
const getVerificationCode = async () => {
  if (!form.value.phone) {
    uni.showToast({
      title: '请先输入手机号',
      icon: 'none'
    })
    return
  }
  
  if (form.value.phone.length !== 11) {
    uni.showToast({
      title: '请输入正确的手机号',
      icon: 'none'
    })
    return
  }
  
  try {
    await AuthApi.sendVerificationCode({ phone: form.value.phone })
    uni.showToast({
      title: '验证码已发送',
      icon: 'success'
    })
    startCountdown()
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '发送失败，请重试',
      icon: 'none'
    })
  }
}

// 开始倒计时
const startCountdown = () => {
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

// 提交表单
const handleSubmit = async () => {
  if (!isFormValid.value) {
    uni.showToast({
      title: '请填写完整信息',
      icon: 'none'
    })
    return
  }
  
  if (isLoginMode.value) {
    await handleLogin()
  } else {
    await handleRegister()
  }
}

// 处理登录
const handleLogin = async () => {
  try {
    const result = await AuthApi.login({
      phone: form.value.phone,
      code: form.value.code
    })
    
    uni.showToast({
      title: '登录成功',
      icon: 'success'
    })
    emit('success', result)
    handleClose()
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '登录失败',
      icon: 'none'
    })
  }
}

// 处理注册
const handleRegister = async () => {
  if (form.value.password !== form.value.confirmPassword) {
    uni.showToast({
      title: '两次密码不一致',
      icon: 'none'
    })
    return
  }
  
  try {
    const result = await AuthApi.register({
      phone: form.value.phone,
      code: form.value.code,
      password: form.value.password
    })
    
    if (result) {
      uni.showToast({
        title: '注册成功',
        icon: 'success'
      })
      isLoginMode.value = true
      resetForm()
    }
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '注册失败',
      icon: 'none'
    })
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 20px;
  width: 90%;
  max-width: 420px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  position: relative;
}

.close-btn-wrapper {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 10;
}

.close-btn {
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.2);
  color: #374151;
}

.header-section {
  text-align: center;
  padding: 40px 30px 20px;
}

.welcome-text {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 8px;
}

.subtitle {
  display: block;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

.form-section {
  padding: 0 30px 30px;
}

.input-group {
  margin-bottom: 20px;
}

.input-label {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.label-icon {
  font-size: 16px;
  margin-right: 8px;
}

.label-text {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.input-field {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  background: #ffffff;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.input-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-field::placeholder {
  color: #9ca3af;
}

.verification-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.verification-input {
  flex: 1;
}

.get-code-btn {
  padding: 14px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
  min-width: 100px;
}

.get-code-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.get-code-btn:not(:disabled):hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.password-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.password-input {
  flex: 1;
}

.eye-icon {
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.eye-icon:hover {
  background: rgba(0, 0, 0, 0.05);
}

.submit-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
}

.submit-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-text {
  color: white;
}

.mode-switch {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.switch-text {
  font-size: 14px;
  color: #6b7280;
  margin-right: 8px;
}

.switch-link {
  font-size: 14px;
  color: #3b82f6;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.3s ease;
}

.switch-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

.footer-decoration {
  position: relative;
  height: 20px;
  overflow: hidden;
}

.decoration-circle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #e5e7eb;
  border-radius: 50%;
}

.decoration-circle:first-child {
  left: 20%;
  top: 50%;
  transform: translateY(-50%);
}

.decoration-circle:last-child {
  right: 20%;
  top: 50%;
  transform: translateY(-50%);
}

/* 响应式设计 */
@media (max-width: 480px) {
  .modal-content {
    width: 95%;
    margin: 20px;
  }
  
  .header-section {
    padding: 30px 20px 15px;
  }
  
  .form-section {
    padding: 0 20px 25px;
  }
  
  .welcome-text {
    font-size: 22px;
  }
}
</style> 