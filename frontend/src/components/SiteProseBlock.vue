<template>
  <view class="site-prose-block" :class="[`site-prose-block--${tone}`, rootClass]">
    <template v-for="(paragraph, index) in paragraphs" :key="index">
      <view
        v-if="paragraph === ''"
        class="site-prose-paragraph site-prose-paragraph--block site-prose-paragraph--spacer"
        :class="paragraphClass"
      />
      <text
        v-else
        class="site-prose-paragraph site-prose-paragraph--block"
        :class="paragraphClass"
      >
        {{ paragraph }}
      </text>
    </template>
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
  display: block;
  font-size: 28rpx;
  line-height: 1.85;
  margin-bottom: 32rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.site-prose-paragraph--block.site-prose-paragraph--spacer {
  margin-bottom: 16rpx;
}

.site-prose-block--muted .site-prose-paragraph {
  color: #6b6560;
}

.site-prose-block--body .site-prose-paragraph {
  color: #374151;
}
</style>
