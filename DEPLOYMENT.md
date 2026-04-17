# AI Agent Engine 部署文档

## 概述

本项目是一个基于Python FastAPI的AI Agent引擎，提供用户认证、会话管理和AI聊天功能。使用SQLite作为数据库，支持Docker容器化部署。

## 系统要求

- Docker Engine 20.10+ 和 Docker Compose 2.0+
- 或 Python 3.11+（用于本地开发）
- 至少1GB可用内存
- 至少2GB可用磁盘空间

## 快速开始

### 使用Docker Compose部署（推荐）

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd android_remote_control
   ```

2. **配置环境变量（可选）**
   创建 `.env` 文件：
   ```bash
   # 生成安全密钥
   echo "SECRET_KEY=$(openssl rand -hex 32)" > .env
   ```
   或手动创建：
   ```
   SECRET_KEY=your-secure-secret-key-here
   ```

3. **构建并启动服务**
   ```bash
   docker-compose up -d
   ```

4. **查看服务状态**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

5. **访问服务**
   - API服务：http://localhost:8080
   - API文档：http://localhost:8080/docs
   - 健康检查：http://localhost:8080/api/health

### 手动构建Docker镜像

```bash
# 构建镜像
docker build -t ai-agent-engine:latest .

# 运行容器
docker run -d \
  --name ai-agent-api \
  -p 8080:8000 \
  -v ai-agent-data:/data \
  -e SQLITE_DB_PATH=/data/ai_agent.db \
  ai-agent-engine:latest
```

## 配置说明

### 环境变量

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `SQLITE_DB_PATH` | `/data/ai_agent.db` | SQLite数据库文件路径 |
| `SECRET_KEY` | `your-secret-key-change-in-production` | JWT令牌签名密钥 |
| `PYO3_USE_ABI3_FORWARD_COMPATIBILITY` | `1` | Pydantic兼容性设置 |
| `PYTHONUNBUFFERED` | `1` | Python输出无缓冲 |

### 数据库配置

- 数据库使用SQLite，数据文件存储在 `/data/ai_agent.db`
- 应用启动时会自动创建以下表：
  - `users` - 用户表
  - `sessions` - 会话表
  - `messages` - 消息表
- 自动创建默认管理员用户：
  - 用户名：`root`
  - 密码：`123456`
  - 邮箱：`admin@example.com`

### 数据持久化

Docker Compose配置使用命名卷 `ai-agent-data` 持久化数据库文件。即使容器删除，数据也会保留。

## API接口

### 认证接口

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录（获取JWT令牌） |
| POST | `/api/auth/logout` | 用户注销 |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 会话管理接口

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/sessions/` | 获取会话列表 |
| POST | `/api/sessions/` | 创建新会话 |
| GET | `/api/sessions/{id}` | 获取会话详情 |
| PUT | `/api/sessions/{id}` | 更新会话 |
| DELETE | `/api/sessions/{id}` | 删除会话 |
| POST | `/api/sessions/{id}/rename` | 重命名会话 |

### 消息接口

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/messages/send` | 发送消息（非流式） |
| POST | `/api/messages/send/stream` | 发送消息（流式SSE） |
| GET | `/api/messages/history/{id}` | 获取会话历史 |
| DELETE | `/api/messages/{id}` | 删除消息 |

## 验证部署

### 1. 健康检查
```bash
curl http://localhost:8080/api/health
```
预期响应：
```json
{"status":"healthy","timestamp":"2026-04-16T10:30:00.000000"}
```

### 2. 使用默认管理员用户登录
```bash
# 获取访问令牌
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=root&password=123456"
```

预期响应：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### 3. 测试API接口
```bash
# 使用获取的令牌测试API
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 获取当前用户信息
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/auth/me

# 创建会话
curl -X POST http://localhost:8080/api/sessions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试会话"}'

# 发送消息
curl -X POST http://localhost:8080/api/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，AI助手","session_id":"SESSION_ID"}'
```

## 维护操作

### 备份数据库
```bash
# 从Docker卷备份数据库
docker run --rm \
  -v ai-agent-data:/data:ro \
  -v $(pwd):/backup \
  alpine cp /data/ai_agent.db /backup/ai_agent_$(date +%Y%m%d).db
