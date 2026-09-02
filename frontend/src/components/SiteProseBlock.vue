<template>
  <view class="site-prose-block" :class="[`site-prose-block--${tone}`, rootClass]">
    <view
      v-for="(paragraph, index) in paragraphs"
      :key="index"
      class="site-prose-paragraph site-prose-paragraph--block"
      :class="paragraphClass"
    >
      {{ paragraph }}
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    paragraphs: string[]
    tone?: 'muted' | 'body'
    rootClass?: string
    paragraphClass?: string
  }>(),
  {
    paragraphs: () => [],
    tone: 'muted',
    rootClass: '',
    paragraphClass: '',
  },
)
</script>

<style scoped lang="scss">
@import '@/styles/site-prose.scss';

.site-prose-paragraph--block {
  font-size: 28rpx;
  line-height: 1.85;
  margin-bottom: 16rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.site-prose-block--muted .site-prose-paragraph {
  color: #6b6560;
}

.site-prose-block--body .site-prose-paragraph {
  color: #374151;
}
</style>
