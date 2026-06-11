<template>
  <view class="page-banner">
    <button class="add-btn" @click="openModal()">+ 新增 Banner</button>

    <view v-if="list.length === 0" class="empty-state">
      <text class="empty-text">暂无 Banner，点击上方添加</text>
    </view>

    <view v-for="item in list" :key="item.Id" class="banner-card">
      <image class="banner-img" :src="item.ImageUrl" mode="aspectFill" />
      <view class="banner-info">
        <text class="banner-title">{{ item.Title }}</text>
        <text class="banner-link">{{ item.LinkType }}{{ item.LinkValue ? ': ' + item.LinkValue : '' }}</text>
        <view class="banner-meta">
          <text class="meta-order">排序: {{ item.SortOrder }}</text>
          <text class="meta-status" :class="item.IsActive ? 'active' : 'inactive'">
            {{ item.IsActive ? '启用' : '停用' }}
          </text>
        </view>
      </view>
      <view class="banner-actions">
        <text class="action-edit" @tap.stop="openModal(item)">编辑</text>
        <text class="action-delete" @tap.stop="deleteBanner(item.Id)">删除</text>
      </view>
    </view>

    <!-- 新增/编辑弹窗（勿用 @click.self，小程序点击输入框会误触关闭） -->
    <view v-if="showModal" class="modal-overlay" @touchmove.stop.prevent>
      <view class="modal-card" @tap.stop @touchmove.stop.prevent>
        <text class="modal-title">{{ form.Id ? '编辑 Banner' : '新增 Banner' }}</text>

        <view class="form-group" @tap.stop>
          <text class="form-label">标题 *</text>
          <input class="form-input" v-model="form.title" placeholder="Banner 标题" />
        </view>

        <view class="form-group" @tap.stop>
          <text class="form-label">图片 URL *</text>
          <view class="upload-row">
            <input class="form-input" v-model="form.image_url" placeholder="输入或上传图片" />
            <button class="upload-btn" @tap.stop="pickImage">上传</button>
          </view>
          <image v-if="form.image_url" class="preview-img" :src="form.image_url" mode="aspectFill" />
        </view>

        <view class="form-group">
          <text class="form-label">跳转类型</text>
          <view class="radio-row">
            <view
              v-for="lt in linkTypes" :key="lt.value"
              class="radio-item" :class="{ active: form.link_type === lt.value }"
              @tap.stop="form.link_type = lt.value"
            >{{ lt.label }}</view>
          </view>
        </view>

        <view class="form-group" @tap.stop>
          <text class="form-label">跳转地址</text>
          <input
            v-if="form.link_type !== 'NONE'"
            class="form-input"
            v-model="form.link_value"
            placeholder="页面路径或外链 URL"
          />
        </view>

        <view class="form-group" @tap.stop>
          <text class="form-label">排序（数字越小越靠前）</text>
          <input class="form-input" type="number" v-model.number="form.sort_order" placeholder="0" />
        </view>

        <view class="form-group switch-row">
          <text class="form-label">是否启用</text>
          <switch :checked="form.is_active" @change="e => form.is_active = e.detail.value" color="#0D9488" />
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @tap.stop="showModal = false">取消</button>
          <button class="modal-btn confirm" :loading="saving" @tap.stop="saveBanner">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpV2 } from '@/utils/http'

interface Banner {
  Id: number
  Title: string
  ImageUrl: string
  LinkType: string
  LinkValue?: string
  SortOrder: number
  IsActive: boolean
}

const list = ref<Banner[]>([])
const showModal = ref(false)
const saving = ref(false)

const defaultForm = () => ({
  Id: 0,
  title: '',
  image_url: '',
  link_type: 'PAGE',
  link_value: '',
  sort_order: 0,
  is_active: true,
})
const form = ref(defaultForm())

const linkTypes = [
  { label: '页面', value: 'PAGE' },
  { label: '外链', value: 'URL' },
  { label: '无跳转', value: 'NONE' },
]

const load = async () => {
  const res = await httpV2.get('/api/mini/ops/banners/manage')
  if (res.code === 0 && res.data) list.value = res.data
}

const openModal = (item?: Banner) => {
  if (item) {
    form.value = {
      Id: item.Id,
      title: item.Title,
      image_url: item.ImageUrl,
      link_type: item.LinkType,
      link_value: item.LinkValue ?? '',
      sort_order: item.SortOrder,
      is_active: item.IsActive,
    }
  } else {
    form.value = defaultForm()
  }
  showModal.value = true
}

const pickImage = () => {
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      const uploadRes = await httpV2.upload('/api/upload/file', filePath, 'file')
      if (uploadRes.code === 0 && uploadRes.data?.url) {
        form.value.image_url = uploadRes.data.url
      } else {
        uni.showToast({ title: '上传失败', icon: 'none' })
      }
    }
  })
}

