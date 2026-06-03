import re

file_path = r"d:\data\extra\lxxl-main\frontend\src\pages\index\index.vue"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove opacity and brightness filter from search icon to prevent it from looking weird
content = content.replace('opacity: 0.8;', '')
content = content.replace('opacity: 0.5;\n  filter: brightness(0);', '')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed search icon UI issues.")
