<template>
  <view class="page-ops-home">
    <view class="hero">
      <text class="hero-title">运营工作台</text>
      <text class="hero-subtitle">管理挂课、咨询室、Banner、活动、主题月、文章与用户</text>
    </view>

    <view class="grid">
      <view
        v-for="entry in entries"
        :key="entry.path"
        class="grid-item"
        @click="navigate(entry.path)"
      >
        <view class="grid-icon" :style="{ background: entry.color }">
          <text class="grid-emoji">{{ entry.icon }}</text>
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
const entries = [
  { title: '挂课情况', desc: '各咨询师当日挂课与预约', icon: '📋', color: 'linear-gradient(135deg,#14B8A6,#0D9488)', path: '/pages/ops/schedules/index' },
  { title: '咨询室情况', desc: '咨询室占用与管理', icon: '🏢', color: 'linear-gradient(135deg,#0891B2,#0284C7)', path: '/pages/ops/rooms/index' },
  { title: 'Banner 管理', desc: '首页轮播图位与跳转链路', icon: '🎨', color: 'linear-gradient(135deg,#0EA5E9,#3B82F6)', path: '/pages/ops/banner/index' },
  { title: '活动管理', desc: '招募 / 公告 / 主题活动', icon: '🎯', color: 'linear-gradient(135deg,#F59E0B,#F97316)', path: '/pages/ops/activities/index' },
  { title: '主题月管理', desc: '按月发布主题内容', icon: '📅', color: 'linear-gradient(135deg,#0D9488,#10B981)', path: '/pages/ops/themes/index' },
  { title: '文章管理', desc: '内容中心 / 知识科普', icon: '📰', color: 'linear-gradient(135deg,#8B5CF6,#A855F7)', path: '/pages/ops/articles/index' },
  { title: '运营看板', desc: '关键指标与日活数据', icon: '📊', color: 'linear-gradient(135deg,#EC4899,#F43F5E)', path: '/pages/ops/dashboard/index' },
  { title: '用户与角色', desc: '账号绑定与角色管理', icon: '👥', color: 'linear-gradient(135deg,#6366F1,#4F46E5)', path: '/pages/ops/admin-roles/index' },
  { title: '重后台 (Web)', desc: 'WebView 嵌入旧管理后台', icon: '🛠', color: 'linear-gradient(135deg,#475569,#1E293B)', path: '/pages/admin-webview/index' },
]

const navigate = (path: string) => {
  uni.navigateTo({ url: path })
}
</script>

<style scoped>
.page-ops-home { min-height: 100vh; background: #F4F6F8; padding: 32rpx; }
.hero { padding: 40rpx 0 24rpx; }
.hero-title { display: block; font-size: 44rpx; font-weight: 800; color: #1F2937; }
.hero-subtitle { display: block; margin-top: 12rpx; font-size: 26rpx; color: #6B7280; }

.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; }
.grid-item {
  background: #fff; border-radius: 28rpx; padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
  display: flex; flex-direction: column; gap: 12rpx;
  transition: transform .15s ease;
}
.grid-item:active { transform: scale(.98); }
.grid-icon {
  width: 72rpx; height: 72rpx; border-radius: 24rpx;
  display: flex; align-items: center; justify-content: center;
}
.grid-emoji { font-size: 38rpx; color: #fff; }
.grid-title { font-size: 30rpx; font-weight: 700; color: #1F2937; }
.grid-desc { font-size: 22rpx; color: #6B7280; line-height: 1.5; }

.footer-tip {
  margin-top: 36rpx; padding: 24rpx; border-radius: 20rpx;
  background: rgba(13, 148, 136, 0.08); color: #0F766E;
  font-size: 22rpx; line-height: 1.6; text-align: center;
}
</style>
