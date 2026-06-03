<template>
  <view class="page-activities">
    <view class="form-card">
      <input class="input" v-model="form.title" placeholder="活动/公告标题" />
      <input class="input" v-model="form.type" placeholder="类型 NOTICE / PROMOTION / EVENT" />
      <input class="input" v-model="form.cover_url" placeholder="封面 URL" />
      <textarea class="textarea" v-model="form.content" placeholder="活动内容" />
      <button class="save-btn" :loading="saving" @click="save">发布活动</button>
    </view>

    <view v-for="item in list" :key="item.Id" class="item-card">
      <text class="title">{{ item.Title }}</text>
      <text class="desc">{{ item.Content || item.Type }}</text>
      <view class="actions">
        <text class="status">{{ item.IsActive ? '启用' : '停用' }}</text>
        <text class="delete" @click="remove(item.Id)">删除</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'

const list = ref<any[]>([])
const saving = ref(false)
const form = ref({ title: '', type: 'NOTICE', cover_url: '', content: '' })

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
.input, .textarea {
  width: 100%; box-sizing: border-box; background: #F9FAFB; border-radius: 16rpx;
  padding: 20rpx 24rpx; font-size: 28rpx; color: #1F2937; margin-bottom: 18rpx;
}
.textarea { min-height: 160rpx; line-height: 1.6; }
.save-btn {
  height: 82rpx; line-height: 82rpx; border: none; border-radius: 100rpx;
  background: #0D9488; color: #fff; font-size: 30rpx; font-weight: 800;
}
.title { display: block; font-size: 30rpx; font-weight: 800; color: #1F2937; }
.desc { display: block; margin-top: 10rpx; font-size: 25rpx; color: #6B7280; line-height: 1.5; }
.actions { display: flex; justify-content: space-between; margin-top: 20rpx; }
.status { font-size: 24rpx; color: #10B981; }
.delete { font-size: 24rpx; color: #EF4444; }
</style>
