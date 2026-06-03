#!/bin/bash

echo "连心心理前端项目启动脚本"
echo "================================"

# 检查Node.js版本
echo "检查Node.js版本..."
if ! command -v node &> /dev/null; then
    echo "错误: 未安装Node.js，请先安装Node.js 18+"
    exit 1
fi

node --version

# 检查pnpm是否安装
echo "检查pnpm是否安装..."
if ! command -v pnpm &> /dev/null; then
    echo "正在安装pnpm..."
    npm install pnpm -g
    if [ $? -ne 0 ]; then
        echo "错误: pnpm安装失败"
        exit 1
    fi
fi

# 安装项目依赖
echo "安装项目依赖..."
pnpm install
if [ $? -ne 0 ]; then
    echo "错误: 依赖安装失败"
    exit 1
fi

# 启动开发服务器
echo "启动开发服务器..."
pnpm run dev:h5 