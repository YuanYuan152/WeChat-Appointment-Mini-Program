@echo off
echo 连心心理前端项目启动脚本
echo ================================

echo 检查Node.js版本...
node --version
if %errorlevel% neq 0 (
    echo 错误: 未安装Node.js，请先安装Node.js 18+
    pause
    exit /b 1
)

echo 检查pnpm是否安装...
pnpm --version
if %errorlevel% neq 0 (
    echo 正在安装pnpm...
    npm install pnpm -g
    if %errorlevel% neq 0 (
        echo 错误: pnpm安装失败
        pause
        exit /b 1
    )
)

echo 安装项目依赖...
pnpm install
if %errorlevel% neq 0 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)

echo 启动开发服务器...
pnpm run dev:h5

pause 