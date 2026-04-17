# AI Agent Platform

## 📋 项目概述

AI Agent Platform 是一个基于 Python 和 React 的智能代理系统，采用分层架构设计，提供用户认证、聊天会话管理和AI交互功能。该平台支持完整的用户注册/登录流程，实时聊天会话管理，以及与AI引擎的无缝集成。

- **分层架构**：Engine（引擎层）、Service（服务层）、API（接口层）、Frontend（前端）
- **完整的用户系统**：注册、登录、认证、记住密码功能
- **聊天会话管理**：创建、切换、删除会话，加载历史消息
- **AI集成**：基于LangChain框架的AI引擎集成
- **容器化部署**：使用Docker和Docker Compose实现快速部署

## 🚀 核心功能

### 用户认证系统
- ✅ 用户注册（用户名、邮箱、密码强度验证）
- ✅ 用户登录（支持"记住我"功能，7天有效期）
- ✅ JWT认证令牌管理
- ✅ 密码安全存储（SHA-256加密）

### 聊天会话管理
- ✅ 创建新会话
- ✅ 会话列表展示
- ✅ 会话切换
- ✅ 会话删除
- ✅ 历史消息加载
- ✅ 消息发送与接收

### 前端界面
- ✅ 响应式设计（支持桌面端和移动端）
- ✅ 深色/浅色模式切换
- ✅ 会话列表固定顶部的"New Chat Session"按钮
- ✅ 实时表单验证
- ✅ 加载状态和错误处理

### 后端API
- ✅ RESTful API设计
- ✅ FastAPI框架
- ✅ SQLite数据库集成
- ✅ 自动API文档（Swagger UI）
- ✅ CORS配置

## 🛠️ 技术栈

### 后端技术
| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11+ | 核心编程语言 |
| FastAPI | 最新 | Web框架 |
| SQLAlchemy | 最新 | ORM |
| SQLite | 最新 | 数据库 |
| LangChain | 最新 | AI框架 |
| JWT | 最新 | 认证 |
| Passlib | 最新 | 密码加密 |

### 前端技术
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18+ | 前端框架 |
| TypeScript | 最新 | 类型安全 |
| Tailwind CSS | 3+ | 样式框架 |
| React Router | 6+ | 路由管理 |
| Vite | 最新 | 构建工具 |

### 部署技术
| 技术 | 版本 | 用途 |
|------|------|------|
| Docker | 20+ | 容器化 |
| Docker Compose | 1.29+ | 多容器管理 |

## 📦 环境要求

### 开发环境
- **操作系统**：Linux / macOS / Windows
- **Docker**：20.10.0+ 或 Docker Desktop
- **Docker Compose**：1.29.0+
- **Node.js**：18.0.0+（仅前端开发）
- **Python**：3.11+（仅后端开发）

### 生产环境
- **Docker**：20.10.0+
- **Docker Compose**：1.29.0+
- **服务器配置**：2GB+ RAM，20GB+ 磁盘空间

## 📥 安装步骤

### 方法1：使用Docker Compose（推荐）

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/ai-agent-platform.git
   cd ai-agent-platform
   ```

2. **启动服务**
   ```bash
   docker-compose up -d
   ```

3. **访问应用**
   - 前端：http://localhost:5174
   - 后端API：http://localhost:8080
   - API文档：http://localhost:8080/docs

### 方法2：本地开发环境

#### 后端设置
1. **创建虚拟环境**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # Linux/macOS
   # 或 .venv\Scripts\activate  # Windows
   ```

2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **启动后端**
   ```bash
   uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
   ```

#### 前端设置
1. **安装依赖**
   ```bash
   cd frontend
   npm install
   ```

2. **启动前端**
   ```bash
   npm run dev
   ```

## 📖 使用指南

### 1. 首次访问
- 打开 http://localhost:5174
- 系统自动重定向到登录页面
- 使用默认管理员账户登录：
  - 用户名：`root`
  - 密码：`123456`

### 2. 注册新用户
1. 点击登录页面的"Create one"链接
2. 填写注册信息：
   - 用户名（3-50字符，字母、数字、下划线、连字符）
   - 邮箱（可选，标准邮箱格式）
   - 密码（8-128字符，包含大小写字母、数字、特殊字符）
3. 点击"Create Account"按钮
4. 注册成功后自动跳转到登录页面

### 3. 登录系统
1. 输入用户名和密码
2. 可选：勾选"Remember me"以在7天内自动登录
3. 点击"Sign In"按钮
4. 登录成功后自动跳转到聊天页面

### 4. 聊天会话管理
- **创建新会话**：点击左侧顶部的"New Chat Session"按钮
- **切换会话**：点击左侧会话列表中的会话
- **删除会话**：点击会话右侧的删除图标
- **发送消息**：在底部输入框中输入消息，按Enter或点击发送按钮

### 5. 界面功能
- **深色/浅色模式**：点击顶部的主题切换按钮
- **侧边栏折叠**：点击左侧顶部的折叠按钮
- **会话列表**：显示所有历史会话，支持滚动
- **消息状态**：显示消息发送状态和时间戳

## 📡 API文档

