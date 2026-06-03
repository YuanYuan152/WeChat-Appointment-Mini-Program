import re

file_path = r"d:\data\extra\lxxl-main\frontend\src\pages\user\profile.vue"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add flex-shrink: 0 to prevent squashing
content = content.replace('.menu-icon-wrap {\n  width: 64rpx;', '.menu-icon-wrap {\n  flex-shrink: 0;\n  width: 64rpx;')
content = content.replace('.avatar-wrap {\n  position: relative;', '.avatar-wrap {\n  flex-shrink: 0;\n  position: relative;')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed profile.vue flex-shrink.")
