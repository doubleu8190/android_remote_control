#!/bin/bash

# Android Remote Control Python 后端服务启动脚本
# 用于启动 FastAPI 后端服务，供 Electron 应用连接

set -e

echo "🚀 启动 Python 后端服务"
echo "=========================================="

# 脚本所在目录即为项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/backend/.venv"
API_DIR="$SCRIPT_DIR/backend/api"
DATA_DIR="$SCRIPT_DIR/data"

echo "📂 项目路径: $SCRIPT_DIR"

# 检查 Python 版本
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ 未找到 Python，请安装 Python 3.11 或更高版本"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

echo "✅ Python 版本: $PYTHON_VERSION"

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
    echo "⚠️  推荐使用 Python 3.11 或更高版本"
fi

# 创建虚拟环境（如果不存在）
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 创建 Python 虚拟环境..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    echo "✅ 虚拟环境创建完成"
else
    echo "✅ 虚拟环境已存在"
fi

# 激活虚拟环境
source "$VENV_DIR/bin/activate"

# 安装依赖
if [ -f "$SCRIPT_DIR/backend/requirements.txt" ]; then
    echo "📦 安装 Python 依赖..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$SCRIPT_DIR/backend/requirements.txt"
    echo "✅ 依赖安装完成"
else
    echo "⚠️  未找到 requirements.txt"
fi

# 创建数据目录
if [ ! -d "$DATA_DIR" ]; then
    echo "📁 创建数据目录..."
    mkdir -p "$DATA_DIR"
    echo "✅ 数据目录已创建: $DATA_DIR"
else
    echo "✅ 数据目录已存在"
fi

# 设置环境变量
export SQLITE_DB_PATH="$DATA_DIR/ai_agent.db"
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
export PYTHONUNBUFFERED=1

echo ""
echo "🔧 配置信息:"
echo "  - API 端口: 8080"
echo "  - 数据库路径: $SQLITE_DB_PATH"
echo "  - 工作目录: $SCRIPT_DIR"
echo ""

# 启动后端服务
echo "🎯 启动后端服务..."
echo "------------------------------------------"

cd "$SCRIPT_DIR"
uvicorn backend.api.main:app \
    --host 0.0.0.0 \
    --port 8080 \
    --reload \
    --log-level info

# 服务退出后的处理
echo ""
echo "------------------------------------------"
echo "❌ 后端服务已停止"
echo ""
echo "其他命令:"
echo "  ./start-python-service.sh          - 启动服务"
echo ""
echo "后端服务信息:"
echo "  API 地址:    http://localhost:8080"
echo "  API 文档:    http://localhost:8080/docs"
echo "  健康检查:    http://localhost:8080/api/health"
echo ""
echo "感谢使用 Android Remote Control！"
