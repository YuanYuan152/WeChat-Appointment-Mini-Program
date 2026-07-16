# 压缩后的小程序静态图（主包体积优化）

由 `scripts/compress_static_images.py` 从 `static/images` 生成。
代码统一引用 `/static/images-opt/...`。
旧目录 `static/images` 中的大图应删除，否则仍会打进主包。
