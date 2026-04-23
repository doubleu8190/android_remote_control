# Android Remote Control Electron 启动指南

## 📋 概述

本文档提供了多种启动 Android Remote Control Electron 应用的方法。根据你的操作系统和需求，选择最适合的启动方式。

## 🚀 快速开始

### 方法1：使用快速启动脚本（推荐）

```bash
# 在项目根目录运行快速启动脚本
./run.sh
```

### 方法2：使用功能完整的启动脚本

```bash
# 查看所有选项
./launch.sh help

# 启动开发模式（默认）
./launch.sh dev

# 启动生产模式
./launch.sh prod

# 仅构建应用
./launch.sh build

# 清理项目
./launch.sh clean

# 运行测试
./launch.sh test
```

### 方法3：手动启动

```bash
# 1. 进入 electron 目录
cd electron

# 2. 安装依赖（如果未安装）
npm install

# 3. 构建应用
npm run build

# 4. 启动应用
npm start

# 或者直接启动开发模式
npm run dev
```

## 🖥️ 跨平台支持

### macOS / Linux
```bash
# 使用shell脚本
./launch.sh dev
./run.sh
```

### Windows
```bat
# 使用批处理脚本
.\launch.bat
```

## 🔧 启动脚本功能对比

| 脚本名称 | 功能特点 | 适用场景 |
|---------|---------|---------|
| `run.sh` | 简单快速，自动检查依赖和构建 | 日常快速启动 |
| `launch.sh` | 功能完整，支持多种模式，彩色输出 | 开发调试，多种操作 |
| `launch.bat` | Windows兼容，基本功能 | Windows系统使用 |
| `start.sh` | 原始版本，基础功能 | 兼容性要求 |

## 📁 脚本文件说明

### 1. `run.sh` - 快速启动脚本
- **特点**：最简单，最快速
- **功能**：
  - 自动检查Node.js
  - 自动安装依赖
  - 自动构建应用
  - 启动生产模式
- **使用**：`./run.sh`

### 2. `launch.sh` - 功能完整脚本
- **特点**：功能最完整，支持多种模式
- **功能**：
  - 彩色输出，更好的用户体验
  - 支持开发/生产/构建/清理/测试模式
  - 自动修复常见问题
  - 详细的错误处理
- **使用**：`./launch.sh [模式]`

### 3. `launch.bat` - Windows启动脚本
- **特点**：Windows系统专用
- **功能**：
  - 兼容Windows命令行
  - 中文支持
  - 基本依赖检查和构建
- **使用**：双击运行或`launch.bat`

### 4. `start.sh` - 原始启动脚本
- **特点**：最初的启动脚本
- **功能**：基础启动功能
- **使用**：`./start.sh`

## 🛠️ 故障排除

### 常见问题1：权限不足
```bash
# 给脚本添加执行权限
chmod +x launch.sh run.sh start.sh
```

### 常见问题2：Node.js版本过低
```bash
# 检查Node.js版本
node -v

# 需要Node.js 18或更高版本
# 从 https://nodejs.org/ 下载安装
```

### 常见问题3：依赖安装失败
```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 清理缓存
npm cache clean --force

# 重新安装
npm install
```

### 常见问题4：构建失败
```bash
# 清理并重新构建
rm -rf electron/dist electron/node_modules
cd electron
npm install
npm run build
```

## 🎯 不同场景的启动建议

### 场景1：日常使用
```bash
# 使用快速启动脚本
./run.sh
```

### 场景2：开发调试
```bash
# 使用开发模式，支持热重载
./launch.sh dev
# 或
cd electron && npm run dev
```

### 场景3：测试构建
```bash
# 仅构建不运行
./launch.sh build
```

### 场景4：清理项目
```bash
# 清理所有构建文件和依赖
./launch.sh clean
```

## 🔍 调试信息

### 查看详细日志
```bash
# 开发模式下查看控制台输出
cd electron && npm run dev

# 生产模式下如果有问题，检查错误日志
```

### 检查应用状态
```bash
# 运行测试脚本
cd electron && node test-app.js

# 检查项目结构
ls -la
```

## 📝 环境要求

### 必需软件
1. **Node.js 18+** - JavaScript运行时
2. **npm** - Node.js包管理器
3. **Git** - 版本控制（可选）

### 推荐工具
1. **Visual Studio Code** - 代码编辑器
2. **Chrome DevTools** - 调试工具
3. **React Developer Tools** - React调试

## 🆘 获取帮助

### 查看脚本帮助
```bash
./launch.sh help
```

### 查看项目文档
```bash
cat README.md
```

### 运行诊断
```bash
cd electron && node test-app.js
```

## 🔄 更新脚本

如果需要更新启动脚本，可以：

1. 直接编辑脚本文件（位于项目根目录）
2. 从项目仓库获取最新版本
3. 根据错误信息调整脚本

## 📞 支持

如果遇到无法解决的问题：

1. 检查错误信息
2. 查看控制台输出
3. 参考Electron官方文档
4. 检查项目issue

---

**提示**：建议使用 `./launch.sh dev` 进行开发，使用 `./run.sh` 进行日常快速启动。
