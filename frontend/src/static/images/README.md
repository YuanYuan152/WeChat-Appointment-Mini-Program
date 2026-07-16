# 静态图目录（已迁移）

业务图片已压缩并迁移到 `../images-opt/`。

- 代码请引用：`/static/images-opt/xxx.jpg|png`
- 本目录不再放置大图，避免打进小程序主包超限
- 重新压缩：`python scripts/compress_static_images.py`
