import re

file_path = r"d:\data\extra\lxxl-main\frontend\src\pages\index\index.vue"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Feature Section (Bento Box) - Remove custom text/gradients and let the original images fill the cards
new_feature_section = """    <!-- Bento Box 功能卡片 -->
    <view class="feature-section">
      <view class="bento-grid">
        <view class="bento-item large" @click="navigateTo('/pages/consultant/list')">
          <image src="/static/images/place11.png" class="bento-bg-full" mode="aspectFill" />
        </view>
        
        <view class="bento-right-col">
          <view class="bento-item small">
            <image src="/static/images/place12.png" class="bento-bg-full" mode="aspectFill" />
          </view>
          <view class="bento-item small" @click="navigateTo('/pages/activity/list')">
            <image src="/static/images/place14.png" class="bento-bg-full" mode="aspectFill" />
          </view>
        </view>
      </view>
    </view>"""

content = re.sub(r'<!-- Bento Box 功能卡片 -->.*?<!-- 悬浮功能导航 -->', new_feature_section + '\n\n    <!-- 悬浮功能导航 -->', content, flags=re.DOTALL)

# Fix 2: CSS adjustments
# 1. Fix nav-icon-wrap squashing (add flex-shrink: 0)
content = content.replace('.nav-icon-wrap {', '.nav-icon-wrap {\n  flex-shrink: 0;')
# 2. Increase top-bg-gradient height
content = content.replace('height: 450rpx;', 'height: 540rpx;')
# 3. Add .bento-bg-full class
bento_css = """
.bento-bg-full {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  object-fit: cover;
}
"""
content = content.replace('.bento-bg {', bento_css + '\n.bento-bg {')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed index.vue UI issues.")
