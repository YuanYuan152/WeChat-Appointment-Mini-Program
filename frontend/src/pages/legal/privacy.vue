<template>
  <view class="page-legal">
    <view class="legal-header">
      <text class="legal-title">隐私政策</text>
      <text class="legal-meta">最后更新：{{ updatedAt }}</text>
    </view>

    <view class="legal-card">
      <text class="section-title">一、我们如何收集你的信息</text>
      <text class="paragraph">
        1.1 微信账号信息：当你使用微信登录时，我们会通过微信小程序接口获取 OpenID、UnionID 和昵称、头像。
      </text>
      <text class="paragraph">
        1.2 手机号：在你主动授权后，我们通过微信 getPhoneNumber 接口获取并绑定到当前账号，用于咨询协调和订单确认。
      </text>
      <text class="paragraph">
        1.3 业务信息：你在登记表、咨询单、活动报名等环节主动填写的内容（姓名、性别、出生日期、紧急联系人、心理评估问卷等）。
      </text>
      <text class="paragraph">
        1.4 设备与日志：登录 IP、UA、必要的请求时间，用于安全审计与异常排查。
      </text>

      <text class="section-title">二、我们如何使用你的信息</text>
      <text class="paragraph">
        2.1 提供心理咨询服务：将你的资料提供给你已选定的咨询师/咨询助理，用于咨询前评估和咨询过程跟进。
      </text>
      <text class="paragraph">
        2.2 履约通知：通过微信订阅消息向你发送预约确认、咨询提醒、支付结果等履约消息。
        我们仅在你授权后才会发送相应模板。
      </text>
      <text class="paragraph">
        2.3 服务改进：在去标识化处理后用于产品质量分析与功能改进。
      </text>

      <text class="section-title">三、信息存储与保护</text>
      <text class="paragraph">
        3.1 你的信息以加密通道（HTTPS）传输，并存储在受访问控制的数据库中。
      </text>
      <text class="paragraph">
        3.2 我们对涉及个人身份的字段采用最小化原则；不必要的字段不会被索引或对外暴露。
      </text>
      <text class="paragraph">
        3.3 业务记录的最低保存期限以法律法规要求为准（一般为 3 年）。
      </text>

      <text class="section-title">四、信息共享</text>
      <text class="paragraph">
        除以下情形外，我们不会向第三方共享你的信息：
      </text>
      <text class="paragraph">- 经你明确授权；</text>
      <text class="paragraph">- 为提供你主动请求的服务（如咨询师对接）；</text>
      <text class="paragraph">- 法律法规要求披露。</text>

      <text class="section-title">五、你的权利</text>
      <text class="paragraph">
        5.1 查询：你可以在「我的 → 个人信息 / 登记表」中查看你提交过的信息。
      </text>
      <text class="paragraph">
        5.2 更正：你可以随时编辑个人资料和登记表内容。
      </text>
      <text class="paragraph">
        5.3 删除/注销：你可以在「我的 → 注销账号」中提交注销请求。
        我们会在合理时间内清空你的可识别身份字段；为合规追溯需要保留的业务记录将做去标识化处理。
      </text>
      <text class="paragraph">
        5.4 拒绝订阅消息：你可以在微信"订阅消息管理"中关闭对应模板，我们将不再向你发送对应通知。
      </text>

      <text class="section-title">六、未成年人保护</text>
      <text class="paragraph">
        若你是未成年人，请在监护人指导下使用本服务，并由监护人代为同意本协议中涉及个人信息处理的部分。
      </text>

      <text class="section-title">七、政策更新</text>
      <text class="paragraph">
        当本政策发生重大变化时，我们会通过启动页或站内消息提醒你。
      </text>

      <text class="section-title">八、联系方式</text>
      <text class="paragraph">
        如需行使上述权利或对隐私问题有疑问，请通过「我的 → 意见反馈」或运营方公示渠道联系我们。
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
