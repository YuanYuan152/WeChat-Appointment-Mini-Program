<template>
  <view class="page-ops-list">
    <view class="form-card">
      <input class="input" v-model="form.title" placeholder="文章标题" />
      <input class="input" v-model="form.category" placeholder="分类，如：文章/知识/公告" />
      <input class="input" v-model="form.cover_url" placeholder="封面图 URL" />
      <textarea class="textarea" v-model="form.summary" placeholder="摘要" />
      <textarea class="textarea content" v-model="form.content" placeholder="正文内容（支持富文本 HTML）" />
      <button class="save-btn" :loading="saving" @click="save">发布文章</button>
    </view>

    <view v-for="item in list" :key="item.id" class="item-card">
      <text class="title">{{ item.title }}</text>
      <text class="desc">{{ item.summary || item.category || '未填写摘要' }}</text>
      <view class="actions">
        <text class="status">{{ item.isActive ? '已发布' : '已停用' }}</text>
        <text class="delete" @click="remove(item.id)">删除</text>
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
const form = ref({ title: '', category: '文章', cover_url: '', summary: '', content: '' })

const load = async () => {
  const res = await httpV2.get<any>(API_ENDPOINTS.ops.articles)
  if (res.code === 0 && res.data) list.value = res.data.items || []
}

const save = async () => {
  if (!form.value.title) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const res = await httpV2.post(API_ENDPOINTS.ops.articles, form.value)
    if (res.code === 0) {
      form.value = { title: '', category: '文章', cover_url: '', summary: '', content: '' }
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
    content: '确定删除这篇文章吗？',
    success: async (res) => {
      if (!res.confirm) return
      await httpV2.delete(`${API_ENDPOINTS.ops.articles}/${id}`)
      await load()
    }
  })
}

onMounted(load)
</script>

<style scoped>
.page-ops-list { min-height: 100vh; background: #F4F6F8; padding: 28rpx; }
.form-card, .item-card {
  background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.input, .textarea {
  width: 100%; box-sizing: border-box; background: #F9FAFB; border-radius: 16rpx;
  padding: 20rpx 24rpx; font-size: 28rpx; color: #1F2937; margin-bottom: 18rpx;
}
.textarea { min-height: 120rpx; line-height: 1.6; }
.content { min-height: 220rpx; }
.save-btn {
  height: 82rpx; line-height: 82rpx; border: none; border-radius: 100rpx;
  background: #7C3AED; color: #fff; font-size: 30rpx; font-weight: 800;
}
.title { display: block; font-size: 30rpx; font-weight: 800; color: #1F2937; }
.desc { display: block; margin-top: 10rpx; font-size: 25rpx; color: #6B7280; line-height: 1.5; }
.actions { display: flex; justify-content: space-between; margin-top: 20rpx; }
.status { font-size: 24rpx; color: #10B981; }
.delete { font-size: 24rpx; color: #EF4444; }
</style>
