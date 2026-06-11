<template>
  <view class="page-activities">
    <view class="form-card">
      <view class="form-group">
        <text class="form-label">活动标题 *</text>
        <view class="input-wrap">
          <input class="input" v-model="form.title" placeholder="请输入标题" placeholder-class="input-ph" />
        </view>
      </view>

      <view class="form-group">
        <text class="form-label">活动类型</text>
        <picker :range="typeLabels" :value="typeIndex" @change="onTypeChange">
          <view class="picker-row">{{ typeLabels[typeIndex] }}</view>
        </picker>
      </view>

      <view class="form-group">
        <text class="form-label">封面 URL</text>
        <view class="input-wrap">
          <input class="input" v-model="form.cover_url" placeholder="选填" placeholder-class="input-ph" />
        </view>
      </view>

      <view class="form-group">
        <text class="form-label">活动内容</text>
        <textarea
          class="textarea"
          v-model="form.content"
          placeholder="请输入活动详情"
          placeholder-class="input-ph"
        />
      </view>

      <button class="save-btn" :loading="saving" @tap="save">发布活动</button>
    </view>

    <view v-for="item in list" :key="item.Id" class="item-card">
      <text class="title">{{ item.Title }}</text>
      <text class="desc">{{ item.Content || item.Type }}</text>
      <view class="actions">
        <text class="status">{{ item.IsActive ? '启用' : '停用' }}</text>
        <text class="delete" @tap="remove(item.Id)">删除</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const list = ref<any[]>([])
const saving = ref(false)
const form = ref({ title: '', type: 'NOTICE', cover_url: '', content: '' })

const typeOptions = [
  { label: '公告 NOTICE', value: 'NOTICE' },
  { label: '促销 PROMOTION', value: 'PROMOTION' },
  { label: '活动 EVENT', value: 'EVENT' },
]
const typeLabels = typeOptions.map(t => t.label)
const typeIndex = computed(() =>
  Math.max(0, typeOptions.findIndex(t => t.value === form.value.type))
)

const onTypeChange = (e: any) => {
  const idx = Number(e.detail.value)
  form.value.type = typeOptions[idx]?.value || 'NOTICE'
}

const load = async () => {
  const res = await httpV2.get<any[]>(API_ENDPOINTS.ops.activities)
  if (res.code === 0 && res.data) list.value = res.data
}

const save = async () => {
  if (!form.value.title) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.ops.activities, form.value)
    if (res.code === 0) {
      form.value = { title: '', type: 'NOTICE', cover_url: '', content: '' }
      await load()
      uni.showToast({ title: '已发布', icon: 'success' })
    }
  } finally {
    saving.value = false
  }
}

const remove = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定删除该活动吗？',
    success: async (res) => {
      if (!res.confirm) return
      await httpV2.delete(`${API_ENDPOINTS.ops.activities}/${id}`)
      await load()
    }
  })
}

onMounted(load)
</script>

<style scoped>
.page-activities { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.form-card, .item-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.form-group { margin-bottom: 20rpx; }
.form-label { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 10rpx; }
.input-wrap {
  width: 100%; box-sizing: border-box; background: #F9FAFB; border-radius: 16rpx;
  min-height: 88rpx; padding: 0 24rpx; display: flex; align-items: center;
}
.input {
  flex: 1; width: 100%; height: 88rpx; min-height: 88rpx; line-height: 88rpx;
  font-size: 28rpx; color: #1F2937; background: transparent; padding: 0; margin: 0;
  box-sizing: border-box;
}
.input-ph { color: #9CA3AF; font-size: 28rpx; }
.textarea, .picker-row {
  width: 100%; box-sizing: border-box; background: #F9FAFB; border-radius: 16rpx;
  padding: 20rpx 24rpx; font-size: 28rpx; color: #1F2937;
}
.textarea { min-height: 160rpx; line-height: 1.6; }
.picker-row { min-height: 88rpx; line-height: 88rpx; color: #374151; padding-top: 0; padding-bottom: 0; }
.save-btn {
  height: 82rpx; line-height: 82rpx; border: none; border-radius: 100rpx;
  background: #0D9488; color: #fff; font-size: 30rpx; font-weight: 800; margin-top: 8rpx;
}
.title { display: block; font-size: 30rpx; font-weight: 800; color: #1F2937; }
.desc { display: block; margin-top: 10rpx; font-size: 25rpx; color: #6B7280; line-height: 1.5; }
.actions { display: flex; justify-content: space-between; margin-top: 20rpx; }
.status { font-size: 24rpx; color: #10B981; }
.delete { font-size: 24rpx; color: #EF4444; }
</style>
