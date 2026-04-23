#!/bin/bash

# AI Agent 全栈开发环境启动脚本
# 同时启动后端API服务和前端开发服务器

set -e  # 遇到错误时退出

echo "🚀 启动 AI Agent 全栈开发环境"
echo "=================================="

# 检查依赖
echo "🔍 检查依赖..."

# 检查Python虚拟环境
if [ ! -d ".venv" ]; then
    echo "❌ Python虚拟环境不存在，请先运行: python -m venv .venv"
    echo "   然后安装依赖: source .venv/bin/activate && pip install -r backend/requirements.txt"
    exit 1
fi

# 检查前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  前端依赖未安装，正在安装..."
    cd frontend
    npm install --legacy-peer-deps
    cd ..
fi

# 检查数据库目录
if [ ! -d "data" ]; then
    echo "📁 创建数据库目录..."
    mkdir -p data
fi

echo "✅ 依赖检查完成"
echo ""

# 定义清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止所有服务..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ 服务已停止"
    exit 0
}

# 捕获退出信号
trap cleanup INT TERM

# 启动后端服务
echo "🔧 启动后端API服务 (端口: 8080)..."
cd /Users/doubleu/Documents/trae_projects/android_remote_control
SQLITE_DB_PATH=./data/ai_agent.db \
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 \
.venv/bin/uvicorn backend.api.main:app --host 0.0.0.0 --port 8080 --reload &
BACKEND_PID=$!

echo "📊 后端PID: $BACKEND_PID"
echo "⏳ 等待后端服务启动..."

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if curl -s http://localhost:8080/api/health > /dev/null; then
    echo "✅ 后端API服务启动成功"
    echo "   📍 API地址: http://localhost:8080"
    echo "   📍 API文档: http://localhost:8080/docs"
else
    echo "❌ 后端API服务启动失败"
    exit 1
fi

echo ""

# 启动前端服务
echo "🎨 启动前端开发服务器 (端口: 5174)..."
cd /Users/doubleu/Documents/trae_projects/android_remote_control/frontend
npm run dev &
FRONTEND_PID=$!

echo "📊 前端PID: $FRONTEND_PID"
echo "⏳ 等待前端服务启动..."

# 等待前端启动
sleep 5

# 检查前端是否启动成功
if curl -s http://localhost:5174 > /dev/null; then
    echo "✅ 前端开发服务器启动成功"
    echo "   📍 前端地址: http://localhost:5174"
else
    echo "⚠️  前端服务可能启动较慢，请稍后访问 http://localhost:5174"
fi

echo ""
echo "=================================="
echo "🎉 AI Agent 全栈开发环境已启动！"
echo ""
echo "📌 服务地址:"
echo "   前端: http://localhost:5174"
echo "   后端API: http://localhost:8080"
echo "   API文档: http://localhost:8080/docs"
echo ""
echo "🔑 默认管理员账户:"
echo "   用户名: root"
echo "   密码: 123456"
echo ""
echo "📁 数据库文件: ./data/ai_agent.db"
echo ""
echo "🛑 按 Ctrl+C 停止所有服务"
echo "=================================="

# 等待用户中断
wait