const saveBanner = async () => {
  if (!form.value.title || !form.value.image_url) {
    uni.showToast({ title: '请填写标题和图片', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.value.title,
      image_url: form.value.image_url,
      link_type: form.value.link_type,
      link_value: form.value.link_value || null,
      sort_order: form.value.sort_order,
      is_active: form.value.is_active,
    }
    let res
    if (form.value.Id) {
      res = await httpV2.put(`/api/mini/ops/banners/${form.value.Id}`, payload)
    } else {
      res = await httpV2.post('/api/mini/ops/banners', payload)
    }
    if (res.code === 0) {
      showModal.value = false
      await load()
      uni.showToast({ title: '保存成功', icon: 'success' })
    } else {
      uni.showToast({ title: res.msg || '保存失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

const deleteBanner = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该 Banner 吗？',
    success: async (res) => {
      if (!res.confirm) return
      await httpV2.delete(`/api/mini/ops/banners/${id}`)
      await load()
      uni.showToast({ title: '已删除', icon: 'success' })
    }
  })
}

onMounted(load)
</script>

<style scoped>
.page-banner { padding: 32rpx; background: #F4F6F8; min-height: 100vh; }

.add-btn {
  width: 100%; height: 88rpx; line-height: 88rpx;
  background: #0D9488; color: #fff; border: none;
  border-radius: 24rpx; font-size: 30rpx; font-weight: 700;
  margin-bottom: 32rpx;
}

.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #9CA3AF; }

.banner-card {
  background: #fff; border-radius: 24rpx; overflow: hidden;
  margin-bottom: 24rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
  display: flex; flex-direction: column;
}
.banner-img { width: 100%; height: 280rpx; }
.banner-info { padding: 24rpx 28rpx 0; }
.banner-title { display: block; font-size: 30rpx; font-weight: 700; color: #1F2937; }
.banner-link { display: block; font-size: 24rpx; color: #6B7280; margin-top: 8rpx; }
.banner-meta { display: flex; gap: 24rpx; margin-top: 12rpx; }
.meta-order { font-size: 24rpx; color: #9CA3AF; }
.meta-status { font-size: 24rpx; font-weight: 600; }
.meta-status.active { color: #10B981; }
.meta-status.inactive { color: #EF4444; }
.banner-actions { display: flex; gap: 0; border-top: 1rpx solid #F3F4F6; margin-top: 20rpx; }
.action-edit, .action-delete {
  flex: 1; text-align: center; padding: 24rpx 0;
  font-size: 28rpx; font-weight: 600;
}
.action-edit { color: #0D9488; }
.action-delete { color: #EF4444; border-left: 1rpx solid #F3F4F6; }

/* 弹窗 */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 9999;
}
.modal-card {
  width: 100%; background: #fff;
  border-radius: 40rpx 40rpx 0 0;
  padding: 48rpx 40rpx calc(60rpx + env(safe-area-inset-bottom));
  max-height: 90vh; overflow-y: auto;
}
.modal-title { display: block; font-size: 36rpx; font-weight: 800; color: #1F2937; margin-bottom: 40rpx; }
.form-group { margin-bottom: 28rpx; }
.form-label { display: block; font-size: 26rpx; color: #6B7280; margin-bottom: 12rpx; }
.form-input {
  background: #F9FAFB; border-radius: 16rpx; padding: 20rpx 24rpx;
  font-size: 28rpx; color: #1F2937; width: 100%; box-sizing: border-box; flex: 1;
}
.upload-row { display: flex; gap: 16rpx; align-items: center; }
.upload-btn {
  height: 72rpx; line-height: 72rpx; padding: 0 24rpx; flex-shrink: 0;
  border-radius: 16rpx; font-size: 26rpx; background: #E5E7EB; color: #374151;
  border: none; margin: 0;
}
.preview-img { width: 100%; height: 240rpx; border-radius: 16rpx; margin-top: 16rpx; }

.radio-row { display: flex; gap: 16rpx; }
.radio-item {
  padding: 12rpx 28rpx; border-radius: 100rpx; font-size: 26rpx;
  border: 2rpx solid #E5E7EB; color: #6B7280; background: #fff;
}
.radio-item.active { background: #0D9488; color: #fff; border-color: #0D9488; }

.switch-row { display: flex; justify-content: space-between; align-items: center; }
.modal-btns { display: flex; gap: 24rpx; margin-top: 40rpx; }
.modal-btn { flex: 1; height: 88rpx; line-height: 88rpx; border-radius: 100rpx; font-size: 30rpx; font-weight: 700; margin: 0; }
.modal-btn.cancel { background: #F3F4F6; color: #6B7280; border: none; }
.modal-btn.confirm { background: #0D9488; color: #fff; border: none; }
</style>
