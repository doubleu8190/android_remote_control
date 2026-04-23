#!/bin/bash

# Android Remote Control Electron 快速启动脚本
# 简化版本，适合日常使用

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/electron"

echo "🚀 启动 Android Remote Control Electron..."

# 检查是否在electron目录
if [ ! -f "package.json" ]; then
    echo "错误：找不到 electron/package.json，请确保项目结构完整"
    exit 1
fi

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "错误：Node.js未安装"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败，尝试使用镜像..."
        npm config set registry https://registry.npmmirror.com
        npm cache clean --force
        npm install
    fi
fi

# 检查构建
if [ ! -d "dist" ]; then
    echo "构建应用..."
    npm run build
fi

# 启动应用
echo "启动应用..."
echo ""
echo "应用信息："
echo "  - 名称: Android Remote Control"
echo "  - 版本: Electron桌面版"
echo "  - 模式: 生产环境"
echo ""
echo "按 Ctrl+C 停止应用"
echo ""

npm start
