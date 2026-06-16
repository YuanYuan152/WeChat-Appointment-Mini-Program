<template>
  <view class="page-ops-home">
    <view class="hero-card">
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
const entries = [
  { title: '挂课情况', desc: '各咨询师当日挂课与预约', symbol: '课', tone: 'tone-green', path: '/pages/ops/schedules/index' },
  { title: '咨询室情况', desc: '咨询室占用与管理', symbol: '室', tone: 'tone-green', path: '/pages/ops/rooms/index' },
  { title: 'Banner 管理', desc: '首页轮播图位与跳转链路', symbol: '图', tone: 'tone-gold', path: '/pages/ops/banner/index' },
  { title: '活动管理', desc: '招募 / 公告 / 主题活动', symbol: '活', tone: 'tone-gold', path: '/pages/ops/activities/index' },
  { title: '主题月管理', desc: '按月发布主题内容', symbol: '月', tone: 'tone-green', path: '/pages/ops/themes/index' },
  { title: '文章管理', desc: '内容中心 / 知识科普', symbol: '文', tone: 'tone-muted', path: '/pages/ops/articles/index' },
  { title: '运营看板', desc: '关键指标与日活数据', symbol: '数', tone: 'tone-muted', path: '/pages/ops/dashboard/index' },
  { title: '用户与角色', desc: '账号绑定与角色管理', symbol: '人', tone: 'tone-green', path: '/pages/ops/admin-roles/index' },
  { title: '豁免申请审核', desc: '24小时内取消退款豁免 · 管理员', symbol: '审', tone: 'tone-gold', path: '/pages/ops/refund-exemptions/index' },
  { title: '重后台 (Web)', desc: 'WebView 嵌入旧管理后台', symbol: 'Web', tone: 'tone-dark', path: '/pages/admin-webview/index' },
]

const navigate = (path: string) => {
  uni.navigateTo({
    url: path,
    fail: () => {
      uni.showToast({
        title: '页面未编译，请重启 pnpm dev:mp-weixin 后刷新开发者工具',
        icon: 'none',
        duration: 3000,
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
  padding: 44rpx 36rpx;
  margin-bottom: 28rpx;
  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);
}
.hero-title { display: block; font-size: 40rpx; font-weight: 600; color: #fff; letter-spacing: 2rpx; }
.hero-subtitle { display: block; margin-top: 12rpx; font-size: 26rpx; color: rgba(255,255,255,0.8); line-height: 1.6; }

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
