import re

file_path = r"d:\data\extra\lxxl-main\frontend\src\pages\index\index.vue"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace HTML
old_nav_html = """    <!-- 悬浮功能导航 (修复了被挤压的问题) -->
    <view class="nav-section">
      <view class="nav-glass-card">
        <view class="nav-item" @click="navigateTo('/pages/highlights/index')">
          <view class="nav-icon-wrap bg-teal-light">
            <image src="/static/images/icon21.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">往期精华</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/consultation/guide')">
          <view class="nav-icon-wrap bg-blue-light">
            <image src="/static/images/icon22.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">了解咨询</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/about/index')">
          <view class="nav-icon-wrap bg-orange-light">
            <image src="/static/images/icon23.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">关于我们</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/jixinli/index')">
          <view class="nav-icon-wrap bg-purple-light">
            <image src="/static/images/icon24.png" class="nav-icon" mode="aspectFit" />
          </view>
          <text class="nav-text">济心理</text>
        </view>
      </view>
    </view>"""

new_nav_html = """    <!-- 悬浮功能导航 -->
    <view class="nav-section">
      <view class="nav-glass-card">
        <view class="nav-item" @click="navigateTo('/pages/highlights/index')">
          <image src="/static/images/icon21.png" class="nav-icon" mode="aspectFill" />
          <text class="nav-text">往期精华</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/consultation/guide')">
          <image src="/static/images/icon22.png" class="nav-icon" mode="aspectFill" />
          <text class="nav-text">了解咨询</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/about/index')">
          <image src="/static/images/icon23.png" class="nav-icon" mode="aspectFill" />
          <text class="nav-text">关于我们</text>
        </view>
        <view class="nav-item" @click="navigateTo('/pages/jixinli/index')">
          <image src="/static/images/icon24.png" class="nav-icon" mode="aspectFill" />
          <text class="nav-text">济心理</text>
        </view>
      </view>
    </view>"""

content = content.replace(old_nav_html, new_nav_html)

# 2. Replace CSS
css_to_replace = """.nav-icon-wrap {
  width: 96rpx;
  height: 96rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  flex-shrink: 0; /* 防止被挤压 */
}

.nav-item:active .nav-icon-wrap {
  transform: scale(0.9);
}

.bg-teal-light { background: #F0FDFA; }
.bg-blue-light { background: #EFF6FF; }
.bg-orange-light { background: #FFF7ED; }
.bg-purple-light { background: #FAF5FF; }

.nav-icon {
  width: 48rpx;
  height: 48rpx;
}"""

new_css = """.nav-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 40rpx; /* 完美裁切掉图片自带的深色边角 */
  background-color: #ffffff;
  transition: transform 0.2s;
}

.nav-item:active .nav-icon {
  transform: scale(0.9);
}"""

content = content.replace(css_to_replace, new_css)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed nav icons.")
