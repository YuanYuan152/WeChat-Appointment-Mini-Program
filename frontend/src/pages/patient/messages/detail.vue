<template>
  <view class="page-detail">
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="message" class="detail-card">
      <view class="detail-head">
        <text class="detail-title">{{ messageDisplayTitle(message) }}</text>
        <text class="detail-time">{{ formatTime(message.CreatedAt) }}</text>
      </view>

      <view v-if="relatedType === 'APPOINTMENT_NEW'" class="detail-body">
        <view class="detail-row">
          <text class="label">来访者</text>
          <text class="value">{{ detail.patientName }}</text>
        </view>
        <view class="detail-row">
          <text class="label">联系电话</text>
          <text class="value">{{ detail.patientPhone || '未填写' }}</text>
        </view>
        <view v-if="detail.emergencyContact" class="detail-row">
          <text class="label">紧急联系人</text>
          <text class="value">{{ detail.emergencyContact }} {{ detail.emergencyPhone }}</text>
        </view>
        <view class="detail-row">
          <text class="label">咨询师</text>
          <text class="value">{{ detail.counselorName }}</text>
        </view>
        <view class="detail-row">
          <text class="label">预约时间</text>
          <text class="value">{{ detail.startTime }}<text v-if="detail.endTime"> - {{ formatEndTime(detail.endTime) }}</text></text>
        </view>
        <view class="detail-row">
          <text class="label">预约地点</text>
          <text class="value">{{ detail.location }}</text>
        </view>
        <view v-if="detail.amountYuan" class="detail-row">
          <text class="label">支付金额</text>
          <text class="value">¥{{ detail.amountYuan }}</text>
        </view>
      </view>

      <view v-else-if="relatedType === 'APPOINTMENT_CANCEL'" class="detail-body">
        <view class="detail-row">
          <text class="label">来访者</text>
          <text class="value">{{ detail.patientName }}</text>
        </view>
        <view class="detail-row">
          <text class="label">联系电话</text>
          <text class="value">{{ detail.patientPhone || '未填写' }}</text>
        </view>
        <view v-if="detail.emergencyContact" class="detail-row">
          <text class="label">紧急联系人</text>
          <text class="value">{{ detail.emergencyContact }} {{ detail.emergencyPhone }}</text>
        </view>
        <view class="detail-row">
          <text class="label">咨询师</text>
          <text class="value">{{ detail.counselorName }}</text>
        </view>
        <view class="detail-row">
          <text class="label">原预约时间</text>
          <text class="value">{{ detail.startTime }}</text>
        </view>
        <view class="detail-row">
          <text class="label">预约地点</text>
          <text class="value">{{ detail.location }}</text>
        </view>
        <view class="detail-row">
          <text class="label">是否退款</text>
          <text class="value" :class="{ highlight: detail.refunded }">{{ detail.refundText }}</text>
        </view>
        <view class="detail-row">
          <text class="label">豁免申请</text>
          <text class="value">{{ detail.exemptionLabel }}</text>
        </view>
        <view v-if="detail.exemptionReason" class="detail-row">
          <text class="label">豁免原因</text>
          <text class="value">{{ detail.exemptionReason }}</text>
        </view>
      </view>

      <view v-else-if="isExemptionPending" class="detail-body">
        <view class="tip-box pending">
          <text class="tip-text">{{ exemptionPendingTip }}</text>
        </view>
        <view class="detail-row">
          <text class="label">审核状态</text>
          <text class="value pending-text">待审核</text>
        </view>
        <view v-if="detail.patientName" class="detail-row">
          <text class="label">来访者</text>
          <text class="value">{{ detail.patientName }}</text>
        </view>
        <view v-if="detail.counselorName" class="detail-row">
          <text class="label">咨询师</text>
          <text class="value">{{ detail.counselorName }}</text>
        </view>
        <view v-if="detail.amountYuan" class="detail-row">
          <text class="label">申请金额</text>
          <text class="value">¥{{ detail.amountYuan }}</text>
        </view>
        <view v-if="detail.reason" class="reason-box">
          <text class="reason-label">申请原因</text>
          <text class="reason-text">{{ detail.reason }}</text>
        </view>
        <view v-else class="reason-box">
          <text class="reason-text">{{ payload.summary || message.Content }}</text>
        </view>
      </view>

      <view v-else-if="relatedType === 'REFUND_EXEMPTION'" class="detail-body">
        <view class="detail-row">
          <text class="label">审核结果</text>
          <text class="value" :class="exemptionResultClass">{{ exemptionStatusLabel }}</text>
        </view>
        <view class="reason-box">
          <text class="reason-label">详情说明</text>
          <text class="reason-text">{{ detail.resultText || payload.summary || message.Content }}</text>
          <text v-if="detail.amountYuan" class="reason-text">退款金额：¥{{ detail.amountYuan }}</text>
          <text v-if="detail.rejectReason" class="reason-text">拒绝理由：{{ detail.rejectReason }}</text>
        </view>
      </view>

      <view v-else-if="isPatientMessage" class="detail-body">
        <view v-if="detail.tip" class="tip-box">
          <text class="tip-text">{{ detail.tip }}</text>
        </view>
        <view v-if="relatedType === 'PATIENT_NEW_ACTIVITY'" class="detail-row">
          <text class="label">活动名称</text>
          <text class="value">{{ detail.activityTitle }}</text>
        </view>
        <view v-if="detail.counselorName" class="detail-row">
          <text class="label">咨询师</text>
          <text class="value">{{ detail.counselorName }}</text>
        </view>
        <view v-if="detail.startTime" class="detail-row">
          <text class="label">预约时间</text>
          <text class="value">{{ detail.startTime }}<text v-if="detail.endTime"> - {{ formatEndTime(detail.endTime) }}</text></text>
        </view>
        <view v-if="detail.location" class="detail-row">
          <text class="label">{{ relatedType === 'PATIENT_APPOINTMENT_SUCCESS' ? '预约中心' : '预约地点' }}</text>
          <text class="value">{{ detail.centerName || detail.location }}</text>
        </view>
        <view v-if="relatedType === 'PATIENT_APPOINTMENT_CANCEL' || relatedType === 'PATIENT_LEAVE_APPROVED'" class="detail-row">
          <text class="label">退款说明</text>
          <text class="value" :class="{ highlight: detail.refunded }">{{ detail.refundText }}</text>
        </view>
        <view v-if="relatedType === 'PATIENT_LEAVE_APPROVED' && detail.leaveReason" class="detail-row">
          <text class="label">请假原因</text>
          <text class="value multiline">{{ detail.leaveReason }}</text>
        </view>
      </view>

      <view v-else-if="isCounselorMessage" class="detail-body">
        <view v-if="detail.tip" class="tip-box">
          <text class="tip-text">{{ detail.tip }}</text>
        </view>
        <view v-if="relatedType === 'COUNSELOR_LEAVE_SUBMITTED' || relatedType === 'COUNSELOR_LEAVE_SUCCESS'" class="detail-row">
          <text class="label">审核状态</text>
          <text class="value" :class="detail.status === 'PENDING' ? 'pending-text' : 'highlight'">
            {{ detail.statusLabel || (detail.status === 'PENDING' ? '待审核' : '已成功') }}
          </text>
        </view>
        <view v-if="detail.patientName" class="detail-row">
          <text class="label">来访者</text>
          <text class="value">{{ detail.patientName }}</text>
        </view>
        <view class="detail-row">
          <text class="label">{{ (relatedType === 'COUNSELOR_LEAVE_SUBMITTED' || relatedType === 'COUNSELOR_LEAVE_SUCCESS') ? '请假时段' : '咨询时间' }}</text>
          <text class="value">{{ detail.startTime }}<text v-if="detail.endTime"> - {{ formatEndTime(detail.endTime) }}</text></text>
        </view>
        <view class="detail-row">
          <text class="label">咨询地点</text>
          <text class="value">{{ detail.location }}</text>
        </view>
        <view v-if="(relatedType === 'COUNSELOR_LEAVE_SUBMITTED' || relatedType === 'COUNSELOR_LEAVE_SUCCESS') && detail.leaveReason" class="detail-row">
          <text class="label">请假原因</text>
          <text class="value multiline">{{ detail.leaveReason }}</text>
        </view>
        <view v-if="relatedType === 'COUNSELOR_APPOINTMENT_CANCEL'" class="detail-row">
          <text class="label">是否退款</text>
          <text class="value" :class="{ highlight: detail.refunded }">{{ detail.refundText }}</text>
        </view>
        <view v-if="relatedType === 'COUNSELOR_APPOINTMENT_CANCEL'" class="detail-row">
          <text class="label">豁免申请</text>
          <text class="value">{{ detail.exemptionLabel }}</text>
        </view>
      </view>

      <view v-else-if="relatedType === 'COUNSELOR_LEAVE'" class="detail-body">
        <view class="detail-row">
          <text class="label">咨询师</text>
          <text class="value">{{ detail.counselorName }}</text>
        </view>
        <view class="detail-row">
          <text class="label">请假时段</text>
          <text class="value">{{ detail.startTime }}<text v-if="detail.endTime"> - {{ formatEndTime(detail.endTime) }}</text></text>
        </view>
        <view class="detail-row">
          <text class="label">预约地点</text>
          <text class="value">{{ detail.location }}</text>
        </view>
        <view class="detail-row">
          <text class="label">请假原因</text>
          <text class="value multiline">{{ detail.leaveReason }}</text>
        </view>

        <view v-if="affectedList.length" class="section-title">涉及预约与来访联系方式</view>
        <view v-for="(appt, idx) in affectedList" :key="idx" class="sub-card">
          <view class="detail-row">
            <text class="label">来访者</text>
            <text class="value">{{ appt.patientName }}</text>
          </view>
          <view class="detail-row">
            <text class="label">联系电话</text>
            <text class="value">{{ appt.patientPhone || '未填写' }}</text>
          </view>
          <view v-if="appt.emergencyContact" class="detail-row">
            <text class="label">紧急联系人</text>
            <text class="value">{{ appt.emergencyContact }} {{ appt.emergencyPhone }}</text>
          </view>
          <view class="detail-row">
            <text class="label">预约时间</text>
            <text class="value">{{ appt.startTime }}</text>
          </view>
          <view class="detail-row">
            <text class="label">预约地点</text>
            <text class="value">{{ appt.location }}</text>
          </view>
          <view class="detail-row">
            <text class="label">退款说明</text>
            <text class="value">{{ appt.refundText }}</text>
          </view>
        </view>
      </view>

      <view v-else class="detail-body">
        <text class="fallback-text">{{ payload.summary || message.Content || '暂无详情' }}</text>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-title">无法加载消息</text>
      <text class="empty-desc">请返回后重试</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { COUNSELOR_MESSAGE_TYPES, PATIENT_MESSAGE_TYPES, isExemptionPendingMessage, messageDisplayTitle, parseMessageContent, type MessageItem } from '@/utils/message'

