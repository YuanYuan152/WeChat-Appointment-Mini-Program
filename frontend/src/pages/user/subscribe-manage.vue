<template>
  <view class="page">
    <view class="hero">
      <text class="title">服务通知订阅</text>
      <text class="desc">
        授权弹窗由微信官方提供（每条消息旁有开关）。推送出现在微信「服务通知」会话。
      </text>
    </view>

    <view v-if="hint" class="warn">{{ hint }}</view>

    <view class="card">
      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="!items.length" class="empty">当前角色暂无可订阅消息</view>
      <view v-for="item in items" :key="item.eventKey" class="row">
        <view class="meta">
          <text class="label">{{ item.label }}</text>
          <text class="sub">{{ item.isMock ? '未配置真实模板' : (item.enabled ? '已授权' : '未授权') }}</text>
        </view>
        <switch
          :checked="item.enabled"
          color="#07c160"
          :disabled="togglingKey === item.eventKey"
          @change="onSwitchChange(item, $event)"
        />
      </view>
    </view>

    <button class="ghost" @tap="openWechatSetting">打开微信通知设置</button>
    <button class="primary" :loading="batchLoading" @tap="batchEnable">一键申请本角色通知</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { MessageApi, type SubscribeStatusItem } from '@/apis/message'
import { isLoggedIn } from '@/utils/auth'
import {
  openSubscribeSetting,
  requestAndSaveSubscribe,
  ROLE_EVENT_KEYS,
} from '@/utils/subscribeMessage'
import { getStoredRole } from '@/utils/session'

const loading = ref(true)
const batchLoading = ref(false)
const togglingKey = ref('')
const hint = ref('')
const items = ref<SubscribeStatusItem[]>([])

const load = async () => {
  loading.value = true
  try {
    const data = await MessageApi.getSubscribeStatus()
    items.value = data.items || []
    hint.value = data.hint || ''
  } catch (e: any) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const onSwitchChange = (item: SubscribeStatusItem, e: any) => {
  void onToggle(item, !!e?.detail?.value)
}

const onToggle = async (item: SubscribeStatusItem, enabled: boolean) => {
  if (togglingKey.value) return
  togglingKey.value = item.eventKey
  try {
    if (enabled) {
      if (item.isMock) {
        uni.showModal({
          title: '无法开启',
          content: '请先在 backend-python/.env 配置真实 WECHAT_TMPL_* 模板 ID 并重启后端。',
          showCancel: false,
        })
        await load()
        return
      }
      await requestAndSaveSubscribe([item.eventKey])
      await load()
    } else {
      await MessageApi.toggleSubscribe(item.eventKey, false)
      item.enabled = false
      uni.showToast({ title: '已关闭本端推送', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
    await load()
  } finally {
    togglingKey.value = ''
  }
}

const batchEnable = async () => {
  if (batchLoading.value) return
  batchLoading.value = true
  try {
    const role = getStoredRole() || 'Patient'
    await requestAndSaveSubscribe(ROLE_EVENT_KEYS[role])
    await load()
  } finally {
    batchLoading.value = false
  }
}

const openWechatSetting = async () => {
  try {
    await openSubscribeSetting()
  } catch {
    uni.showToast({ title: '无法打开设置', icon: 'none' })
  }
}

onMounted(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }
  load()
})

onShow(() => {
  if (isLoggedIn()) load()
})
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f5f2; padding: 40rpx 32rpx 80rpx; }
.hero { margin-bottom: 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; color: #1f2937; }
.desc { display: block; margin-top: 12rpx; font-size: 26rpx; color: #6b7280; line-height: 1.6; }
.warn {
  background: #fff7ed; color: #9a3412; border: 1rpx solid #fdba74;
  border-radius: 16rpx; padding: 20rpx 24rpx; font-size: 24rpx; line-height: 1.5; margin-bottom: 24rpx;
}
.card {
  background: #fff; border-radius: 24rpx; padding: 8rpx 28rpx;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.04);
}
.row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 28rpx 0; border-bottom: 1rpx solid #f3f4f6;
}
.row:last-child { border-bottom: none; }
.meta { flex: 1; padding-right: 24rpx; }
.label { display: block; font-size: 30rpx; color: #111827; font-weight: 600; }
.sub { display: block; margin-top: 8rpx; font-size: 22rpx; color: #9ca3af; }
.empty { padding: 48rpx 0; text-align: center; color: #9ca3af; font-size: 28rpx; }
.ghost, .primary {
  margin-top: 24rpx; height: 88rpx; line-height: 88rpx; border-radius: 100rpx;
  font-size: 30rpx; font-weight: 600; border: none;
}
.ghost { background: #f3f4f6; color: #374151; }
.primary { background: #07c160; color: #fff; }
</style>
