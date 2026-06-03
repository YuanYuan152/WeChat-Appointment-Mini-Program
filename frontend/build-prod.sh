#!/bin/bash

echo "========================================"
echo "连心心理 - 生产环境构建脚本"
echo "========================================"
echo

echo "正在清理之前的构建文件..."
rm -rf dist unpackage

echo
echo "正在安装依赖..."
pnpm install

echo
echo "正在构建生产版本..."
pnpm run build

echo
echo "构建完成！输出目录: dist/"
echo
echo "生产环境配置:"
echo "- API地址: https://www.ji-psy.com"
echo "- 超时时间: 15000ms"
echo "- 应用标题: 连心心理"
echo 