interface AffectedAppointment {
  patientName?: string
  patientPhone?: string
  emergencyContact?: string
  emergencyPhone?: string
  startTime?: string
  endTime?: string
  location?: string
  refundText?: string
}

const message = ref<MessageItem | null>(null)
const loading = ref(true)
const messageId = ref(0)

const payload = computed(() => parseMessageContent(message.value?.Content))
const detail = computed(() => (payload.value.detail || {}) as Record<string, any>)
const relatedType = computed(() => message.value?.RelatedType || '')
const isCounselorMessage = computed(() => COUNSELOR_MESSAGE_TYPES.has(relatedType.value))
const isPatientMessage = computed(() => PATIENT_MESSAGE_TYPES.has(relatedType.value))
const isExemptionPending = computed(() => {
  if (!message.value) return false
  return isExemptionPendingMessage(message.value)
})
const exemptionPendingTip = computed(() => {
  const text = detail.value.resultText as string | undefined
  if (text && text.includes('您的')) return text
  return '待审核：请在工作台「豁免申请审核」中选择对应申请后处理'
})
const exemptionStatusLabel = computed(() => {
  if (isExemptionPending.value) return '待审核'
  if (detail.value.status === 'APPROVED' || detail.value.approved === true) return '已通过'
  if (detail.value.status === 'REJECTED' || detail.value.approved === false) return '未通过'
  return '待审核'
})
const exemptionResultClass = computed(() => {
  if (exemptionStatusLabel.value === '已通过') return 'highlight'
  if (exemptionStatusLabel.value === '未通过') return 'rejected-text'
  return 'pending-text'
})
const affectedList = computed(() => {
  const list = detail.value.affectedAppointments
  return Array.isArray(list) ? (list as AffectedAppointment[]) : []
})

