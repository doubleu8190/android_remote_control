#!/bin/bash

# Android Remote Control Electron 应用启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR/electron"

echo "🚀 启动 Android Remote Control Electron 应用"
echo "=========================================="

cd "$ELECTRON_DIR"

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ $NODE_MAJOR_VERSION -lt 18 ]; then
    echo "❌ 需要 Node.js 18 或更高版本，当前版本: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js 版本: $NODE_VERSION"

# 检查 npm 版本
NPM_VERSION=$(npm -v)
echo "✅ npm 版本: $NPM_VERSION"

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖已安装"
fi

# 检查构建目录
if [ ! -d "dist" ]; then
    echo "🔨 构建应用..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ 构建失败"
        exit 1
    fi
    echo "✅ 构建完成"
else
    echo "✅ 已构建"
fi

# 启动应用
echo "🎯 启动应用..."
echo ""
echo "应用信息:"
echo "  - 名称: Android Remote Control"
echo "  - 平台: Electron"
echo "  - 模式: 生产环境"
echo ""
echo "控制台输出:"
echo "------------------------------------------"

# 运行应用
npm start

# 应用退出后的处理
echo ""
echo "------------------------------------------"
echo "应用已退出"
echo ""
echo "其他命令:"
echo "  npm run dev    - 开发模式"
echo "  npm run build  - 构建应用"
echo "  npm test       - 运行测试"
echo ""
echo "感谢使用 Android Remote Control！"