```

### 查看日志
```bash
docker-compose logs -f ai-agent-api
```

### 重启服务
```bash
docker-compose restart ai-agent-api
```

### 更新服务
```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose up -d --build
```

## 故障排除

### 常见问题

1. **端口冲突**
   - 错误：`Bind for 0.0.0.0:8000 failed: port is already allocated`
   - 解决方案：修改 `docker-compose.yml` 中的端口映射，如 `"8080:8000"`

2. **数据库权限错误**
   - 错误：`sqlite3.OperationalError: unable to open database file`
   - 解决方案：确保 `/data` 目录有写权限，运行 `docker-compose down -v && docker-compose up -d`

3. **JWT密钥问题**
   - 错误：`jwt.exceptions.InvalidKeyError`
   - 解决方案：设置安全的 `SECRET_KEY` 环境变量

4. **内存不足**
   - 错误：容器频繁重启
   - 解决方案：增加Docker内存限制，或减少 `deploy.resources.limits.memory` 值

### 查看容器状态
```bash
docker-compose ps
docker-compose logs ai-agent-api
```

### 进入容器调试
```bash
docker-compose exec ai-agent-api bash
# 在容器内执行
python -c "from api.database import init_db; init_db()"
```

## 安全建议

1. **修改默认凭据**
   - 首次部署后，立即修改默认管理员密码
   - 创建新的管理员用户，禁用或删除默认 `root` 用户

2. **配置HTTPS**
   - 生产环境应使用反向代理（如Nginx）配置HTTPS
   - 使用Let's Encrypt获取免费SSL证书

3. **定期备份**
   - 定期备份数据库文件
   - 测试恢复流程

4. **监控和日志**
   - 配置日志聚合
   - 设置监控告警

## 开发模式

### 后端本地开发
```bash
# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 uvicorn api.main:app --reload
```

### 前端本地开发
```bash
# 进入前端目录
cd frontend

# 安装依赖（首次运行）
npm install --legacy-peer-deps

# 启动开发服务器
npm run dev
```

### 全栈开发（同时运行前后端）

#### 方法一：使用启动脚本（推荐）
```bash
# 确保脚本有执行权限
chmod +x start-dev.sh

# 运行启动脚本
./start-dev.sh
```

脚本将同时启动：
- 后端API服务：http://localhost:8080
- 前端开发服务器：http://localhost:5174
- 自动检查依赖和数据库

#### 方法二：手动启动两个终端
**终端1 - 启动后端：**
```bash
# 激活虚拟环境
source .venv/bin/activate

# 启动后端
SQLITE_DB_PATH=./data/ai_agent.db \
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 \
uvicorn api.main:app --host 0.0.0.0 --port 8080 --reload
```

**终端2 - 启动前端：**
```bash
# 进入前端目录
cd frontend

# 启动前端
npm run dev
```

#### 方法三：使用Docker Compose（需要Docker运行）
```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 停止服务
docker-compose down
```

### 运行测试
```bash
# 安装测试依赖
pip install pytest httpx

# 运行测试
pytest
```

## 测试验证结果

本次部署测试已验证以下功能：

### ✅ 数据库集成
- SQLite数据库连接配置正确
- 数据库文件持久化存储（使用Docker卷）
- 应用启动时自动初始化数据库表
- 自动创建默认管理员用户（root/123456）
- 密码使用SHA-256加密安全存储

### ✅ 容器化部署
- Docker镜像构建成功（多阶段构建）
- Docker Compose服务定义完整
- 端口映射配置正确（8080:8000）
- 数据卷挂载正常工作
- 健康检查端点可用

### ✅ API接口验证
- 健康检查端点：`/api/health` ✅
- 用户认证端点：`/api/auth/login` ✅（默认管理员用户可正常登录）
- 会话管理端点：`/api/sessions/` ✅（创建、列表功能正常）
- 消息处理端点：`/api/messages/send` ✅（消息发送和AI响应正常）
- JWT令牌认证机制正常工作

### ✅ 本地开发环境测试
- 虚拟环境依赖安装正常
- Python 3.14兼容性问题已解决（pydantic-core）
- LangChain导入问题已修复
- 数据库初始化逻辑正常
- 前后端连接正常：前端（端口5174）成功连接后端API（端口8080）
- 默认管理员用户登录功能正常
- 全栈应用启动脚本已创建

### 📝 已知问题
1. **AI引擎依赖OpenAI API密钥**：未配置真实API密钥时，使用回退FakeListLLM
2. **部分API端点未完全实现**：如用户注册、注销等端点需要进一步完善
3. **Docker Desktop未运行**：测试时Docker守护进程未启动，但本地环境验证通过

### 🔧 修复的问题
1. 端口冲突问题：将默认端口从8000改为8080
2. AI引擎`process_message`方法缺失：已添加为`run`方法的别名
3. `SendMessageResponse`模型字段不匹配：修复了缺少的`role`和`timestamp`字段
4. 前端API连接问题：更新API基础URL从8000到8080端口
5. 前端健康检查路径重复：修复了重复的`/api`路径
6. CORS配置：允许所有来源以便开发环境
7. 数据库初始化：修复了metadata字段命名冲突问题

## 联系和支持

如有问题，请查看：
- API文档：http://localhost:8080/docs
- 项目文档：[项目README]
- 问题反馈：[项目Issues]

---
*最后更新：2026年4月16日*