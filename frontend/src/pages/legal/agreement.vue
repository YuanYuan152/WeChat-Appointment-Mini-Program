<template>
  <view class="page-legal">
    <view class="legal-header">
      <text class="legal-title">用户协议</text>
      <text class="legal-meta">最后更新：{{ updatedAt }}</text>
    </view>

    <view class="legal-card">
      <text class="section-title">一、服务说明</text>
      <text class="paragraph">
        欢迎使用「连心心理」微信小程序（以下简称"本服务"）。本服务由连心心理团队运营，
        为用户提供心理咨询师介绍、预约、心理健康内容浏览、活动报名、订阅消息提醒等功能。
      </text>

      <text class="section-title">二、账号与登录</text>
      <text class="paragraph">
        2.1 用户通过微信登录使用本服务，登录后我们会建立你的账号并绑定微信 OpenID/UnionID 与手机号。
      </text>
      <text class="paragraph">
        2.2 用户应妥善保管自己的账号信息，不应将账号借予他人使用。
      </text>
      <text class="paragraph">
        2.3 用户有权随时通过「我的 → 注销账号」终止本服务并删除可识别身份字段。
      </text>

      <text class="section-title">三、咨询服务约定</text>
      <text class="paragraph">
        3.1 咨询师所提供的心理咨询服务并非医疗诊断行为。如出现严重心理危机或精神疾病征兆，应立即就医。
      </text>
      <text class="paragraph">
        3.2 咨询师与用户之间的咨询过程在合法合规前提下严格保密；以下情况除外：
        危及自身或他人生命安全、未成年人保护、法律法规要求披露的情形。
      </text>
      <text class="paragraph">
        3.3 一次预约成功并完成支付后，如需取消或改期，请提前 24 小时通过咨询助理或工作台申请。
      </text>

      <text class="section-title">四、内容与版权</text>
      <text class="paragraph">
        本服务内的文章、Banner、活动、主题月等内容版权归运营方或原作者所有，未经授权不得转载。
      </text>

      <text class="section-title">五、免责声明</text>
      <text class="paragraph">
        因不可抗力、第三方网络故障或用户自身原因造成的服务中断，运营方在法律允许范围内不承担责任。
      </text>

      <text class="section-title">六、协议变更</text>
      <text class="paragraph">
        我们可能根据业务调整或法律要求修订本协议。重大调整将通过站内消息或启动页提示，
        持续使用即视为同意更新后的协议。
      </text>

      <text class="section-title">七、联系我们</text>
      <text class="paragraph">
        如对本协议有任何疑问，请通过「我的 → 意见反馈」或运营方公示电话联系我们。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
const updatedAt = '2026-05-19'
</script>

<style scoped>
.page-legal { min-height: 100vh; background: #F4F6F8; padding: 32rpx; }
.legal-header { padding: 28rpx 0 24rpx; }
.legal-title { display: block; font-size: 44rpx; font-weight: 800; color: #1F2937; }
.legal-meta { display: block; margin-top: 12rpx; font-size: 24rpx; color: #9CA3AF; }
.legal-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.05);
}
.section-title {
  display: block;
  margin: 32rpx 0 16rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0D9488;
}
.section-title:first-child { margin-top: 0; }
.paragraph {
  display: block;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.85;
  margin-bottom: 16rpx;
}
</style>