### 认证API
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 会话API
- `GET /api/sessions` - 获取会话列表
- `POST /api/sessions` - 创建新会话
- `GET /api/sessions/{session_id}` - 获取会话详情
- `PUT /api/sessions/{session_id}` - 更新会话
- `DELETE /api/sessions/{session_id}` - 删除会话
- `POST /api/sessions/{session_id}/rename` - 重命名会话

### 消息API
- `GET /api/messages/history/{session_id}` - 获取会话历史消息
- `POST /api/messages/send` - 发送消息

### WebSocket API
- `GET /api/ws/{session_id}` - 实时消息流

**完整API文档**：http://localhost:8080/docs

## 🤝 贡献规范

### 开发流程
1. **Fork** 项目仓库
2. **Clone** 到本地
3. **创建** 新分支（feature/your-feature-name）
4. **开发** 功能
5. **测试** 确保代码质量
6. **提交** 代码（遵循语义化提交规范）
7. **Push** 到远程分支
8. **创建** Pull Request

### 代码规范
- **Python**：遵循PEP 8规范，使用黑色格式化器
- **TypeScript**：遵循ESLint规则，使用Prettier格式化
- **提交信息**：使用语义化提交格式
  - `feat: ` 新功能
  - `fix: ` 修复bug
  - `docs: ` 文档更新
  - `refactor: ` 代码重构
  - `test: ` 测试相关

### 测试要求
- 所有新功能必须包含单元测试
- 确保测试覆盖率不低于80%
- 提交前运行完整测试套件

## 📄 许可证

本项目采用 **MIT License** 开源协议。详见 [LICENSE](LICENSE) 文件。

## 📞 联系方式

### 项目维护者
- **Name**: DoubleU
- **Email**: doubleu8190@gmail.com
- **GitHub**: [@your-github-username](https://github.com/your-github-username)

### 问题反馈
- **Bug 报告**：使用 GitHub Issues
- **功能请求**：使用 GitHub Issues
- **代码贡献**：使用 Pull Requests

## 📊 项目结构

```
ai-agent-platform/
├── api/                  # 后端API
│   ├── auth.py           # 认证相关API
│   ├── sessions.py       # 会话管理API
│   ├── messages.py       # 消息相关API
│   ├── database.py       # 数据库配置
│   ├── models.py         # 数据模型
│   ├── models_db.py      # 数据库模型
│   ├── main.py           # 应用入口
│   └── __init__.py
├── engine/               # AI引擎层
│   ├── engine.py         # 引擎核心
│   └── __init__.py
├── service/              # 服务层
│   ├── llm_service.py    # 大模型服务
│   ├── context_compression.py  # 上下文压缩
│   ├── mcp_protocol.py   # MCP协议
│   └── __init__.py
├── frontend/             # 前端应用
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── context/       # 上下文
│   │   ├── services/      # API服务
│   │   ├── types/         # TypeScript类型
│   │   ├── App.tsx        # 应用入口
│   │   └── main.tsx        # 渲染入口
│   ├── package.json       # 依赖配置
│   └── vite.config.ts     # Vite配置
├── .dockerignore         # Docker忽略文件
├── .gitignore            # Git忽略文件
├── Dockerfile            # 后端Dockerfile
├── docker-compose.yml    # Docker Compose配置
├── requirements.txt      # Python依赖
└── README.md             # 项目文档
```

## 🌟 特色功能

- **智能路由守卫**：确保用户必须登录才能访问聊天功能
- **实时表单验证**：提供即时反馈，提升用户体验
- **密码强度指示器**：帮助用户创建安全密码
- **会话列表固定顶部**：方便用户快速创建新会话
- **Docker容器化**：一键部署，环境一致性
- **自动API文档**：交互式API文档，便于集成
- **数据持久化**：SQLite数据库持久存储
- **响应式设计**：适配各种设备屏幕

## 📈 性能优化

- **前端**：使用React.memo、useCallback、useMemo优化渲染
- **后端**：FastAPI异步处理，SQLAlchemy ORM优化
- **数据库**：SQLite文件存储，轻量级高效
- **部署**：Docker容器隔离，资源限制配置

## 🛡️ 安全措施

- **密码加密**：SHA-256 Crypt哈希存储
- **XSS防护**：HTML转义，输入清理
- **SQL注入防护**：SQLAlchemy参数化查询
- **JWT认证**：安全的令牌管理
- **CORS配置**：安全的跨域请求
- **输入验证**：Pydantic模型验证

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/your-username/ai-agent-platform.git
cd ai-agent-platform

# 启动服务
docker-compose up -d

# 访问
# 前端: http://localhost:5174
# 后端: http://localhost:8080
# API文档: http://localhost:8080/docs

# 停止服务
docker-compose down
```

## 📝 版本历史

- **v1.0.0** (2026-04-17)
  - 初始版本
  - 完整的用户认证系统
  - 聊天会话管理
  - AI引擎集成
  - Docker容器化部署

## 🔮 未来规划

- [ ] 支持多AI模型切换
- [ ] 消息历史导出功能
- [ ] 语音输入/输出
- [ ] 聊天机器人训练
- [ ] 多语言支持
- [ ] 实时协作功能

---

**感谢使用 AI Agent Platform！** 🎉

如有任何问题或建议，欢迎联系我们。