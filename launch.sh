#!/bin/bash

# ============================================
# Android Remote Control Electron 启动脚本
# 版本: 1.0.0
# ============================================

set -e

# 脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR/electron"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_banner() {
    echo -e "${BLUE}"
    echo "==========================================="
    echo "   Android Remote Control - Electron"
    echo "==========================================="
    echo -e "${NC}"
}

show_help() {
    echo "用法: ./launch.sh [选项]"
    echo ""
    echo "选项:"
    echo "  dev       启动 Electron 开发模式 (默认)"
    echo "  prod      启动 Electron 生产模式"
    echo "  backend   启动 Python 后端服务"
    echo "  all       启动 Python 后端 + Electron 应用"
    echo "  build     仅构建 Electron 应用"
    echo "  clean     清理构建文件和依赖"
    echo "  test      运行测试"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./launch.sh dev        # 启动 Electron 开发模式"
    echo "  ./launch.sh backend    # 启动 Python 后端服务"
    echo "  ./launch.sh all        # 启动全部服务"
    echo "  ./launch.sh            # 默认启动开发模式"
}

check_node_version() {
    log_info "检查 Node.js 版本..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        echo "请从 https://nodejs.org/ 安装 Node.js 18 或更高版本"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

    if [ $NODE_MAJOR_VERSION -lt 18 ]; then
        log_error "需要 Node.js 18 或更高版本，当前版本: $NODE_VERSION"
        exit 1
    fi

    log_success "Node.js 版本: $NODE_VERSION"
}

check_npm() {
    log_info "检查 npm..."

    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi

    NPM_VERSION=$(npm -v)
    log_success "npm 版本: $NPM_VERSION"
}

install_dependencies() {
    cd "$ELECTRON_DIR"
    log_info "检查依赖..."

    if [ ! -d "node_modules" ]; then
        log_warning "依赖未安装，开始安装..."
        npm install

        if [ $? -ne 0 ]; then
            log_error "依赖安装失败"

            log_info "尝试使用淘宝镜像..."
            npm config set registry https://registry.npmmirror.com
            npm cache clean --force
            npm install

            if [ $? -ne 0 ]; then
                log_error "使用镜像后依赖安装仍然失败"
                exit 1
            fi
        fi

        log_success "依赖安装完成"
    else
        log_success "依赖已安装"
    fi
}

clean_project() {
    cd "$ELECTRON_DIR"
    log_info "清理项目..."

    if [ -d "dist" ]; then
        rm -rf dist
        log_success "删除 dist 目录"
    fi

    if [ -d "release" ]; then
        rm -rf release
        log_success "删除 release 目录"
    fi

    if [ -d "node_modules" ]; then
        rm -rf node_modules
        log_success "删除 node_modules 目录"
    fi

    if [ -f "package-lock.json" ]; then
        rm package-lock.json
        log_success "删除 package-lock.json"
    fi

    log_success "项目清理完成"
}

build_app() {
    cd "$ELECTRON_DIR"
    log_info "构建应用..."

    install_dependencies

    npm run build

    if [ $? -ne 0 ]; then
        log_error "构建失败"

        log_info "尝试修复构建问题..."

        log_info "检查 TypeScript 错误..."
        npx tsc --noEmit

        log_info "检查 TailwindCSS 配置..."
        npx tailwindcss -o /dev/null

        log_info "重新尝试构建..."
        npm run build

        if [ $? -ne 0 ]; then
            log_error "构建仍然失败，请检查错误信息"
            exit 1
        fi
    fi

    log_success "应用构建完成"
}

start_dev() {
    cd "$ELECTRON_DIR"
    log_info "启动开发模式..."

    install_dependencies

    echo ""
    echo -e "${YELLOW}开发模式信息:${NC}"
    echo "  - 渲染进程: http://localhost:3000"
    echo "  - 热重载: 已启用"
    echo "  - 开发者工具: 自动打开"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止应用${NC}"
    echo ""

    npm run dev
}

start_prod() {
    cd "$ELECTRON_DIR"
    log_info "启动生产模式..."

    rm -rf 'dist'
    log_info "重新构建应用，开始构建..."
    build_app

    echo ""
    echo -e "${YELLOW}生产模式信息:${NC}"
    echo "  - 模式: 生产环境"
    echo "  - 性能: 优化"
    echo "  - 开发者工具: 禁用"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止应用${NC}"
    echo ""

    npm start
}

