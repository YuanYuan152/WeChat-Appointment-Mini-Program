<template>
  <view class="page-themes">
    <view class="page-header">
      <text class="page-title">主题月管理</text>
      <text class="page-tip">主题月统一以 AppActivity.type=THEME 存储，前端在 /pages/theme/index 直接读取展示。</text>
    </view>

    <view class="form-card">
      <text class="form-section">{{ editingId ? '编辑主题月' : '新建主题月' }}</text>
      <input class="input" v-model="form.title" placeholder="主题月标题（如：5 月 · 情绪管理）" />
      <input class="input" v-model="form.cover_url" placeholder="封面图 URL（建议绝对地址或 /static/...）" />
      <textarea class="textarea" v-model="form.content" placeholder="主题月介绍 / 当月议程，支持中文" />

      <view class="form-row">
        <view class="form-col">
          <text class="form-label">开始</text>
          <picker mode="date" :value="form.start_at" @change="(e: any) => form.start_at = e.detail.value">
            <view class="picker">{{ form.start_at || '请选择' }}</view>
          </picker>
        </view>
        <view class="form-col">
          <text class="form-label">结束</text>
          <picker mode="date" :value="form.end_at" @change="(e: any) => form.end_at = e.detail.value">
            <view class="picker">{{ form.end_at || '请选择' }}</view>
          </picker>
        </view>
      </view>

      <view class="form-row">
        <view class="form-col">
          <text class="form-label">排序</text>
          <input class="input small" v-model.number="form.sort_order" type="number" placeholder="0" />
        </view>
        <view class="form-col switch-col">
          <text class="form-label">启用</text>
          <switch :checked="form.is_active" color="#0D9488" @change="(e: any) => form.is_active = e.detail.value" />
        </view>
      </view>

      <view class="form-actions">
        <button class="btn primary" :loading="saving" @click="save">{{ editingId ? '保存修改' : '发布主题月' }}</button>
        <button v-if="editingId" class="btn ghost" @click="resetForm">取消编辑</button>
      </view>
    </view>

    <view class="list-section">
      <view class="list-header">
        <text class="list-title">已发布主题月（{{ list.length }}）</text>
        <text class="refresh" @click="load">刷新</text>
      </view>

      <view v-if="loading" class="empty"><text class="empty-text">加载中...</text></view>
      <view v-else-if="list.length === 0" class="empty"><text class="empty-text">暂无主题月，可在上方新建</text></view>
      <view v-else>
        <view v-for="item in list" :key="item.Id" class="item-card">
          <view class="item-cover" :style="item.CoverUrl ? `background-image:url(${normalizeImg(item.CoverUrl)})` : ''">
            <text v-if="!item.IsActive" class="item-badge inactive">已停用</text>
            <text v-else-if="isOngoing(item)" class="item-badge ongoing">进行中</text>
            <text v-else class="item-badge ended">已结束</text>
          </view>
          <view class="item-body">
            <text class="item-title">{{ item.Title }}</text>
            <text class="item-time">{{ formatDate(item.StartAt) }} - {{ formatDate(item.EndAt) }}</text>
            <text v-if="item.Content" class="item-desc">{{ item.Content }}</text>
          </view>
          <view class="item-actions">
            <text class="action-btn edit" @click="startEdit(item)">编辑</text>
            <text class="action-btn toggle" @click="toggleActive(item)">{{ item.IsActive ? '停用' : '启用' }}</text>
            <text class="action-btn delete" @click="remove(item.Id)">删除</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { httpV2 } from '@/utils/http'
import { API_ENDPOINTS } from '@/config/api'
import { fixImageUrl } from '@/utils/image'

interface ThemeRow {
  Id: number
  Title: string
  Content?: string
  CoverUrl?: string
  IsActive: boolean
  StartAt?: string
  EndAt?: string
  SortOrder?: number
  Type?: string
}

const list = ref<ThemeRow[]>([])
const loading = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

const initialForm = () => ({
  title: '',
  type: 'THEME',
  cover_url: '',
  content: '',
  start_at: '',
  end_at: '',
  is_active: true,
  sort_order: 0,
})

const form = ref(initialForm())

const normalizeImg = (u?: string) => (u ? fixImageUrl(u) : '')

const formatDate = (s?: string) => (s ? s.slice(0, 10) : '—')

const isOngoing = (item: ThemeRow) => {
  const now = new Date().getTime()
  const start = item.StartAt ? new Date(item.StartAt).getTime() : 0
  const end = item.EndAt ? new Date(item.EndAt).getTime() : Number.MAX_SAFE_INTEGER
  return start <= now && now <= end
}