const formatTime = (dt?: string) => dt ? dt.slice(0, 16).replace('T', ' ') : ''

const formatEndTime = (value?: string) => {
  if (!value) return ''
  const text = value.replace('T', ' ')
  return text.length > 11 ? text.slice(11, 16) : text.slice(0, 16)
}

const markReadIfNeeded = async (item: MessageItem) => {
  if (item.IsRead) return
  await httpV2.put<MessageItem>(
    API_ENDPOINTS.message.markRead(item.Id),
    undefined,
    { showLoading: false, showError: false },
  )
}

const loadDetail = async () => {
  if (!messageId.value) return
  loading.value = true
  try {
    const res = await httpV2.get<MessageItem>(API_ENDPOINTS.message.detail(messageId.value))
    if (res.code === 0 && res.data) {
      message.value = res.data
      await markReadIfNeeded(res.data)
    }
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  messageId.value = Number(options?.id || 0)
  loadDetail()
})
</script>

<style scoped>
.page-detail {
  min-height: 100vh;
  background: #F4F6F8;
  padding: 28rpx;
}

.empty-state {
  background: #fff;
  border-radius: 28rpx;
  padding: 80rpx 40rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.empty-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #374151;
}

.empty-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #9CA3AF;
}

.loading-wrap {
  padding: 120rpx 0;
  text-align: center;
}

