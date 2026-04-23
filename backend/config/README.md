# 配置文件说明

本目录包含 AI Agent 平台的配置文件，用于管理引擎相关的所有配置参数。

## 配置文件结构

```
config/
├── engine_config.yaml  # 引擎配置文件
├── config_loader.py    # 配置加载器
└── README.md           # 配置说明文档
```

## 配置文件格式

配置文件采用 YAML 格式，包含以下主要部分：

### 1. 基础设置 (`base`)
- `engine`: 引擎管理设置，包括每个用户的最大会话数、会话超时时间等
- `logging`: 日志设置，包括日志级别、日志文件路径等

### 2. LLM 配置 (`llm`)
- `openai`: OpenAI 模型配置，包括 API 密钥、模型名称、温度参数等
- `fallback`: 回退 LLM 配置，当主 LLM 初始化失败时使用

### 3. 工具配置 (`tools`)
- `calculator`: 计算器工具配置
- `mcp`: MCP 服务工具配置

### 4. 上下文压缩配置 (`context_compression`)
- `strategies`: 五步压缩策略配置，包括大结果存磁盘、砍掉远古消息、裁剪老的工具输出、读时投影、全量摘要

### 5. 服务层配置 (`service`)
- 各服务的启用状态

## 环境变量支持

配置文件支持环境变量替换，格式为 `${环境变量名}`。例如：

```yaml
api_key: "${OPENAI_API_KEY}"
```

## 配置加载

使用 `config_loader.py` 中的 `config` 实例加载配置：

```python
from config.config_loader import config

# 获取配置值
model_name = config.get_config("llm.openai.model_name")
temperature = config.get_config("llm.openai.temperature")

# 获取嵌套配置
openai_config = config.get_config("llm.openai")

# 获取默认值
api_key = config.get_config("llm.openai.api_key", "default_key")
```

## 配置项说明

### 基础设置
- `base.engine.max_sessions_per_user`: 每个用户的最大会话数
- `base.engine.session_timeout`: 会话超时时间（秒）
- `base.engine.cleanup_interval`: 清理过期会话的间隔时间（秒）
- `base.logging.level`: 日志级别（DEBUG, INFO, WARNING, ERROR, CRITICAL）
- `base.logging.file`: 日志文件路径
- `base.logging.rotation`: 日志文件轮换大小

### LLM 配置
- `llm.openai.api_key`: OpenAI API 密钥
- `llm.openai.model_name`: 模型名称（如 gpt-3.5-turbo, gpt-4 等）
- `llm.openai.temperature`: 温度参数（0-1），控制输出的随机性
- `llm.openai.max_tokens`: 最大令牌数，控制输出的长度
- `llm.openai.timeout`: API 请求超时时间（秒）
- `llm.openai.max_retries`: 最大重试次数

### 上下文压缩配置
- `context_compression.strategies.disk_storage.single_tool_limit`: 单个工具结果大小限制（字节）
- `context_compression.strategies.disk_storage.total_message_limit`: 单条消息总大小限制（字节）
- `context_compression.strategies.disk_storage.preview_size`: 预览摘要大小（字节）
- `context_compression.strategies.ancient_message.max_message_age`: 消息最大年龄（秒）
- `context_compression.strategies.read_time_projection.threshold_normal`: 正常压缩阈值（上下文窗口的比例）
- `context_compression.strategies.read_time_projection.threshold_emergency`: 紧急压缩阈值（上下文窗口的比例）

## 修改配置

要修改配置，只需编辑 `engine_config.yaml` 文件，然后重启应用程序即可。

## 注意事项

1. API 密钥等敏感信息应通过环境变量设置，避免直接硬编码在配置文件中
2. 配置文件的修改会在应用程序重启后生效
3. 对于生产环境，建议使用更安全的方式管理敏感配置，如使用密钥管理服务