const load = async () => {
  loading.value = true
  try {
    const res = await httpV2.get<ThemeRow[]>(API_ENDPOINTS.ops.activities, { type: 'THEME' })
    list.value = res.code === 0 && Array.isArray(res.data) ? res.data : []
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.value = initialForm()
  editingId.value = null
}

const startEdit = (item: ThemeRow) => {
  editingId.value = item.Id
  form.value = {
    title: item.Title || '',
    type: 'THEME',
    cover_url: item.CoverUrl || '',
    content: item.Content || '',
    start_at: item.StartAt ? item.StartAt.slice(0, 10) : '',
    end_at: item.EndAt ? item.EndAt.slice(0, 10) : '',
    is_active: !!item.IsActive,
    sort_order: item.SortOrder || 0,
  }
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
}

const toIsoOrNull = (d: string) => (d ? new Date(d).toISOString() : null)

const save = async () => {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const payload: any = {
      title: form.value.title,
      type: 'THEME',
      cover_url: form.value.cover_url || null,
      content: form.value.content || null,
      start_at: toIsoOrNull(form.value.start_at),
      end_at: toIsoOrNull(form.value.end_at),
      is_active: form.value.is_active,
      sort_order: Number(form.value.sort_order) || 0,
    }

    let res
    if (editingId.value) {
      res = await httpV2.put(`${API_ENDPOINTS.ops.activities}/${editingId.value}`, payload)
    } else {
      res = await httpV2.post(API_ENDPOINTS.ops.activities, payload)
    }

    if (res.code === 0) {
      uni.showToast({ title: editingId.value ? '已保存' : '已发布', icon: 'success' })
      resetForm()
      await load()
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

const toggleActive = async (item: ThemeRow) => {
  const res = await httpV2.put(`${API_ENDPOINTS.ops.activities}/${item.Id}`, {
    is_active: !item.IsActive,
  })
  if (res.code === 0) {
    item.IsActive = !item.IsActive
    uni.showToast({ title: item.IsActive ? '已启用' : '已停用', icon: 'success' })
  }
}

const remove = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '该主题月将从前台立即下架，确定继续？',
    success: async (mr) => {
      if (!mr.confirm) return
      const res = await httpV2.delete(`${API_ENDPOINTS.ops.activities}/${id}`)
      if (res.code === 0) {
        uni.showToast({ title: '已删除', icon: 'success' })
        await load()
      }
    },
  })
}

onMounted(load)
</script>

<style scoped>
.page-themes { min-height: 100vh; background: #F4F6F8; padding: 32rpx; }
.page-header { margin-bottom: 28rpx; }
.page-title { display: block; font-size: 40rpx; font-weight: 800; color: #1F2937; }
.page-tip { display: block; margin-top: 12rpx; font-size: 24rpx; color: #6B7280; line-height: 1.6; }

.form-card, .list-section, .item-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.form-section { display: block; font-size: 30rpx; font-weight: 700; color: #1F2937; margin-bottom: 20rpx; }
.input, .textarea, .picker {
  width: 100%; box-sizing: border-box; background: #F9FAFB; border-radius: 16rpx;
  padding: 20rpx 24rpx; font-size: 28rpx; color: #1F2937; margin-bottom: 18rpx;
}
.input.small { padding: 16rpx 20rpx; }
.textarea { min-height: 180rpx; line-height: 1.6; }
.picker { color: #374151; }

.form-row { display: flex; gap: 20rpx; }
.form-col { flex: 1; }
.form-col.switch-col { display: flex; flex-direction: column; }
.form-label { display: block; font-size: 24rpx; color: #6B7280; margin-bottom: 8rpx; }

.form-actions { display: flex; gap: 16rpx; margin-top: 12rpx; }
.btn {
  flex: 1;
  height: 82rpx; line-height: 82rpx; border: none; border-radius: 100rpx;
  font-size: 30rpx; font-weight: 700;
}
.btn.primary { background: #0D9488; color: #fff; }
.btn.ghost { background: #F3F4F6; color: #374151; }

.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.list-title { font-size: 30rpx; font-weight: 700; color: #1F2937; }
.refresh { font-size: 24rpx; color: #0D9488; }

.empty { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #9CA3AF; }

.item-card { padding: 0; overflow: hidden; }
.item-cover {
  height: 220rpx; background: #E5E7EB center/cover no-repeat;
  position: relative; display: flex; align-items: flex-start;
}
.item-badge {
  margin: 20rpx; padding: 6rpx 18rpx; border-radius: 100rpx;
  font-size: 22rpx; font-weight: 700; color: #fff;
}
.item-badge.ongoing { background: rgba(13, 148, 136, 0.9); }
.item-badge.ended { background: rgba(107, 114, 128, 0.85); }
.item-badge.inactive { background: rgba(239, 68, 68, 0.9); }

.item-body { padding: 24rpx 28rpx 8rpx; }
.item-title { display: block; font-size: 30rpx; font-weight: 800; color: #1F2937; margin-bottom: 8rpx; }
.item-time { display: block; font-size: 22rpx; color: #9CA3AF; margin-bottom: 12rpx; }
.item-desc { display: block; font-size: 24rpx; color: #4B5563; line-height: 1.6;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }

.item-actions {
  display: flex; gap: 24rpx; padding: 16rpx 28rpx 24rpx;
  border-top: 1rpx solid #F3F4F6; margin-top: 16rpx;
}
.action-btn { font-size: 24rpx; font-weight: 600; }
.action-btn.edit { color: #0D9488; }
.action-btn.toggle { color: #F59E0B; }
.action-btn.delete { color: #EF4444; }
</style>