run_tests() {
    cd "$ELECTRON_DIR"
    log_info "运行测试..."

    install_dependencies

    if [ -f "test-app.js" ]; then
        node test-app.js
    else
        log_warning "测试脚本不存在，创建基本测试..."

        npm run build

        if [ $? -eq 0 ]; then
            log_success "构建测试通过"
        else
            log_error "构建测试失败"
            exit 1
        fi
    fi
}

start_backend() {
    log_info "启动 Python 后端服务..."

    PROJECT_ROOT="$SCRIPT_DIR"
    VENV_DIR="$PROJECT_ROOT/.venv"
    DATA_DIR="$PROJECT_ROOT/data"

    PYTHON_CMD=""
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        log_error "Python 未安装"
        exit 1
    fi

    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
    log_success "Python 版本: $PYTHON_VERSION"

    if [ ! -d "$VENV_DIR" ]; then
        log_warning "虚拟环境不存在，正在创建..."
        $PYTHON_CMD -m venv "$VENV_DIR"
        log_success "虚拟环境已创建"
    else
        log_success "虚拟环境已存在"
    fi

    source "$VENV_DIR/bin/activate"

    if [ ! -f "$PROJECT_ROOT/backend/requirements.txt" ]; then
        log_error "未找到 requirements.txt"
        exit 1
    fi

    log_info "安装 Python 依赖..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$PROJECT_ROOT/backend/requirements.txt"
    log_success "依赖安装完成"

    if [ ! -d "$DATA_DIR" ]; then
        mkdir -p "$DATA_DIR"
        log_success "数据目录已创建"
    fi

    export SQLITE_DB_PATH="$DATA_DIR/ai_agent.db"
    export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
    export PYTHONUNBUFFERED=1

    echo ""
    echo -e "${YELLOW}后端服务信息:${NC}"
    echo "  - API 地址: http://localhost:8080"
    echo "  - API 文档: http://localhost:8080/docs"
    echo "  - 健康检查: http://localhost:8080/api/health"
    echo "  - 数据库: $SQLITE_DB_PATH"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
    echo ""

    cd "$PROJECT_ROOT"
    uvicorn backend.api.main:app \
        --host 0.0.0.0 \
        --port 8080 \
        --reload \
        --log-level info
}

start_all() {
    log_info "启动全部服务 (Python 后端 + Electron)..."

    PROJECT_ROOT="$SCRIPT_DIR"

    log_info "启动 Python 后端服务..."
    "$PROJECT_ROOT/start-python-service.sh" &
    BACKEND_PID=$!
    log_success "后端服务已启动 (PID: $BACKEND_PID)"

    log_info "等待后端服务就绪..."
    BACKEND_READY=false
    for i in $(seq 1 20); do
        if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
            log_success "后端服务就绪"
            BACKEND_READY=true
            break
        fi
        if [ $i -eq 20 ]; then
            log_error "后端服务启动失败，无法启动 Electron 应用"
            log_error "请检查后端服务日志并手动启动"
            kill $BACKEND_PID 2>/dev/null || true
            exit 1
        fi
        log_info "等待中 ($i/20)..."
        sleep 1
    done
    
    if [ "$BACKEND_READY" = false ]; then
        log_error "后端服务启动失败"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi

    log_info "启动 Electron 应用..."
    echo ""
    echo -e "${YELLOW}服务信息:${NC}"
    echo "  - 后端 API: http://localhost:8080"
    echo "  - API 文档: http://localhost:8080/docs"
    echo "  - Electron: 桌面应用"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
    echo ""

    cd "$ELECTRON_DIR"
    install_dependencies

    rm -rf "dist"
    if [ ! -d "dist" ]; then
        build_app
    fi

    trap 'log_info "正在停止后端服务..."; kill $BACKEND_PID 2>/dev/null || true; exit 0' INT TERM

    npm start

    log_info "正在停止后端服务..."
    kill $BACKEND_PID 2>/dev/null || true
    log_success "所有服务已停止"
}

main() {
    show_banner

    check_node_version
    check_npm

    MODE=${1:-"dev"}

    case $MODE in
        "dev")
            start_dev
            ;;
        "prod")
            start_prod
            ;;
        "backend")
            start_backend
            ;;
        "all")
            start_all
            ;;
        "build")
            build_app
            ;;
        "clean")
            clean_project
            ;;
        "test")
            run_tests
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "未知选项: $MODE"
            show_help
            exit 1
            ;;
    esac
}

trap 'echo -e "\n${YELLOW}[INFO]${NC} 应用已停止"; exit 0' INT

main "$@"
