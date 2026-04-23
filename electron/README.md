# Android Remote Control - Electron 桌面应用

这是一个基于 Electron 技术栈的 Android 远程控制桌面应用程序，旨在提供与现有 Web 页面完全一致的视觉展示效果和用户交互体验。

## 功能特性

- 🖥️ **跨平台支持**: Windows、macOS、Linux 全平台支持
- 🎨 **一致视觉体验**: 与 Web 版本完全相同的页面布局、色彩方案、字体样式
- ⚡ **高性能**: 保持与 Web 版本相同的性能表现
- 🔄 **响应式设计**: 自适应不同屏幕尺寸
- 🌙 **暗色模式**: 支持系统级暗色模式切换
- 🎯 **原生体验**: 系统托盘、应用菜单、快捷键等原生功能
- 📱 **设备管理**: Android 设备会话管理
- 🎮 **远程控制**: 实时设备屏幕镜像和控制

## 项目结构

```
electron/
├── src/
│   ├── main/           # 主进程代码
│   │   ├── main.ts     # 主进程入口
│   │   └── preload.ts  # 预加载脚本
│   ├── renderer/       # 渲染进程代码
│   │   ├── App.tsx     # 主应用组件
│   │   ├── AppRouter.tsx # 路由配置
│   │   ├── main.tsx    # 渲染进程入口
│   │   └── index.css   # 全局样式
│   └── shared/         # 共享代码
├── public/             # 静态资源
├── package.json        # 项目配置
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Vite 配置
├── tailwind.config.js  # TailwindCSS 配置
└── README.md           # 说明文档
```

## 技术栈

- **Electron**: 桌面应用框架
- **React 18**: 用户界面库
- **TypeScript**: 类型安全的 JavaScript
- **Vite**: 构建工具和开发服务器
- **TailwindCSS**: 实用优先的 CSS 框架
- **React Router**: 客户端路由

## 开发环境设置

### 前提条件

- Node.js 18+ 
- npm 或 yarn

### 安装依赖

```bash
cd electron
npm install
```

### 开发模式

```bash
npm run dev
```

这将同时启动：
- 渲染进程开发服务器 (http://localhost:3000)
- 主进程 TypeScript 编译器
- Electron 应用

### 构建应用

```bash
npm run build
```

### 运行应用

```bash
npm start
```

### 打包应用

#### macOS
```bash
npm run package:mac
```

#### Windows
```bash
npm run package:win
```

#### Linux
```bash
npm run package:linux
```

## 跨平台一致性

为确保在不同操作系统上的展示一致性，本项目实现了：

### 1. 样式一致性
- 使用相同的 TailwindCSS 配置
- 统一的颜色方案和字体
- 一致的动画效果
- 响应式布局适配

### 2. 平台适配
- **macOS**: 原生菜单栏、Dock 图标
- **Windows**: 系统托盘、任务栏图标
- **Linux**: AppImage、deb、rpm 包支持

### 3. 功能特性
- 系统托盘支持
- 全局快捷键
- 文件系统访问
- 网络请求处理
- 本地存储

## 与 Web 版本的集成

### 现有组件复用
Electron 应用可以直接复用现有 Web 项目的以下组件：

1. **React 组件**: ChatContainer、MessageList、MessageInput 等
2. **样式系统**: TailwindCSS 配置和自定义样式
3. **类型定义**: TypeScript 接口和类型
4. **路由配置**: 页面路由结构

### 差异处理
1. **路由**: 使用 `HashRouter` 替代 `BrowserRouter`
2. **API 通信**: 通过 `electronAPI` 桥接主进程和渲染进程
3. **本地功能**: 文件系统访问、系统托盘等 Electron 特有功能

## 性能优化

### 1. 构建优化
- Vite 快速构建和热重载
- 代码分割和懒加载
- Tree-shaking 移除未使用代码

### 2. 运行时优化
- React 18 并发特性
- 虚拟列表和懒加载
- 内存泄漏预防

### 3. 网络优化
- 本地资源加载
- 缓存策略
- 请求合并

## 部署

### 开发环境
```bash
npm run dev
```

### 生产环境
```bash
npm run build
npm run package
```

### 自动更新
应用支持自动更新检查，可以通过配置 electron-builder 实现自动更新功能。

## 故障排除

### 常见问题

1. **依赖安装失败**
   - 检查网络连接
   - 清除 npm 缓存: `npm cache clean --force`
   - 使用淘宝镜像: `npm config set registry https://registry.npmmirror.com`

2. **构建错误**
   - 确保 TypeScript 配置正确
   - 检查依赖版本兼容性
   - 查看详细的错误日志

3. **运行错误**
   - 检查主进程和渲染进程的通信
   - 验证 preload 脚本配置
   - 查看开发者工具控制台输出

### 调试

#### 主进程调试
```bash
npm run dev
# 在代码中添加 debugger 语句
```

#### 渲染进程调试
- 开发模式下自动打开开发者工具
- 使用 React Developer Tools
- 查看网络请求和性能分析

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License