@echo off
echo ========================================
echo 连心心理 - 生产环境构建脚本
echo ========================================
echo.

echo 正在清理之前的构建文件...
if exist "dist" rmdir /s /q "dist"
if exist "unpackage" rmdir /s /q "unpackage"

echo.
echo 正在安装依赖...
call pnpm install

echo.
echo 正在构建生产版本...
call pnpm run build

echo.
echo 构建完成！输出目录: dist/
echo.
echo 生产环境配置:
echo - API地址: https://www.ji-psy.com
echo - 超时时间: 15000ms
echo - 应用标题: 连心心理
echo.
pause 