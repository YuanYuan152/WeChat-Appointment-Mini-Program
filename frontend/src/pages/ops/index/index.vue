<template>
  <view class="page-ops-home">
    <view class="hero-card">
      <text class="hero-subtitle">咨询助理、咨询主任、管理员共用；管理排期、咨询室与用户</text>
    </view>

    <view class="grid">
      <view
        v-for="entry in entries"
        :key="entry.path"
        class="grid-item"
        @click="navigate(entry.path)"
      >
        <view class="grid-icon" :class="entry.tone">
          <text class="grid-symbol">{{ entry.symbol }}</text>
        </view>
        <text class="grid-title">{{ entry.title }}</text>
        <text class="grid-desc">{{ entry.desc }}</text>
      </view>
    </view>

    <view class="footer-tip">
      复杂后台能力（批量导入导出 / 富文本重编辑 / 组织权限）请前往 Web 控制台。
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { resolveAccountRole, canManageStaffOperationalSettings } from '@/constants/roles'
import { getToken } from '@/utils/auth'
import { readStoredRole } from '@/utils/tabBar'

const userStore = useUserStore()

onShow(() => {
  if (getToken()) {
    userStore.fetchUserInfo().catch(() => {})
  }
})

const HIDDEN_OPS_PATHS = new Set([
  '/pages/ops/banner/index',
  '/pages/ops/activities/index',
  '/pages/ops/themes/index',
  '/pages/ops/articles/index',
])

const allEntries = [
  { title: '排期情况', desc: '按日浏览 · 点击进入普通/日历排期', symbol: '期', tone: 'tone-green', path: '/pages/ops/schedules/index' },
  { title: '咨询室情况', desc: '咨询室占用与管理', symbol: '室', tone: 'tone-green', path: '/pages/ops/rooms/index' },
  { title: '运营看板', desc: '关键指标与日活数据', symbol: '数', tone: 'tone-muted', path: '/pages/ops/dashboard/index', roles: ['Ops', 'Admin'] },
  { title: '角色&权限绑定', desc: '为账号绑定角色并分配管理工作台权限', symbol: '人', tone: 'tone-green', path: '/pages/ops/admin-roles/index' },
  { title: '定价管理', desc: '咨询师基础价与个性化调价', symbol: '价', tone: 'tone-gold', path: '/pages/ops/pricing/index' },
  { title: '审批管理', desc: '退款申请与咨询师请假 · 助理/主任/管理员', symbol: '审', tone: 'tone-gold', path: '/pages/ops/approvals/index' },
  { title: '咨询记录修改审核', desc: '咨询师提交的记录修改申请', symbol: '改', tone: 'tone-gold', path: '/pages/ops/case-record-amendments/index' },
  { title: '用户管理', desc: '来访者信息与咨询师档案管理', symbol: '用', tone: 'tone-green', path: '/pages/ops/users/index' },
  { title: '代理预约', desc: '为来访推送待支付预约订单', symbol: '代', tone: 'tone-gold', path: '/pages/ops/proxy-booking/index' },
  { title: '系统设置', desc: '待支付时限（5 分钟起，轮盘调节）', symbol: '设', tone: 'tone-muted', path: '/pages/ops/system-settings/index', staffSettings: true },
  { title: '用户反馈', desc: '来访者咨询完成后的评价反馈', symbol: '馈', tone: 'tone-green', path: '/pages/ops/consultation-feedbacks/index' },
  { title: '咨询记录', desc: '各咨询师近30天记录填写情况', symbol: '记', tone: 'tone-green', path: '/pages/ops/case-records/index' },
  { title: '重后台 (Web)', desc: 'WebView 嵌入旧管理后台', symbol: 'Web', tone: 'tone-dark', path: '/pages/admin-webview/index' },
] as Array<{
  title: string
  desc: string
  symbol: string
  tone: string
  path: string
  adminOnly?: boolean
  staffSettings?: boolean
  roles?: string[]
}>

const entries = computed(() => {
  const role =
    userStore.activeRole ||
    resolveAccountRole(userStore.roles) ||
    readStoredRole()
  const isAdmin = role === 'Admin'
  return allEntries.filter((e) => {
    if (HIDDEN_OPS_PATHS.has(e.path)) return false
    if (e.adminOnly && !isAdmin) return false
    if (e.staffSettings && !canManageStaffOperationalSettings(role)) return false
    if (e.roles && !e.roles.includes(role)) return false
    return true
  })
})

const navigate = (path: string) => {
  uni.navigateTo({
    url: path,
    fail: () => {
      uni.showModal({
        title: '页面未找到',
        content: '新页面尚未编译进小程序，请重启 pnpm dev:mp-weixin，并在微信开发者工具中点击「编译」刷新后重试。',
        showCancel: false,
      })
    },
  })
}
</script>

<style scoped>
.page-ops-home { min-height: 100vh; background: #F7F5F2; padding: 32rpx; }

.hero-card {
  background: linear-gradient(135deg, #3D5A4E, #2F4A40);
  border-radius: 24rpx;
  padding: 36rpx;
  margin-bottom: 28rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);
}
.hero-subtitle { display: block; font-size: 26rpx; color: rgba(255,255,255,0.9); line-height: 1.6; }

.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; }
.grid-item {
  background: #fff; border-radius: 20rpx; padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
  display: flex; flex-direction: column; gap: 12rpx;
}
.grid-item:active { opacity: 0.92; }
.grid-icon {
  width: 72rpx; height: 72rpx; border-radius: 16rpx;
  display: flex; align-items: center; justify-content: center;
}
.grid-symbol { font-size: 28rpx; font-weight: 600; }
.tone-green { background: #E8E4DE; color: #3D5A4E; }
.tone-gold { background: #F5EFE3; color: #C9A96E; }
.tone-muted { background: #F0EDE8; color: #6B6560; }
.tone-dark { background: #2C2C2C; color: #fff; }
.grid-title { font-size: 30rpx; font-weight: 600; color: #2C2C2C; }
.grid-desc { font-size: 22rpx; color: #8A8A8A; line-height: 1.5; }

.footer-tip {
  margin-top: 36rpx; padding: 24rpx; border-radius: 16rpx;
  background: #E8E4DE; color: #3D5A4E;
  font-size: 22rpx; line-height: 1.6; text-align: center;
}
</style>