.loading-text {
  font-size: 28rpx;
  color: #9CA3AF;
}

.detail-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.detail-head {
  margin-bottom: 28rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.detail-title {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  color: #1F2937;
}

.detail-time {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-row {
  display: flex;
  gap: 24rpx;
}

.label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 26rpx;
  color: #9CA3AF;
}

.value {
  flex: 1;
  font-size: 28rpx;
  color: #1F2937;
  line-height: 1.6;
}

.value.multiline {
  white-space: pre-wrap;
}

.value.highlight {
  color: #0D9488;
  font-weight: 600;
}

.section-title {
  margin-top: 12rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #374151;
}

.sub-card {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.fallback-text {
  font-size: 28rpx;
  line-height: 1.8;
  color: #4B5563;
  white-space: pre-wrap;
}

.tip-box {
  background: #ECFDF5;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.tip-text {
  font-size: 26rpx;
  color: #047857;
  line-height: 1.6;
}

.tip-box.pending {
  background: #FFF7ED;
}

.tip-box.pending .tip-text {
  color: #C2410C;
}

.pending-text {
  color: #D97706;
  font-weight: 600;
}

.rejected-text {
  color: #DC2626;
  font-weight: 600;
}

.reason-box {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 24rpx;
}

.reason-label {
  display: block;
  font-size: 24rpx;
  color: #9CA3AF;
  margin-bottom: 10rpx;
}

.reason-text {
  display: block;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.7;
  margin-bottom: 8rpx;
}
</style>
