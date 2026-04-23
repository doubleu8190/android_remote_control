@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ===========================================
echo    Android Remote Control - Electron
echo ===========================================
echo.

REM 进入electron目录
cd /d "%~dp0electron"

REM 检查是否在electron目录
if not exist "package.json" (
    echo 错误：找不到 electron\package.json，请确保项目结构完整
    pause
    exit /b 1
)

REM 检查Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo 错误：Node.js未安装
    echo 请从 https://nodejs.org/ 安装 Node.js 18 或更高版本
    pause
    exit /b 1
)

REM 获取Node.js版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo Node.js版本: !NODE_VERSION!

REM 检查npm
where npm >nul 2>nul
if errorlevel 1 (
    echo 错误：npm未安装
    pause
    exit /b 1
)

REM 检查依赖
if not exist "node_modules" (
    echo 安装依赖...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，尝试使用镜像...
        call npm config set registry https://registry.npmmirror.com
        call npm cache clean --force
        call npm install
        if errorlevel 1 (
            echo 依赖安装失败
            pause
            exit /b 1
        )
    )
    echo 依赖安装完成
) else (
    echo 依赖已安装
)

REM 检查构建
if not exist "dist" (
    echo 构建应用...
    call npm run build
    if errorlevel 1 (
        echo 构建失败
        pause
        exit /b 1
    )
    echo 构建完成
) else (
    echo 已构建
)

echo.
echo 应用信息：
echo   - 名称: Android Remote Control
echo   - 版本: Electron桌面版
echo   - 模式: 生产环境
echo.
echo 按 Ctrl+C 停止应用
echo.

REM 启动应用
call npm start

echo.
echo 应用已退出
pause
